/**
 * Config version checker with 24h caching and GitHub API integration
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CLAUDEKIT_CLI_USER_AGENT } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { KitType } from "@/types";
import { compareVersions } from "compare-versions";
import type { ConfigUpdateCache, UpdateCheckResult } from "./types.js";

/** Cache time-to-live in hours */
const CACHE_TTL_HOURS = 24;
/** Default cache TTL in milliseconds */
const DEFAULT_CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;
/** Minimum cache TTL (1 minute) */
const MIN_CACHE_TTL_MS = 60 * 1000;
/** Maximum cache TTL (7 days) */
const MAX_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parse and validate CK_SYNC_CACHE_TTL env var
 * Returns validated TTL in milliseconds, or default if invalid
 */
function parseCacheTtl(): number {
	const envValue = process.env.CK_SYNC_CACHE_TTL;
	if (!envValue) {
		return DEFAULT_CACHE_TTL_MS;
	}

	const parsed = Number.parseInt(envValue, 10);

	// Check for NaN or negative values
	if (Number.isNaN(parsed) || parsed < 0) {
		logger.warning(
			`Invalid CK_SYNC_CACHE_TTL value "${envValue}", using default (${CACHE_TTL_HOURS}h)`,
		);
		return DEFAULT_CACHE_TTL_MS;
	}

	const ttlMs = parsed * 1000;

	// Clamp to reasonable bounds
	if (ttlMs < MIN_CACHE_TTL_MS) {
		logger.warning(`CK_SYNC_CACHE_TTL too low (${parsed}s), using minimum (60s)`);
		return MIN_CACHE_TTL_MS;
	}

	if (ttlMs > MAX_CACHE_TTL_MS) {
		logger.warning(`CK_SYNC_CACHE_TTL too high (${parsed}s), using maximum (7 days)`);
		return MAX_CACHE_TTL_MS;
	}

	return ttlMs;
}

/** Cache TTL in milliseconds (validated from env or default) */
const CACHE_TTL_MS = parseCacheTtl();
/** GitHub API timeout in milliseconds */
const GITHUB_API_TIMEOUT_MS = 10000; // Increased from 5000
const CACHE_FILENAME = "config-update-cache.json";

/**
 * GitHub repo info for each kit type
 * SECURITY: Owner hardcoded to official ClaudeKit org to prevent supply chain attacks.
 * Users must fork the CLI if they need different upstream repos.
 */
const KIT_REPOS: Record<string, { owner: string; repo: string }> = {
	engineer: { owner: "claudekit", repo: "claudekit-engineer" },
	marketing: { owner: "claudekit", repo: "claudekit-marketing" },
};

/**
 * ConfigVersionChecker handles checking for kit updates with caching
 */
export class ConfigVersionChecker {
	/**
	 * Get cache file path for a kit type
	 */
	private static getCacheFilePath(kitType: KitType, global: boolean): string {
		const cacheDir = PathResolver.getCacheDir(global);
		return join(cacheDir, `${kitType}-${CACHE_FILENAME}`);
	}

	/**
	 * Load cached update check result
	 */
	private static async loadCache(
		kitType: KitType,
		global: boolean,
	): Promise<ConfigUpdateCache | null> {
		try {
			const cachePath = ConfigVersionChecker.getCacheFilePath(kitType, global);
			const data = await readFile(cachePath, "utf8");
			const parsed = JSON.parse(data);

			// Validate cache structure
			if (
				typeof parsed !== "object" ||
				parsed === null ||
				typeof parsed.lastCheck !== "number" ||
				typeof parsed.latestVersion !== "string" ||
				!parsed.latestVersion ||
				parsed.lastCheck < 0 ||
				parsed.lastCheck > Date.now() + 7 * 24 * 60 * 60 * 1000 // Reject future timestamps > 7 days
			) {
				logger.debug("Invalid cache structure, ignoring");
				return null;
			}

			return parsed as ConfigUpdateCache;
		} catch {
			return null;
		}
	}

