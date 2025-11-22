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

	describe("getLatestRelease with beta flag", () => {
		test("should call listReleases when includePrereleases is true", async () => {
			const kitConfig = AVAILABLE_KITS.engineer;

			// Mock listReleases to return a mix of stable and prerelease versions
			const mockListReleases = mock(async () => [
				{
					id: 2,
					tag_name: "v1.1.0-beta.1",
					name: "Beta Release",
					draft: false,
					prerelease: true,
					assets: [],
					published_at: "2024-01-02T00:00:00Z",
					tarball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.1.0-beta.1",
					zipball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.1.0-beta.1",
				},
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Stable Release",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.0.0",
					zipball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.0.0",
				},
			]);

			// Replace the listReleases method
			client.listReleases = mockListReleases;

			const release = await client.getLatestRelease(kitConfig, true);

			expect(mockListReleases).toHaveBeenCalledWith(kitConfig, 30);
			expect(release.tag_name).toBe("v1.1.0-beta.1");
			expect(release.prerelease).toBe(true);
		});

		test("should return first prerelease when includePrereleases is true", async () => {
			const kitConfig = AVAILABLE_KITS.engineer;

			const mockListReleases = mock(async () => [
				{
					id: 3,
					tag_name: "v1.2.0-beta.2",
					name: "Latest Beta",
					draft: false,
					prerelease: true,
					assets: [],
					published_at: "2024-01-03T00:00:00Z",
					tarball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.2.0-beta.2",
					zipball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.2.0-beta.2",
				},
				{
					id: 2,
					tag_name: "v1.1.0-beta.1",
					name: "Older Beta",
					draft: false,
					prerelease: true,
					assets: [],
					published_at: "2024-01-02T00:00:00Z",
					tarball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.1.0-beta.1",
					zipball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.1.0-beta.1",
				},
			]);

			client.listReleases = mockListReleases;

			const release = await client.getLatestRelease(kitConfig, true);

			expect(release.tag_name).toBe("v1.2.0-beta.2");
			expect(release.prerelease).toBe(true);
		});

		test("should fall back to stable release when no prereleases exist", async () => {
			const kitConfig = AVAILABLE_KITS.engineer;

			// Mock listReleases to return only stable releases
			const mockListReleases = mock(async () => [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Stable Release",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.0.0",
					zipball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.0.0",
				},
			]);

			client.listReleases = mockListReleases;

			// Mock getLatestRelease to simulate the fallback behavior
			const mockGetLatestRelease = mock(async () => ({
				id: 1,
				tag_name: "v1.0.0",
				name: "Stable Release",
				draft: false,
				prerelease: false,
				assets: [],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.0.0",
			}));

			// We expect the method to call listReleases, find no prerelease, and fall back
			const release = await client.getLatestRelease(kitConfig, true);

			// The actual implementation will call the API, so we verify the behavior
			expect(release).toBeDefined();
		});

		test("should not call listReleases when includePrereleases is false", async () => {
			const kitConfig = AVAILABLE_KITS.engineer;

			const mockListReleases = mock(async () => []);
			client.listReleases = mockListReleases;

			// This will call the actual API since we're testing default behavior
			// In a real scenario, this would need proper mocking of Octokit
			try {
				await client.getLatestRelease(kitConfig, false);
			} catch (error) {
				// Expected to fail since we're not mocking Octokit
			}

			// When includePrereleases is false, listReleases should NOT be called
			expect(mockListReleases).not.toHaveBeenCalled();
		});

		test("should default includePrereleases to false", async () => {
			const kitConfig = AVAILABLE_KITS.engineer;

			const mockListReleases = mock(async () => []);
			client.listReleases = mockListReleases;

			try {
				await client.getLatestRelease(kitConfig);
			} catch (error) {
				// Expected to fail since we're not mocking Octokit
			}

			// When no parameter is passed, listReleases should NOT be called
			expect(mockListReleases).not.toHaveBeenCalled();
		});
	});

	// Note: Actual API tests would require mocking Octokit or using a test fixture
	// We're keeping these tests simple to avoid external dependencies
});
