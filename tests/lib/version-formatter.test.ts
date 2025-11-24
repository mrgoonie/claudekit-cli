import { describe, expect, it, mock } from "bun:test";
import { VersionFormatter } from "../../src/lib/version-formatter.js";

// Mock logger
mock.module("../../src/utils/logger.js", () => ({
	logger: {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
	},
}));

describe("VersionFormatter", () => {
	describe("normalize", () => {
		it("should strip 'v' prefix from version", () => {
			expect(VersionFormatter.normalize("v1.2.3")).toBe("1.2.3");
			expect(VersionFormatter.normalize("V1.2.3")).toBe("1.2.3");
		});

		it("should return version unchanged if no 'v' prefix", () => {
			expect(VersionFormatter.normalize("1.2.3")).toBe("1.2.3");
		});

		it("should handle empty input", () => {
			expect(VersionFormatter.normalize("")).toBe("");
		});

		it("should handle version with only 'v'", () => {
			expect(VersionFormatter.normalize("v")).toBe("");
		});
	});

	describe("display", () => {
		it("should add 'v' prefix to version", () => {
			expect(VersionFormatter.display("1.2.3")).toBe("v1.2.3");
		});

		it("should not add 'v' prefix if already present", () => {
			expect(VersionFormatter.display("v1.2.3")).toBe("v1.2.3");
		});

		it("should handle empty input", () => {
			expect(VersionFormatter.display("")).toBe("");
		});
	});

	describe("compare", () => {
		it("should compare versions correctly", () => {
			expect(VersionFormatter.compare("v1.2.3", "v1.2.4")).toBe(-1);
			expect(VersionFormatter.compare("v1.2.4", "v1.2.3")).toBe(1);
			expect(VersionFormatter.compare("v1.2.3", "v1.2.3")).toBe(0);
		});

		it("should handle versions without 'v' prefix", () => {
			expect(VersionFormatter.compare("1.2.3", "1.2.4")).toBe(-1);
			expect(VersionFormatter.compare("1.2.4", "1.2.3")).toBe(1);
			expect(VersionFormatter.compare("1.2.3", "1.2.3")).toBe(0);
		});

		it("should handle mixed prefixes", () => {
			expect(VersionFormatter.compare("v1.2.3", "1.2.4")).toBe(-1);
			expect(VersionFormatter.compare("1.2.4", "v1.2.3")).toBe(1);
		});
	});

	describe("formatRelativeTime", () => {
		it("should format relative time correctly", () => {
			const now = new Date();

			// Test seconds
			const fewSecondsAgo = new Date(now.getTime() - 30 * 1000);
			expect(VersionFormatter.formatRelativeTime(fewSecondsAgo.toISOString())).toBe("just now");

			// Test minutes
			const minutesAgo = new Date(now.getTime() - 45 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(minutesAgo.toISOString())).toBe("45 minutes ago");

			// Test hours
			const hoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(hoursAgo.toISOString())).toBe("3 hours ago");

			// Test days
			const daysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(daysAgo.toISOString())).toBe("5 days ago");

			// Test weeks
			const weeksAgo = new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(weeksAgo.toISOString())).toBe("2 weeks ago");

			// Test months
			const monthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(monthsAgo.toISOString())).toBe("3 months ago");

			// Test years
			const yearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(yearsAgo.toISOString())).toBe("2 years ago");
		});

		it("should handle singular vs plural correctly", () => {
			const now = new Date();

			const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(oneMinuteAgo.toISOString())).toBe("1 minute ago");

			const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(oneHourAgo.toISOString())).toBe("1 hour ago");

			const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(oneDayAgo.toISOString())).toBe("1 day ago");

			const oneWeekAgo = new Date(now.getTime() - 1 * 7 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(oneWeekAgo.toISOString())).toBe("1 week ago");

			const oneMonthAgo = new Date(now.getTime() - 1 * 30 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(oneMonthAgo.toISOString())).toBe("1 month ago");

			const oneYearAgo = new Date(now.getTime() - 1 * 365 * 24 * 60 * 60 * 1000);
			expect(VersionFormatter.formatRelativeTime(oneYearAgo.toISOString())).toBe("1 year ago");
		});

		it("should handle invalid dates", () => {
			expect(VersionFormatter.formatRelativeTime("invalid-date")).toBe("Unknown");
			expect(VersionFormatter.formatRelativeTime("")).toBe("Unknown");
		});

		it("should handle missing date", () => {
			expect(VersionFormatter.formatRelativeTime(undefined)).toBe("Unknown");
		});
	});

	describe("enrichRelease", () => {
		it("should enrich release with metadata", () => {
			const release = {
				id: 1,
				tag_name: "v1.2.3",
				name: "Release 1.2.3",
				draft: false,
				prerelease: false,
				assets: [
					{ id: 1, name: "asset1.zip", size: 1000 },
					{ id: 2, name: "asset2.tar.gz", size: 2000 },
				],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://example.com/tarball",
				zipball_url: "https://example.com/zipball",
			};

			const enriched = VersionFormatter.enrichRelease(release as any);

			expect(enriched.displayVersion).toBe("v1.2.3");
			expect(enriched.normalizedVersion).toBe("1.2.3");
			expect(enriched.assetCount).toBe(2);
			expect(enriched.isLatestStable).toBe(false);
			expect(enriched.isLatestBeta).toBe(false);
			expect(enriched.relativeTime).toBeDefined();
		});

		it("should handle releases with no assets", () => {
			const release = {
				id: 1,
				tag_name: "v1.2.3",
				name: "Release 1.2.3",
				draft: false,
				prerelease: false,
				assets: [],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://example.com/tarball",
				zipball_url: "https://example.com/zipball",
			};

			const enriched = VersionFormatter.enrichRelease(release as any);

			expect(enriched.assetCount).toBe(0);
		});

		it("should handle releases with no published date", () => {
			const release = {
				id: 1,
				tag_name: "v1.2.3",
				name: "Release 1.2.3",
				draft: false,
				prerelease: false,
				assets: [],
				published_at: undefined,
				tarball_url: "https://example.com/tarball",
				zipball_url: "https://example.com/zipball",
			};

			const enriched = VersionFormatter.enrichRelease(release as any);

			expect(enriched.relativeTime).toBe("Unknown");
		});
	});

	describe("enrichReleases", () => {
		it("should enrich multiple releases", () => {
			const releases = [
				{
					id: 1,
					tag_name: "v1.2.3",
					name: "Release 1.2.3",
					draft: false,
					prerelease: false,
					assets: [{ id: 1, name: "asset1.zip", size: 1000 }],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
				{
					id: 2,
					tag_name: "v1.3.0",
					name: "Release 1.3.0",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-02T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			const enriched = VersionFormatter.enrichReleases(releases as any);

			expect(enriched).toHaveLength(2);
			expect(enriched[0].displayVersion).toBe("v1.2.3");
			expect(enriched[0].assetCount).toBe(1);
			expect(enriched[1].displayVersion).toBe("v1.3.0");
			expect(enriched[1].assetCount).toBe(0);
		});
	});

	describe("isValidVersion", () => {
		it("should validate semantic versions", () => {
			expect(VersionFormatter.isValidVersion("1.2.3")).toBe(true);
			expect(VersionFormatter.isValidVersion("v1.2.3")).toBe(true);
			expect(VersionFormatter.isValidVersion("10.20.30")).toBe(true);
		});

		it("should validate versions with prerelease", () => {
			expect(VersionFormatter.isValidVersion("1.2.3-alpha")).toBe(true);
			expect(VersionFormatter.isValidVersion("1.2.3-beta.1")).toBe(true);
			expect(VersionFormatter.isValidVersion("1.2.3-rc.1")).toBe(true);
			expect(VersionFormatter.isValidVersion("v1.2.3-alpha")).toBe(true);
		});

		it("should reject invalid versions", () => {
			expect(VersionFormatter.isValidVersion("1.2")).toBe(false);
			expect(VersionFormatter.isValidVersion("1")).toBe(false);
			expect(VersionFormatter.isValidVersion("invalid")).toBe(false);
			expect(VersionFormatter.isValidVersion("")).toBe(false);
			expect(VersionFormatter.isValidVersion("1.2.3.4")).toBe(false);
		});
	});

	describe("parseVersion", () => {
		it("should parse semantic versions", () => {
			const parsed = VersionFormatter.parseVersion("1.2.3");
			expect(parsed).toEqual({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: undefined,
			});
		});

		it("should parse versions with prerelease", () => {
			const parsed = VersionFormatter.parseVersion("1.2.3-alpha.1");
			expect(parsed).toEqual({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: "alpha.1",
			});
		});

		it("should parse versions with 'v' prefix", () => {
			const parsed = VersionFormatter.parseVersion("v1.2.3");
			expect(parsed).toEqual({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: undefined,
			});
		});

		it("should return null for invalid versions", () => {
			expect(VersionFormatter.parseVersion("invalid")).toBeNull();
			expect(VersionFormatter.parseVersion("1.2")).toBeNull();
			expect(VersionFormatter.parseVersion("")).toBeNull();
		});
	});

	describe("isPrerelease", () => {
		it("should identify prerelease versions", () => {
			expect(VersionFormatter.isPrerelease("1.2.3-alpha")).toBe(true);
			expect(VersionFormatter.isPrerelease("v1.2.3-beta")).toBe(true);
			expect(VersionFormatter.isPrerelease("1.2.3-rc.1")).toBe(true);
		});

		it("should identify stable versions", () => {
			expect(VersionFormatter.isPrerelease("1.2.3")).toBe(false);
			expect(VersionFormatter.isPrerelease("v1.2.3")).toBe(false);
		});

		it("should handle invalid versions", () => {
			expect(VersionFormatter.isPrerelease("invalid")).toBe(false);
			expect(VersionFormatter.isPrerelease("")).toBe(false);
		});
	});

	describe("sortVersions", () => {
		it("should sort versions descending", () => {
			const versions = ["1.0.0", "1.2.0", "1.1.0", "2.0.0"];
			const sorted = VersionFormatter.sortVersions(versions);
			expect(sorted).toEqual(["2.0.0", "1.2.0", "1.1.0", "1.0.0"]);
		});

		it("should handle 'v' prefixes", () => {
			const versions = ["v1.0.0", "v1.2.0", "1.1.0", "v2.0.0"];
			const sorted = VersionFormatter.sortVersions(versions);
			expect(sorted).toEqual(["v2.0.0", "v1.2.0", "1.1.0", "v1.0.0"]);
		});

		it("should prioritize major versions > 0", () => {
			const versions = ["0.1.0", "1.0.0", "0.2.0", "1.1.0"];
			const sorted = VersionFormatter.sortVersions(versions);
			expect(sorted).toEqual(["1.1.0", "1.0.0", "0.2.0", "0.1.0"]);
		});

		it("should sort 0.x.x versions among themselves", () => {
			const versions = ["0.1.0", "0.3.0", "0.2.0"];
			const sorted = VersionFormatter.sortVersions(versions);
			expect(sorted).toEqual(["0.3.0", "0.2.0", "0.1.0"]);
		});
	});
});
