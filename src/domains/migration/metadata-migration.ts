/**
 * Metadata Migration - Handles migration from single-kit to multi-kit metadata format
 *
 * Migration scenarios:
 * 1. Fresh install (no metadata.json) - Create multi-kit format directly
 * 2. Legacy single-kit metadata - Migrate to multi-kit format, preserving existing kit
 * 3. Already multi-kit format - No migration needed
 */

import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import type { KitMetadata, KitType, Metadata, TrackedFile } from "@/types";
import { pathExists, readFile, writeFile } from "fs-extra";

/**
 * Detection result for metadata format
 */
export interface MetadataFormatDetection {
	format: "none" | "legacy" | "multi-kit";
	metadata: Metadata | null;
	detectedKit: KitType | null;
}

/**
 * Migration result
 */
export interface MetadataMigrationResult {
	success: boolean;
	migrated: boolean;
	fromFormat: "none" | "legacy" | "multi-kit";
	toFormat: "multi-kit";
	error?: string;
}

/**
 * Detect metadata format in existing metadata.json
 */
export async function detectMetadataFormat(claudeDir: string): Promise<MetadataFormatDetection> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) {
		return { format: "none", metadata: null, detectedKit: null };
	}

	try {
		const content = await readFile(metadataPath, "utf-8");
		const parsed = JSON.parse(content) as Metadata;

		// Check if it's multi-kit format (has `kits` object with at least one kit)
		if (parsed.kits && Object.keys(parsed.kits).length > 0) {
			// Detect which kit(s) are installed
			const installedKits = Object.keys(parsed.kits) as KitType[];
			return {
				format: "multi-kit",
				metadata: parsed,
				detectedKit: installedKits[0] || null,
			};
		}

		// Legacy format - has name/version at root level
		if (parsed.name || parsed.version || parsed.files) {
			// Detect kit type from name using word boundaries to avoid false matches
			let detectedKit: KitType | null = null;
			const nameToCheck = parsed.name || "";
			if (/\bengineer\b/i.test(nameToCheck)) {
				detectedKit = "engineer";
			} else if (/\bmarketing\b/i.test(nameToCheck)) {
				detectedKit = "marketing";
			} else {
				// Default to engineer for unnamed legacy installs
				detectedKit = "engineer";
			}

			return { format: "legacy", metadata: parsed, detectedKit };
		}

		// Empty or unknown format - warn user about potentially corrupted metadata
		logger.warning(
			"Metadata file exists but has unrecognized format (missing kits, name, version, or files)",
		);
		return { format: "none", metadata: null, detectedKit: null };
	} catch (error) {
		// Warn about corrupted metadata file (parse error, invalid JSON, etc.)
		logger.warning(`Failed to read metadata file (may be corrupted): ${error}`);
		return { format: "none", metadata: null, detectedKit: null };
	}
}

/**
 * Check if metadata needs migration to multi-kit format
 */
export function needsMigration(detection: MetadataFormatDetection): boolean {
	return detection.format === "legacy";
}

/**
 * Migrate legacy single-kit metadata to multi-kit format.
 * Detects the existing kit type from metadata name field and preserves it.
 *
 * @param claudeDir - Path to .claude directory
 * @returns Migration result
 */
