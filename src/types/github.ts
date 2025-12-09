/**
 * GitHub API types and schemas
 */
import { z } from "zod";

// GitHub schemas
export const GitHubReleaseAssetSchema = z.object({
	id: z.number(),
	name: z.string(),
	url: z.string().url(), // API endpoint for authenticated downloads
	browser_download_url: z.string().url(), // Direct download URL (public only)
	size: z.number(),
	content_type: z.string(),
});
export type GitHubReleaseAsset = z.infer<typeof GitHubReleaseAssetSchema>;

export const GitHubReleaseSchema = z.object({
	id: z.number(),
	tag_name: z.string(),
	name: z.string(),
	draft: z.boolean(),
	prerelease: z.boolean(),
	assets: z.array(GitHubReleaseAssetSchema),
	published_at: z.string().optional(),
	tarball_url: z.string().url(),
	zipball_url: z.string().url(),
});
export type GitHubRelease = z.infer<typeof GitHubReleaseSchema>;

// Enhanced release types for version selection
export interface EnrichedRelease extends GitHubRelease {
	displayVersion: string;
	normalizedVersion: string;
	relativeTime: string;
	isLatestStable: boolean;
	isLatestBeta: boolean;
	assetCount: number;
}

// Release filtering options
export interface FilterOptions {
	includeDrafts?: boolean;
	includePrereleases?: boolean;
	limit?: number;
	sortBy?: "date" | "version";
	order?: "asc" | "desc";
}

// Cache entry for release lists
export interface CacheEntry {
	timestamp: number;
	releases: GitHubRelease[];
}
