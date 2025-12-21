/**
 * Kit Version Checker
 * Checks for ClaudeKit template updates from GitHub
 */
import { GitHubClient } from "@/domains/github/github-client.js";
import { logger } from "@/shared/logger.js";
import { AVAILABLE_KITS } from "@/types";
import { VersionCacheManager } from "../version-cache.js";
import { type VersionCheckResult, isNewerVersion, isUpdateCheckDisabled } from "./version-utils.js";

/**
 * Fetch latest release from GitHub (with timeout)
 */
async function fetchLatestRelease(currentVersion: string): Promise<VersionCheckResult | null> {
	try {
		const githubClient = new GitHubClient();
		const kit = AVAILABLE_KITS.engineer; // Always check engineer kit

		// Fetch with 5s timeout
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("Timeout")), 5000),
		);

		const releasePromise = githubClient.getLatestRelease(kit);
		const release = await Promise.race([releasePromise, timeoutPromise]);

		const latestVersion = release.tag_name;
		const updateAvailable = isNewerVersion(currentVersion, latestVersion);

		// Construct release URL from kit info and tag
		const releaseUrl = `https://github.com/${kit.owner}/${kit.repo}/releases/tag/${latestVersion}`;

		logger.debug(
			`Fetched latest release: current=${currentVersion}, latest=${latestVersion}, updateAvailable=${updateAvailable}`,
		);

		return {
			currentVersion,
			latestVersion,
			updateAvailable,
			releaseUrl,
		};
	} catch (error) {
		logger.debug(`Failed to fetch latest release: ${error}`);
		return null; // Silent failure
	}
}

export class VersionChecker {
	/**
	 * Check for updates (non-blocking)
	 * Uses cache if available and valid, otherwise fetches from GitHub
	 */
	static async check(currentVersion: string): Promise<VersionCheckResult | null> {
		// Respect opt-out
		if (isUpdateCheckDisabled()) {
			logger.debug("Update check disabled by environment");
			return null;
		}

		// Try to load cache
		const cache = await VersionCacheManager.load();

		// Return cached result if valid and for same version
		if (
			cache &&
			VersionCacheManager.isCacheValid(cache) &&
			cache.currentVersion === currentVersion
		) {
			logger.debug("Using cached version check result");
			return {
				currentVersion: cache.currentVersion,
				latestVersion: cache.latestVersion,
				updateAvailable: cache.updateAvailable,
				releaseUrl: cache.latestUrl,
			};
		}

		// Cache expired or invalid - fetch new data
		logger.debug("Cache expired or invalid, fetching latest release");
		const result = await fetchLatestRelease(currentVersion);

		if (result) {
			// Save to cache
			await VersionCacheManager.save({
				lastCheck: Date.now(),
				currentVersion: result.currentVersion,
				latestVersion: result.latestVersion,
				latestUrl: result.releaseUrl,
				updateAvailable: result.updateAvailable,
			});
		}

		return result;
	}
}
