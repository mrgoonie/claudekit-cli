/**
 * User preferences reader for ~/.claude.json
 * Reads theme, usage stats, tips history, and feature flags with mtime caching.
 */

import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type PreferencesCacheEntry,
	TipsHistorySchema,
	type UserPreferencesResult,
	UserPreferencesSchema,
} from "./types.js";

const cache = new Map<string, PreferencesCacheEntry>();
const locks = new Map<string, Promise<UserPreferencesResult>>();

export function getPreferencesPath(): string {
	return join(homedir(), ".claude.json");
}

export async function readUserPreferences(filePath?: string): Promise<UserPreferencesResult> {
	const path = filePath ?? getPreferencesPath();

	// Check if parsing is already in progress for this path
	const existingLock = locks.get(path);
	if (existingLock) return existingLock;

	// Check cache first (outside lock)
	const start = Date.now();
	try {
		const { mtimeMs } = await stat(path);
		const cached = cache.get(path);
		if (cached && cached.mtime === mtimeMs) {
			return cached.result;
		}
	} catch {
		return emptyResult(Date.now() - start, "Cannot read user preferences - file not found");
	}

	// Create parsing promise with lock
	const parsePromise = (async (): Promise<UserPreferencesResult> => {
		try {
			// Parse JSON
			try {
				const content = await readFile(path, "utf8");
				const raw = JSON.parse(content);

				const result: UserPreferencesResult = {
					preferences: UserPreferencesSchema.parse(raw),
					tipsHistory: TipsHistorySchema.parse(raw.tipsHistory ?? {}),
					featureFlags: {
						statsigGates: raw.cachedStatsigGates ?? {},
						growthBookFeatures: raw.cachedGrowthBookFeatures ?? {},
					},
					rawSize: Buffer.byteLength(content),
					parseTimeMs: Date.now() - start,
				};

				// Update cache
				const { mtimeMs } = await stat(path);
				cache.set(path, { mtime: mtimeMs, result });

				return result;
			} catch (err) {
				const errorMsg =
					err instanceof Error
						? `Failed to parse user preferences: ${err.message}`
						: "Failed to parse user preferences";
				return emptyResult(Date.now() - start, errorMsg);
			}
		} finally {
			locks.delete(path);
		}
	})();

	locks.set(path, parsePromise);
	return parsePromise;
}

function emptyResult(parseTimeMs: number, error?: string): UserPreferencesResult {
	return {
		preferences: {},
		tipsHistory: {},
		featureFlags: { statsigGates: {}, growthBookFeatures: {} },
		rawSize: 0,
		parseTimeMs,
		error,
	};
}

export function clearPreferencesCache(): void {
	cache.clear();
	locks.clear();
}

// Utility: Get effective theme
export function getEffectiveTheme(prefs: UserPreferencesResult): string {
	return prefs.preferences.theme ?? "dark";
}

// Utility: Get usage summary
export interface UsageSummary {
	totalSessions: number;
	promptQueueUsage: number;
	firstUsed: Date | null;
	tipsShown: number;
}

export function getUsageSummary(prefs: UserPreferencesResult): UsageSummary {
	const tipsCounts = Object.values(prefs.tipsHistory);
	return {
		totalSessions: prefs.preferences.numStartups ?? 0,
		promptQueueUsage: prefs.preferences.promptQueueUseCount ?? 0,
		firstUsed: prefs.preferences.firstStartTime ? new Date(prefs.preferences.firstStartTime) : null,
		tipsShown: tipsCounts.reduce((a, b) => a + b, 0),
	};
}
