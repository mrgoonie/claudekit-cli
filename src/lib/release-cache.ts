import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { type GitHubRelease } from "../types.js";
import { logger } from "../utils/logger.js";
import { PathResolver } from "../utils/path-resolver.js";

interface ReleaseCacheEntry {
	timestamp: number;
	releases: GitHubRelease[];
}

const ReleaseCacheEntrySchema = z.object({
	timestamp: z.number(),
	releases: z.array(z.any()), // GitHubRelease schema validation happens on load
});

export class ReleaseCache {
	private static readonly CACHE_DIR = "releases";
	private static readonly CACHE_TTL_SECONDS = Number(process.env.CK_CACHE_TTL) || 3600; // 1 hour (configurable via CK_CACHE_TTL env var)
	private readonly cacheDir: string;

	constructor() {
		this.cacheDir = join(PathResolver.getCacheDir(false), ReleaseCache.CACHE_DIR);
	}

	/**
	 * Retrieves cached releases for a specific kit and options combination.
	 *
	 * @param key - The cache key representing the kit and options combination
	 * @returns Promise resolving to array of GitHub releases if found and not expired, null otherwise
	 *
	 * @example
	 * ```typescript
	 * const cache = new ReleaseCache();
	 * const releases = await cache.get('claudekit-engineer-latest-false');
	 * if (releases) {
	 *   console.log(`Found ${releases.length} cached releases`);
	 * }
	 * ```
	 */
	async get(key: string): Promise<GitHubRelease[] | null> {
		const cacheFile = this.getCachePath(key);

		try {
			if (!existsSync(cacheFile)) {
				logger.debug(`Release cache not found for key: ${key}`);
				return null;
			}

			const content = await readFile(cacheFile, "utf-8");
			const parsed = JSON.parse(content);
			const cacheEntry = ReleaseCacheEntrySchema.parse(parsed);

			// Check if cache is expired
			if (this.isExpired(cacheEntry.timestamp)) {
				logger.debug(`Release cache expired for key: ${key}`);
				await this.clear(key);
				return null;
			}

			// Validate and parse releases
			const { GitHubReleaseSchema } = await import("../types.js");
			const releases = cacheEntry.releases.map((release) =>
				GitHubReleaseSchema.parse(release)
			);

			logger.debug(`Release cache hit for key: ${key}, found ${releases.length} releases`);
			return releases;
		} catch (error) {
			logger.debug(`Failed to load release cache for key ${key}: ${error}`);
			// Clear corrupted cache
			await this.clear(key);
			return null;
		}
	}

	/**
	 * Caches releases for a specific kit and options combination.
	 *
	 * @param key - The cache key representing the kit and options combination
	 * @param releases - Array of GitHub releases to cache
	 * @returns Promise that resolves when caching is complete
	 *
	 * @example
	 * ```typescript
	 * const cache = new ReleaseCache();
	 * await cache.set('claudekit-engineer-latest-false', releases);
	 * console.log('Releases cached successfully');
	 * ```
	 */
	async set(key: string, releases: GitHubRelease[]): Promise<void> {
		const cacheFile = this.getCachePath(key);

		try {
			// Ensure cache directory exists
			if (!existsSync(this.cacheDir)) {
				await mkdir(this.cacheDir, { recursive: true, mode: 0o700 });
			}

			const cacheEntry: ReleaseCacheEntry = {
				timestamp: Date.now(),
				releases,
			};

			await writeFile(cacheFile, JSON.stringify(cacheEntry, null, 2), "utf-8");
			logger.debug(`Release cache set for key: ${key}, cached ${releases.length} releases`);
		} catch (error) {
			logger.debug(`Failed to set release cache for key ${key}: ${error}`);
			// Silent failure - don't block execution
		}
	}

	/**
	 * Clears cached releases, either for a specific key or all cached data.
	 *
	 * @param key - Optional cache key to clear. If not provided, clears all cached releases
	 * @returns Promise that resolves when clearing is complete
	 *
	 * @example
	 * ```typescript
	 * const cache = new ReleaseCache();
	 * // Clear specific kit cache
	 * await cache.clear('claudekit-engineer-latest-false');
	 * // Clear all caches
	 * await cache.clear();
	 * ```
	 */
	async clear(key?: string): Promise<void> {
		if (key) {
			const cacheFile = this.getCachePath(key);
			try {
				if (existsSync(cacheFile)) {
					await unlink(cacheFile);
					logger.debug(`Release cache cleared for key: ${key}`);
				}
			} catch (error) {
				logger.debug(`Failed to clear release cache for key ${key}: ${error}`);
			}
		} else {
			// Clear all cache files
			try {
				const { readdir } = await import("node:fs/promises");
				const files = await readdir(this.cacheDir);

				for (const file of files) {
					if (file.endsWith(".json")) {
						await unlink(join(this.cacheDir, file));
					}
				}
				logger.debug("All release cache cleared");
			} catch (error) {
				logger.debug(`Failed to clear all release cache: ${error}`);
			}
		}
	}

	/**
	 * Get cache file path for a key
	 */
	private getCachePath(key: string): string {
		// Sanitize key to be filesystem-safe
		const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
		return join(this.cacheDir, `${safeKey}.json`);
	}

	/**
	 * Check if cache entry is expired
	 */
	private isExpired(timestamp: number): boolean {
		const now = Date.now();
		const age = now - timestamp;
		const ageSeconds = Math.floor(age / 1000);
		const isExpired = ageSeconds >= ReleaseCache.CACHE_TTL_SECONDS;

		const ageMinutes = Math.floor(ageSeconds / 60);
		logger.debug(`Cache age check: ${ageMinutes} minutes old, expired=${isExpired}`);

		return isExpired;
	}
}