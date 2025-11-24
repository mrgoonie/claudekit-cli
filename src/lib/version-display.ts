import pc from "picocolors";
import { type EnrichedRelease } from "../types.js";

export interface VersionChoice {
	value: string;        // Version tag (e.g., "v1.8.0")
	label: string;        // Formatted display
	hint?: string;        // Additional info
	isLatest?: boolean;
	isPrerelease?: boolean;
}

export class VersionDisplayFormatter {
	/**
	 * Creates colored status badges for release display.
	 *
	 * Generates visual indicators for release status including latest, beta,
	 * stable, and draft states with appropriate colors and formatting.
	 *
	 * @param release - The enriched release object with status flags
	 * @returns Formatted string containing colored badges or empty string if no badges
	 *
	 * @example
	 * ```typescript
	 * const badges = VersionDisplayFormatter.createBadges(enrichedRelease);
	 * console.log(`v1.2.3${badges}`); // Output: v1.2.3 [latest] [stable]
	 * ```
	 */
	static createBadges(release: EnrichedRelease): string {
		const badges: string[] = [];

		if (release.isLatestStable) {
			badges.push(pc.bold(pc.yellow("[latest]")));
		}

		if (release.prerelease || release.isLatestBeta) {
			if (release.isLatestBeta) {
				badges.push(pc.bold(pc.magenta("[beta]")));
			} else {
				badges.push(pc.magenta("[prerelease]"));
			}
		} else if (!release.draft) {
			badges.push(pc.blue("[stable]"));
		}

		if (release.draft) {
			badges.push(pc.gray("[draft]"));
		}

		return badges.length > 0 ? ` ${badges.join(" ")}` : "";
	}

	/**
	 * Format the main label for a version choice
	 */
	static formatChoiceLabel(release: EnrichedRelease): string {
		const version = pc.green(release.displayVersion);
		const badges = VersionDisplayFormatter.createBadges(release);
		const name = release.name || "Release";

		return `${version}${badges} ${pc.dim(name)}`;
	}

	/**
	 * Format the hint/metadata for a version choice
	 */
	static formatChoiceHint(release: EnrichedRelease): string {
		const parts: string[] = [];

		// Relative time
		if (release.relativeTime && release.relativeTime !== "Unknown") {
			parts.push(release.relativeTime);
		}

		// Asset count
		if (release.assetCount > 0) {
			const assetText = release.assetCount === 1 ? "asset" : "assets";
			parts.push(`${release.assetCount} ${assetText}`);
		}

		// Version number (normalized)
		if (release.normalizedVersion !== release.displayVersion) {
			parts.push(`(${release.normalizedVersion})`);
		}

		return parts.length > 0 ? parts.join(", ") : "";
	}

	/**
	 * Create special options like "Latest Stable", "Latest Beta"
	 */
	static createSpecialOptions(releases: EnrichedRelease[]): VersionChoice[] {
		const options: VersionChoice[] = [];

		// Find latest stable
		const latestStable = releases.find(r => r.isLatestStable && !r.prerelease);
		if (latestStable) {
			options.push({
				value: latestStable.tag_name,
				label: `${pc.bold(pc.green("Latest Stable"))} (${latestStable.displayVersion})`,
				hint: "recommended version",
				isLatest: true,
				isPrerelease: false,
			});
		}

		// Find latest beta/prerelease
		const latestBeta = releases.find(r => r.isLatestBeta || (r.prerelease && !r.draft));
		if (latestBeta) {
			options.push({
				value: latestBeta.tag_name,
				label: `${pc.bold(pc.magenta("Latest Beta"))} (${latestBeta.displayVersion})`,
				hint: "latest features, may be unstable",
				isLatest: false,
				isPrerelease: true,
			});
		}

		return options;
	}

	/**
	 * Create a separator choice
	 */
	static createSeparator(): VersionChoice {
		return {
			value: "separator",
			label: pc.dim("─".repeat(50)),
			hint: undefined,
			isLatest: false,
			isPrerelease: false,
		};
	}

	/**
	 * Create cancel option
	 */
	static createCancelOption(): VersionChoice {
		return {
			value: "cancel",
			label: pc.red("Cancel"),
			hint: "exit version selection",
			isLatest: false,
			isPrerelease: false,
		};
	}

	/**
	 * Format a complete version choice with label and hint
	 */
	static formatVersionChoice(release: EnrichedRelease): VersionChoice {
		return {
			value: release.tag_name,
			label: VersionDisplayFormatter.formatChoiceLabel(release),
			hint: VersionDisplayFormatter.formatChoiceHint(release),
			isLatest: release.isLatestStable,
			isPrerelease: release.prerelease,
		};
	}

	/**
	 * Format multiple releases into choices
	 */
	static formatReleasesToChoices(
		releases: EnrichedRelease[],
		includeSpecialOptions = true,
		limit = 30
	): VersionChoice[] {
		const choices: VersionChoice[] = [];

		// Add special options first
		if (includeSpecialOptions) {
			const specialOptions = VersionDisplayFormatter.createSpecialOptions(releases);
			choices.push(...specialOptions);

			// Add separator if we have special options and regular releases
			if (specialOptions.length > 0 && releases.length > 0) {
				choices.push(VersionDisplayFormatter.createSeparator());
			}
		}

		// Add regular releases (limited)
		const limitedReleases = releases.slice(0, limit);
		for (const release of limitedReleases) {
			choices.push(VersionDisplayFormatter.formatVersionChoice(release));
		}

		// Add cancel option at the end
		if (includeSpecialOptions) {
			choices.push(VersionDisplayFormatter.createSeparator());
			choices.push(VersionDisplayFormatter.createCancelOption());
		}

		return choices;
	}

	/**
	 * Get default selection index (usually "Latest Stable")
	 */
	static getDefaultChoiceIndex(choices: VersionChoice[]): number {
		// Find the "Latest Stable" option
		for (let i = 0; i < choices.length; i++) {
			const choice = choices[i];
			if (choice.isLatest && !choice.isPrerelease) {
				return i;
			}
		}

		// Fallback to first non-separator choice
		for (let i = 0; i < choices.length; i++) {
			if (choices[i].value !== "separator") {
				return i;
			}
		}

		return 0;
	}

	/**
	 * Validate if a choice value is a valid version selection
	 */
	static isValidVersionChoice(value: string): boolean {
		return value !== "separator" && value !== "cancel" && value.trim().length > 0;
	}

	/**
	 * Create error message for version selection
	 */
	static formatError(message: string, suggestion?: string): string {
		let output = pc.red(`Error: ${message}`);
		if (suggestion) {
			output += `\n${pc.dim(suggestion)}`;
		}
		return output;
	}

	/**
	 * Create success message for version selection
	 */
	static formatSuccess(version: string, kitName: string): string {
		return `${pc.green("✓")} Selected ${pc.bold(version)} for ${pc.bold(kitName)}`;
	}
}