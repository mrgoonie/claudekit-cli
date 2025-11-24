import { describe, expect, it } from "bun:test";
import { ReleaseFilter } from "../../src/lib/release-filter.js";
import { VersionFormatter } from "../../src/lib/version-formatter.js";

describe("ReleaseFilter", () => {
	const mockReleases = [
		{
			id: 1,
			tag_name: "v1.0.0",
			name: "Release 1.0.0",
			draft: false,
			prerelease: false,
			assets: [],
			published_at: "2024-01-03T00:00:00Z",
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
		},
		{
			id: 2,
			tag_name: "v1.1.0",
			name: "Release 1.1.0",
			draft: false,
			prerelease: false,
			assets: [],
			published_at: "2024-01-02T00:00:00Z",
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
		},
		{
			id: 3,
			tag_name: "v1.2.0-beta",
			name: "Release 1.2.0 Beta",
			draft: false,
			prerelease: true,
			assets: [],
			published_at: "2024-01-01T00:00:00Z",
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
		},
		{
			id: 4,
			tag_name: "v2.0.0-alpha",
			name: "Release 2.0.0 Alpha",
			draft: false,
			prerelease: true,
			assets: [],
			published_at: "2024-01-04T00:00:00Z",
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
		},
		{
			id: 5,
			tag_name: "v2.1.0",
			name: "Release 2.1.0",
			draft: true,
			prerelease: false,
			assets: [],
			published_at: "2024-01-05T00:00:00Z",
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
		},
	];

	describe("filterByType", () => {
		it("should exclude drafts and prereleases by default", () => {
			const filtered = ReleaseFilter.filterByType(mockReleases);
			expect(filtered).toHaveLength(2);
			expect(filtered.map((r) => r.tag_name)).toEqual(["v1.0.0", "v1.1.0"]);
		});

		it("should include prereleases when specified", () => {
			const filtered = ReleaseFilter.filterByType(mockReleases, { includePrereleases: true });
			expect(filtered).toHaveLength(4);
			expect(filtered.map((r) => r.tag_name)).toEqual([
				"v1.0.0",
				"v1.1.0",
				"v1.2.0-beta",
				"v2.0.0-alpha",
			]);
		});

		it("should include drafts when specified", () => {
			const filtered = ReleaseFilter.filterByType(mockReleases, { includeDrafts: true });
			expect(filtered).toHaveLength(3);
			expect(filtered.map((r) => r.tag_name)).toEqual(["v1.0.0", "v1.1.0", "v2.1.0"]);
		});

		it("should include both drafts and prereleases when specified", () => {
			const filtered = ReleaseFilter.filterByType(mockReleases, {
				includeDrafts: true,
				includePrereleases: true,
			});
			expect(filtered).toHaveLength(5);
		});

		it("should handle empty input", () => {
			const filtered = ReleaseFilter.filterByType([]);
			expect(filtered).toHaveLength(0);
		});
	});

	describe("sortByDate", () => {
		it("should sort by date descending by default", () => {
			const sorted = ReleaseFilter.sortByDate(mockReleases);
			expect(sorted[0].tag_name).toBe("v2.1.0"); // 2024-01-05
			expect(sorted[1].tag_name).toBe("v2.0.0-alpha"); // 2024-01-04
			expect(sorted[2].tag_name).toBe("v1.0.0"); // 2024-01-03
		});

		it("should sort by date ascending when specified", () => {
			const sorted = ReleaseFilter.sortByDate(mockReleases, "asc");
			expect(sorted[0].tag_name).toBe("v1.2.0-beta"); // 2024-01-01
			expect(sorted[1].tag_name).toBe("v1.1.0"); // 2024-01-02
			expect(sorted[2].tag_name).toBe("v1.0.0"); // 2024-01-03
		});

		it("should handle releases without published_at", () => {
			const releasesWithoutDate = [
				{ ...mockReleases[0] },
				{ ...mockReleases[1], published_at: undefined },
				{ ...mockReleases[2] },
			];
			const sorted = ReleaseFilter.sortByDate(releasesWithoutDate as any, "asc");
			// Undefined date goes to beginning in ascending order (current behavior)
			expect(sorted[0].tag_name).toBe("v1.1.0");
		});
	});

	describe("sortByVersion", () => {
		it("should sort by version descending by default", () => {
			const sorted = ReleaseFilter.sortByVersion(mockReleases);
			expect(sorted[0].tag_name).toBe("v2.1.0");
			expect(sorted[1].tag_name).toBe("v2.0.0-alpha");
			expect(sorted[2].tag_name).toBe("v1.2.0-beta");
		});

		it("should sort by version ascending when specified", () => {
			const sorted = ReleaseFilter.sortByVersion(mockReleases, "asc");
			expect(sorted[0].tag_name).toBe("v1.0.0");
			expect(sorted[1].tag_name).toBe("v1.1.0");
			expect(sorted[2].tag_name).toBe("v1.2.0-beta");
		});
	});

	describe("tagLatest", () => {
		it("should tag latest stable and beta releases", () => {
			const enriched = VersionFormatter.enrichReleases(mockReleases);
			const tagged = ReleaseFilter.tagLatest(enriched);

			const latestStable = tagged.find((r) => r.isLatestStable);
			const latestBeta = tagged.find((r) => r.isLatestBeta);

			expect(latestStable?.tag_name).toBe("v1.1.0");
			expect(latestBeta?.tag_name).toBe("v2.0.0-alpha");
		});

		it("should handle no stable releases", () => {
			const onlyPrereleases = mockReleases.filter((r) => r.prerelease);
			const enriched = VersionFormatter.enrichReleases(onlyPrereleases);
			const tagged = ReleaseFilter.tagLatest(enriched);

			const latestStable = tagged.find((r) => r.isLatestStable);
			const latestBeta = tagged.find((r) => r.isLatestBeta);

			expect(latestStable).toBeUndefined();
			expect(latestBeta?.tag_name).toBe("v2.0.0-alpha");
		});

		it("should handle no beta releases", () => {
			const onlyStable = mockReleases.filter((r) => !r.prerelease && !r.draft);
			const enriched = VersionFormatter.enrichReleases(onlyStable);
			const tagged = ReleaseFilter.tagLatest(enriched);

			const latestStable = tagged.find((r) => r.isLatestStable);
			const latestBeta = tagged.find((r) => r.isLatestBeta);

			expect(latestStable?.tag_name).toBe("v1.1.0");
			expect(latestBeta).toBeUndefined();
		});
	});

	describe("processReleases", () => {
		it("should apply full processing pipeline", () => {
			const processed = ReleaseFilter.processReleases(mockReleases, {
				includeDrafts: false,
				includePrereleases: false,
				limit: 2,
				sortBy: "date",
				order: "desc",
			});

			expect(processed).toHaveLength(2);
			expect(processed[0].tag_name).toBe("v1.0.0");
			expect(processed[1].tag_name).toBe("v1.1.0");
			expect(processed[0].displayVersion).toBe("v1.0.0");
			expect(processed[0].isLatestStable).toBe(false);
			expect(processed[1].isLatestStable).toBe(true);
		});

		it("should include prereleases when specified", () => {
			const processed = ReleaseFilter.processReleases(mockReleases, {
				includePrereleases: true,
				limit: 4,
			});

			expect(processed).toHaveLength(4);
			// Sorted by date desc: v2.0.0-alpha (01-04), v1.0.0 (01-03), v1.1.0 (01-02), v1.2.0-beta (01-01)
			expect(processed.map((r) => r.tag_name)).toContain("v2.0.0-alpha");
			expect(processed.map((r) => r.tag_name)).toContain("v1.2.0-beta");
		});

		it("should sort by version when specified", () => {
			const processed = ReleaseFilter.processReleases(mockReleases, {
				sortBy: "version",
				order: "desc",
			});

			expect(processed[0].tag_name).toBe("v1.1.0");
			expect(processed[1].tag_name).toBe("v1.0.0");
		});

		it("should apply limit", () => {
			const processed = ReleaseFilter.processReleases(mockReleases, {
				limit: 1,
			});

			expect(processed).toHaveLength(1);
			expect(processed[0].tag_name).toBe("v1.0.0");
		});
	});

	describe("filterByVersionPattern", () => {
		it("should filter by wildcard pattern", () => {
			const filtered = ReleaseFilter.filterByVersionPattern(mockReleases, "1.*.*");
			expect(filtered).toHaveLength(3); // v1.0.0, v1.1.0, v1.2.0-beta
		});

		it("should filter by specific version pattern", () => {
			const filtered = ReleaseFilter.filterByVersionPattern(mockReleases, "1.1.*");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].tag_name).toBe("v1.1.0");
		});

		it("should filter by caret pattern", () => {
			const filtered = ReleaseFilter.filterByVersionPattern(mockReleases, "^1.0.0");
			// Caret matches same major version >= specified, including prereleases
			expect(filtered.map((r) => r.tag_name)).toEqual(["v1.0.0", "v1.1.0", "v1.2.0-beta"]);
		});

		it("should filter by tilde pattern", () => {
			const filtered = ReleaseFilter.filterByVersionPattern(mockReleases, "~1.1.0");
			expect(filtered.map((r) => r.tag_name)).toEqual(["v1.1.0"]);
		});

		it("should handle exact match", () => {
			const filtered = ReleaseFilter.filterByVersionPattern(mockReleases, "1.0.0");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].tag_name).toBe("v1.0.0");
		});

		it("should handle version with 'v' prefix", () => {
			const filtered = ReleaseFilter.filterByVersionPattern(mockReleases, "v1.0.0");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].tag_name).toBe("v1.0.0");
		});
	});

	describe("getStableReleases", () => {
		it("should return only stable releases", () => {
			const stable = ReleaseFilter.getStableReleases(mockReleases);
			expect(stable).toHaveLength(2);
			expect(stable.map((r) => r.tag_name)).toEqual(["v1.0.0", "v1.1.0"]);
		});
	});

	describe("getPrereleaseReleases", () => {
		it("should return only prerelease releases", () => {
			const prerelease = ReleaseFilter.getPrereleaseReleases(mockReleases);
			expect(prerelease).toHaveLength(2);
			expect(prerelease.map((r) => r.tag_name)).toEqual(["v1.2.0-beta", "v2.0.0-alpha"]);
		});
	});

	describe("getRecentReleases", () => {
		it("should return releases within specified days", () => {
			// Create current date-based test
			const now = new Date();
			const recentReleases = mockReleases.map((release, index) => ({
				...release,
				published_at: new Date(now.getTime() - index * 24 * 60 * 60 * 1000).toISOString(), // Each day older
			}));

			// With 5 releases at 0, 1, 2, 3, 4 days ago, "2 days" cutoff includes indices 0, 1, 2
			const recent = ReleaseFilter.getRecentReleases(recentReleases, 2);
			expect(recent).toHaveLength(3);
			expect(recent[0].tag_name).toBe("v1.0.0"); // index 0 = today
		});

		it("should handle releases without published_at", () => {
			// Create fresh dates within the last 30 days
			const now = new Date();
			const releasesWithMissingDate = [
				{ ...mockReleases[0], published_at: undefined },
				{
					...mockReleases[1],
					published_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
				},
			];

			const recent = ReleaseFilter.getRecentReleases(releasesWithMissingDate as any, 30);
			expect(recent).toHaveLength(1); // Only the one with a valid date
		});
	});
});
