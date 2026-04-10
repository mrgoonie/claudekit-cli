/**
 * Version Display
 *
 * Displays version information for CLI and kits.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import packageInfo from "../../package.json" assert { type: "json" };
import { ConfigVersionChecker } from "../domains/sync/config-version-checker.js";
import { CliVersionChecker, VersionChecker } from "../domains/versioning/version-checker.js";
import { logger } from "../shared/logger.js";
import { PathResolver } from "../shared/path-resolver.js";
import type { KitType, Metadata } from "../types/index.js";
import { MetadataSchema } from "../types/index.js";
import { AVAILABLE_KITS } from "../types/index.js";

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
 * Best-effort legacy inference for installs that predate the multi-kit metadata shape.
 * If the root name field doesn't mention marketing, fall back to engineer.
 */
export function inferLegacyKitType(metadata: Metadata): KitType {
	if (/\bmarketing\b/i.test(metadata.name ?? "")) {
		return "marketing";
	}

	return "engineer";
}

export function getInstalledKitVersions(
	metadata: Metadata,
): Array<{ kit: KitType; version: string }> {
	const kitTypes = getInstalledKitTypes(metadata);
	if (kitTypes.length > 0) {
		return kitTypes
			.map((kit) => ({
				kit,
				version: metadata.kits?.[kit]?.version ?? "",
			}))
			.filter(({ version }) => version.trim() !== "");
	}

	if (metadata.version?.trim()) {
		return [{ kit: inferLegacyKitType(metadata), version: metadata.version }];
	}

	return [];
}

async function maybeDisplayKitUpdateNotifications(
	installedKits: Array<{ kit: KitType; version: string }>,
	isGlobal: boolean,
): Promise<void> {
	const updateChecks = await Promise.all(
		installedKits.map(async ({ kit, version }) => ({
			kit,
			updateCheck: await ConfigVersionChecker.checkForUpdates(kit, version, isGlobal),
		})),
	);

	for (const { kit, updateCheck } of updateChecks) {
		if (!updateCheck.hasUpdates) {
			continue;
		}

		const releaseUrl = `https://github.com/${AVAILABLE_KITS[kit].owner}/${AVAILABLE_KITS[kit].repo}/releases/tag/v${updateCheck.latestVersion.replace(/^v/i, "")}`;
		VersionChecker.displayNotification(
			{
				currentVersion: updateCheck.currentVersion,
				latestVersion: updateCheck.latestVersion,
				updateAvailable: true,
				releaseUrl,
			},
			{ isGlobal, kitName: kit },
		);
	}
}

/**
 * Display version information
 * Shows CLI version, Local Kit version, and Global Kit version (if they exist)
 */
export async function displayVersion(): Promise<void> {
	console.log(`CLI Version: ${packageVersion}`);

	let foundAnyKit = false;
	let localInstalledKits: Array<{ kit: KitType; version: string }> = [];
	let globalInstalledKits: Array<{ kit: KitType; version: string }> = [];

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
				localInstalledKits = getInstalledKitVersions(metadata);
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
				globalInstalledKits = getInstalledKitVersions(metadata);
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
	if (localInstalledKits.length > 0 || globalInstalledKits.length > 0) {
		try {
			await maybeDisplayKitUpdateNotifications(localInstalledKits, false);
			await maybeDisplayKitUpdateNotifications(globalInstalledKits, true);
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
