/**
 * Passive config update check - runs silently after commands
 * Uses 24h cached GitHub API check, never blocks or errors
 */
import { detectMetadataFormat } from "@/domains/migration/metadata-migration.js";
import { logger } from "@/shared/logger.js";
import type { KitType } from "@/types";
import { ConfigVersionChecker } from "./config-version-checker.js";
import { displayConfigUpdateNotification } from "./notification-display.js";

/**
 * Check for config updates and display notification if available
 * Safe to call at end of any command - uses cache, never throws
 *
 * @param claudeDir - Path to .claude directory
 * @param global - Whether this is a global installation
 * @returns true if notification was shown
 */
export async function maybeShowConfigUpdateNotification(
	claudeDir: string,
	global: boolean,
): Promise<boolean> {
	try {
		// Detect metadata format and get installed kits
		const detection = await detectMetadataFormat(claudeDir);

		if (detection.format === "none" || !detection.metadata) {
			logger.debug("No metadata found, skipping update check");
			return false;
		}

		// Get installed kits with versions
		const kitsToCheck: Array<{ kit: KitType; version: string }> = [];

		if (detection.format === "multi-kit" && detection.metadata.kits) {
			for (const [kitType, kitInfo] of Object.entries(detection.metadata.kits)) {
				if (kitInfo?.version) {
					kitsToCheck.push({ kit: kitType as KitType, version: kitInfo.version });
				}
			}
		} else if (
			detection.format === "legacy" &&
			detection.detectedKit &&
			detection.metadata.version
		) {
			kitsToCheck.push({
				kit: detection.detectedKit,
				version: detection.metadata.version,
			});
		}

		if (kitsToCheck.length === 0) {
			logger.debug("No kits with versions found, skipping update check");
			return false;
		}

		// Check each kit for updates (uses 24h cache, fast)
		for (const { kit, version } of kitsToCheck) {
			const result = await ConfigVersionChecker.checkForUpdates(kit, version, global);

			if (result.hasUpdates) {
				displayConfigUpdateNotification(result.currentVersion, result.latestVersion, global);
				return true; // Show only one notification
			}
		}

		return false;
	} catch (error) {
		// Silent - passive check should never crash the main command
		logger.debug(`Passive update check failed: ${error instanceof Error ? error.message : error}`);
		return false;
	}
}
