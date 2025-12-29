import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maybeShowConfigUpdateNotification } from "@/domains/sync/passive-update-check.js";
import { PathResolver } from "@/shared/path-resolver.js";

describe("maybeShowConfigUpdateNotification", () => {
	let testDir: string;
	let claudeDir: string;
	let cacheDir: string;
	let originalFetch: typeof fetch;
	let originalGetCacheDir: typeof PathResolver.getCacheDir;

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`passive-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		claudeDir = join(testDir, ".claude");
		cacheDir = join(testDir, ".cache");
		await mkdir(claudeDir, { recursive: true });
		await mkdir(cacheDir, { recursive: true });
		originalFetch = globalThis.fetch;

		// Mock getCacheDir to use test directory
		originalGetCacheDir = PathResolver.getCacheDir;
		PathResolver.getCacheDir = () => cacheDir;
	});

	afterEach(async () => {
		globalThis.fetch = originalFetch;
		PathResolver.getCacheDir = originalGetCacheDir;
		await rm(testDir, { recursive: true, force: true });
	});

	it("returns false when no metadata exists", async () => {
		const result = await maybeShowConfigUpdateNotification(claudeDir, false);
		expect(result).toBe(false);
	});

	it("returns false for empty metadata", async () => {
		await writeFile(join(claudeDir, "metadata.json"), "{}");
		const result = await maybeShowConfigUpdateNotification(claudeDir, false);
		expect(result).toBe(false);
	});

	it("returns false when kits have no version", async () => {
		const metadata = {
			kits: {
				engineer: { files: [] }, // No version
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));
		const result = await maybeShowConfigUpdateNotification(claudeDir, false);
		expect(result).toBe(false);
	});

	it("returns false when no updates available (cached)", async () => {
		// Set up multi-kit metadata
		const metadata = {
			kits: {
				engineer: { version: "1.16.0", files: [] },
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// Set up cache showing same version (uses mocked cacheDir)
		const cache = {
			lastCheck: Date.now(),
			latestVersion: "1.16.0",
		};
		await writeFile(join(cacheDir, "engineer-config-update-cache.json"), JSON.stringify(cache));

		const result = await maybeShowConfigUpdateNotification(claudeDir, false);
		expect(result).toBe(false);
	});

	it("returns true and shows notification when updates available", async () => {
		// Set up multi-kit metadata with older version
		const metadata = {
			kits: {
				engineer: { version: "1.15.0", files: [] },
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// Set up cache showing newer version available (uses mocked cacheDir)
		const cache = {
			lastCheck: Date.now(),
			latestVersion: "1.16.0",
		};
		await writeFile(join(cacheDir, "engineer-config-update-cache.json"), JSON.stringify(cache));

		// Spy on console.log to verify notification shown
		const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

		const result = await maybeShowConfigUpdateNotification(claudeDir, false);

		expect(result).toBe(true);
		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
	});

	it("handles legacy metadata format", async () => {
		// Legacy single-kit format
		const metadata = {
			name: "claudekit-engineer",
			version: "1.15.0",
			files: [],
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// Set up cache showing newer version (uses mocked cacheDir)
		const cache = {
			lastCheck: Date.now(),
			latestVersion: "1.16.0",
		};
		await writeFile(join(cacheDir, "engineer-config-update-cache.json"), JSON.stringify(cache));

		const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

		const result = await maybeShowConfigUpdateNotification(claudeDir, false);

		expect(result).toBe(true);

		consoleSpy.mockRestore();
	});

	it("shows only one notification for multiple kits", async () => {
		// Multi-kit with both needing updates
		const metadata = {
			kits: {
				engineer: { version: "1.15.0", files: [] },
				marketing: { version: "1.15.0", files: [] },
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// Set up caches for both (uses mocked cacheDir)
		const cache = { lastCheck: Date.now(), latestVersion: "1.16.0" };
		await writeFile(join(cacheDir, "engineer-config-update-cache.json"), JSON.stringify(cache));
		await writeFile(join(cacheDir, "marketing-config-update-cache.json"), JSON.stringify(cache));

		let notificationCount = 0;
		const consoleSpy = spyOn(console, "log").mockImplementation((msg) => {
			// Count notification boxes (they start with the top border)
			if (typeof msg === "string" && msg.includes("╭")) {
				notificationCount++;
			}
		});

		const result = await maybeShowConfigUpdateNotification(claudeDir, false);

		expect(result).toBe(true);
		// Should show exactly one notification box
		expect(notificationCount).toBe(1);

		consoleSpy.mockRestore();
	});

	it("never throws errors (silent failure)", async () => {
		// Corrupt metadata that would cause JSON parse error
		await writeFile(join(claudeDir, "metadata.json"), "not valid json {{{");

		// Should not throw
		const result = await maybeShowConfigUpdateNotification(claudeDir, false);
		expect(result).toBe(false);
	});

	it("works with global flag", async () => {
		const metadata = {
			kits: {
				engineer: { version: "1.15.0", files: [] },
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// Set up cache with update available (uses mocked cacheDir)
		const cache = { lastCheck: Date.now(), latestVersion: "1.16.0" };
		await writeFile(join(cacheDir, "engineer-config-update-cache.json"), JSON.stringify(cache));

		const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

		// global=true should still work with our mocked getCacheDir
		const result = await maybeShowConfigUpdateNotification(claudeDir, true);

		expect(result).toBe(true);
		consoleSpy.mockRestore();
	});
});
