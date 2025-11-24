import { Octokit } from "@octokit/rest";
import { GitHubError, type GitHubRelease, GitHubReleaseSchema, type KitConfig, type EnrichedRelease } from "../types.js";
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
			if (error?.status === 404) {
				throw new GitHubError(
					`Cannot access ${kit.name} repository.\n\nPossible causes:\n  • You haven't accepted the GitHub repository invitation\n  • Your token lacks the 'repo' scope (needs full private repo access)\n  • You're not added as a collaborator yet\n  • Repository doesn't exist\n\nSolutions:\n  1. Check email for GitHub invitation and accept it\n  2. Use 'gh auth login' for automatic authentication (recommended)\n  3. Recreate token with 'repo' scope: https://github.com/settings/tokens/new?scopes=repo\n  4. Wait 2-5 minutes after accepting invitation for permissions to sync\n\nNeed help? Run with: ck new --verbose`,
					404,
				);
			}
			if (error?.status === 401) {
				throw new GitHubError(
					"Authentication failed - token is invalid or expired.\n\n" +
						"Solutions:\n" +
						"  1. Use GitHub CLI (recommended): gh auth login\n" +
						"  2. Create new token: https://github.com/settings/tokens/new?scopes=repo\n" +
						`  3. Verify token format (should start with 'ghp_' or 'github_pat_')\n` +
						"  4. Check token is set: echo $GITHUB_TOKEN\n\n" +
						"Need help? Run with: ck new --verbose",
					401,
				);
			}
			if (error?.status === 403) {
				throw new GitHubError(
					"Access forbidden - token lacks required permissions.\n\n" +
						`Your token needs the 'repo' scope for private repositories.\n\n` +
						"Solutions:\n" +
						"  1. Use GitHub CLI (handles scopes automatically): gh auth login\n" +
						`  2. Recreate token with 'repo' scope: https://github.com/settings/tokens/new?scopes=repo\n` +
						"  3. Check existing token scopes: https://github.com/settings/tokens\n\n" +
						`Common mistake: Using 'public_repo' scope doesn't work for private repos.\n\n` +
						"Need help? Run with: ck new --verbose",
					403,
				);
			}
			throw new GitHubError(
				`Failed to fetch release: ${error?.message || "Unknown error"}`,
				error?.status,
			);
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
			if (error?.status === 404) {
				throw new GitHubError(
					`Release '${tag}' not found for ${kit.name}.\n\nPossible causes:\n  • Release version doesn't exist (check: ck versions --kit ${kit.name.toLowerCase()})\n  • You don't have repository access\n  • Your token lacks the 'repo' scope\n\nSolutions:\n  1. List available versions: ck versions --kit ${kit.name.toLowerCase()}\n  2. Check email for GitHub invitation and accept it\n  3. Use 'gh auth login' for automatic authentication\n  4. Recreate token: https://github.com/settings/tokens/new?scopes=repo\n\nNeed help? Run with: ck new --verbose`,
					404,
				);
			}
			if (error?.status === 401) {
				throw new GitHubError(
					"Authentication failed - token is invalid or expired.\n\n" +
						"Solutions:\n" +
						"  1. Use GitHub CLI (recommended): gh auth login\n" +
						"  2. Create new token: https://github.com/settings/tokens/new?scopes=repo\n" +
						`  3. Verify token format (should start with 'ghp_' or 'github_pat_')\n` +
						"  4. Check token is set: echo $GITHUB_TOKEN\n\n" +
						"Need help? Run with: ck new --verbose",
					401,
				);
			}
			if (error?.status === 403) {
				throw new GitHubError(
					"Access forbidden - token lacks required permissions.\n\n" +
						`Your token needs the 'repo' scope for private repositories.\n\n` +
						"Solutions:\n" +
						"  1. Use GitHub CLI (handles scopes automatically): gh auth login\n" +
						`  2. Recreate token with 'repo' scope: https://github.com/settings/tokens/new?scopes=repo\n` +
						"  3. Check existing token scopes: https://github.com/settings/tokens\n\n" +
						"Need help? Run with: ck new --verbose",
					403,
				);
			}
			throw new GitHubError(
				`Failed to fetch release: ${error?.message || "Unknown error"}`,
				error?.status,
			);
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
			if (error?.status === 401) {
				throw new GitHubError(
					"Authentication failed - token is invalid or expired.\n\n" +
						"Solutions:\n" +
						"  1. Use GitHub CLI (recommended): gh auth login\n" +
						"  2. Create new token: https://github.com/settings/tokens/new?scopes=repo\n" +
						`  3. Verify token format (should start with 'ghp_' or 'github_pat_')\n\n` +
						"Need help? Run with: ck versions --verbose",
					401,
				);
			}
			if (error?.status === 403) {
				throw new GitHubError(
					"Access forbidden - token lacks required permissions.\n\n" +
						`Your token needs the 'repo' scope for private repositories.\n\n` +
						"Solutions:\n" +
						"  1. Use GitHub CLI (handles scopes automatically): gh auth login\n" +
						`  2. Recreate token with 'repo' scope: https://github.com/settings/tokens/new?scopes=repo\n\n` +
						"Need help? Run with: ck versions --verbose",
					403,
				);
			}
			if (error?.status === 404) {
				throw new GitHubError(
					`Cannot access ${kit.name} repository.\n\nYou may not have been added as a collaborator yet.\n\nSolutions:\n  1. Check email for GitHub invitation and accept it\n  2. Contact support to verify repository access\n  3. Use 'gh auth login' for automatic authentication\n\nNeed help? Run with: ck versions --verbose`,
					404,
				);
			}
			throw new GitHubError(
				`Failed to list releases: ${error?.message || "Unknown error"}`,
				error?.status,
			);
		}
	}

	/**
	 * Check if user has access to repository
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
			if (error?.status === 404 || error?.status === 403) {
				return false;
			}
			throw new GitHubError(
				`Failed to check repository access: ${error?.message || "Unknown error"}`,
				error?.status,
			);
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
		} = {}
	): Promise<EnrichedRelease[]> {
		const {
			limit = 10,
			includePrereleases = false,
			forceRefresh = false,
		} = options;

		// Generate cache key based on kit and options
		const cacheKey = `${kit.repo}-${limit}-${includePrereleases}`;

		try {
			// Try to get from cache first (unless force refresh)
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
		} = {}
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
			const patternReleases = ReleaseFilter.filterByVersionPattern(
				allReleases,
				pattern
			);

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
			logger.error(`Failed to get versions by pattern ${pattern} for ${kit.name}: ${error.message}`);
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