export async function migrateToMultiKit(claudeDir: string): Promise<MetadataMigrationResult> {
	const detection = await detectMetadataFormat(claudeDir);

	// Already multi-kit or no metadata
	if (detection.format === "multi-kit") {
		return {
			success: true,
			migrated: false,
			fromFormat: "multi-kit",
			toFormat: "multi-kit",
		};
	}

	if (detection.format === "none") {
		return {
			success: true,
			migrated: false,
			fromFormat: "none",
			toFormat: "multi-kit",
		};
	}

	// Legacy format - migrate
	const metadataPath = join(claudeDir, "metadata.json");
	const legacy = detection.metadata;
	if (!legacy) {
		return {
			success: false,
			migrated: false,
			fromFormat: "legacy",
			toFormat: "multi-kit",
			error: "Metadata exists but could not be read",
		};
	}
	const legacyKit = detection.detectedKit || "engineer";

	try {
		// Build kit metadata from legacy fields
		const kitMetadata: KitMetadata = {
			version: legacy.version || "unknown",
			installedAt: legacy.installedAt || new Date().toISOString(),
			files: legacy.files || [],
		};

		// Create multi-kit structure while preserving legacy fields for backward compat
		// NOTE: Legacy fields (files, installedFiles) are intentionally preserved here to avoid
		// breaking existing tools/scripts that may read them. On next `ck init/update`, these
		// duplicates will be cleaned up as writeManifest() only writes to kits[kit].files.
		const multiKit: Metadata = {
			kits: {
				[legacyKit]: kitMetadata,
			},
			scope: legacy.scope,
			// Preserve legacy fields for backward compatibility (will be cleaned on next update)
			name: legacy.name,
			version: legacy.version,
			installedAt: legacy.installedAt,
			installedFiles: legacy.installedFiles,
			userConfigFiles: legacy.userConfigFiles,
			files: legacy.files,
		};

		// Write migrated metadata
		await writeFile(metadataPath, JSON.stringify(multiKit, null, 2), "utf-8");

		logger.info(`Migrated metadata from legacy format to multi-kit (detected: ${legacyKit})`);

		return {
			success: true,
			migrated: true,
			fromFormat: "legacy",
			toFormat: "multi-kit",
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Metadata migration failed: ${errorMsg}`);
		return {
			success: false,
			migrated: false,
			fromFormat: "legacy",
			toFormat: "multi-kit",
			error: errorMsg,
		};
	}
}

/**
 * Get kit-specific metadata from multi-kit structure
 */
export function getKitMetadata(metadata: Metadata, kit: KitType): KitMetadata | null {
	if (metadata.kits?.[kit]) {
		return metadata.kits[kit];
	}

	// Fallback for legacy format being read by old code
	if (!metadata.kits && metadata.version) {
		return {
			version: metadata.version,
			installedAt: metadata.installedAt || "",
			files: metadata.files,
		};
	}

	return null;
}

/**
 * Get all tracked files across all kits (for backward compat)
 */
export function getAllTrackedFiles(metadata: Metadata): TrackedFile[] {
	// Multi-kit format
	if (metadata.kits) {
		const allFiles: TrackedFile[] = [];
		for (const kit of Object.values(metadata.kits)) {
			if (kit.files) {
				allFiles.push(...kit.files);
			}
		}
		return allFiles;
	}

	// Legacy format
	return metadata.files || [];
}

/**
 * Get tracked files for a specific kit only
 * Used for kit-aware cleanup operations
 */
export function getTrackedFilesForKit(metadata: Metadata, kitType: KitType): TrackedFile[] {
	// Multi-kit format
	if (metadata.kits?.[kitType]) {
		return metadata.kits[kitType].files || [];
	}

	// Legacy format - return all files if kit matches detected kit
	const detectedKits = getInstalledKits(metadata);
	if (detectedKits.includes(kitType)) {
		return metadata.files || [];
	}

	return [];
}

/**
 * Get installed kits from metadata
 * Returns ALL matching kits (not just first match) for legacy format
 */
export function getInstalledKits(metadata: Metadata): KitType[] {
	if (metadata.kits) {
		return Object.keys(metadata.kits) as KitType[];
	}

	// Legacy format - detect ALL kits from name using word boundaries
	const nameToCheck = metadata.name || "";
	const kits: KitType[] = [];

	if (/\bengineer\b/i.test(nameToCheck)) {
		kits.push("engineer");
	}
	if (/\bmarketing\b/i.test(nameToCheck)) {
		kits.push("marketing");
	}

	// If kits found, return them
	if (kits.length > 0) {
		return kits;
	}

	// Default to engineer for legacy installs with version but no identifiable name
	if (metadata.version) {
		return ["engineer"];
	}

	return [];
}

/**
 * Update plugin installation state in kit metadata.
 * Called after plugin install attempt to record success/failure for idempotent re-runs.
 */
export async function updateKitPluginState(
	claudeDir: string,
	kit: KitType,
	state: { pluginInstalled: boolean; pluginInstalledAt: string; pluginVersion: string },
): Promise<void> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) {
		logger.debug("No metadata.json found — skipping plugin state update");
		return;
	}

	try {
		let metadata: Metadata = {};
		try {
			const raw = await readFile(metadataPath, "utf-8");
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === "object") {
				metadata = parsed as Metadata;
			} else {
				logger.warning(
					"metadata.json is not an object; rebuilding minimal plugin metadata structure",
				);
			}
		} catch (error) {
			logger.warning(`metadata.json unreadable during plugin state update; rebuilding: ${error}`);
		}

		if (!metadata.kits || typeof metadata.kits !== "object") {
			metadata.kits = {};
		}

		const existingKitState = metadata.kits[kit];
		metadata.kits[kit] = {
			...(existingKitState || {}),
			version: existingKitState?.version ?? "",
			installedAt: existingKitState?.installedAt ?? state.pluginInstalledAt,
			...state,
		};

		await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
		logger.debug(`Plugin state saved: ${state.pluginInstalled ? "installed" : "failed"}`);
	} catch (error) {
		logger.debug(`Failed to update plugin state: ${error}`);
	}
}
