import type { EnrichedRelease, FilterOptions, GitHubRelease } from "@/types";
import { VersionFormatter } from "./version-formatter.js";

export class ReleaseFilter {
	/**
	 * Filters releases based on type criteria such as drafts and prereleases.
	 *
	 * Provides flexible filtering options to include or exclude draft releases
	 * and prerelease versions based on the provided options.
	 *
	 * @param releases - Array of GitHub releases to filter
	 * @param options - Filter configuration options
	 * @param options.includeDrafts - Whether to include draft releases (default: false)
	 * @param options.includePrereleases - Whether to include prerelease versions (default: false)
	 * @returns Filtered array of GitHub releases
	 *
	 * @example
	 * ```typescript
	 * const filtered = ReleaseFilter.filterByType(releases, {
	 *   includeDrafts: false,
	 *   includePrereleases: true
	 * });
	 * ```
	 */
	static filterByType(releases: GitHubRelease[], options: FilterOptions = {}): GitHubRelease[] {
		return releases.filter((release) => {
			// Exclude drafts unless explicitly included
			if (!options.includeDrafts && release.draft) {
				return false;
			}

			// Exclude prereleases unless explicitly included
			if (!options.includePrereleases && release.prerelease) {
				return false;
			}

			return true;
		});
	}

	/**
	 * Sort releases by published date or version
	 */
	static sortByDate(releases: GitHubRelease[], order: "asc" | "desc" = "desc"): GitHubRelease[] {
		return [...releases].sort((a, b) => {
			if (!a.published_at && !b.published_at) return 0;
			if (!a.published_at) return order === "desc" ? 1 : -1;
			if (!b.published_at) return order === "desc" ? -1 : 1;

			const dateA = new Date(a.published_at).getTime();
			const dateB = new Date(b.published_at).getTime();

			return order === "desc" ? dateB - dateA : dateA - dateB;
		});
	}

	/**
	 * Sort releases by semantic version
	 */
	static sortByVersion(releases: GitHubRelease[], order: "asc" | "desc" = "desc"): GitHubRelease[] {
		return [...releases].sort((a, b) => {
			const comparison = VersionFormatter.compare(a.tag_name, b.tag_name);
			return order === "desc" ? -comparison : comparison;
		});
	}

	/**
	 * Tag latest stable and beta releases in enriched releases
	 */
	static tagLatest(releases: EnrichedRelease[]): EnrichedRelease[] {
		// Create a copy to avoid mutating the original
		const enriched = releases.map((release) => ({ ...release }));

		// Find latest stable release (non-prerelease, non-draft) - sorted by version desc
		const stableReleases = enriched
			.filter((release) => !release.prerelease && !release.draft)
			.sort((a, b) => -VersionFormatter.compare(a.tag_name, b.tag_name));
		const latestStable = stableReleases.length > 0 ? stableReleases[0] : null;

		// Find latest beta release (prerelease, non-draft) - sorted by version desc
		const betaReleases = enriched
			.filter((release) => release.prerelease && !release.draft)
			.sort((a, b) => -VersionFormatter.compare(a.tag_name, b.tag_name));
		const latestBeta = betaReleases.length > 0 ? betaReleases[0] : null;

		// Tag the releases
		for (const release of enriched) {
			if (latestStable && release.id === latestStable.id) {
				release.isLatestStable = true;
			}
			if (latestBeta && release.id === latestBeta.id) {
				release.isLatestBeta = true;
			}
		}

		return enriched;
	}

	/**
	 * Applies comprehensive filtering and sorting to releases with metadata enrichment.
	 *
	 * This is the main processing method that combines filtering, sorting, enrichment,
	 * and tagging to produce a complete set of version choices for display.
	 *
	 * @param releases - Array of GitHub releases to process
	 * @param options - Comprehensive processing options
	 * @param options.includeDrafts - Whether to include draft releases (default: false)
	 * @param options.includePrereleases - Whether to include prerelease versions (default: false)
	 * @param options.sortBy - Sort method: 'date' or 'version' (default: 'date')
	 * @param options.order - Sort order: 'asc' or 'desc' (default: 'desc')
	 * @param options.limit - Maximum number of releases to return (default: all)
	 * @returns Enriched releases with metadata and latest tags
	 *
	 * @example
	 * ```typescript
	 * const enriched = ReleaseFilter.processReleases(releases, {
	 *   includePrereleases: true,
	 *   sortBy: 'version',
	 *   limit: 20
	 * });
	 * ```
	 */
	static processReleases(
		releases: GitHubRelease[],
		options: FilterOptions = {},
	): EnrichedRelease[] {
		// Step 1: Filter by type
		let filtered = ReleaseFilter.filterByType(releases, options);

		// Step 2: Sort by date (newest first) or version
		if (options.sortBy === "version") {
			filtered = ReleaseFilter.sortByVersion(filtered, options.order);
		} else {
			filtered = ReleaseFilter.sortByDate(filtered, options.order);
		}

		// Step 3: Apply limit if specified
		if (options.limit && options.limit > 0) {
			filtered = filtered.slice(0, options.limit);
		}

		// Step 4: Enrich with metadata
		let enriched = VersionFormatter.enrichReleases(filtered);

		// Step 5: Tag latest releases
		enriched = ReleaseFilter.tagLatest(enriched);

		return enriched;
	}

