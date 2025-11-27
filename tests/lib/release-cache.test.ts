import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ReleaseCache } from "../../src/lib/release-cache.js";
import { type TestPaths, setupTestPaths } from "../helpers/test-paths.js";

// Test uses isolated temp directories via CK_TEST_HOME
// PathResolver automatically uses test paths when CK_TEST_HOME is set

describe("ReleaseCache", () => {
	let cache: ReleaseCache;
	let cacheDir: string;
	let testPaths: TestPaths;
	const testKeyPrefix = "test-release-cache-";

	// Helper to create unique test keys
	const createTestKey = (suffix: string) => `${testKeyPrefix}${Date.now()}-${suffix}`;

	// Suppress logger.debug during tests using spyOn
	let loggerDebugSpy: ReturnType<typeof spyOn>;

	beforeEach(async () => {
		// Setup isolated test paths - PathResolver will use these
		testPaths = setupTestPaths();
		cacheDir = join(testPaths.cacheDir, "releases");

		// Import logger and spy on debug to suppress output
		const { logger } = await import("../../src/utils/logger.js");
		loggerDebugSpy = spyOn(logger, "debug").mockImplementation(() => {});

		cache = new ReleaseCache();

		// Ensure cache directory exists in test location
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
		}
	});

	afterEach(() => {
		// Restore logger spy
		loggerDebugSpy?.mockRestore();

		// Cleanup test paths - removes entire temp directory
		testPaths.cleanup();
	});

	describe("get", () => {
		it("should return null when cache file doesn't exist", async () => {
			const key = createTestKey("nonexistent");
			const result = await cache.get(key);
			expect(result).toBeNull();
		});

		it("should return cached releases when valid", async () => {
			const key = createTestKey("valid");
			const mockReleases = [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Release 1.0.0",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			// Set cache first
			await cache.set(key, mockReleases as any);

			// Get from cache
			const result = await cache.get(key);
			expect(result).not.toBeNull();
			expect(result).toHaveLength(1);
			expect(result?.[0].tag_name).toBe("v1.0.0");
		});

		it("should return null when cache is expired", async () => {
			const key = createTestKey("expired");
			const mockReleases = [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Release 1.0.0",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			// Set cache with manual timestamp manipulation
			await cache.set(key, mockReleases as any);

			// Manually set timestamp to be old (2 hours ago)
			const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
			const cacheFile = join(cacheDir, `${safeKey}.json`);
			const content = await readFile(cacheFile, "utf-8");
			const cacheEntry = JSON.parse(content);
			cacheEntry.timestamp = Date.now() - 2 * 60 * 60 * 1000;
			await writeFile(cacheFile, JSON.stringify(cacheEntry, null, 2), "utf-8");

			// Get from cache should return null due to expiration
			const result = await cache.get(key);
			expect(result).toBeNull();
		});

		it("should return null for corrupted cache", async () => {
			const key = createTestKey("corrupted");
			const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
			const cacheFile = join(cacheDir, `${safeKey}.json`);

			// Write invalid JSON
			await writeFile(cacheFile, "invalid json content", "utf-8");

			const result = await cache.get(key);
			expect(result).toBeNull();
		});
	});

	describe("set", () => {
		it("should cache releases successfully", async () => {
			const key = createTestKey("set-test");
			const mockReleases = [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Release 1.0.0",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			await cache.set(key, mockReleases as any);

			// Verify cache file exists
			const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
			const cacheFile = join(cacheDir, `${safeKey}.json`);
			expect(existsSync(cacheFile)).toBe(true);

			// Verify content
			const content = await readFile(cacheFile, "utf-8");
			const cacheEntry = JSON.parse(content);
			expect(cacheEntry.timestamp).toBeDefined();
			expect(cacheEntry.releases).toHaveLength(1);
			expect(cacheEntry.releases[0].tag_name).toBe("v1.0.0");
		});

		it("should sanitize cache key", async () => {
			const key = createTestKey("special/chars@#");
			const mockReleases = [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Release 1.0.0",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			await cache.set(key, mockReleases as any);

			// Verify sanitized cache file exists (special chars replaced with _)
			const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
			const cacheFile = join(cacheDir, `${safeKey}.json`);
			expect(existsSync(cacheFile)).toBe(true);
		});
	});

	describe("clear", () => {
		it("should clear specific cache entry", async () => {
			const key1 = createTestKey("clear-1");
			const key2 = createTestKey("clear-2");
			const mockReleases = [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Release 1.0.0",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			await cache.set(key1, mockReleases as any);
			await cache.set(key2, mockReleases as any);

			// Verify both exist
			const safeKey1 = key1.replace(/[^a-zA-Z0-9_-]/g, "_");
			const safeKey2 = key2.replace(/[^a-zA-Z0-9_-]/g, "_");
			const cacheFile1 = join(cacheDir, `${safeKey1}.json`);
			const cacheFile2 = join(cacheDir, `${safeKey2}.json`);
			expect(existsSync(cacheFile1)).toBe(true);
			expect(existsSync(cacheFile2)).toBe(true);

			// Clear specific key
			await cache.clear(key1);

			// Verify only specific key is cleared
			expect(existsSync(cacheFile1)).toBe(false);
			expect(existsSync(cacheFile2)).toBe(true);
		});
	});
});
