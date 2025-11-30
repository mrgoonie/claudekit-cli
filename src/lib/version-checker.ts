import { compareVersions } from "compare-versions";
import pc from "picocolors";
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
	 * Display update notification (styled box with colors)
	 */
	static displayNotification(result: VersionCheckResult): void {
		if (!result.updateAvailable) return;

		const { currentVersion, latestVersion, releaseUrl } = result;

		// Normalize versions for display (strip 'v' prefix for consistency)
		const displayCurrent = normalizeVersion(currentVersion);
		const displayLatest = normalizeVersion(latestVersion);

		// Box width based on content
		const boxWidth = 52;
		const contentWidth = boxWidth - 2;

		// Colored box borders (cyan for Kit updates)
		const border = pc.cyan;
		const topBorder = border(`╭${"─".repeat(contentWidth)}╮`);
		const bottomBorder = border(`╰${"─".repeat(contentWidth)}╯`);
		const emptyLine = border("│") + " ".repeat(contentWidth) + border("│");

		// Pad line with centered text
		const padLine = (text: string, visibleLen?: number): string => {
			const len = visibleLen ?? text.length;
			const displayText = len > contentWidth ? `${text.slice(0, contentWidth - 3)}...` : text;
			const actualLen = visibleLen ?? displayText.length;
			const totalPadding = contentWidth - actualLen;
			const leftPadding = Math.max(0, Math.floor(totalPadding / 2));
			const rightPadding = Math.max(0, totalPadding - leftPadding);
			return (
				border("│") + " ".repeat(leftPadding) + displayText + " ".repeat(rightPadding) + border("│")
			);
		};

		// Left-align line for URL
		const padLineLeft = (text: string, visibleLen?: number): string => {
			const len = visibleLen ?? text.length;
			const displayText = len > contentWidth - 2 ? `${text.slice(0, contentWidth - 5)}...` : text;
			const actualLen = visibleLen ?? displayText.length;
			const rightPadding = Math.max(0, contentWidth - actualLen - 2);
			return `${border("│")}  ${displayText}${" ".repeat(rightPadding)}${border("│")}`;
		};

		// Build content with visual hierarchy
		const headerText = pc.bold(pc.yellow("⬆ Kit Update Available"));
		const headerLen = "⬆ Kit Update Available".length;

		const versionText = `${pc.dim(displayCurrent)} ${pc.white("→")} ${pc.green(pc.bold(displayLatest))}`;
		const versionLen = displayCurrent.length + 3 + displayLatest.length;

		const commandText = `Run: ${pc.cyan(pc.bold("ck init"))}`;
		const commandLen = "Run: ck init".length;

		// Full URL display (or truncate if extremely long)
		const urlLabel = pc.dim("Release: ");
		const urlValue = pc.underline(pc.blue(releaseUrl));
		const urlLen = "Release: ".length + releaseUrl.length;

		console.log("");
		console.log(topBorder);
		console.log(emptyLine);
		console.log(padLine(headerText, headerLen));
		console.log(padLine(versionText, versionLen));
		console.log(emptyLine);
		console.log(padLine(commandText, commandLen));
		console.log(padLineLeft(urlLabel + urlValue, urlLen));
		console.log(emptyLine);
		console.log(bottomBorder);
		console.log("");
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
	 * Display CLI update notification (styled box with colors)
	 */
	static displayNotification(result: VersionCheckResult): void {
		if (!result.updateAvailable) return;

		const { currentVersion, latestVersion, releaseUrl } = result;

		// Box width based on content
		const boxWidth = 52;
		const contentWidth = boxWidth - 2;

		// Colored box borders (magenta for CLI updates - distinct from Kit)
		const border = pc.magenta;
		const topBorder = border(`╭${"─".repeat(contentWidth)}╮`);
		const bottomBorder = border(`╰${"─".repeat(contentWidth)}╯`);
		const emptyLine = border("│") + " ".repeat(contentWidth) + border("│");

		// Pad line with centered text
		const padLine = (text: string, visibleLen?: number): string => {
			const len = visibleLen ?? text.length;
			const displayText = len > contentWidth ? `${text.slice(0, contentWidth - 3)}...` : text;
			const actualLen = visibleLen ?? displayText.length;
			const totalPadding = contentWidth - actualLen;
			const leftPadding = Math.max(0, Math.floor(totalPadding / 2));
			const rightPadding = Math.max(0, totalPadding - leftPadding);
			return (
				border("│") + " ".repeat(leftPadding) + displayText + " ".repeat(rightPadding) + border("│")
			);
		};

		// Left-align line for URL
		const padLineLeft = (text: string, visibleLen?: number): string => {
			const len = visibleLen ?? text.length;
			const displayText = len > contentWidth - 2 ? `${text.slice(0, contentWidth - 5)}...` : text;
			const actualLen = visibleLen ?? displayText.length;
			const rightPadding = Math.max(0, contentWidth - actualLen - 2);
			return `${border("│")}  ${displayText}${" ".repeat(rightPadding)}${border("│")}`;
		};

		// Build content with visual hierarchy
		const headerText = pc.bold(pc.yellow("⬆ CLI Update Available"));
		const headerLen = "⬆ CLI Update Available".length;

		const versionText = `${pc.dim(currentVersion)} ${pc.white("→")} ${pc.green(pc.bold(latestVersion))}`;
		const versionLen = currentVersion.length + 3 + latestVersion.length;

		const commandText = `Run: ${pc.magenta(pc.bold("ck update"))}`;
		const commandLen = "Run: ck update".length;

		// Full URL display
		const urlLabel = pc.dim("Package: ");
		const urlValue = pc.underline(pc.blue(releaseUrl));
		const urlLen = "Package: ".length + releaseUrl.length;

		console.log("");
		console.log(topBorder);
		console.log(emptyLine);
		console.log(padLine(headerText, headerLen));
		console.log(padLine(versionText, versionLen));
		console.log(emptyLine);
		console.log(padLine(commandText, commandLen));
		console.log(padLineLeft(urlLabel + urlValue, urlLen));
		console.log(emptyLine);
		console.log(bottomBorder);
		console.log("");
	}
}
