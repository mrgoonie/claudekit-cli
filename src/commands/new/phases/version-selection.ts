/**
 * Version Selection Phase
 * Handles interactive and non-interactive version selection
 */

import type { GitHubClient } from "@/domains/github/github-client.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import type { GitHubRelease, KitConfig, NewCommandOptions } from "@/types";

export interface VersionSelectionResult {
	release: GitHubRelease;
	selectedVersion: string;
}

/**
 * Select and fetch release version (interactive or explicit)
 */
export async function selectVersion(
	kit: KitConfig,
	options: NewCommandOptions,
	isNonInteractive: boolean,
	prompts: PromptsManager,
	github: GitHubClient,
): Promise<VersionSelectionResult | null> {
	let selectedVersion: string | undefined = options.release;

	// Validate non-interactive mode requires explicit version
	if (!selectedVersion && isNonInteractive) {
		throw new Error(
			"Interactive version selection unavailable in non-interactive mode. " +
				"Either: (1) use --release <tag> flag, or (2) set CI=false to enable interactive mode",
		);
	}

	// Interactive version selection if no explicit version and in interactive mode
	if (!selectedVersion && !isNonInteractive) {
		logger.info("Fetching available versions...");

		try {
			const versionResult = await prompts.selectVersionEnhanced({
				kit,
				includePrereleases: options.beta,
				limit: 10,
				allowManualEntry: true,
				forceRefresh: options.refresh,
			});

			if (!versionResult) {
				logger.warning("Version selection cancelled by user");
				return null;
			}

			selectedVersion = versionResult;
			logger.success(`Selected version: ${selectedVersion}`);
		} catch (error: any) {
			logger.error("Failed to fetch versions, using latest release");
			logger.debug(`Version selection error: ${error.message}`);
			// Fall back to latest (default behavior)
			selectedVersion = undefined;
		}
	}

	// Get release
	let release: GitHubRelease;
	if (selectedVersion) {
		release = await github.getReleaseByTag(kit, selectedVersion);
	} else {
		if (options.beta) {
			logger.info("Fetching latest beta release...");
		} else {
			logger.info("Fetching latest release...");
		}
		release = await github.getLatestRelease(kit, options.beta);
		// Only show "Found release" when fetching latest (user didn't select specific version)
		if (release.prerelease) {
			logger.success(`Found beta: ${release.tag_name}`);
		} else {
			logger.success(`Found: ${release.tag_name}`);
		}
	}

	return {
		release,
		selectedVersion: release.tag_name,
	};
}
