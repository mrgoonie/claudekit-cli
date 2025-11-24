import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ReleaseCache } from "../../src/lib/release-cache.js";

// Mock logger
mock.module("../../src/utils/logger.js", () => ({
	logger: {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
	},
}));

// Mock PathResolver
mock.module("../../src/utils/path-resolver.js", () => ({
	PathResolver: {
		getCacheDir: mock(() => "/tmp/test-cache"),
	},
}));

describe("ReleaseCache", () => {
	let cache: ReleaseCache;
	let cacheDir: string;

	beforeEach(() => {
		cache = new ReleaseCache();
		cacheDir = "/tmp/test-cache/releases";

		// Ensure cache directory exists
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
		}
	});

	afterEach(() => {
		// Clean up test cache directory
		if (existsSync(cacheDir)) {
			rmSync(cacheDir, { recursive: true, force: true });
		}
	});

	describe("get", () => {
		it("should return null when cache file doesn't exist", async () => {
			const result = await cache.get("nonexistent-key");
			expect(result).toBeNull();
		});

		it("should return cached releases when valid", async () => {
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
			await cache.set("test-key", mockReleases as any);

			// Get from cache
			const result = await cache.get("test-key");
			expect(result).toHaveLength(1);
			expect(result?.[0].tag_name).toBe("v1.0.0");
		});

		it("should return null when cache is expired", async () => {
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
			await cache.set("test-key", mockReleases as any);

			// Manually set timestamp to be old
			const cacheFile = join(cacheDir, "test-key.json");
			const { readFile, writeFile } = await import("node:fs/promises");
			const content = await readFile(cacheFile, "utf-8");
			const cacheEntry = JSON.parse(content);
			cacheEntry.timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
			await writeFile(cacheFile, JSON.stringify(cacheEntry, null, 2), "utf-8");

			// Get from cache should return null due to expiration
			const result = await cache.get("test-key");
			expect(result).toBeNull();
		});

		it("should return null for corrupted cache", async () => {
			const cacheFile = join(cacheDir, "corrupted-key.json");
			const { writeFile } = await import("node:fs/promises");
			await writeFile(cacheFile, "invalid json content", "utf-8");

			const result = await cache.get("corrupted-key");
			expect(result).toBeNull();
		});
	});

	describe("set", () => {
		it("should cache releases successfully", async () => {
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

			await cache.set("test-key", mockReleases as any);

			// Verify cache file exists
			const cacheFile = join(cacheDir, "test-key.json");
			expect(existsSync(cacheFile)).toBe(true);

			// Verify content
			const { readFile } = await import("node:fs/promises");
			const content = await readFile(cacheFile, "utf-8");
			const cacheEntry = JSON.parse(content);
			expect(cacheEntry.timestamp).toBeDefined();
			expect(cacheEntry.releases).toHaveLength(1);
			expect(cacheEntry.releases[0].tag_name).toBe("v1.0.0");
		});

		it("should sanitize cache key", async () => {
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

			await cache.set("key/with/special-chars@#", mockReleases as any);

			// Verify sanitized cache file exists
			const cacheFile = join(cacheDir, "key__with_special-chars_.json");
			expect(existsSync(cacheFile)).toBe(true);
		});

		it("should handle write errors gracefully", async () => {
			// Mock mkdir to throw an error
			const originalMkdir = await import("node:fs/promises");
			spyOn(originalMkdir, "mkdir").mockRejectedValueOnce(new Error("Permission denied"));

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

			// Should not throw error
			await expect(cache.set("test-key", mockReleases as any)).resolves.not.toThrow();
		});
	});

	describe("clear", () => {
		it("should clear specific cache entry", async () => {
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

			await cache.set("test-key", mockReleases as any);
			await cache.set("other-key", mockReleases as any);

			// Verify both exist
			const cacheFile1 = join(cacheDir, "test-key.json");
			const cacheFile2 = join(cacheDir, "other-key.json");
			expect(existsSync(cacheFile1)).toBe(true);
			expect(existsSync(cacheFile2)).toBe(true);

			// Clear specific key
			await cache.clear("test-key");

			// Verify only specific key is cleared
			expect(existsSync(cacheFile1)).toBe(false);
			expect(existsSync(cacheFile2)).toBe(true);
		});

		it("should clear all cache entries when no key provided", async () => {
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

			await cache.set("test-key1", mockReleases as any);
			await cache.set("test-key2", mockReleases as any);
			await cache.set("test-key3", mockReleases as any);

			// Verify all exist
			expect(existsSync(join(cacheDir, "test-key1.json"))).toBe(true);
			expect(existsSync(join(cacheDir, "test-key2.json"))).toBe(true);
			expect(existsSync(join(cacheDir, "test-key3.json"))).toBe(true);

			// Clear all
			await cache.clear();

			// Verify all are cleared
			expect(existsSync(join(cacheDir, "test-key1.json"))).toBe(false);
			expect(existsSync(join(cacheDir, "test-key2.json"))).toBe(false);
			expect(existsSync(join(cacheDir, "test-key3.json"))).toBe(false);
		});
	});
});
