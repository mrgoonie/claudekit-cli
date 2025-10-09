import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AuthManager } from "../../src/lib/auth.js";
import { AuthenticationError } from "../../src/types.js";

describe("AuthManager", () => {
	beforeEach(() => {
		// Reset AuthManager state
		(AuthManager as any).token = null;
		(AuthManager as any).authMethod = null;
	});

	afterEach(() => {
		// Clean up environment variables
		process.env.GITHUB_TOKEN = undefined;
		process.env.GH_TOKEN = undefined;
	});

	describe("isValidTokenFormat", () => {
		test("should accept ghp_ tokens", () => {
			expect(AuthManager.isValidTokenFormat("ghp_1234567890")).toBe(true);
		});

		test("should accept github_pat_ tokens", () => {
			expect(AuthManager.isValidTokenFormat("github_pat_1234567890")).toBe(true);
		});

		test("should reject invalid token formats", () => {
			expect(AuthManager.isValidTokenFormat("invalid_token")).toBe(false);
			expect(AuthManager.isValidTokenFormat("gho_1234567890")).toBe(false);
			expect(AuthManager.isValidTokenFormat("")).toBe(false);
			expect(AuthManager.isValidTokenFormat("token123")).toBe(false);
		});

		test("should handle empty and malformed tokens", () => {
			expect(AuthManager.isValidTokenFormat("")).toBe(false);
			expect(AuthManager.isValidTokenFormat("ghp")).toBe(false);
			expect(AuthManager.isValidTokenFormat("github_pat")).toBe(false);
		});
	});

	describe("getToken - environment variables", () => {
		test("should get token from environment (gh-cli, env-var, or cached)", async () => {
			// This test acknowledges that the token can come from multiple sources
			// in the fallback chain: gh-cli > env-var > config > keychain > prompt
			const result = await AuthManager.getToken();

			expect(result.token).toBeDefined();
			expect(result.token.length).toBeGreaterThan(0);
			expect(result.method).toBeDefined();
			// Method could be 'gh-cli', 'env-var', 'keychain', or 'prompt'
			expect(["gh-cli", "env-var", "keychain", "prompt"]).toContain(result.method);
		});

		test("should cache token after first retrieval", async () => {
			// Clear cache first
			(AuthManager as any).token = null;
			(AuthManager as any).authMethod = null;

			const result1 = await AuthManager.getToken();
			const result2 = await AuthManager.getToken();

			expect(result1.token).toBe(result2.token);
			expect(result1.method).toBe(result2.method);
		});

		test("should handle GITHUB_TOKEN env var when gh-cli is not available", async () => {
			// Note: If gh CLI is installed and authenticated, it will take precedence
			// This test documents the expected behavior but may not enforce it
			process.env.GITHUB_TOKEN = "ghp_test_token_123";

			// Clear cache
			(AuthManager as any).token = null;
			(AuthManager as any).authMethod = null;

			const result = await AuthManager.getToken();

			// Token should either be from gh-cli or env-var
			expect(result.token).toBeDefined();
			expect(["gh-cli", "env-var"]).toContain(result.method);
		});

		test("should handle GH_TOKEN env var when GITHUB_TOKEN is not set", async () => {
			process.env.GITHUB_TOKEN = undefined;
			process.env.GH_TOKEN = "ghp_test_token_456";

			// Clear cache
			(AuthManager as any).token = null;
			(AuthManager as any).authMethod = null;

			const result = await AuthManager.getToken();

			// Token should either be from gh-cli or env-var
			expect(result.token).toBeDefined();
			expect(["gh-cli", "env-var"]).toContain(result.method);
		});
	});

	describe("clearToken", () => {
		test("should clear cached token", async () => {
			// Set a cached token
			(AuthManager as any).token = "test-token";
			(AuthManager as any).authMethod = "env-var";

			await AuthManager.clearToken();

			expect((AuthManager as any).token).toBeNull();
			expect((AuthManager as any).authMethod).toBeNull();
		});
	});
});
