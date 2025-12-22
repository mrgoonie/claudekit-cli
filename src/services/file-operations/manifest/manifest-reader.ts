import { join } from "node:path";
import {
	detectMetadataFormat,
	getAllTrackedFiles,
	getKitMetadata,
} from "@/domains/migration/metadata-migration.js";
import { logger } from "@/shared/logger.js";
import type { KitMetadata, KitType, Metadata } from "@/types";
import { MetadataSchema, USER_CONFIG_PATTERNS } from "@/types";
import { pathExists, readFile } from "fs-extra";

/**
 * Result of getUninstallManifest
 */
export interface UninstallManifestResult {
	filesToRemove: string[];
	filesToPreserve: string[];
	hasManifest: boolean;
	isMultiKit: boolean;
	remainingKits: KitType[];
}

/**
 * Read manifest from existing metadata.json
 * @param claudeDir - Path to .claude directory
 * @returns Metadata with manifest or null if not found
 */
export async function readManifest(claudeDir: string): Promise<Metadata | null> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) {
		return null;
	}

	try {
		const content = await readFile(metadataPath, "utf-8");
		const parsed = JSON.parse(content);
		return MetadataSchema.parse(parsed);
	} catch (error) {
		logger.debug(`Failed to read manifest: ${error}`);
		return null;
	}
}

/**
 * Read kit-specific manifest from metadata.json
 * @param claudeDir - Path to .claude directory
 * @param kit - Kit type to read
 * @returns Kit metadata or null if not found
 */
export async function readKitManifest(
	claudeDir: string,
	kit: KitType,
): Promise<KitMetadata | null> {
	const metadata = await readManifest(claudeDir);
	if (!metadata) return null;
	return getKitMetadata(metadata, kit);
}

/**
 * Get files to remove during uninstall based on manifest (multi-kit aware)
 * Falls back to legacy hardcoded list if no manifest exists
 * @param claudeDir - Path to .claude directory
 * @param kit - Optional kit type for kit-scoped uninstall
 * @returns Object with files to remove and files to preserve
 */
export async function getUninstallManifest(
	claudeDir: string,
	kit?: KitType,
): Promise<UninstallManifestResult> {
	const detection = await detectMetadataFormat(claudeDir);

	// Multi-kit format
	if (detection.format === "multi-kit" && detection.metadata?.kits) {
		const installedKits = Object.keys(detection.metadata.kits) as KitType[];

		// Kit-scoped uninstall
		if (kit) {
			const kitMeta = detection.metadata.kits[kit];
			if (!kitMeta?.files) {
				return {
					filesToRemove: [],
					filesToPreserve: USER_CONFIG_PATTERNS,
					hasManifest: true,
					isMultiKit: true,
					remainingKits: installedKits.filter((k) => k !== kit),
				};
			}

			// Get files for this kit only
			const kitFiles = kitMeta.files.map((f) => f.path);

			// Check for shared files with other kits (preserve them)
			const sharedFiles = new Set<string>();
			for (const otherKit of installedKits) {
				if (otherKit !== kit) {
					const otherMeta = detection.metadata.kits[otherKit];
					if (otherMeta?.files) {
						for (const f of otherMeta.files) {
							sharedFiles.add(f.path);
						}
					}
				}
			}

			const filesToRemove = kitFiles.filter((f) => !sharedFiles.has(f));
			const filesToPreserve = [
				...USER_CONFIG_PATTERNS,
				...kitFiles.filter((f) => sharedFiles.has(f)),
			];

			return {
				filesToRemove,
				filesToPreserve,
				hasManifest: true,
				isMultiKit: true,
				remainingKits: installedKits.filter((k) => k !== kit),
			};
		}

		// Full uninstall - all kits
		const allFiles = getAllTrackedFiles(detection.metadata);
		return {
			filesToRemove: allFiles.map((f) => f.path),
			filesToPreserve: USER_CONFIG_PATTERNS,
			hasManifest: true,
			isMultiKit: true,
			remainingKits: [],
		};
	}

	// Legacy format
	if (detection.format === "legacy" && detection.metadata) {
		const legacyFiles = detection.metadata.files?.map((f) => f.path) || [];
		const installedFiles = detection.metadata.installedFiles || [];
		const hasFiles = legacyFiles.length > 0 || installedFiles.length > 0;

		// If no files tracked, fall through to legacy hardcoded directories
		if (!hasFiles) {
			const legacyDirs = ["commands", "agents", "skills", "workflows", "hooks", "scripts"];
			const legacyFileList = ["metadata.json"];
			return {
				filesToRemove: [...legacyDirs, ...legacyFileList],
				filesToPreserve: USER_CONFIG_PATTERNS,
				hasManifest: false,
				isMultiKit: false,
				remainingKits: [],
			};
		}

		return {
			filesToRemove: legacyFiles.length > 0 ? legacyFiles : installedFiles,
			filesToPreserve: detection.metadata.userConfigFiles || USER_CONFIG_PATTERNS,
			hasManifest: true,
			isMultiKit: false,
			remainingKits: [],
		};
	}

	// No manifest - fallback to legacy hardcoded directories
	const legacyDirs = ["commands", "agents", "skills", "workflows", "hooks", "scripts"];
	const legacyFiles = ["metadata.json"];

	return {
		filesToRemove: [...legacyDirs, ...legacyFiles],
		filesToPreserve: USER_CONFIG_PATTERNS,
		hasManifest: false,
		isMultiKit: false,
		remainingKits: [],
	};
}
