import { beforeEach, describe, expect, test } from "bun:test";
import { VersionCacheManager } from "../../src/domains/versioning/version-cache";

describe("VersionCacheManager", () => {
	beforeEach(async () => {
		await VersionCacheManager.clear();
	});

	test("saves and loads cache", async () => {
		const cache = {
			lastCheck: Date.now(),
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			latestUrl: "https://github.com/test",
			updateAvailable: true,
		};

		await VersionCacheManager.save(cache);
		const loaded = await VersionCacheManager.load();

		expect(loaded).not.toBeNull();
		expect(loaded?.currentVersion).toBe("v1.0.0");
		expect(loaded?.latestVersion).toBe("v1.1.0");
	});

	test("validates cache TTL", async () => {
		const cache = {
			lastCheck: Date.now(),
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			latestUrl: "https://github.com/test",
			updateAvailable: true,
		};

		await VersionCacheManager.save(cache);
		const loaded = await VersionCacheManager.load();
		expect(VersionCacheManager.isCacheValid(loaded)).toBe(true);
	});

	test("handles missing cache gracefully", async () => {
		const cache = await VersionCacheManager.load();
		expect(cache).toBeNull();
	});

	test("detects expired cache", async () => {
		const expiredCache = {
			lastCheck: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			latestUrl: "https://github.com/test",
			updateAvailable: true,
		};

		await VersionCacheManager.save(expiredCache);
		const loaded = await VersionCacheManager.load();
		expect(VersionCacheManager.isCacheValid(loaded)).toBe(false);
	});

	test("returns null for invalid cache structure", async () => {
		const invalidCache = {
			lastCheck: Date.now(),
			// Missing required fields
		};

		await VersionCacheManager.save(invalidCache as any);
		const loaded = await VersionCacheManager.load();
		expect(loaded).toBeNull();
	});

	test("clears cache successfully", async () => {
		const cache = {
			lastCheck: Date.now(),
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			latestUrl: "https://github.com/test",
			updateAvailable: true,
		};

		await VersionCacheManager.save(cache);
		let loaded = await VersionCacheManager.load();
		expect(loaded).not.toBeNull();

		await VersionCacheManager.clear();
		loaded = await VersionCacheManager.load();
		expect(loaded).toBeNull();
	});
});
