import { beforeEach, describe, expect, mock, test } from "bun:test";
import { GitHubClient } from "../../src/lib/github.js";
import { AVAILABLE_KITS, GitHubError } from "../../src/types.js";

describe("GitHubClient", () => {
	let client: GitHubClient;

	beforeEach(() => {
		client = new GitHubClient();
		// Set environment variable to avoid auth prompts during tests
		process.env.GITHUB_TOKEN = "ghp_test_token_for_testing";
	});

	describe("constructor", () => {
		test("should create GitHubClient instance", () => {
			expect(client).toBeInstanceOf(GitHubClient);
		});
	});

	describe("error handling", () => {
		test("GitHubError should contain message and status code", () => {
			const error = new GitHubError("Test error", 404);
			expect(error.message).toBe("Test error");
			expect(error.statusCode).toBe(404);
			expect(error.code).toBe("GITHUB_ERROR");
			expect(error.name).toBe("GitHubError");
		});

		test("GitHubError should work without status code", () => {
			const error = new GitHubError("Test error");
			expect(error.message).toBe("Test error");
			expect(error.statusCode).toBeUndefined();
		});
	});

	describe("integration scenarios", () => {
		test("should handle kit configuration correctly", () => {
			const engineerKit = AVAILABLE_KITS.engineer;
			expect(engineerKit.owner).toBe("claudekit");
			expect(engineerKit.repo).toBe("claudekit-engineer");
		});

		test("should handle marketing kit configuration", () => {
			const marketingKit = AVAILABLE_KITS.marketing;
			expect(marketingKit.owner).toBe("claudekit");
			expect(marketingKit.repo).toBe("claudekit-marketing");
		});
	});

	// Note: Actual API tests would require mocking Octokit or using a test fixture
	// We're keeping these tests simple to avoid external dependencies
});
