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
			// Detect kit type from name
			let detectedKit: KitType | null = null;
			if (parsed.name?.toLowerCase().includes("engineer")) {
				detectedKit = "engineer";
			} else if (parsed.name?.toLowerCase().includes("marketing")) {
				detectedKit = "marketing";
			} else {
				// Default to engineer for unnamed legacy installs
				detectedKit = "engineer";
			}

			return { format: "legacy", metadata: parsed, detectedKit };
		}

		// Empty or unknown format, treat as none
		return { format: "none", metadata: null, detectedKit: null };
	} catch (error) {
		logger.debug(`Failed to read metadata: ${error}`);
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
 * Migrate legacy single-kit metadata to multi-kit format
 *
 * @param claudeDir - Path to .claude directory
 * @param currentKit - The kit currently being installed (determines target kit slot)
 * @returns Migration result
 */
export async function migrateToMultiKit(
	claudeDir: string,
	_currentKit: KitType,
): Promise<MetadataMigrationResult> {
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
		const multiKit: Metadata = {
			kits: {
				[legacyKit]: kitMetadata,
			},
			scope: legacy.scope,
			// Preserve legacy fields for backward compatibility
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
 * Get installed kits from metadata
 */
export function getInstalledKits(metadata: Metadata): KitType[] {
	if (metadata.kits) {
		return Object.keys(metadata.kits) as KitType[];
	}

	// Legacy format - detect from name
	if (metadata.name?.toLowerCase().includes("engineer")) {
		return ["engineer"];
	}
	if (metadata.name?.toLowerCase().includes("marketing")) {
		return ["marketing"];
	}

	// Default to engineer for legacy
	if (metadata.version) {
		return ["engineer"];
	}

	return [];
}
