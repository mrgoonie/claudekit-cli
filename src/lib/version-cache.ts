import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PathResolver } from "../utils/path-resolver.js";
import { logger } from "../utils/logger.js";

interface VersionCheckCache {
	lastCheck: number;
	currentVersion: string;
	latestVersion: string;
	latestUrl: string;
	updateAvailable: boolean;
}

export class VersionCacheManager {
	private static readonly CACHE_FILENAME = "version-check.json";
	private static readonly CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

	/**
	 * Get cache file path (always use local ~/.claudekit/cache, not global)
	 */
	private static getCacheFile(): string {
		const cacheDir = PathResolver.getCacheDir(false); // false = local
		return join(cacheDir, VersionCacheManager.CACHE_FILENAME);
	}

	/**
	 * Load cache from disk
	 */
	static async load(): Promise<VersionCheckCache | null> {
		const cacheFile = VersionCacheManager.getCacheFile();

		try {
			if (!existsSync(cacheFile)) {
				logger.debug("Version check cache not found");
				return null;
			}

			const content = await readFile(cacheFile, "utf-8");
			const cache: VersionCheckCache = JSON.parse(content);

			// Validate cache structure
			if (!cache.lastCheck || !cache.currentVersion || !cache.latestVersion) {
				logger.debug("Invalid cache structure, ignoring");
				return null;
			}

			logger.debug(`Version check cache loaded: ${JSON.stringify(cache)}`);
			return cache;
		} catch (error) {
			logger.debug(`Failed to load version check cache: ${error}`);
			return null;
		}
	}

	/**
	 * Save cache to disk
	 */
	static async save(cache: VersionCheckCache): Promise<void> {
		const cacheFile = VersionCacheManager.getCacheFile();
		const cacheDir = PathResolver.getCacheDir(false);

		try {
			// Ensure cache directory exists
			if (!existsSync(cacheDir)) {
				await mkdir(cacheDir, { recursive: true, mode: 0o700 });
			}

			await writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf-8");
			logger.debug(`Version check cache saved to ${cacheFile}`);
		} catch (error) {
			logger.debug(`Failed to save version check cache: ${error}`);
			// Silent failure - don't block execution
		}
	}

	/**
	 * Check if cache is still valid (within TTL)
	 */
	static isCacheValid(cache: VersionCheckCache | null): boolean {
		if (!cache) return false;

		const now = Date.now();
		const age = now - cache.lastCheck;
		const isValid = age < VersionCacheManager.CACHE_TTL_MS;

		const ageDays = (age / 1000 / 60 / 60 / 24).toFixed(1);
		logger.debug(`Cache validity check: age=${ageDays} days, valid=${isValid}`);

		return isValid;
	}

	/**
	 * Clear cache (for testing or force refresh)
	 */
	static async clear(): Promise<void> {
		const cacheFile = VersionCacheManager.getCacheFile();

		try {
			if (existsSync(cacheFile)) {
				const fs = await import("node:fs/promises");
				await fs.unlink(cacheFile);
				logger.debug("Version check cache cleared");
			}
		} catch (error) {
			logger.debug(`Failed to clear version check cache: ${error}`);
		}
	}
}
