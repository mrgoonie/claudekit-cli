/**
 * Version Selector Facade
 * Interactive version selection for ClaudeKit releases.
 */
import { GitHubClient } from "@/domains/github/github-client.js";
import { logger } from "@/shared/logger.js";
import type { KitConfig } from "@/types";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import {
	createVersionPrompt,
	getDefaultIndex,
	handleNoReleases,
	handleSelectionError,
} from "./selection/index.js";
import { VersionDisplayFormatter } from "./version-display.js";

export interface VersionSelectorOptions {
	kit: KitConfig;
	includePrereleases?: boolean;
	limit?: number;
	defaultValue?: string;
	allowManualEntry?: boolean;
	forceRefresh?: boolean;
	/** Currently installed version (if any) to display in selection UI */
	currentVersion?: string | null;
}

export class VersionSelector {
	private githubClient: GitHubClient;

	constructor(githubClient?: GitHubClient) {
		this.githubClient = githubClient ?? new GitHubClient();
	}

	/**
	 * Main entry point for interactive version selection with enhanced UI.
	 */
	async selectVersion(options: VersionSelectorOptions): Promise<string | null> {
		const {
			kit,
			includePrereleases = false,
			limit = 10,
			defaultValue,
			allowManualEntry = false,
			forceRefresh = false,
			currentVersion = null,
		} = options;

		try {
			const loadingSpinner = clack.spinner();
			loadingSpinner.start(`Fetching versions for ${pc.bold(kit.name)}...`);

			const releases = await this.githubClient.listReleasesWithCache(kit, {
				limit: limit * 2,
				includePrereleases,
				forceRefresh,
			});

			loadingSpinner.stop();

			if (releases.length === 0) {
				return handleNoReleases(kit, allowManualEntry);
			}

			const choices = VersionDisplayFormatter.formatReleasesToChoices(releases, false, limit);
			const defaultIndex = getDefaultIndex(choices, defaultValue);

			return await createVersionPrompt(
				kit,
				choices,
				defaultIndex,
				allowManualEntry,
				releases,
				currentVersion,
			);
		} catch (error: any) {
			logger.error(`Version selection failed for ${kit.name}: ${error.message}`);
			return handleSelectionError(error, kit, allowManualEntry, () =>
				this.selectVersion({ kit, includePrereleases: false, allowManualEntry }),
			);
		}
	}

	/**
	 * Quickly retrieves the latest version without user interaction.
	 */
	async getLatestVersion(
		kit: KitConfig,
		includePrereleases = false,
		forceRefresh = false,
	): Promise<string | null> {
		try {
			const releases = await this.githubClient.listReleasesWithCache(kit, {
				limit: 5,
				includePrereleases,
				forceRefresh,
			});

			if (releases.length === 0) {
				return null;
			}

			return releases[0].tag_name;
		} catch (error) {
			logger.error(`Failed to get latest version for ${kit.name}: ${error}`);
			return null;
		}
	}
}
