import { GitHubClient } from "@/domains/github/github-client.js";
import { logger } from "@/shared/logger.js";
import type { EnrichedRelease, KitConfig } from "@/types";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import { type VersionChoice, VersionDisplayFormatter } from "./version-display.js";

/** Matches semantic versions like v1.2.3 or 1.2.3 (with optional prerelease suffix) */
const VERSION_PATTERN = /^v?\d+\.\d+\.\d+/;

export interface VersionSelectorOptions {
	kit: KitConfig;
	includePrereleases?: boolean;
	limit?: number;
	defaultValue?: string;
	allowManualEntry?: boolean;
	forceRefresh?: boolean;
}

export class VersionSelector {
	private githubClient: GitHubClient;

	constructor(githubClient?: GitHubClient) {
		this.githubClient = githubClient ?? new GitHubClient();
	}

	/**
	 * Main entry point for interactive version selection with enhanced UI.
	 *
	 * Displays a user-friendly selection interface with release information, badges,
	 * and optional manual entry. Handles network errors gracefully and provides
	 * fallback options.
	 *
	 * @param options - Configuration options for version selection
	 * @param options.kit - The kit configuration to select versions for
	 * @param options.includePrereleases - Whether to include pre-release versions (default: false)
	 * @param options.limit - Maximum number of versions to display (default: 10)
	 * @param options.defaultValue - Default version to pre-select
	 * @param options.allowManualEntry - Whether to allow manual version entry (default: false)
	 * @returns Promise resolving to selected version tag or null if cancelled
	 *
	 * @example
	 * ```typescript
	 * const selector = new VersionSelector();
	 * const version = await selector.selectVersion({
	 *   kit: claudekitConfig,
	 *   includePrereleases: true,
	 *   limit: 20,
	 *   allowManualEntry: true
	 * });
	 * if (version) {
	 *   console.log(`Selected version: ${version}`);
	 * }
	 * ```
	 */
	async selectVersion(options: VersionSelectorOptions): Promise<string | null> {
		const {
			kit,
			includePrereleases = false,
			limit = 10,
			defaultValue,
			allowManualEntry = false,
			forceRefresh = false,
		} = options;

		try {
			// Show loading state
			const loadingSpinner = clack.spinner();
			loadingSpinner.start(`Fetching versions for ${pc.bold(kit.name)}...`);

			// Fetch releases with caching (bypass cache if forceRefresh)
			const releases = await this.githubClient.listReleasesWithCache(kit, {
				limit: limit * 2, // Fetch more to account for filtering
				includePrereleases,
				forceRefresh,
			});

			loadingSpinner.stop();

			if (releases.length === 0) {
				return this.handleNoReleases(kit, allowManualEntry);
			}

			// Create version choices (without special options - we'll add them in createVersionPrompt)
			const choices = VersionDisplayFormatter.formatReleasesToChoices(
				releases,
				false, // don't include special options here
				limit,
			);

			// Get default index
			const defaultIndex = this.getDefaultIndex(choices, defaultValue);

			// Create and show prompt
			return await this.createVersionPrompt(kit, choices, defaultIndex, allowManualEntry, releases);
		} catch (error: any) {
			logger.error(`Version selection failed for ${kit.name}: ${error.message}`);
			return this.handleError(error, kit, allowManualEntry);
		}
	}

	/**
	 * Handle case when no releases are found
	 */
	private async handleNoReleases(
		kit: KitConfig,
		allowManualEntry: boolean,
	): Promise<string | null> {
		clack.note(
			`No releases found for ${kit.name}.\nThis could be due to:\n• No releases published yet\n• Network connectivity issues\n• Repository access permissions`,
			pc.yellow("No Releases Available"),
		);

		if (!allowManualEntry) {
			throw new Error(`No releases available for ${kit.name}`);
		}

		const tryManual = await clack.confirm({
			message: "Would you like to enter a version manually?",
		});

		if (clack.isCancel(tryManual) || !tryManual) {
			return null;
		}

		return await this.getManualVersion(kit);
	}

	/**
	 * Get version through manual entry
	 */
	private async getManualVersion(kit: KitConfig): Promise<string | null> {
		const version = await clack.text({
			message: `Enter version tag for ${kit.name}:`,
			placeholder: "v1.0.0",
			validate: (value) => {
				if (!value || value.trim().length === 0) {
					return "Version is required";
				}
				// Basic version format validation
				if (!VERSION_PATTERN.test(value.trim())) {
					return "Please enter a valid version (e.g., v1.0.0)";
				}
				return;
			},
		});

		if (clack.isCancel(version)) {
			return null;
		}

		// Normalize version to include 'v' prefix
		const trimmed = version.trim();
		return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
	}

