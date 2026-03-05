/**
 * Version Display
 *
 * Displays version information for CLI and kits.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import packageInfo from "../../package.json" assert { type: "json" };
import { CliVersionChecker, VersionChecker } from "../domains/versioning/version-checker.js";
import { logger } from "../shared/logger.js";
import { PathResolver } from "../shared/path-resolver.js";
import type { KitType, Metadata } from "../types/index.js";
import { MetadataSchema } from "../types/index.js";

const packageVersion = packageInfo.version;

/**
 * Format installed kits from metadata for display
 * Returns format like "engineer@2.2.0, marketing@1.0.0" or null if no kits
 */
function formatInstalledKits(metadata: Metadata): string | null {
	if (!metadata.kits || Object.keys(metadata.kits).length === 0) {
		// Fallback to legacy root fields
		if (metadata.version) {
			const kitName = metadata.name || "ClaudeKit";
			return `${metadata.version} (${kitName})`;
		}
		return null;
	}

	const kitVersions = Object.entries(metadata.kits)
		.filter(([_, meta]) => meta.version && meta.version.trim() !== "")
		.map(([kit, meta]) => `${kit}@${meta.version}`)
		.sort() // Alphabetical: engineer, marketing
		.join(", ");

	return kitVersions.length > 0 ? kitVersions : null;
}

/**
 * Get all installed kit types from metadata
 * Returns properly typed KitType array for safe access to metadata.kits
 */
function getInstalledKitTypes(metadata: Metadata): KitType[] {
	if (!metadata.kits) return [];
	return Object.keys(metadata.kits) as KitType[];
}

/**
 * Get version for first installed kit (for update check)
 * Handles type safety for accessing metadata.kits with KitType keys
 */
function getFirstKitVersion(metadata: Metadata): string | null {
	const kitTypes = getInstalledKitTypes(metadata);
	if (kitTypes.length === 0) {
		return metadata.version ?? null;
	}
	const firstKit = kitTypes[0];
	return metadata.kits?.[firstKit]?.version ?? null;
}

/**
 * Display version information
 * Shows CLI version, Local Kit version, and Global Kit version (if they exist)
 */
export async function displayVersion(): Promise<void> {
	console.log(`CLI Version: ${packageVersion}`);

	let foundAnyKit = false;
	let localKitVersion: string | null = null;
	let isGlobalOnlyKit = false; // Track if only global kit exists (no local)

	// Determine paths
	const globalKitDir = PathResolver.getGlobalKitDir();
	const globalMetadataPath = join(globalKitDir, "metadata.json");
	const prefix = PathResolver.getPathPrefix(false); // Local mode check
	const localMetadataPath = prefix
		? join(process.cwd(), prefix, "metadata.json")
		: join(process.cwd(), "metadata.json");

	// Check if local path is actually the global path (e.g., when cwd is ~)
	const isLocalSameAsGlobal = localMetadataPath === globalMetadataPath;

	// Check local project kit version (skip if it's the same as global)
	if (!isLocalSameAsGlobal && existsSync(localMetadataPath)) {
		try {
			const rawMetadata = JSON.parse(readFileSync(localMetadataPath, "utf-8"));
			const metadata = MetadataSchema.parse(rawMetadata);

			const kitsDisplay = formatInstalledKits(metadata);
			if (kitsDisplay) {
				console.log(`Local Kit Version: ${kitsDisplay}`);
				localKitVersion = getFirstKitVersion(metadata);
				foundAnyKit = true;
			}
		} catch (error) {
			// Log to verbose if metadata is invalid
			logger.verbose("Failed to parse local metadata.json", { error });
		}
	}

	// Check global kit installation
	if (existsSync(globalMetadataPath)) {
		try {
			const rawMetadata = JSON.parse(readFileSync(globalMetadataPath, "utf-8"));
			const metadata = MetadataSchema.parse(rawMetadata);

			const kitsDisplay = formatInstalledKits(metadata);
			if (kitsDisplay) {
				console.log(`Global Kit Version: ${kitsDisplay}`);
				// Use global version if no local version found
				if (!localKitVersion) {
					localKitVersion = getFirstKitVersion(metadata);
					isGlobalOnlyKit = true; // Only global kit found, no local
				}
				foundAnyKit = true;
			}
		} catch (error) {
			// Log to verbose if metadata is invalid
			logger.verbose("Failed to parse global metadata.json", { error });
		}
	}

	// Show message if no kits found
	if (!foundAnyKit) {
		console.log("No ClaudeKit installation found");
		console.log("\nTo get started: ck new (local project) or ck init -g (global)");
	}

	// Check for CLI updates (non-blocking)
	try {
		const cliUpdateCheck = await CliVersionChecker.check(packageVersion);
		if (cliUpdateCheck?.updateAvailable) {
			CliVersionChecker.displayNotification(cliUpdateCheck);
		}
	} catch (error) {
		// Silent failure - don't block version display
		logger.debug(`CLI version check failed: ${error}`);
	}

	// Check for kit updates (non-blocking)
	if (localKitVersion) {
		try {
			const updateCheck = await VersionChecker.check(localKitVersion);
			if (updateCheck?.updateAvailable) {
				VersionChecker.displayNotification(updateCheck, { isGlobal: isGlobalOnlyKit });
			}
		} catch (error) {
			// Silent failure - don't block version display
			logger.debug(`Kit version check failed: ${error}`);
		}
	}
}

/**
 * Get the CLI package version
 */
export function getPackageVersion(): string {
	return packageVersion;
}
