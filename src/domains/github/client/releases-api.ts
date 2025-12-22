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
	 * Apply prerelease fallback when no stable releases found
	 * @returns Processed releases (with prereleases if fallback triggered)
	 */
	private applyPrereleasesFallback(
		processed: EnrichedRelease[],
		releases: GitHubRelease[],
		limit: number,
		includePrereleases: boolean,
	): EnrichedRelease[] {
		if (processed.length === 0 && !includePrereleases) {
			logger.debug("No stable releases found, falling back to prereleases");
			const withPrereleases = ReleaseFilter.processReleases(releases, {
				includeDrafts: false,
				includePrereleases: true,
				limit,
				sortBy: "date",
				order: "desc",
			});
			if (withPrereleases.length > 0) {
				logger.warning("No stable releases available. Showing prereleases instead.");
			}
			return withPrereleases;
		}
		return processed;
	}

	/**
	 * Get latest release for a kit
	 * Falls back to latest prerelease if no stable releases exist
	 */
	async getLatestRelease(kit: KitConfig, includePrereleases = false): Promise<GitHubRelease> {
		try {
			const client = await this.getClient();

			// If prereleases are requested, fetch releases and find the first prerelease
			if (includePrereleases) {
				logger.debug(`Fetching latest prerelease for ${kit.owner}/${kit.repo}`);
				const releases = await this.listReleases(kit, 100);

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

			try {
				const { data } = await client.repos.getLatestRelease({
					owner: kit.owner,
					repo: kit.repo,
				});
				return GitHubReleaseSchema.parse(data);
			} catch (stableError: any) {
				// If no stable release exists (404), fall back to latest prerelease
				if (stableError?.status === 404) {
					logger.debug("No stable release found, checking for prereleases...");
					const releases = await this.listReleases(kit, 100);
					const latestPrerelease = releases.find((r) => r.prerelease && !r.draft);

					if (latestPrerelease) {
						logger.warning(
							`No stable release available. Using latest prerelease: ${latestPrerelease.tag_name}`,
						);
						return latestPrerelease;
					}
				}
				throw stableError;
			}
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
	 * List all releases for a kit with automatic pagination
	 * @param kit - Kit configuration
	 * @param limit - Max releases to fetch (will paginate if needed)
	 * @param stopWhenStableFound - Stop paginating once a stable release is found
	 */
	async listReleases(
		kit: KitConfig,
		limit = 100,
		stopWhenStableFound = false,
	): Promise<GitHubRelease[]> {
		try {
			const client = await this.getClient();
			const allReleases: GitHubRelease[] = [];
			let page = 1;
			const perPage = Math.min(limit, 100); // GitHub max is 100

			logger.debug(`Listing releases for ${kit.owner}/${kit.repo}`);

			while (allReleases.length < limit) {
				const { data } = await client.repos.listReleases({
					owner: kit.owner,
					repo: kit.repo,
					per_page: perPage,
					page,
				});

				if (data.length === 0) break; // No more releases

				const parsed = data.map((release) => GitHubReleaseSchema.parse(release));
				allReleases.push(...parsed);

				// Early exit: stop if we found a stable release
				if (stopWhenStableFound) {
					const hasStable = allReleases.some((r) => !r.prerelease && !r.draft);
					if (hasStable) {
						logger.debug(`Found stable release on page ${page}, stopping pagination`);
						break;
					}
				}

				// No more pages
				if (data.length < perPage) break;

				page++;
				// Safety limit: max 5 pages (500 releases)
				if (page > 5) {
					logger.debug("Reached pagination limit (5 pages)");
					break;
				}
			}

			return allReleases.slice(0, limit);
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
	 * Falls back to prereleases if no stable releases exist
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

		// Fetch more releases to ensure filtering has enough candidates
		// Use limit * 3 to account for filtering (similar to getVersionsByPattern)
		const fetchLimit = Math.min(limit * 3, 100);

		// Generate cache key based on kit and fetch options
		const cacheKey = `${kit.repo}-${fetchLimit}-${includePrereleases}`;

		try {
			// Try to get from cache first (unless force refresh)
			if (forceRefresh) {
				logger.debug("Bypassing cache (--refresh flag) - fetching from GitHub API");
			}
			if (!forceRefresh) {
				const cachedReleases = await this.releaseCache.get(cacheKey);
				if (cachedReleases) {
					logger.debug(`Using cached releases for ${kit.name}`);
					const processed = ReleaseFilter.processReleases(cachedReleases, {
						includeDrafts: false,
						includePrereleases,
						limit,
						sortBy: "date",
						order: "desc",
					});
					return this.applyPrereleasesFallback(
						processed,
						cachedReleases,
						limit,
						includePrereleases,
					);
				}
			}

			// Fetch from API if cache miss or force refresh
			// Use pagination with early exit when looking for stable releases
			logger.debug(`Fetching releases from API for ${kit.name}`);
			const stopWhenStableFound = !includePrereleases;
			const releases = await this.listReleases(kit, fetchLimit, stopWhenStableFound);

			// Cache the raw releases
			await this.releaseCache.set(cacheKey, releases);

			// Process and return enriched releases
			const processed = ReleaseFilter.processReleases(releases, {
				includeDrafts: false,
				includePrereleases,
				limit,
				sortBy: "date",
				order: "desc",
			});

			return this.applyPrereleasesFallback(processed, releases, limit, includePrereleases);
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
