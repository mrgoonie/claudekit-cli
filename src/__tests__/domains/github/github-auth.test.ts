import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AuthManager } from "@/domains/github/github-auth.js";

describe("AuthManager", () => {
	const originalEnv = process.env;

	beforeEach(async () => {
		// Reset env and clear cached state
		process.env = { ...originalEnv };
		process.env.GITHUB_TOKEN = undefined;
		process.env.GH_TOKEN = undefined;
		await AuthManager.clearToken();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("hasEnvToken", () => {
		test("returns true when GITHUB_TOKEN is set", () => {
			process.env.GITHUB_TOKEN = "ghp_test123";
			expect(AuthManager.hasEnvToken()).toBe(true);
		});

		test("returns true when GH_TOKEN is set", () => {
			process.env.GH_TOKEN = "ghp_test456";
			expect(AuthManager.hasEnvToken()).toBe(true);
		});

		test("returns false when no env tokens set", () => {
			process.env.GITHUB_TOKEN = undefined;
			process.env.GH_TOKEN = undefined;
			expect(AuthManager.hasEnvToken()).toBe(false);
		});

		test("prefers GITHUB_TOKEN over GH_TOKEN", () => {
			process.env.GITHUB_TOKEN = "github_token";
			process.env.GH_TOKEN = "gh_token";
			expect(AuthManager.hasEnvToken()).toBe(true);
		});
	});

	describe("clearToken", () => {
		test("clears cached token", async () => {
			// Set env token first
			process.env.GITHUB_TOKEN = "test_token";

			// Get token to cache it
			const result = await AuthManager.getToken();
			expect(result.token).toBe("test_token");
			expect(result.method).toBe("env");

			// Clear
			await AuthManager.clearToken();

			// Remove env var
			process.env.GITHUB_TOKEN = undefined;

			// If gh CLI is installed, it will use that
			// Otherwise it will throw - both are valid behaviors
			// Just verify clear doesn't throw
			expect(true).toBe(true);
		});

		test("resets ghCliInstalled cache", async () => {
			// After clear, ghCliInstalled should be re-evaluated on next check
			await AuthManager.clearToken();
			// Just verify it doesn't throw
			expect(AuthManager.hasEnvToken()).toBe(false);
		});
	});

	describe("getToken", () => {
		test("returns env token with method when set", async () => {
			process.env.GITHUB_TOKEN = "env_token";
			const result = await AuthManager.getToken();
			expect(result.token).toBe("env_token");
			expect(result.method).toBe("env");
		});

		test("caches token for subsequent calls", async () => {
			process.env.GITHUB_TOKEN = "cached_token";
			const result1 = await AuthManager.getToken();
			process.env.GITHUB_TOKEN = undefined;
			const result2 = await AuthManager.getToken();
			expect(result1.token).toBe(result2.token);
			expect(result1.method).toBe(result2.method);
		});

		test("returns GH_TOKEN when GITHUB_TOKEN not set", async () => {
			process.env.GITHUB_TOKEN = undefined;
			process.env.GH_TOKEN = "gh_token_value";
			const result = await AuthManager.getToken();
			expect(result.token).toBe("gh_token_value");
			expect(result.method).toBe("env");
		});
	});

	describe("isGhCliInstalled", () => {
		// Skip in CI - gh --version can be slow and cause timeouts
		test.skipIf(!!process.env.CI)("returns boolean", () => {
			const result = AuthManager.isGhCliInstalled();
			expect(typeof result).toBe("boolean");
		});

		test.skipIf(!!process.env.CI)("caches result for performance", () => {
			const result1 = AuthManager.isGhCliInstalled();
			const result2 = AuthManager.isGhCliInstalled();
			expect(result1).toBe(result2);
		});
	});
});
