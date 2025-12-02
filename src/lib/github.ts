import { Octokit } from "@octokit/rest";
import {
	type EnrichedRelease,
	GitHubError,
	type GitHubRelease,
	GitHubReleaseSchema,
	type KitConfig,
} from "../types.js";
import { logger } from "../utils/logger.js";
import { AuthManager } from "./auth.js";
import { ReleaseCache } from "./release-cache.js";
import { ReleaseFilter } from "./release-filter.js";

export class GitHubClient {
	private octokit: Octokit | null = null;
	private releaseCache = new ReleaseCache();

	/**
	 * Initialize Octokit client with authentication
	 */
	private async getClient(): Promise<Octokit> {
		if (this.octokit) {
			return this.octokit;
		}

		const { token } = await AuthManager.getToken();

		this.octokit = new Octokit({
			auth: token,
			userAgent: "claudekit-cli",
			request: {
				timeout: 30000, // 30 seconds
			},
		});

		return this.octokit;
	}

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
			return this.handleHttpError(error, {
				kit,
				operation: "fetch release",
				verboseFlag: "ck new --verbose",
			});
		}
	}

	/**
	 * Invalidate cached authentication on 401 errors
	 */
	private async invalidateAuth(): Promise<void> {
		await AuthManager.clearToken();
		this.octokit = null;
		logger.debug("Invalidated cached authentication due to 401 error");
	}

	/**
	 * Handle common HTTP errors (401, 403, 404) with consistent error messages
	 */
	private async handleHttpError(
		error: any,
		context: { kit: KitConfig; operation: string; verboseFlag?: string },
	): Promise<never> {
		const { kit, operation, verboseFlag = "ck new --verbose" } = context;

		if (error?.status === 401) {
			await this.invalidateAuth();
			throw new GitHubError(
				`Authentication failed.\n\nYour GitHub CLI session may have expired.\n\nSolution: Re-authenticate with GitHub CLI\n  gh auth login\n\nNeed help? Run with: ${verboseFlag}`,
				401,
			);
		}

		if (error?.status === 403) {
			throw new GitHubError(
				`Access forbidden.\n\nYour GitHub CLI session may lack required permissions.\n\nSolution: Re-authenticate with GitHub CLI\n  gh auth login\n\nNeed help? Run with: ${verboseFlag}`,
				403,
			);
		}

		if (error?.status === 404) {
			throw new GitHubError(
				`Cannot access ${kit.name} repository.\n\nPossible causes:\n  • You haven't accepted the GitHub repository invitation\n  • You're not added as a collaborator yet\n  • Repository doesn't exist\n\nSolutions:\n  1. Check email for GitHub invitation and accept it\n  2. Re-authenticate: gh auth login\n  3. Wait 2-5 minutes after accepting invitation for permissions to sync\n\nNeed help? Run with: ${verboseFlag}`,
				404,
			);
		}

		throw new GitHubError(
			`Failed to ${operation}: ${error?.message || "Unknown error"}`,
			error?.status,
		);
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
					`Release '${tag}' not found for ${kit.name}.\n\nPossible causes:\n  • Release version doesn't exist (check: ck versions --kit ${kit.name.toLowerCase()})\n  • You don't have repository access\n\nSolutions:\n  1. List available versions: ck versions --kit ${kit.name.toLowerCase()}\n  2. Check email for GitHub invitation and accept it\n  3. Re-authenticate: gh auth login\n\nNeed help? Run with: ck new --verbose`,
					404,
				);
			}
			return this.handleHttpError(error, {
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
			return this.handleHttpError(error, {
				kit,
				operation: "list releases",
				verboseFlag: "ck versions --verbose",
			});
		}
	}

	/**
	 * Check if user has access to repository
	 * Throws detailed error messages for common auth issues
	 */
	async checkAccess(kit: KitConfig): Promise<boolean> {
		try {
			const client = await this.getClient();

			await client.repos.get({
				owner: kit.owner,
				repo: kit.repo,
			});

			return true;
		} catch (error: any) {
			// Custom 404 with additional account verification hint
			if (error?.status === 404) {
				throw new GitHubError(
					`Cannot access ${kit.name} repository.\n\nPossible causes:\n  • You haven't accepted the GitHub repository invitation\n  • You're not added as a collaborator yet\n  • You're logged into a different GitHub account\n\nSolutions:\n  1. Check email for GitHub invitation and accept it\n  2. Re-authenticate: gh auth login\n  3. Verify you're using the correct GitHub account\n  4. Wait 2-5 minutes after accepting invitation for permissions to sync\n\nNeed help? Run with: ck new --verbose`,
					404,
				);
			}
			return this.handleHttpError(error, {
				kit,
				operation: "check repository access",
				verboseFlag: "ck new --verbose",
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

	/**
	 * Get downloadable asset or source code URL from release
	 * Priority:
	 * 1. "ClaudeKit Engineer Package" or "ClaudeKit Marketing Package" zip file
	 * 2. Other custom uploaded assets (.tar.gz, .tgz, .zip) excluding "Source code" archives
	 * 3. GitHub's automatic tarball URL
	 */
	static getDownloadableAsset(release: GitHubRelease): {
		type: "asset" | "tarball" | "zipball";
		url: string;
		name: string;
		size?: number;
	} {
		// Log all available assets for debugging
		logger.debug(`Available assets for ${release.tag_name}:`);
		if (release.assets.length === 0) {
			logger.debug("  No custom assets found");
		} else {
			release.assets.forEach((asset, index) => {
				logger.debug(`  ${index + 1}. ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);
			});
		}

		// First priority: Look for official ClaudeKit package assets
		const packageAsset = release.assets.find((a) => {
			const nameLower = a.name.toLowerCase();
			return (
				nameLower.includes("claudekit") &&
				nameLower.includes("package") &&
				nameLower.endsWith(".zip")
			);
		});

		if (packageAsset) {
			logger.debug(`✓ Selected ClaudeKit package asset: ${packageAsset.name}`);
			return {
				type: "asset",
				url: packageAsset.url, // Use API endpoint for authenticated downloads
				name: packageAsset.name,
				size: packageAsset.size,
			};
		}

		logger.debug("⚠ No ClaudeKit package asset found, checking for other custom assets...");

		// Second priority: Look for any custom uploaded assets (excluding GitHub's automatic source code archives)
		const customAsset = release.assets.find(
			(a) =>
				(a.name.endsWith(".tar.gz") || a.name.endsWith(".tgz") || a.name.endsWith(".zip")) &&
				!a.name.toLowerCase().startsWith("source") &&
				!a.name.toLowerCase().includes("source code"),
		);

		if (customAsset) {
			logger.debug(`✓ Selected custom asset: ${customAsset.name}`);
			return {
				type: "asset",
				url: customAsset.url, // Use API endpoint for authenticated downloads
				name: customAsset.name,
				size: customAsset.size,
			};
		}

		// Fall back to GitHub's automatic tarball
		logger.debug("⚠ No custom assets found, falling back to GitHub automatic tarball");
		return {
			type: "tarball",
			url: release.tarball_url,
			name: `${release.tag_name}.tar.gz`,
			size: undefined, // Size unknown for automatic tarballs
		};
	}
}
