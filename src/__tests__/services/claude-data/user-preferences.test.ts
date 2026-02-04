import { beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	clearPreferencesCache,
	getEffectiveTheme,
	getUsageSummary,
	readUserPreferences,
} from "@/services/claude-data/user-preferences.js";

/**
 * User Preferences Tests
 *
 * Tests for ~/.claude.json reader with mtime-based caching.
 * Uses temp files in tmpdir with unique names for isolation.
 */

const TEST_DIR = join(tmpdir(), `ck-prefs-test-${Date.now()}-${process.pid}`);

// Helper to create test preferences file
async function createPrefsFile(path: string, data: Record<string, unknown>): Promise<void> {
	await mkdir(TEST_DIR, { recursive: true });
	await writeFile(path, JSON.stringify(data));
}

beforeEach(() => {
	clearPreferencesCache();
});

describe("User Preferences", () => {
	test("reads valid preferences file", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = {
			numStartups: 42,
			theme: "dark",
			installMethod: "npm",
			autoUpdates: true,
			firstStartTime: "2024-01-01T00:00:00.000Z",
			hasSeenTasksHint: true,
			hasSeenStashHint: false,
			promptQueueUseCount: 10,
			tipsHistory: {
				tip1: 3,
				tip2: 5,
			},
			cachedStatsigGates: {
				feature1: true,
				feature2: false,
			},
			cachedGrowthBookFeatures: {
				experiment1: { enabled: true },
			},
		};
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);

		expect(result.preferences.numStartups).toBe(42);
		expect(result.preferences.theme).toBe("dark");
		expect(result.preferences.installMethod).toBe("npm");
		expect(result.preferences.autoUpdates).toBe(true);
		expect(result.preferences.firstStartTime).toBe("2024-01-01T00:00:00.000Z");
		expect(result.preferences.hasSeenTasksHint).toBe(true);
		expect(result.preferences.hasSeenStashHint).toBe(false);
		expect(result.preferences.promptQueueUseCount).toBe(10);
		expect(result.tipsHistory).toEqual({ tip1: 3, tip2: 5 });
		expect(result.featureFlags.statsigGates).toEqual({ feature1: true, feature2: false });
		expect(result.featureFlags.growthBookFeatures).toEqual({ experiment1: { enabled: true } });
		expect(result.rawSize).toBeGreaterThan(0);
		expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
		expect(result.error).toBeUndefined();

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles missing file with error message", async () => {
		const filePath = join(TEST_DIR, `nonexistent-${randomUUID()}.json`);

		const result = await readUserPreferences(filePath);

		expect(result.preferences).toEqual({});
		expect(result.tipsHistory).toEqual({});
		expect(result.featureFlags).toEqual({ statsigGates: {}, growthBookFeatures: {} });
		expect(result.rawSize).toBe(0);
		expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Cannot read user preferences");
	});

	test("uses mtime cache - second call returns cached result", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = {
			numStartups: 5,
			theme: "light",
		};
		await createPrefsFile(filePath, data);

		// First parse
		const result1 = await readUserPreferences(filePath);
		expect(result1.preferences.numStartups).toBe(5);

		// Second parse (should hit cache)
		const result2 = await readUserPreferences(filePath);
		expect(result2).toBe(result1); // Same object reference = cached

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("invalidates cache when mtime changes", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data1 = { numStartups: 5 };
		await createPrefsFile(filePath, data1);

		// First parse
		const result1 = await readUserPreferences(filePath);
		expect(result1.preferences.numStartups).toBe(5);

		// Wait a bit to ensure mtime changes
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Modify file (change content and mtime)
		const data2 = { numStartups: 10 };
		await createPrefsFile(filePath, data2);

		// Touch file to update mtime
		const now = new Date();
		await utimes(filePath, now, now);

		// Second parse (should NOT hit cache)
		const result2 = await readUserPreferences(filePath);
		expect(result2.preferences.numStartups).toBe(10);
		expect(result2).not.toBe(result1); // Different object reference = cache miss

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("extracts theme correctly", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = { theme: "dark-daltonized" };
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);
		const theme = getEffectiveTheme(result);

		expect(theme).toBe("dark-daltonized");

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("returns default theme when missing", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = { numStartups: 1 };
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);
		const theme = getEffectiveTheme(result);

		expect(theme).toBe("dark");

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("calculates usage summary correctly", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = {
			numStartups: 100,
			promptQueueUseCount: 25,
			firstStartTime: "2024-06-15T10:30:00.000Z",
			tipsHistory: {
				tip1: 3,
				tip2: 5,
				tip3: 7,
			},
		};
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);
		const summary = getUsageSummary(result);

		expect(summary.totalSessions).toBe(100);
		expect(summary.promptQueueUsage).toBe(25);
		expect(summary.firstUsed).toEqual(new Date("2024-06-15T10:30:00.000Z"));
		expect(summary.tipsShown).toBe(15); // 3 + 5 + 7

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles partial JSON with missing optional fields", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = {
			numStartups: 1,
			// Missing: theme, installMethod, autoUpdates, etc.
		};
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);

		expect(result.preferences.numStartups).toBe(1);
		expect(result.preferences.theme).toBeUndefined();
		expect(result.preferences.installMethod).toBeUndefined();
		expect(result.preferences.autoUpdates).toBeUndefined();
		expect(result.tipsHistory).toEqual({});
		expect(result.featureFlags.statsigGates).toEqual({});
		expect(result.featureFlags.growthBookFeatures).toEqual({});
		expect(result.error).toBeUndefined();

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles empty JSON object", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		await createPrefsFile(filePath, {});

		const result = await readUserPreferences(filePath);

		expect(result.preferences).toEqual({});
		expect(result.tipsHistory).toEqual({});
		expect(result.featureFlags.statsigGates).toEqual({});
		expect(result.featureFlags.growthBookFeatures).toEqual({});
		expect(result.error).toBeUndefined();

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles malformed JSON with error", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		await mkdir(TEST_DIR, { recursive: true });
		await writeFile(filePath, "{ invalid json }}}");

		const result = await readUserPreferences(filePath);

		expect(result.preferences).toEqual({});
		expect(result.tipsHistory).toEqual({});
		expect(result.rawSize).toBe(0);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Failed to parse user preferences");

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("clearPreferencesCache() actually clears cache", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = { numStartups: 7 };
		await createPrefsFile(filePath, data);

		// First parse (populates cache)
		const result1 = await readUserPreferences(filePath);
		expect(result1.preferences.numStartups).toBe(7);

		// Second parse (should hit cache)
		const result2 = await readUserPreferences(filePath);
		expect(result2).toBe(result1); // Same reference

		// Clear cache
		clearPreferencesCache();

		// Third parse (should NOT hit cache)
		const result3 = await readUserPreferences(filePath);
		expect(result3.preferences.numStartups).toBe(7);
		expect(result3).not.toBe(result1); // Different reference

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles missing tipsHistory field", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = {
			numStartups: 5,
			theme: "light",
			// No tipsHistory
		};
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);

		expect(result.tipsHistory).toEqual({});
		expect(result.error).toBeUndefined();

		const summary = getUsageSummary(result);
		expect(summary.tipsShown).toBe(0);

		// Cleanup
		await rm(filePath, { force: true });
	});

	test("handles null firstStartTime", async () => {
		const filePath = join(TEST_DIR, `prefs-${randomUUID()}.json`);
		const data = {
			numStartups: 3,
			// No firstStartTime
		};
		await createPrefsFile(filePath, data);

		const result = await readUserPreferences(filePath);
		const summary = getUsageSummary(result);

		expect(summary.firstUsed).toBeNull();

		// Cleanup
		await rm(filePath, { force: true });
	});
});

// Cleanup test directory after all tests
process.on("beforeExit", async () => {
	await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
});
