/**
 * CLI Version Checker
 * Checks for CLI package updates from npm registry
 */
import { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import {
	CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
	CLAUDEKIT_CLI_NPM_PACKAGE_URL,
} from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { compareVersions } from "compare-versions";
import {
	type VersionCheckResult,
	isPrereleaseOfSameBase,
	isPrereleaseVersion,
	isUpdateCheckDisabled,
	normalizeVersion,
} from "./version-utils.js";

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
			const latestVersion = isPrereleaseVersion(currentVersion)
				? ((await NpmRegistryClient.getDevVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME)) ??
					(await NpmRegistryClient.getLatestVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME)))
				: await NpmRegistryClient.getLatestVersion(CLAUDEKIT_CLI_NPM_PACKAGE_NAME);

			if (!latestVersion) {
				logger.debug("Failed to fetch latest CLI version from npm");
				return null;
			}

			const current = normalizeVersion(currentVersion);
			const latest = normalizeVersion(latestVersion);

			// Don't show update for any prerelease of same base stable version
			// e.g., 2.15.1-beta.3 should NOT prompt to "update" to 2.15.1
			if (isPrereleaseOfSameBase(current, latest)) {
				logger.debug(
					`CLI version check: skipping update - prerelease (${current}) is same base as stable (${latest})`,
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
				releaseUrl: CLAUDEKIT_CLI_NPM_PACKAGE_URL,
			};
		} catch (error) {
			logger.debug(`CLI version check failed: ${error}`);
			return null;
		}
	}
}
