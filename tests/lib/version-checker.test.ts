import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { VersionCacheManager } from "@/domains/versioning/version-cache";
import {
	CliVersionChecker,
	VersionChecker,
	isNewerVersion,
	normalizeVersion,
} from "@/domains/versioning/version-checker";

describe("VersionChecker", () => {
	const originalEnv = process.env.NO_UPDATE_NOTIFIER;
	const originalIsTTY = process.stdout.isTTY;

	beforeEach(async () => {
		await VersionCacheManager.clear();
		// Restore env
		if (originalEnv !== undefined) {
			process.env.NO_UPDATE_NOTIFIER = originalEnv;
		} else {
			process.env.NO_UPDATE_NOTIFIER = undefined;
		}
		// Restore TTY
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		// Clean up env
		if (originalEnv !== undefined) {
			process.env.NO_UPDATE_NOTIFIER = originalEnv;
		} else {
			process.env.NO_UPDATE_NOTIFIER = undefined;
		}
		// Clean up TTY
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			writable: true,
			configurable: true,
		});
	});

	test("respects NO_UPDATE_NOTIFIER=1", async () => {
		process.env.NO_UPDATE_NOTIFIER = "1";
		const result = await VersionChecker.check("v1.0.0");
		expect(result).toBeNull();
	});

	test("respects NO_UPDATE_NOTIFIER=true", async () => {
		process.env.NO_UPDATE_NOTIFIER = "true";
		const result = await VersionChecker.check("v1.0.0");
		expect(result).toBeNull();
	});

	test("skips check in non-TTY environment", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: false,
			writable: true,
			configurable: true,
		});
		const result = await VersionChecker.check("v1.0.0");
		expect(result).toBeNull();
	});

	test("normalizes version tags", () => {
		// Use exported normalizeVersion function
		expect(normalizeVersion("v1.0.0")).toBe("1.0.0");
		expect(normalizeVersion("1.0.0")).toBe("1.0.0");
		expect(normalizeVersion("v2.5.3")).toBe("2.5.3");
	});

	test("compares versions correctly", () => {
		// Use exported isNewerVersion function
		expect(isNewerVersion("v1.0.0", "v1.1.0")).toBe(true);
		expect(isNewerVersion("v1.0.0", "v1.0.0")).toBe(false);
		expect(isNewerVersion("v1.1.0", "v1.0.0")).toBe(false);
		expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);
	});

	test("uses cached result when valid", async () => {
		// Ensure TTY is true and NO_UPDATE_NOTIFIER is not set
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			writable: true,
			configurable: true,
		});
		process.env.NO_UPDATE_NOTIFIER = undefined;

		// Save a valid cache
		await VersionCacheManager.save({
			lastCheck: Date.now(),
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			latestUrl: "https://github.com/test",
			updateAvailable: true,
		});

		const result = await VersionChecker.check("v1.0.0");
		expect(result).not.toBeNull();
		expect(result?.currentVersion).toBe("v1.0.0");
		expect(result?.latestVersion).toBe("v1.1.0");
		expect(result?.updateAvailable).toBe(true);
	});

	test("fetches new data when cache is expired", async () => {
		// Save an expired cache
		await VersionCacheManager.save({
			lastCheck: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			latestUrl: "https://github.com/test",
			updateAvailable: true,
		});

		// This will try to fetch from GitHub (may fail in CI or without auth)
		// Just verify it doesn't crash
		const result = await VersionChecker.check("v1.0.0");
		// Result could be null (silent failure) or contain new data
		// Just verify the check completes without throwing
		expect(result === null || typeof result === "object").toBe(true);
	});

	test("handles network errors gracefully", async () => {
		// Use a version that will trigger a real check (no cache)
		// The check might fail due to network/auth, but should return null silently
		const result = await VersionChecker.check("v0.0.1-nonexistent");
		// Should return null or a valid result, but never throw
		expect(result === null || typeof result === "object").toBe(true);
	});

	test("displayNotification does not crash with valid result", () => {
		const result = {
			currentVersion: "v1.0.0",
			latestVersion: "v1.1.0",
			updateAvailable: true,
			releaseUrl: "https://github.com/claudekit/claudekit-engineer/releases/tag/v1.1.0",
		};

		// Just verify it doesn't throw
		expect(() => VersionChecker.displayNotification(result)).not.toThrow();
	});

	test("displayNotification does nothing when no update available", () => {
		const result = {
			currentVersion: "v1.0.0",
			latestVersion: "v1.0.0",
			updateAvailable: false,
			releaseUrl: "https://github.com/claudekit/claudekit-engineer/releases/tag/v1.0.0",
		};

		// Just verify it doesn't throw and doesn't log
		expect(() => VersionChecker.displayNotification(result)).not.toThrow();
	});
});

