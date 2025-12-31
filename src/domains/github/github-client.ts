/**
 * GitHub Client Facade
 * Main entry point for GitHub API operations.
 */
import type { EnrichedRelease, GitHubRelease, KitConfig } from "@/types";
import {
	ReleasesApi,
	RepoApi,
	getDownloadableAsset as getAsset,
	getAuthenticatedClient,
} from "./client/index.js";

export class GitHubClient {
	private releasesApi: ReleasesApi;
	private repoApi: RepoApi;

	constructor() {
		this.releasesApi = new ReleasesApi(getAuthenticatedClient);
		this.repoApi = new RepoApi(getAuthenticatedClient);
	}

	/**
	 * Get latest release for a kit
	 */
	async getLatestRelease(kit: KitConfig, includePrereleases = false): Promise<GitHubRelease> {
		return this.releasesApi.getLatestRelease(kit, includePrereleases);
	}

	/**
	 * Get specific release by version tag
	 */
	async getReleaseByTag(kit: KitConfig, tag: string): Promise<GitHubRelease> {
		return this.releasesApi.getReleaseByTag(kit, tag);
	}

	/**
	 * List all releases for a kit
	 */
	async listReleases(kit: KitConfig, limit = 10): Promise<GitHubRelease[]> {
		return this.releasesApi.listReleases(kit, limit);
	}

	/**
	 * Check if user has access to repository
	 */
	async checkAccess(kit: KitConfig): Promise<boolean> {
		return this.repoApi.checkAccess(kit);
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
		return this.releasesApi.listReleasesWithCache(kit, options);
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
		return this.releasesApi.getVersionsByPattern(kit, pattern, options);
	}

	/**
	 * Clear release cache for a kit or all caches
	 */
	async clearReleaseCache(kit?: KitConfig): Promise<void> {
		return this.releasesApi.clearReleaseCache(kit);
	}

	/**
	 * Get downloadable asset or source code URL from release
	 */
	static getDownloadableAsset(release: GitHubRelease): {
		type: "asset" | "tarball" | "zipball";
		url: string;
		name: string;
		size?: number;
	} {
		return getAsset(release);
	}
}