	/**
	 * Save update check result to cache
	 */
	private static async saveCache(
		kitType: KitType,
		global: boolean,
		cache: ConfigUpdateCache,
	): Promise<void> {
		try {
			const cachePath = ConfigVersionChecker.getCacheFilePath(kitType, global);
			const cacheDir = PathResolver.getCacheDir(global);
			await mkdir(cacheDir, { recursive: true });
			await writeFile(cachePath, JSON.stringify(cache, null, 2));
		} catch (error) {
			logger.debug(
				`Cache write failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Fetch latest version from GitHub releases API
	 */
	private static async fetchLatestVersion(
		kitType: KitType,
		etag?: string,
	): Promise<{ version: string; etag?: string } | "not-modified" | null> {
		const repoInfo = KIT_REPOS[kitType];
		if (!repoInfo) return null;

		const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases/latest`;
		const maxRetries = 3;
		const baseBackoff = 1000;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const headers: Record<string, string> = {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": CLAUDEKIT_CLI_USER_AGENT,
				};

				// Support GITHUB_TOKEN for higher rate limits (5000/hr vs 60/hr)
				const githubToken = process.env.GITHUB_TOKEN;
				if (githubToken) {
					headers.Authorization = `Bearer ${githubToken}`;
				}

				if (etag) {
					headers["If-None-Match"] = etag;
				}

				const response = await fetch(url, {
					headers,
					signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS),
				});

				// Check rate limit and provide guidance
				const remaining = response.headers.get("x-ratelimit-remaining");
				if (remaining && Number.parseInt(remaining, 10) < 10) {
					logger.warning(
						`GitHub API rate limit low: ${remaining} remaining. Set GITHUB_TOKEN env var for higher limits (5000/hr vs 60/hr).`,
					);
				}

				if (response.status === 304) {
					return "not-modified";
				}

				if (!response.ok) {
					if (response.status === 403) {
						logger.warning(
							"GitHub API rate limit exceeded. " +
								"Set GITHUB_TOKEN env var for higher limits (5000/hr vs 60/hr).",
						);
						return null;
					}
					throw new Error(`GitHub API returned ${response.status}`);
				}

				const data = (await response.json()) as { tag_name?: string };
				const version = data.tag_name?.replace(/^v/, "") || null;

				// Validate semver format with length limit (prevents regex DoS)
				// Max semver length: 256 chars (generous limit for prerelease/build metadata)
				if (!version || version.length > 256) {
					logger.debug(`Invalid version format from GitHub: ${data.tag_name}`);
					return null;
				}

				// Simple semver validation - avoid complex regex that could backtrack
				// Pattern: MAJOR.MINOR.PATCH with optional prerelease/build
				const semverParts = version.split(/[-+]/);
				const coreParts = semverParts[0].split(".");
				if (coreParts.length !== 3 || !coreParts.every((p) => /^\d+$/.test(p))) {
					logger.debug(`Invalid version format from GitHub: ${data.tag_name}`);
					return null;
				}

				return {
					version,
					etag: response.headers.get("etag") || undefined,
				};
			} catch (error) {
				const isLastAttempt = attempt === maxRetries - 1;

				if (isLastAttempt) {
					logger.debug(`Version check failed after ${maxRetries} attempts: ${error}`);
					return null;
				}

				// Exponential backoff
				const delay = baseBackoff * 2 ** attempt;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		return null;
	}

	/**
	 * Check for config updates with caching
	 *
	 * @param kitType - Type of kit to check
	 * @param currentVersion - Currently installed version
	 * @param global - Whether this is a global installation
	 * @returns Update check result
	 */
	static async checkForUpdates(
		kitType: KitType,
		currentVersion: string,
		global = false,
	): Promise<UpdateCheckResult> {
		const normalizedCurrent = currentVersion.replace(/^v/, "");

		// Load cache
		const cache = await ConfigVersionChecker.loadCache(kitType, global);
		const now = Date.now();

		// Check if cache is valid (< 24h)
		if (cache && now - cache.lastCheck < CACHE_TTL_MS) {
			const hasUpdates = compareVersions(cache.latestVersion, normalizedCurrent) > 0;
			return {
				hasUpdates,
				currentVersion: normalizedCurrent,
				latestVersion: cache.latestVersion,
				fromCache: true,
			};
		}

		// Fetch from GitHub with ETag
		const result = await ConfigVersionChecker.fetchLatestVersion(kitType, cache?.etag);

		if (result === "not-modified" && cache) {
			// Update cache timestamp, keep existing data
			await ConfigVersionChecker.saveCache(kitType, global, {
				...cache,
				lastCheck: now,
			});

			const hasUpdates = compareVersions(cache.latestVersion, normalizedCurrent) > 0;
			return {
				hasUpdates,
				currentVersion: normalizedCurrent,
				latestVersion: cache.latestVersion,
				fromCache: false,
			};
		}

		if (result && result !== "not-modified") {
			// Save new cache
			await ConfigVersionChecker.saveCache(kitType, global, {
				lastCheck: now,
				latestVersion: result.version,
				etag: result.etag,
			});

			const hasUpdates = compareVersions(result.version, normalizedCurrent) > 0;
			return {
				hasUpdates,
				currentVersion: normalizedCurrent,
				latestVersion: result.version,
				fromCache: false,
			};
		}

		// Fetch failed - use stale cache or return no updates
		if (cache) {
			const hasUpdates = compareVersions(cache.latestVersion, normalizedCurrent) > 0;
			return {
				hasUpdates,
				currentVersion: normalizedCurrent,
				latestVersion: cache.latestVersion,
				fromCache: true,
			};
		}

		// No cache, fetch failed - assume no updates
		return {
			hasUpdates: false,
			currentVersion: normalizedCurrent,
			latestVersion: normalizedCurrent,
			fromCache: false,
		};
	}

	/**
	 * Clear cached update check for a kit
	 */
	static async clearCache(kitType: KitType, global = false): Promise<void> {
		const cachePath = ConfigVersionChecker.getCacheFilePath(kitType, global);
		try {
			await unlink(cachePath);
			logger.debug(`Cleared sync cache for ${kitType}`);
		} catch (error) {
			// Ignore if file doesn't exist
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
		}
	}
}
