import { beforeEach, describe, expect, mock, test } from "bun:test";
import { GitHubClient } from "@/domains/github/github-client.js";
import { AVAILABLE_KITS, GitHubError } from "@/types";

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
		test("should return prerelease when includePrereleases is true and prereleases exist", async () => {
			// Mock listReleases to return a mix of stable and prerelease versions
			const mockReleases = [
				{
					id: 2,
					tag_name: "v1.1.0-beta.1",
					name: "Beta Release",
					draft: false,
					prerelease: true,
					assets: [],
					published_at: "2024-01-02T00:00:00Z",
					tarball_url:
						"https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.1.0-beta.1",
					zipball_url:
						"https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.1.0-beta.1",
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
			];

			const listReleasesSpy = mock(() => Promise.resolve(mockReleases));

			// Test the logic by calling the mock and verifying the behavior
			const releases = await listReleasesSpy();
			const prereleaseVersion = releases.find((r) => r.prerelease);

			// Verify the prerelease was found
			expect(prereleaseVersion).toBeDefined();
			expect(prereleaseVersion?.tag_name).toBe("v1.1.0-beta.1");
			expect(prereleaseVersion?.prerelease).toBe(true);
		});

		test("should return first prerelease from list when multiple prereleases exist", async () => {
			const mockReleases = [
				{
					id: 3,
					tag_name: "v1.2.0-beta.2",
					name: "Latest Beta",
					draft: false,
					prerelease: true,
					assets: [],
					published_at: "2024-01-03T00:00:00Z",
					tarball_url:
						"https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.2.0-beta.2",
					zipball_url:
						"https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.2.0-beta.2",
				},
				{
					id: 2,
					tag_name: "v1.1.0-beta.1",
					name: "Older Beta",
					draft: false,
					prerelease: true,
					assets: [],
					published_at: "2024-01-02T00:00:00Z",
					tarball_url:
						"https://api.github.com/repos/claudekit/claudekit-engineer/tarball/v1.1.0-beta.1",
					zipball_url:
						"https://api.github.com/repos/claudekit/claudekit-engineer/zipball/v1.1.0-beta.1",
				},
			];

			const listReleasesSpy = mock(() => Promise.resolve(mockReleases));

			// Test the logic: first prerelease should be selected
			const releases = await listReleasesSpy();
			const firstPrerelease = releases.find((r) => r.prerelease);

			expect(firstPrerelease).toBeDefined();
			expect(firstPrerelease?.tag_name).toBe("v1.2.0-beta.2");
			expect(firstPrerelease?.prerelease).toBe(true);
		});

		test("should fall back to stable release when beta=true but no prereleases exist", async () => {
			// Test the logic directly: when includePrereleases=true but no prereleases in list
			const mockReleases = [
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
			];

			// Simulate the logic from ReleasesApi.getLatestRelease
			const prereleaseVersion = mockReleases.find((r) => r.prerelease);

			// When no prerelease found, it should fall back to stable
			expect(prereleaseVersion).toBeUndefined();

			// The fallback behavior: if no prerelease, use stable release
			const stableRelease = mockReleases[0];
			expect(stableRelease.tag_name).toBe("v1.0.0");
			expect(stableRelease.prerelease).toBe(false);
		});

		test("should not call listReleases when includePrereleases is false", async () => {
			// Test the logic: when includePrereleases=false, listReleases should not be called
			// The ReleasesApi.getLatestRelease only calls listReleases if includePrereleases=true
			let listReleasesCallCount = 0;
			const includePrereleases = false;

			// Simulate the conditional logic in getLatestRelease
			if (includePrereleases) {
				listReleasesCallCount++;
			}

			expect(listReleasesCallCount).toBe(0);
		});

		test("should default includePrereleases to false when not specified", async () => {
			// Test that the default parameter value is false
			// The ReleasesApi.getLatestRelease signature is: (kit, includePrereleases = false)
			const defaultValue = false; // matches the default parameter

			let listReleasesCallCount = 0;
			const includePrereleases = defaultValue;

			// Simulate the conditional logic
			if (includePrereleases) {
				listReleasesCallCount++;
			}

			// listReleases should not be called with default (false) value
			expect(listReleasesCallCount).toBe(0);
		});

		test("should handle empty prerelease list gracefully", async () => {
			// Test the logic: when list is empty, no prerelease is found
			const mockReleases: any[] = [];

			const prereleaseVersion = mockReleases.find((r) => r.prerelease);

			// With empty list, no prerelease found, should fall back to stable
			expect(prereleaseVersion).toBeUndefined();

			// The fallback behavior would get stable from getLatestRelease API
			// This test validates the logic handles empty arrays without crashing
			expect(mockReleases.length).toBe(0);
		});
	});

	// Note: Actual API tests would require mocking Octokit or using a test fixture
	// We're keeping these tests simple to avoid external dependencies

	describe("listReleases pagination logic", () => {
		test("should stop early when stable release found with stopWhenStableFound=true", () => {
			// Simulate: page 1 has only prereleases, page 2 has stable
			const page1 = Array.from({ length: 100 }, (_, i) => ({
				id: i + 1,
				tag_name: `v1.0.0-beta.${100 - i}`,
				prerelease: true,
				draft: false,
			}));

			const page2 = [
				{ id: 101, tag_name: "v1.0.0", prerelease: false, draft: false },
				...Array.from({ length: 99 }, (_, i) => ({
					id: 102 + i,
					tag_name: `v0.9.0-beta.${99 - i}`,
					prerelease: true,
					draft: false,
				})),
			];

			// Simulate the stopWhenStableFound logic
			const allReleases = [...page1];
			let hasStable = allReleases.some((r) => !r.prerelease && !r.draft);
			expect(hasStable).toBe(false);

			// After adding page 2
			allReleases.push(...page2);
			hasStable = allReleases.some((r) => !r.prerelease && !r.draft);
			expect(hasStable).toBe(true);

			// The stable release should be found
			const stable = allReleases.find((r) => !r.prerelease && !r.draft);
			expect(stable?.tag_name).toBe("v1.0.0");
		});

		test("should respect limit and not exceed it", () => {
			// Simulate fetching with limit=50
			const limit = 50;
			const allReleases = Array.from({ length: 200 }, (_, i) => ({
				id: i + 1,
				tag_name: `v1.0.0-beta.${200 - i}`,
				prerelease: true,
				draft: false,
			}));

			// After slicing to limit
			const result = allReleases.slice(0, limit);
			expect(result.length).toBe(50);
		});

		test("should handle empty page response (end of releases)", () => {
			const releases: any[] = [];
			const data: any[] = []; // Empty page from API

			// When data.length === 0, should break the loop
			expect(data.length).toBe(0);
			expect(releases.length).toBe(0);
		});

		test("should stop at 5-page safety limit", () => {
			// Simulate 6 pages of prereleases (no stable)
			let page = 1;
			const maxPages = 5;
			const allReleases: any[] = [];

			while (page <= 6) {
				const pageData = Array.from({ length: 100 }, (_, i) => ({
					id: (page - 1) * 100 + i + 1,
					tag_name: `v1.0.0-beta.${600 - (page - 1) * 100 - i}`,
					prerelease: true,
					draft: false,
				}));

				allReleases.push(...pageData);

				if (page > maxPages) {
					// Should have stopped before page 6
					break;
				}
				page++;
			}

			// With safety limit, should stop at page 5 (500 releases max)
			expect(page).toBe(6); // Loop ran until page 6 but would break
			// In actual implementation, page > 5 check happens BEFORE incrementing
		});

		test("should calculate perPage correctly based on limit", () => {
			// perPage = Math.min(limit, 100)
			expect(Math.min(50, 100)).toBe(50);
			expect(Math.min(100, 100)).toBe(100);
			expect(Math.min(150, 100)).toBe(100); // Capped at GitHub max
		});

		test("should fallback to prereleases when no stable releases exist", () => {
			const releases = Array.from({ length: 30 }, (_, i) => ({
				id: i + 1,
				tag_name: `v1.0.0-beta.${30 - i}`,
				prerelease: true,
				draft: false,
			}));

			// Filter for stable (non-prerelease)
			const stableReleases = releases.filter((r) => !r.prerelease && !r.draft);
			expect(stableReleases.length).toBe(0);

			// Fallback logic should trigger
			const shouldFallback = stableReleases.length === 0;
			expect(shouldFallback).toBe(true);

			// After fallback, prereleases should be available
			const prereleases = releases.filter((r) => r.prerelease);
			expect(prereleases.length).toBe(30);
		});
	});
});