	/**
	 * Create and show the version selection prompt
	 */
	private async createVersionPrompt(
		kit: KitConfig,
		choices: VersionChoice[],
		_defaultIndex: number,
		allowManualEntry: boolean,
		releases: EnrichedRelease[],
	): Promise<string | null> {
		// Build final choices with clear ordering
		const clackChoices: Array<{ value: string; label: string; hint?: string }> = [];

		// 1. Add "Latest Stable" shortcut first
		const latestStable = releases.find((r) => r.isLatestStable && !r.prerelease);
		if (latestStable) {
			clackChoices.push({
				value: latestStable.tag_name,
				label: `${pc.bold(pc.green("Latest Stable"))} (${latestStable.displayVersion})`,
				hint: "recommended",
			});
		}

		// 2. Add utility options for easy access
		if (allowManualEntry) {
			clackChoices.push({
				value: "manual-entry",
				label: pc.cyan("↳ Enter Version Manually"),
				hint: "for older versions",
			});
		}
		clackChoices.push({
			value: "cancel",
			label: pc.red("✕ Cancel"),
		});

		// 3. Add version list (excluding separator)
		const versionChoices = choices.filter(
			(choice) => choice.value !== "separator" && choice.value !== "cancel",
		);
		for (const choice of versionChoices) {
			clackChoices.push({
				value: choice.value,
				label: choice.label,
				hint: choice.hint,
			});
		}

		const selected = await clack.select({
			message: `Select version for ${pc.bold(kit.name)}:`,
			options: clackChoices,
			initialValue: latestStable?.tag_name, // Default to Latest Stable
		});

		if (clack.isCancel(selected)) {
			return null;
		}

		// Handle manual entry
		if (selected === "manual-entry") {
			return await this.getManualVersion(kit);
		}

		// Handle cancel
		if (selected === "cancel") {
			return null;
		}

		// Validate selected version
		if (!VersionDisplayFormatter.isValidVersionChoice(selected as string)) {
			throw new Error(`Invalid version selection: ${selected}`);
		}

		// Show confirmation
		const selectedChoice = choices.find((c) => c.value === selected);
		if (selectedChoice && !selectedChoice.isLatest) {
			clack.note(
				VersionDisplayFormatter.formatSuccess(selected as string, kit.name),
				"Version Selected",
			);
		}

		return selected as string;
	}

	/**
	 * Get the default index for selection
	 */
	private getDefaultIndex(choices: VersionChoice[], defaultValue?: string): number {
		// If default value provided, find it
		if (defaultValue) {
			const index = choices.findIndex((c) => c.value === defaultValue);
			if (index >= 0) {
				return index;
			}
		}

		// Otherwise, get the recommended default
		return VersionDisplayFormatter.getDefaultChoiceIndex(choices);
	}

	/**
	 * Handle errors during version selection
	 */
	private async handleError(
		error: any,
		kit: KitConfig,
		allowManualEntry: boolean,
	): Promise<string | null> {
		// Log the detailed error
		logger.error(`Version selection error: ${error.message}`);

		// Handle different error types
		if (error.message.includes("401") || error.message.includes("403")) {
			// Authentication errors
			clack.note(
				VersionDisplayFormatter.formatError(
					"Authentication failed",
					"Please check your GitHub token with: ck auth",
				),
				pc.red("Authentication Error"),
			);
		} else if (error.message.includes("404")) {
			// Repository not found or no access
			clack.note(
				VersionDisplayFormatter.formatError(
					"Repository access denied",
					"Make sure you have access to the repository",
				),
				pc.red("Access Error"),
			);
		} else if (error.message.includes("rate limit") || error.message.includes("403")) {
			// Rate limiting
			clack.note(
				VersionDisplayFormatter.formatError(
					"GitHub API rate limit exceeded",
					"Please wait a moment and try again",
				),
				pc.yellow("Rate Limited"),
			);
		} else if (error.message.includes("network") || error.message.includes("ENOTFOUND")) {
			// Network errors
			clack.note(
				VersionDisplayFormatter.formatError(
					"Network connection failed",
					"Please check your internet connection",
				),
				pc.yellow("Network Error"),
			);
		} else {
			// Generic errors
			clack.note(
				VersionDisplayFormatter.formatError(
					error.message || "Unknown error occurred",
					"Please try again or contact support",
				),
				pc.red("Error"),
			);
		}

		// Offer retry option
		if (allowManualEntry) {
			const retry = await clack.confirm({
				message: "Would you like to try entering a version manually?",
			});

			if (clack.isCancel(retry) || !retry) {
				return null;
			}

			return await this.getManualVersion(kit);
		}

		const retry = await clack.confirm({
			message: "Would you like to retry?",
		});

		if (clack.isCancel(retry) || !retry) {
			return null;
		}

		// Retry the selection
		return this.selectVersion({
			kit,
			includePrereleases: false,
			allowManualEntry,
		});
	}

	/**
	 * Quickly retrieves the latest version without user interaction.
	 *
	 * This method provides a fast way to get the most recent version for automation
	 * or non-interactive use cases. It uses caching and minimal network requests.
	 *
	 * @param kit - The kit configuration to get the latest version for
	 * @param includePrereleases - Whether to include pre-release versions (default: false)
	 * @returns Promise resolving to the latest version tag or null if no versions available
	 *
	 * @example
	 * ```typescript
	 * const selector = new VersionSelector();
	 * const latest = await selector.getLatestVersion(claudekitConfig);
	 * if (latest) {
	 *   console.log(`Latest version: ${latest}`);
	 * }
	 * ```
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

			// Return the first (latest) version
			return releases[0].tag_name;
		} catch (error) {
			logger.error(`Failed to get latest version for ${kit.name}: ${error}`);
			return null;
		}
	}
}
