import { describe, expect, it } from "bun:test";
import { ReleaseFilter } from "@/domains/versioning/release-filter.js";
import type { EnrichedRelease, GitHubRelease } from "@/types";

// Test fixtures - no mocking needed as ReleaseFilter is pure functions
const createMockRelease = (overrides: Partial<GitHubRelease> = {}): GitHubRelease => ({
	id: 1,
	tag_name: "v1.0.0",
	name: "Release 1.0.0",
	draft: false,
	prerelease: false,
	assets: [],
	published_at: "2024-01-15T00:00:00Z",
	tarball_url: "https://example.com/tarball",
	zipball_url: "https://example.com/zipball",
	...overrides,
});

const createMockEnrichedRelease = (overrides: Partial<EnrichedRelease> = {}): EnrichedRelease => ({
	id: 1,
	tag_name: "v1.0.0",
	name: "Release 1.0.0",
	draft: false,
	prerelease: false,
	assets: [],
	published_at: "2024-01-15T00:00:00Z",
	tarball_url: "https://example.com/tarball",
	zipball_url: "https://example.com/zipball",
	displayVersion: "v1.0.0",
	normalizedVersion: "1.0.0",
	relativeTime: "1 month ago",
	isLatestStable: false,
	isLatestBeta: false,
	assetCount: 0,
	...overrides,
});

