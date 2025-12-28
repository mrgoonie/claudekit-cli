import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import { AuthManager } from "@/domains/github/github-auth.js";
import { AuthenticationError } from "@/types";

describe("AuthManager", () => {
	let execSyncSpy: ReturnType<typeof spyOn>;
	let savedGitHubToken: string | undefined;
	let savedGhToken: string | undefined;

	beforeEach(() => {
		// Save original env vars
		savedGitHubToken = process.env.GITHUB_TOKEN;
		savedGhToken = process.env.GH_TOKEN;

		// Reset AuthManager state
		(AuthManager as any).token = null;
		(AuthManager as any).tokenMethod = null;
		(AuthManager as any).ghCliInstalled = null;

		// Actually remove env vars to test gh CLI path (delete is required, undefined doesn't work)
		// biome-ignore lint/performance/noDelete: Required to properly clear env vars for testing
		delete process.env.GITHUB_TOKEN;
		// biome-ignore lint/performance/noDelete: Required to properly clear env vars for testing
		delete process.env.GH_TOKEN;
	});

	afterEach(() => {
		// Restore execSync
		if (execSyncSpy) {
			execSyncSpy.mockRestore();
		}
		// Restore env vars
		if (savedGitHubToken !== undefined) {
			process.env.GITHUB_TOKEN = savedGitHubToken;
		}
		if (savedGhToken !== undefined) {
			process.env.GH_TOKEN = savedGhToken;
		}
	});

	describe("getToken - GitHub CLI authentication", () => {
		test(
			"should get token from GitHub CLI when authenticated (with explicit host)",
			async () => {
				// Mock gh CLI to return a valid token
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						return "gh version 2.0.0";
					}
					// New: Uses explicit -h github.com flag
					if (command === "gh auth token -h github.com") {
						return "ghp_test_token_123";
					}
					return "";
				}) as any);

				const result = await AuthManager.getToken();

				expect(result.token).toBe("ghp_test_token_123");
				expect(result.method).toBe("gh-cli");
			},
			{ timeout: 5000 },
		);

		test(
			"should fallback to gh auth token without host flag if explicit host fails",
			async () => {
				// Mock gh CLI: explicit host fails, fallback succeeds
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						return "gh version 2.0.0";
					}
					if (command === "gh auth token -h github.com") {
						throw new Error("unknown flag: -h");
					}
					if (command === "gh auth token") {
						return "ghp_fallback_token_999";
					}
					return "";
				}) as any);

				const result = await AuthManager.getToken();

				expect(result.token).toBe("ghp_fallback_token_999");
				expect(result.method).toBe("gh-cli");
			},
			{ timeout: 5000 },
		);

		test(
			"should throw AuthenticationError when GitHub CLI is not installed",
			async () => {
				// Mock gh CLI to fail on version check (not installed)
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						throw new Error("command not found: gh");
					}
					return "";
				}) as any);

				const error = await AuthManager.getToken().catch((e) => e);
				expect(error).toBeInstanceOf(AuthenticationError);
				expect(error.message).toContain("No GitHub authentication found");
			},
			{ timeout: 5000 },
		);

		test(
			"should throw AuthenticationError when GitHub CLI is not authenticated",
			async () => {
				// Mock gh CLI: installed but not authenticated
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						return "gh version 2.0.0";
					}
					if (command === "gh auth token -h github.com" || command === "gh auth token") {
						throw new Error("gh not authenticated");
					}
					// Mock diagnostic commands
					if (command.includes("gh auth status")) {
						return "Not logged in";
					}
					return "";
				}) as any);

				const error = await AuthManager.getToken().catch((e) => e);
				expect(error).toBeInstanceOf(AuthenticationError);
				expect(error.message).toContain("Failed to retrieve GitHub token");
			},
			{ timeout: 5000 },
		);

		test(
			"should throw AuthenticationError when GitHub CLI returns empty token",
			async () => {
				// Mock gh CLI: installed but returns empty token
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						return "gh version 2.0.0";
					}
					if (command === "gh auth token -h github.com" || command === "gh auth token") {
						return "";
					}
					// Mock diagnostic commands
					if (command.includes("gh auth status")) {
						return "Not logged in";
					}
					return "";
				}) as any);

				const error = await AuthManager.getToken().catch((e) => e);
				expect(error).toBeInstanceOf(AuthenticationError);
				expect(error.message).toContain("Failed to retrieve GitHub token");
			},
			{ timeout: 5000 },
		);

		test(
			"should cache token after first retrieval",
			async () => {
				// Mock gh CLI to return a valid token
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						return "gh version 2.0.0";
					}
					if (command === "gh auth token -h github.com") {
						return "ghp_cached_token_456";
					}
					return "";
				}) as any);

				// Clear cache first
				(AuthManager as any).token = null;

				const result1 = await AuthManager.getToken();
				const result2 = await AuthManager.getToken();

				expect(result1.token).toBe(result2.token);
				expect(result1.method).toBe("gh-cli");
				expect(result2.method).toBe("gh-cli");
			},
			{ timeout: 5000 },
		);

		test(
			"should use cached token without calling gh CLI again",
			async () => {
				let tokenCallCount = 0;
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh --version") {
						return "gh version 2.0.0";
					}
					if (command === "gh auth token -h github.com") {
						tokenCallCount++;
						return "ghp_test_token_789";
					}
					return "";
				}) as any);

				// Clear cache first
				(AuthManager as any).token = null;

				await AuthManager.getToken();
				await AuthManager.getToken();
				await AuthManager.getToken();

				// Should only call gh auth token once (first time, then cached)
				expect(tokenCallCount).toBe(1);
			},
			{ timeout: 5000 },
		);
	});

	describe("clearToken", () => {
		test("should clear cached token", async () => {
			// Set a cached token
			(AuthManager as any).token = "test-token";

			await AuthManager.clearToken();

			expect((AuthManager as any).token).toBeNull();
		});
	});
});