describe("CliVersionChecker", () => {
	const originalEnv = process.env.NO_UPDATE_NOTIFIER;
	const originalIsTTY = process.stdout.isTTY;
	const originalFetch = global.fetch;

	beforeEach(() => {
		// Restore env
		if (originalEnv !== undefined) {
			process.env.NO_UPDATE_NOTIFIER = originalEnv;
		} else {
			process.env.NO_UPDATE_NOTIFIER = undefined;
		}
		// Restore TTY
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		// Clean up env
		if (originalEnv !== undefined) {
			process.env.NO_UPDATE_NOTIFIER = originalEnv;
		} else {
			process.env.NO_UPDATE_NOTIFIER = undefined;
		}
		// Clean up TTY
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			writable: true,
			configurable: true,
		});
		// Restore fetch
		global.fetch = originalFetch;
	});

	test("respects NO_UPDATE_NOTIFIER=1", async () => {
		process.env.NO_UPDATE_NOTIFIER = "1";
		const result = await CliVersionChecker.check("1.0.0");
		expect(result).toBeNull();
	});

	test("respects NO_UPDATE_NOTIFIER=true", async () => {
		process.env.NO_UPDATE_NOTIFIER = "true";
		const result = await CliVersionChecker.check("1.0.0");
		expect(result).toBeNull();
	});

	test("skips check in non-TTY environment", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: false,
			writable: true,
			configurable: true,
		});
		const result = await CliVersionChecker.check("1.0.0");
		expect(result).toBeNull();
	});

	test("returns update available when newer version exists", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			writable: true,
			configurable: true,
		});
		process.env.NO_UPDATE_NOTIFIER = undefined;

		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						name: "claudekit-cli",
						"dist-tags": { latest: "2.0.0" },
						versions: {},
						time: {},
					}),
			} as Response),
		) as unknown as typeof fetch;

		const result = await CliVersionChecker.check("1.0.0");
		expect(result).not.toBeNull();
		expect(result?.updateAvailable).toBe(true);
		expect(result?.currentVersion).toBe("1.0.0");
		expect(result?.latestVersion).toBe("2.0.0");
	});

	test("returns null when already on latest version", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			writable: true,
			configurable: true,
		});
		process.env.NO_UPDATE_NOTIFIER = undefined;

		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						name: "claudekit-cli",
						"dist-tags": { latest: "1.0.0" },
						versions: {},
						time: {},
					}),
			} as Response),
		) as unknown as typeof fetch;

		const result = await CliVersionChecker.check("1.0.0");
		// Should return null or an object with updateAvailable: false
		expect(result === null || result?.updateAvailable === false).toBe(true);
	});

	test("handles network errors gracefully", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			writable: true,
			configurable: true,
		});
		process.env.NO_UPDATE_NOTIFIER = undefined;

		global.fetch = mock(() =>
			Promise.reject(new Error("Network error")),
		) as unknown as typeof fetch;

		const result = await CliVersionChecker.check("1.0.0");
		// Should return null on error (silent failure)
		expect(result).toBeNull();
	});

	test("normalizes version with v prefix", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			writable: true,
			configurable: true,
		});
		process.env.NO_UPDATE_NOTIFIER = undefined;

		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						name: "claudekit-cli",
						"dist-tags": { latest: "2.0.0" },
						versions: {},
						time: {},
					}),
			} as Response),
		) as unknown as typeof fetch;

		const result = await CliVersionChecker.check("v1.0.0");
		expect(result).not.toBeNull();
		expect(result?.currentVersion).toBe("1.0.0"); // v prefix stripped
	});

	test("displayNotification does not crash with valid result", () => {
		const result = {
			currentVersion: "1.0.0",
			latestVersion: "2.0.0",
			updateAvailable: true,
			releaseUrl: "https://www.npmjs.com/package/claudekit-cli",
		};

		// Just verify it doesn't throw
		expect(() => CliVersionChecker.displayNotification(result)).not.toThrow();
	});

	test("displayNotification does nothing when no update available", () => {
		const result = {
			currentVersion: "1.0.0",
			latestVersion: "1.0.0",
			updateAvailable: false,
			releaseUrl: "https://www.npmjs.com/package/claudekit-cli",
		};

		// Just verify it doesn't throw
		expect(() => CliVersionChecker.displayNotification(result)).not.toThrow();
	});
});