describe("ReleaseFilter", () => {
	describe("filterByType", () => {
		it("should exclude drafts by default", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", draft: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0", draft: true }),
				createMockRelease({ id: 3, tag_name: "v1.2.0", draft: false }),
			];

			const filtered = ReleaseFilter.filterByType(releases);
			expect(filtered).toHaveLength(2);
			expect(filtered.every((r) => !r.draft)).toBe(true);
		});

		it("should exclude prereleases by default", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", prerelease: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0-beta", prerelease: true }),
				createMockRelease({ id: 3, tag_name: "v1.2.0", prerelease: false }),
			];

			const filtered = ReleaseFilter.filterByType(releases);
			expect(filtered).toHaveLength(2);
			expect(filtered.every((r) => !r.prerelease)).toBe(true);
		});

		it("should include drafts when explicitly requested", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", draft: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0", draft: true }),
			];

			const filtered = ReleaseFilter.filterByType(releases, { includeDrafts: true });
			expect(filtered).toHaveLength(2);
		});

		it("should include prereleases when explicitly requested", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", prerelease: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0-beta", prerelease: true }),
			];

			const filtered = ReleaseFilter.filterByType(releases, { includePrereleases: true });
			expect(filtered).toHaveLength(2);
		});
	});

	describe("sortByDate", () => {
		it("should sort by date descending by default", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", published_at: "2024-01-01T00:00:00Z" }),
				createMockRelease({ id: 2, tag_name: "v1.1.0", published_at: "2024-02-01T00:00:00Z" }),
				createMockRelease({ id: 3, tag_name: "v1.2.0", published_at: "2024-01-15T00:00:00Z" }),
			];

			const sorted = ReleaseFilter.sortByDate(releases);
			expect(sorted[0].tag_name).toBe("v1.1.0"); // Most recent
			expect(sorted[1].tag_name).toBe("v1.2.0");
			expect(sorted[2].tag_name).toBe("v1.0.0"); // Oldest
		});

		it("should sort by date ascending when specified", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", published_at: "2024-01-01T00:00:00Z" }),
				createMockRelease({ id: 2, tag_name: "v1.1.0", published_at: "2024-02-01T00:00:00Z" }),
			];

			const sorted = ReleaseFilter.sortByDate(releases, "asc");
			expect(sorted[0].tag_name).toBe("v1.0.0"); // Oldest first
			expect(sorted[1].tag_name).toBe("v1.1.0");
		});

		it("should handle releases without published_at", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", published_at: "2024-01-01T00:00:00Z" }),
				createMockRelease({ id: 2, tag_name: "v1.1.0", published_at: undefined }),
			];

			const sorted = ReleaseFilter.sortByDate(releases);
			expect(sorted).toHaveLength(2);
			// Release without date should be at the end (descending)
			expect(sorted[0].tag_name).toBe("v1.0.0");
		});
	});

	describe("sortByVersion", () => {
		it("should sort by version descending by default", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0" }),
				createMockRelease({ id: 2, tag_name: "v2.0.0" }),
				createMockRelease({ id: 3, tag_name: "v1.5.0" }),
			];

			const sorted = ReleaseFilter.sortByVersion(releases);
			expect(sorted[0].tag_name).toBe("v2.0.0"); // Highest version
			expect(sorted[1].tag_name).toBe("v1.5.0");
			expect(sorted[2].tag_name).toBe("v1.0.0"); // Lowest version
		});

		it("should sort by version ascending when specified", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.0.0" }),
				createMockRelease({ id: 2, tag_name: "v1.0.0" }),
			];

			const sorted = ReleaseFilter.sortByVersion(releases, "asc");
			expect(sorted[0].tag_name).toBe("v1.0.0"); // Lowest first
			expect(sorted[1].tag_name).toBe("v2.0.0");
		});
	});

	describe("tagLatest", () => {
		it("should tag latest stable release", () => {
			const releases = [
				createMockEnrichedRelease({ id: 1, tag_name: "v2.0.0", prerelease: false, draft: false }),
				createMockEnrichedRelease({ id: 2, tag_name: "v1.0.0", prerelease: false, draft: false }),
			];

			const tagged = ReleaseFilter.tagLatest(releases);
			const latestStable = tagged.find((r) => r.isLatestStable);
			expect(latestStable?.tag_name).toBe("v2.0.0");
		});

		it("should tag latest beta release", () => {
			const releases = [
				createMockEnrichedRelease({ id: 1, tag_name: "v2.0.0", prerelease: false, draft: false }),
				createMockEnrichedRelease({
					id: 2,
					tag_name: "v2.1.0-beta",
					prerelease: true,
					draft: false,
				}),
				createMockEnrichedRelease({
					id: 3,
					tag_name: "v2.0.0-beta",
					prerelease: true,
					draft: false,
				}),
			];

			const tagged = ReleaseFilter.tagLatest(releases);
			const latestBeta = tagged.find((r) => r.isLatestBeta);
			expect(latestBeta?.tag_name).toBe("v2.1.0-beta");
		});

		it("should not mutate original array", () => {
			const releases = [createMockEnrichedRelease({ id: 1, tag_name: "v1.0.0" })];
			const original = { ...releases[0] };

			ReleaseFilter.tagLatest(releases);
			expect(releases[0].isLatestStable).toBe(original.isLatestStable);
		});
	});

	describe("processReleases", () => {
		it("should filter, sort, and enrich releases", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", draft: false, prerelease: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0", draft: true, prerelease: false }),
				createMockRelease({ id: 3, tag_name: "v1.2.0-beta", draft: false, prerelease: true }),
			];

			const processed = ReleaseFilter.processReleases(releases);
			expect(processed).toHaveLength(1); // Only stable, non-draft
			expect(processed[0].tag_name).toBe("v1.0.0");
			expect(processed[0].displayVersion).toBeDefined();
		});

		it("should apply limit option", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0" }),
				createMockRelease({ id: 2, tag_name: "v1.1.0" }),
				createMockRelease({ id: 3, tag_name: "v1.2.0" }),
			];

			const processed = ReleaseFilter.processReleases(releases, { limit: 2 });
			expect(processed).toHaveLength(2);
		});
	});

	describe("filterByVersionPattern", () => {
		it("should filter by wildcard pattern", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0" }),
				createMockRelease({ id: 2, tag_name: "v1.5.0" }),
				createMockRelease({ id: 3, tag_name: "v2.0.0" }),
			];

			const filtered = ReleaseFilter.filterByVersionPattern(releases, "1.*.*");
			expect(filtered).toHaveLength(2);
			expect(filtered.every((r) => r.tag_name.startsWith("v1"))).toBe(true);
		});

		it("should filter by caret pattern", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0" }),
				createMockRelease({ id: 2, tag_name: "v1.5.0" }),
				createMockRelease({ id: 3, tag_name: "v2.0.0" }),
			];

			const filtered = ReleaseFilter.filterByVersionPattern(releases, "^1.0.0");
			expect(filtered).toHaveLength(2); // v1.0.0 and v1.5.0 (same major)
		});

		it("should filter by tilde pattern", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0" }),
				createMockRelease({ id: 2, tag_name: "v1.0.5" }),
				createMockRelease({ id: 3, tag_name: "v1.1.0" }),
			];

			const filtered = ReleaseFilter.filterByVersionPattern(releases, "~1.0.0");
			expect(filtered).toHaveLength(2); // v1.0.0 and v1.0.5 (same major.minor)
		});

		it("should filter by exact match", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0" }),
				createMockRelease({ id: 2, tag_name: "v1.5.0" }),
			];

			const filtered = ReleaseFilter.filterByVersionPattern(releases, "v1.0.0");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].tag_name).toBe("v1.0.0");
		});
	});

	describe("getStableReleases", () => {
		it("should return only stable releases", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", prerelease: false, draft: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0-beta", prerelease: true, draft: false }),
				createMockRelease({ id: 3, tag_name: "v1.2.0", prerelease: false, draft: true }),
			];

			const stable = ReleaseFilter.getStableReleases(releases);
			expect(stable).toHaveLength(1);
			expect(stable[0].tag_name).toBe("v1.0.0");
		});
	});

	describe("getPrereleaseReleases", () => {
		it("should return only prerelease releases", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", prerelease: false }),
				createMockRelease({ id: 2, tag_name: "v1.1.0-beta", prerelease: true }),
				createMockRelease({ id: 3, tag_name: "v1.2.0-alpha", prerelease: true }),
			];

			const prereleases = ReleaseFilter.getPrereleaseReleases(releases);
			expect(prereleases).toHaveLength(2);
			expect(prereleases.every((r) => r.prerelease)).toBe(true);
		});
	});

	describe("getRecentReleases", () => {
		it("should return releases within specified days", () => {
			const now = new Date();
			const tenDaysAgo = new Date(now);
			tenDaysAgo.setDate(now.getDate() - 10);
			const sixtyDaysAgo = new Date(now);
			sixtyDaysAgo.setDate(now.getDate() - 60);

			const releases = [
				createMockRelease({ id: 1, tag_name: "v1.0.0", published_at: tenDaysAgo.toISOString() }),
				createMockRelease({ id: 2, tag_name: "v0.9.0", published_at: sixtyDaysAgo.toISOString() }),
			];

			const recent = ReleaseFilter.getRecentReleases(releases, 30);
			expect(recent).toHaveLength(1);
			expect(recent[0].tag_name).toBe("v1.0.0");
		});
	});

	/**
	 * Regression tests for GitHub API sorting quirk (issue #256).
	 * GitHub API uses lexicographic sorting for same-day releases,
	 * causing "beta.10" to appear before "beta.4" in results.
	 *
	 * @see https://github.com/mrgoonie/claudekit-cli/issues/256
	 */
	describe("getLatestStable", () => {
		it("should return highest semver stable release", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.0.0", prerelease: false, draft: false }),
				createMockRelease({ id: 2, tag_name: "v1.5.0", prerelease: false, draft: false }),
				createMockRelease({ id: 3, tag_name: "v2.1.0-beta.1", prerelease: true, draft: false }),
			];

			const latest = ReleaseFilter.getLatestStable(releases);
			expect(latest?.tag_name).toBe("v2.0.0");
		});

		it("should return null if no stable releases exist", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.1.0-beta.1", prerelease: true, draft: false }),
			];

			const latest = ReleaseFilter.getLatestStable(releases);
			expect(latest).toBeNull();
		});

		it("should exclude drafts", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.0.0", prerelease: false, draft: true }),
				createMockRelease({ id: 2, tag_name: "v1.0.0", prerelease: false, draft: false }),
			];

			const latest = ReleaseFilter.getLatestStable(releases);
			expect(latest?.tag_name).toBe("v1.0.0");
		});
	});

	describe("getLatestPrerelease", () => {
		it("should return highest semver prerelease", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.1.0-beta.9", prerelease: true, draft: false }),
				createMockRelease({ id: 2, tag_name: "v2.1.0-beta.10", prerelease: true, draft: false }),
				createMockRelease({ id: 3, tag_name: "v2.0.0", prerelease: false, draft: false }),
			];

			const latest = ReleaseFilter.getLatestPrerelease(releases);
			expect(latest?.tag_name).toBe("v2.1.0-beta.10");
		});

		it("should return null if no prereleases exist", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.0.0", prerelease: false, draft: false }),
			];

			const latest = ReleaseFilter.getLatestPrerelease(releases);
			expect(latest).toBeNull();
		});

		it("should exclude drafts", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.1.0-beta.10", prerelease: true, draft: true }),
				createMockRelease({ id: 2, tag_name: "v2.1.0-beta.9", prerelease: true, draft: false }),
			];

			const latest = ReleaseFilter.getLatestPrerelease(releases);
			expect(latest?.tag_name).toBe("v2.1.0-beta.9");
		});

		/**
		 * Critical regression test for issue #256:
		 * GitHub API returns releases in lexicographic order for same-day releases.
		 * "beta.10" sorts before "beta.4" alphabetically because '1' < '4'.
		 * This test ensures we use proper semver sorting regardless of input order.
		 */
		it("should select beta.10 over beta.9 regardless of API order (issue #256)", () => {
			// Simulate GitHub API order: lexicographic, not semver
			// "beta.10" < "beta.4" < "beta.9" alphabetically
			const releasesInGitHubApiOrder = [
				createMockRelease({ id: 9, tag_name: "v2.1.0-beta.9", prerelease: true, draft: false }),
				createMockRelease({ id: 8, tag_name: "v2.1.0-beta.8", prerelease: true, draft: false }),
				createMockRelease({ id: 7, tag_name: "v2.1.0-beta.7", prerelease: true, draft: false }),
				createMockRelease({ id: 6, tag_name: "v2.1.0-beta.6", prerelease: true, draft: false }),
				createMockRelease({ id: 5, tag_name: "v2.1.0-beta.5", prerelease: true, draft: false }),
				createMockRelease({ id: 4, tag_name: "v2.1.0-beta.4", prerelease: true, draft: false }),
				createMockRelease({ id: 10, tag_name: "v2.1.0-beta.10", prerelease: true, draft: false }), // Appears AFTER beta.4!
				createMockRelease({ id: 3, tag_name: "v2.1.0-beta.3", prerelease: true, draft: false }),
			];

			const latest = ReleaseFilter.getLatestPrerelease(releasesInGitHubApiOrder);
			expect(latest?.tag_name).toBe("v2.1.0-beta.10"); // Must be beta.10, not beta.9
		});

		it("should handle mixed prerelease tags (alpha, beta, rc)", () => {
			const releases = [
				createMockRelease({ id: 1, tag_name: "v2.0.0-alpha.1", prerelease: true, draft: false }),
				createMockRelease({ id: 2, tag_name: "v2.0.0-beta.1", prerelease: true, draft: false }),
				createMockRelease({ id: 3, tag_name: "v2.0.0-rc.1", prerelease: true, draft: false }),
			];

			const latest = ReleaseFilter.getLatestPrerelease(releases);
			// rc > beta > alpha in semver prerelease ordering
			expect(latest?.tag_name).toBe("v2.0.0-rc.1");
		});
	});
});
