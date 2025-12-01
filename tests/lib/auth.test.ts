import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import { AuthManager } from "../../src/lib/auth.js";
import { AuthenticationError } from "../../src/types.js";

describe("AuthManager", () => {
	let execSyncSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		// Reset AuthManager state
		(AuthManager as any).token = null;
	});

	afterEach(() => {
		// Restore execSync
		if (execSyncSpy) {
			execSyncSpy.mockRestore();
		}
	});

	describe("getToken - GitHub CLI authentication", () => {
		test(
			"should get token from GitHub CLI when authenticated",
			async () => {
				// Mock gh CLI to return a valid token
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh auth token") {
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
			"should throw AuthenticationError when GitHub CLI is not authenticated",
			async () => {
				// Mock gh CLI to fail (not authenticated)
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation((() => {
					throw new Error("gh not authenticated");
				}) as any);

				await expect(AuthManager.getToken()).rejects.toThrow(AuthenticationError);
			},
			{ timeout: 5000 },
		);

		test(
			"should throw AuthenticationError when GitHub CLI returns empty token",
			async () => {
				// Mock gh CLI to return empty string
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh auth token") {
						return "";
					}
					return "";
				}) as any);

				await expect(AuthManager.getToken()).rejects.toThrow(AuthenticationError);
			},
			{ timeout: 5000 },
		);

		test(
			"should cache token after first retrieval",
			async () => {
				// Mock gh CLI to return a valid token
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh auth token") {
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
				let callCount = 0;
				execSyncSpy = spyOn(childProcess, "execSync").mockImplementation(((command: string) => {
					if (command === "gh auth token") {
						callCount++;
						return "ghp_test_token_789";
					}
					return "";
				}) as any);

				// Clear cache first
				(AuthManager as any).token = null;

				await AuthManager.getToken();
				await AuthManager.getToken();
				await AuthManager.getToken();

				// Should only call gh CLI once (first time)
				expect(callCount).toBe(1);
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
