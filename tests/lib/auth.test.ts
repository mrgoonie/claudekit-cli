import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import { AuthManager } from "../../src/lib/auth.js";
import { AuthenticationError } from "../../src/types.js";

describe("AuthManager", () => {
	let execSyncSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		// Reset AuthManager state
		(AuthManager as any).token = null;
		(AuthManager as any).authMethod = null;

		// Spy on execSync to prevent actual gh CLI calls during tests
		execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((command: string) => {
			if (command === "gh auth token") {
				// Simulate gh CLI not available/not authenticated
				throw new Error("gh not authenticated");
			}
			return Buffer.from("");
		});
	});

	afterEach(() => {
		// Clean up environment variables
		process.env.GITHUB_TOKEN = undefined;
		process.env.GH_TOKEN = undefined;

		// Restore execSync
		if (execSyncSpy) {
			execSyncSpy.mockRestore();
		}
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
		test(
			"should get token from environment (gh-cli, env-var, or cached)",
			async () => {
				// Set environment variable to avoid prompting in CI
				process.env.GITHUB_TOKEN = "ghp_test_token_ci_123";

				// Since we mock gh CLI to fail, it should fall back to env-var
				const result = await AuthManager.getToken();

				expect(result.token).toBe("ghp_test_token_ci_123");
				expect(result.method).toBe("env-var");
			},
			{ timeout: 5000 },
		);

		test(
			"should cache token after first retrieval",
			async () => {
				// Set environment variable to avoid prompting in CI
				process.env.GITHUB_TOKEN = "ghp_test_token_cache_456";

				// Clear cache first
				(AuthManager as any).token = null;
				(AuthManager as any).authMethod = null;

				const result1 = await AuthManager.getToken();
				const result2 = await AuthManager.getToken();

				expect(result1.token).toBe(result2.token);
				expect(result1.method).toBe(result2.method);
				expect(result1.method).toBe("env-var");
			},
			{ timeout: 5000 },
		);

		test(
			"should handle GITHUB_TOKEN env var when gh-cli is not available",
			async () => {
				// gh CLI is mocked to fail, so should use env-var
				process.env.GITHUB_TOKEN = "ghp_test_token_123";

				// Clear cache
				(AuthManager as any).token = null;
				(AuthManager as any).authMethod = null;

				const result = await AuthManager.getToken();

				expect(result.token).toBe("ghp_test_token_123");
				expect(result.method).toBe("env-var");
			},
			{ timeout: 5000 },
		);

		test(
			"should handle GH_TOKEN env var when GITHUB_TOKEN is not set",
			async () => {
				process.env.GITHUB_TOKEN = undefined;
				process.env.GH_TOKEN = "ghp_test_token_456";

				// Clear cache
				(AuthManager as any).token = null;
				(AuthManager as any).authMethod = null;

				const result = await AuthManager.getToken();

				expect(result.token).toBe("ghp_test_token_456");
				expect(result.method).toBe("env-var");
			},
			{ timeout: 5000 },
		);
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
