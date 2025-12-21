/**
 * GitHub Releases API operations
 */
import { ReleaseCache } from "@/domains/versioning/release-cache.js";
import { ReleaseFilter } from "@/domains/versioning/release-filter.js";
import { logger } from "@/shared/logger.js";
import {
	type EnrichedRelease,
	GitHubError,
	type GitHubRelease,
	GitHubReleaseSchema,
	type KitConfig,
} from "@/types";
import type { Octokit } from "@octokit/rest";
import { handleHttpError } from "./error-handler.js";

export class ReleasesApi {
	private releaseCache = new ReleaseCache();

	constructor(private getClient: () => Promise<Octokit>) {}

	/**
	 * Get latest release for a kit
	 */
	async getLatestRelease(kit: KitConfig, includePrereleases = false): Promise<GitHubRelease> {
		try {
			const client = await this.getClient();

			// If prereleases are requested, fetch all releases and find the first prerelease
			if (includePrereleases) {
				logger.debug(`Fetching latest prerelease for ${kit.owner}/${kit.repo}`);
				const releases = await this.listReleases(kit, 30);

				// Find the first prerelease
				const prereleaseVersion = releases.find((r) => r.prerelease);

				if (prereleaseVersion) {
					logger.debug(`Found prerelease version: ${prereleaseVersion.tag_name}`);
					return prereleaseVersion;
				}

				// Fall back to latest stable if no prereleases found
				logger.warning("No prerelease versions found, falling back to latest stable release");
			}

			logger.debug(`Fetching latest release for ${kit.owner}/${kit.repo}`);

			const { data } = await client.repos.getLatestRelease({
				owner: kit.owner,
				repo: kit.repo,
			});

			return GitHubReleaseSchema.parse(data);
		} catch (error: any) {
			return handleHttpError(error, {
				kit,
				operation: "fetch release",
				verboseFlag: "ck new --verbose",
			});
		}
	}

	/**
	 * Get specific release by version tag
	 */
	async getReleaseByTag(kit: KitConfig, tag: string): Promise<GitHubRelease> {
		try {
			const client = await this.getClient();

			logger.debug(`Fetching release ${tag} for ${kit.owner}/${kit.repo}`);

			const { data } = await client.repos.getReleaseByTag({
				owner: kit.owner,
				repo: kit.repo,
				tag,
			});

			return GitHubReleaseSchema.parse(data);
		} catch (error: any) {
			// Custom 404 message for specific release tag
			if (error?.status === 404) {
				throw new GitHubError(
					`Release '${tag}' not found for ${kit.name}.\n\nPossible causes:\n  • Release version doesn't exist (check: ck versions --kit ${kit.name.toLowerCase()})\n  • You don't have repository access\n\nSolutions:\n  1. List available versions: ck versions --kit ${kit.name.toLowerCase()}\n  2. Check email for GitHub invitation and accept it\n  3. Re-authenticate: gh auth login (select 'Login with a web browser')\n\nNeed help? Run with: ck new --verbose`,
					404,
				);
			}
			return handleHttpError(error, {
				kit,
				operation: "fetch release",
				verboseFlag: "ck new --verbose",
			});
		}
	}

	/**
	 * List all releases for a kit
	 */
	async listReleases(kit: KitConfig, limit = 10): Promise<GitHubRelease[]> {
		try {
			const client = await this.getClient();

			logger.debug(`Listing releases for ${kit.owner}/${kit.repo}`);

			const { data } = await client.repos.listReleases({
				owner: kit.owner,
				repo: kit.repo,
				per_page: limit,
			});

			return data.map((release) => GitHubReleaseSchema.parse(release));
		} catch (error: any) {
			return handleHttpError(error, {
				kit,
				operation: "list releases",
				verboseFlag: "ck versions --verbose",
			});
		}
	}

	/**
	 * List releases with caching and filtering
	 */
	async listReleasesWithCache(
		kit: KitConfig,
		options: {
			limit?: number;
			includePrereleases?: boolean;
			forceRefresh?: boolean;
		} = {},
	): Promise<EnrichedRelease[]> {
		const { limit = 10, includePrereleases = false, forceRefresh = false } = options;

		// Generate cache key based on kit and options
		const cacheKey = `${kit.repo}-${limit}-${includePrereleases}`;

		try {
			// Try to get from cache first (unless force refresh)
			if (forceRefresh) {
				logger.debug("Bypassing cache (--refresh flag) - fetching from GitHub API");
			}
			if (!forceRefresh) {
				const cachedReleases = await this.releaseCache.get(cacheKey);
				if (cachedReleases) {
					logger.debug(`Using cached releases for ${kit.name}`);
					return ReleaseFilter.processReleases(cachedReleases, {
						includeDrafts: false,
						includePrereleases,
						limit,
						sortBy: "date",
						order: "desc",
					});
				}
			}

			// Fetch from API if cache miss or force refresh
			logger.debug(`Fetching releases from API for ${kit.name}`);
			const releases = await this.listReleases(kit, limit * 2); // Fetch more to account for filtering

			// Cache the raw releases
			await this.releaseCache.set(cacheKey, releases);

			// Process and return enriched releases
			return ReleaseFilter.processReleases(releases, {
				includeDrafts: false,
				includePrereleases,
				limit,
				sortBy: "date",
				order: "desc",
			});
		} catch (error: any) {
			logger.error(`Failed to list releases with cache for ${kit.name}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get versions by pattern (e.g., "1.8.*", "^1.0.0")
	 */
	async getVersionsByPattern(
		kit: KitConfig,
		pattern: string,
		options: {
			limit?: number;
			includePrereleases?: boolean;
		} = {},
	): Promise<EnrichedRelease[]> {
		const { limit = 10, includePrereleases = false } = options;

		try {
			// Get all releases (without pattern filtering)
			const allReleases = await this.listReleasesWithCache(kit, {
				limit: limit * 3, // Fetch more to ensure we have enough after pattern filtering
				includePrereleases,
				forceRefresh: false,
			});

			// Filter by pattern
			const patternReleases = ReleaseFilter.filterByVersionPattern(allReleases, pattern);

			// Apply limit and enrich
			const filteredReleases = ReleaseFilter.processReleases(patternReleases, {
				includeDrafts: false,
				includePrereleases,
				limit,
				sortBy: "version",
				order: "desc",
			});

			return filteredReleases;
		} catch (error: any) {
			logger.error(
				`Failed to get versions by pattern ${pattern} for ${kit.name}: ${error.message}`,
			);
			throw error;
		}
	}

	/**
	 * Clear release cache for a kit or all caches
	 */
	async clearReleaseCache(kit?: KitConfig): Promise<void> {
		try {
			if (kit) {
				// Clear cache for specific kit
				await this.releaseCache.clear();
				logger.debug(`Cleared release cache for ${kit.name}`);
			} else {
				// Clear all release caches
				await this.releaseCache.clear();
				logger.debug("Cleared all release caches");
			}
		} catch (error: any) {
			logger.error(`Failed to clear release cache: ${error.message}`);
			throw error;
		}
	}
}