	/**
	 * Filter releases by version pattern (e.g., "1.8.*", "^1.0.0")
	 */
	static filterByVersionPattern(releases: GitHubRelease[], pattern: string): GitHubRelease[] {
		return releases.filter((release) => {
			const version = VersionFormatter.normalize(release.tag_name);
			const parsed = VersionFormatter.parseVersion(version);

			if (!parsed) return false;

			// Handle wildcard patterns like "1.8.*"
			if (pattern.includes("*")) {
				const patternParts = pattern.split(".");
				const versionParts = version.split(".");

				return patternParts.every((part, index) => {
					if (part === "*") return true;
					return part === versionParts[index];
				});
			}

			// Handle caret patterns like "^1.0.0"
			if (pattern.startsWith("^")) {
				const baseVersion = pattern.slice(1);
				const baseParsed = VersionFormatter.parseVersion(baseVersion);
				if (!baseParsed) return false;

				// Must be same major version and >= specified version
				return (
					parsed.major === baseParsed.major && VersionFormatter.compare(version, baseVersion) >= 0
				);
			}

			// Handle tilde patterns like "~1.0.0"
			if (pattern.startsWith("~")) {
				const baseVersion = pattern.slice(1);
				const baseParsed = VersionFormatter.parseVersion(baseVersion);
				if (!baseParsed) return false;

				// Must be same major.minor version and >= specified version
				return (
					parsed.major === baseParsed.major &&
					parsed.minor === baseParsed.minor &&
					VersionFormatter.compare(version, baseVersion) >= 0
				);
			}

			// Exact match
			return VersionFormatter.normalize(pattern) === version;
		});
	}

	/**
	 * Get stable releases only
	 */
	static getStableReleases(releases: GitHubRelease[]): GitHubRelease[] {
		return ReleaseFilter.filterByType(releases, {
			includeDrafts: false,
			includePrereleases: false,
		});
	}

	/**
	 * Get prerelease versions only
	 */
	static getPrereleaseReleases(releases: GitHubRelease[]): GitHubRelease[] {
		return ReleaseFilter.filterByType(releases, {
			includeDrafts: false,
			includePrereleases: true,
		}).filter((release) => release.prerelease);
	}

	/**
	 * Get recent releases within the last N days
	 */
	static getRecentReleases(releases: GitHubRelease[], days = 30): GitHubRelease[] {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);

		return releases.filter((release) => {
			if (!release.published_at) return false;
			const releaseDate = new Date(release.published_at);
			return releaseDate >= cutoffDate;
		});
	}

	/**
	 * Get the latest stable release by semantic version.
	 * Returns the highest semver non-prerelease, non-draft release.
	 *
	 * IMPORTANT: Do NOT trust GitHub API order - it uses lexicographic sorting
	 * for same-day releases (e.g., "beta.10" < "beta.4"). Always sort by semver.
	 *
	 * @see https://github.com/mrgoonie/claudekit-cli/issues/256
	 */
	static getLatestStable(releases: GitHubRelease[]): GitHubRelease | null {
		const stableReleases = releases
			.filter((r) => !r.prerelease && !r.draft)
			.sort((a, b) => -VersionFormatter.compare(a.tag_name, b.tag_name));
		return stableReleases.length > 0 ? stableReleases[0] : null;
	}

	/**
	 * Get the latest prerelease by semantic version.
	 * Returns the highest semver prerelease (beta/alpha/rc) release.
	 *
	 * IMPORTANT: Do NOT trust GitHub API order - it uses lexicographic sorting
	 * for same-day releases (e.g., "beta.10" < "beta.4"). Always sort by semver.
	 *
	 * @see https://github.com/mrgoonie/claudekit-cli/issues/256
	 */
	static getLatestPrerelease(releases: GitHubRelease[]): GitHubRelease | null {
		const prereleases = releases
			.filter((r) => r.prerelease && !r.draft)
			.sort((a, b) => -VersionFormatter.compare(a.tag_name, b.tag_name));
		return prereleases.length > 0 ? prereleases[0] : null;
	}
}
