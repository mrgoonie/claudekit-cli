import { compareVersions } from "compare-versions";
import { AVAILABLE_KITS } from "../types.js";
import { logger } from "../utils/logger.js";
import { GitHubClient } from "./github.js";
import { NpmRegistryClient } from "./npm-registry.js";
import { VersionCacheManager } from "./version-cache.js";

interface VersionCheckResult {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	releaseUrl: string;
}

/**
 * Check if environment disables update notifications
 * Shared utility for all version checkers
 * @internal Exported for testing
 */
export function isUpdateCheckDisabled(): boolean {
	return (
		process.env.NO_UPDATE_NOTIFIER === "1" ||
		process.env.NO_UPDATE_NOTIFIER === "true" ||
		!process.stdout.isTTY // Not a terminal (CI/CD)
	);
}

/**
 * Normalize version tag (strip 'v' prefix)
 * Shared utility for all version checkers
 * @internal Exported for testing
 */
export function normalizeVersion(version: string): string {
	return version.replace(/^v/, "");
}

export class VersionChecker {
	/**
	 * Compare two version strings
	 * Returns: true if latestVersion > currentVersion
	 */
	private static isNewerVersion(currentVersion: string, latestVersion: string): boolean {
		try {
			const current = normalizeVersion(currentVersion);
			const latest = normalizeVersion(latestVersion);
			return compareVersions(latest, current) > 0;
		} catch (error) {
			logger.debug(
				`Version comparison failed: current=${currentVersion}, latest=${latestVersion}, error=${error}`,
			);
			return false;
		}
	}

	/**
	 * Fetch latest release from GitHub (with timeout)
	 */
	private static async fetchLatestRelease(
		currentVersion: string,
	): Promise<VersionCheckResult | null> {
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
			const updateAvailable = VersionChecker.isNewerVersion(currentVersion, latestVersion);

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
		const result = await VersionChecker.fetchLatestRelease(currentVersion);

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

	/**
	 * Display update notification (styled box)
	 */
	static displayNotification(result: VersionCheckResult): void {
		if (!result.updateAvailable) return;

		const { currentVersion, latestVersion, releaseUrl } = result;

		// Box width is 45 chars total (including border chars)
		const boxWidth = 45;
		const contentWidth = boxWidth - 2; // Subtract 2 for the │ borders

		// Generate box drawing characters dynamically based on content width
		const topBorder = `╭${"─".repeat(contentWidth)}╮`;
		const bottomBorder = `╰${"─".repeat(contentWidth)}╯`;
		const emptyLine = `│${" ".repeat(contentWidth)}│`;

		// Normalize versions for display (strip 'v' prefix for consistency)
		const displayCurrent = normalizeVersion(currentVersion);
		const displayLatest = normalizeVersion(latestVersion);

		// Prepare and truncate text if needed (use -> instead of → for reliable padding)
		const updateText = `Kit update: ${displayCurrent} -> ${displayLatest}`;
		const commandText = "Run: ck init";
		const releaseText = `Release: ${releaseUrl.length > contentWidth - 9 ? `${releaseUrl.slice(0, contentWidth - 12)}...` : releaseUrl}`;

		// Pad line with centered text
		const padLine = (text: string): string => {
			// Truncate if text is too long
			const displayText =
				text.length > contentWidth ? `${text.slice(0, contentWidth - 3)}...` : text;

			const totalPadding = contentWidth - displayText.length;
			const leftPadding = Math.max(0, Math.floor(totalPadding / 2));
			const rightPadding = Math.max(0, totalPadding - leftPadding);

			const leftPad = " ".repeat(leftPadding);
			const rightPad = " ".repeat(rightPadding);
			return `│${leftPad}${displayText}${rightPad}│`;
		};

		logger.info("");
		logger.info(topBorder);
		logger.info(emptyLine);
		logger.info(padLine(updateText));
		logger.info(padLine(commandText));
		logger.info(padLine(releaseText));
		logger.info(emptyLine);
		logger.info(bottomBorder);
		logger.info("");
	}
}

/**
 * CLI Version Checker
 * Checks for CLI package updates from npm registry
 */
export class CliVersionChecker {
	// Package name for claudekit-cli
	private static readonly PACKAGE_NAME = "claudekit-cli";

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
			const latestVersion = await NpmRegistryClient.getLatestVersion(
				CliVersionChecker.PACKAGE_NAME,
			);

			if (!latestVersion) {
				logger.debug("Failed to fetch latest CLI version from npm");
				return null;
			}

			const current = normalizeVersion(currentVersion);
			const latest = normalizeVersion(latestVersion);
			const updateAvailable = compareVersions(latest, current) > 0;

			logger.debug(
				`CLI version check: current=${current}, latest=${latest}, updateAvailable=${updateAvailable}`,
			);

			return {
				currentVersion: current,
				latestVersion: latest,
				updateAvailable,
				releaseUrl: `https://www.npmjs.com/package/${CliVersionChecker.PACKAGE_NAME}`,
			};
		} catch (error) {
			logger.debug(`CLI version check failed: ${error}`);
			return null;
		}
	}

	/**
	 * Display CLI update notification (styled box)
	 */
	static displayNotification(result: VersionCheckResult): void {
		if (!result.updateAvailable) return;

		const { currentVersion, latestVersion } = result;

		// Box width is 45 chars total (including border chars)
		const boxWidth = 45;
		const contentWidth = boxWidth - 2; // Subtract 2 for the │ borders

		// Generate box drawing characters
		const topBorder = `╭${"─".repeat(contentWidth)}╮`;
		const bottomBorder = `╰${"─".repeat(contentWidth)}╯`;
		const emptyLine = `│${" ".repeat(contentWidth)}│`;

		// Prepare text
		const updateText = `CLI update: ${currentVersion} -> ${latestVersion}`;
		const commandText = "Run: ck update";

		// Pad line with centered text
		const padLine = (text: string): string => {
			const displayText =
				text.length > contentWidth ? `${text.slice(0, contentWidth - 3)}...` : text;

			const totalPadding = contentWidth - displayText.length;
			const leftPadding = Math.max(0, Math.floor(totalPadding / 2));
			const rightPadding = Math.max(0, totalPadding - leftPadding);

			const leftPad = " ".repeat(leftPadding);
			const rightPad = " ".repeat(rightPadding);
			return `│${leftPad}${displayText}${rightPad}│`;
		};

		logger.info("");
		logger.info(topBorder);
		logger.info(emptyLine);
		logger.info(padLine(updateText));
		logger.info(padLine(commandText));
		logger.info(emptyLine);
		logger.info(bottomBorder);
		logger.info("");
	}
}
