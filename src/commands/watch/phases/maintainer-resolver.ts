/**
 * Maintainer resolver — fetches and caches repo collaborators for skipMaintainerReplies feature
 * Uses gh CLI to call GitHub API and caches results for 1 hour to avoid rate limit burn
 */

import { logger } from "@/shared/logger.js";
import { spawnAndCollect } from "./implementation-git-helpers.js";

const CACHE_TTL_MS = 3_600_000; // 1 hour

interface CacheEntry {
	users: string[];
	fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export interface MaintainerResolveResult {
	users: string[];
	disabled: boolean;
}

/**
 * Resolve the list of maintainer logins for a repo.
 * Merges GitHub collaborators (if autoDetect) with excludeAuthors.
 * Returns { disabled: true } on API error — caller should disable skipMaintainerReplies.
 */
export async function resolveMaintainers(
	owner: string,
	repo: string,
	excludeAuthors: string[],
	autoDetect: boolean,
): Promise<MaintainerResolveResult> {
	const normalizedExclude = excludeAuthors.map((s) => s.toLowerCase());

	if (!autoDetect) {
		return { users: normalizedExclude, disabled: false };
	}

	const cacheKey = `${owner}/${repo}`;
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.fetchedAt >= CACHE_TTL_MS) {
		cache.delete(cacheKey); // evict expired entry before refetch
	} else if (cached) {
		// Merge cached collaborators with current excludeAuthors (may have changed)
		const merged = Array.from(new Set([...cached.users, ...normalizedExclude]));
		return { users: merged, disabled: false };
	}

	try {
		const stdout = await spawnAndCollect("gh", [
			"api",
			`repos/${owner}/${repo}/collaborators`,
			"--jq",
			"[.[].login]",
		]);

		const parsed = JSON.parse(stdout);
		if (!Array.isArray(parsed)) {
			throw new Error("Unexpected API response (not an array)");
		}
		const logins = (parsed as string[]).map((s) => s.toLowerCase());
		const merged = Array.from(new Set([...logins, ...normalizedExclude]));

		cache.set(cacheKey, { users: logins, fetchedAt: Date.now() });

		return { users: merged, disabled: false };
	} catch (error) {
		logger.warning(
			`gh api collaborators failed, disabling skipMaintainerReplies: ${
				error instanceof Error ? error.message : "Unknown"
			}`,
		);
		return { users: [], disabled: true };
	}
}

/**
 * Clear the maintainer cache — exposed for testing
 */
export function clearMaintainerCache(): void {
	cache.clear();
}
