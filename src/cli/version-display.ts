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
import { MetadataSchema } from "../types/index.js";

const packageVersion = packageInfo.version;

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

			if (metadata.version) {
				const kitName = metadata.name || "ClaudeKit";
				console.log(`Local Kit Version: ${metadata.version} (${kitName})`);
				localKitVersion = metadata.version;
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

			if (metadata.version) {
				const kitName = metadata.name || "ClaudeKit";
				console.log(`Global Kit Version: ${metadata.version} (${kitName})`);
				// Use global version if no local version found
				if (!localKitVersion) {
					localKitVersion = metadata.version;
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
