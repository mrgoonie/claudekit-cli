/**
 * CLI Version Checker
 * Checks for CLI package updates from npm registry
 */
import { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import { logger } from "@/shared/logger.js";
import { compareVersions } from "compare-versions";
import {
	type VersionCheckResult,
	isDevPrereleaseOfSameBase,
	isUpdateCheckDisabled,
	normalizeVersion,
} from "./version-utils.js";

// Package name for claudekit-cli
const PACKAGE_NAME = "claudekit-cli";

export class CliVersionChecker {
	/**
	 * Check for CLI updates from npm registry (non-blocking)
	 * @param currentVersion - Current CLI version
	 * @returns Version check result or null on failure
	 */
	static async check(currentVersion: string): Promise<VersionCheckResult | null> {
		// Respect opt-out
		if (isUpdateCheckDisabled()) {
			logger.debug("CLI update check disabled by environment");
			return null;
		}

		try {
			const latestVersion = await NpmRegistryClient.getLatestVersion(PACKAGE_NAME);

			if (!latestVersion) {
				logger.debug("Failed to fetch latest CLI version from npm");
				return null;
			}

			const current = normalizeVersion(currentVersion);
			const latest = normalizeVersion(latestVersion);

			// Don't show update for dev prerelease to same base stable
			// e.g., 3.31.0-dev.7 should NOT prompt to "update" to 3.31.0
			if (isDevPrereleaseOfSameBase(current, latest)) {
				logger.debug(
					`CLI version check: skipping update - dev prerelease (${current}) is same base as stable (${latest})`,
				);
				return null;
			}

			const updateAvailable = compareVersions(latest, current) > 0;

			logger.debug(
				`CLI version check: current=${current}, latest=${latest}, updateAvailable=${updateAvailable}`,
			);

			return {
				currentVersion: current,
				latestVersion: latest,
				updateAvailable,
				releaseUrl: `https://www.npmjs.com/package/${PACKAGE_NAME}`,
			};
		} catch (error) {
			logger.debug(`CLI version check failed: ${error}`);
			return null;
		}
	}
}
