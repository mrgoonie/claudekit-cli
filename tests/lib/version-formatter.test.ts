import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { VersionFormatter } from "../../src/domains/versioning/version-formatter.js";
import type { GitHubRelease } from "../../src/types/index.js";

// VersionFormatter is mostly pure functions, minimal mocking needed
// Only logger.debug needs to be suppressed for formatRelativeTime error handling

describe("VersionFormatter", () => {
	let loggerDebugSpy: ReturnType<typeof spyOn>;

	beforeEach(async () => {
		// Suppress logger.debug during tests
		const { logger } = await import("../../src/shared/logger.js");
		loggerDebugSpy = spyOn(logger, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		loggerDebugSpy?.mockRestore();
	});

	describe("normalize", () => {
		it("should strip v prefix from version", () => {
			expect(VersionFormatter.normalize("v1.0.0")).toBe("1.0.0");
			expect(VersionFormatter.normalize("V1.0.0")).toBe("1.0.0");
		});

		it("should return same version if no v prefix", () => {
			expect(VersionFormatter.normalize("1.0.0")).toBe("1.0.0");
		});

		it("should handle empty string", () => {
			expect(VersionFormatter.normalize("")).toBe("");
		});

		it("should handle undefined/null gracefully", () => {
			expect(VersionFormatter.normalize(undefined as any)).toBe("");
		});
	});

	describe("display", () => {
		it("should add v prefix to version", () => {
			expect(VersionFormatter.display("1.0.0")).toBe("v1.0.0");
		});

		it("should not add v prefix if already present", () => {
			expect(VersionFormatter.display("v1.0.0")).toBe("v1.0.0");
		});

		it("should handle empty string", () => {
			expect(VersionFormatter.display("")).toBe("");
		});
	});

	describe("compare", () => {
		it("should compare versions correctly", () => {
			expect(VersionFormatter.compare("v1.0.0", "v2.0.0")).toBe(-1);
			expect(VersionFormatter.compare("v2.0.0", "v1.0.0")).toBe(1);
			expect(VersionFormatter.compare("v1.0.0", "v1.0.0")).toBe(0);
		});

		it("should handle versions without v prefix", () => {
			expect(VersionFormatter.compare("1.0.0", "2.0.0")).toBe(-1);
		});

		it("should compare patch versions", () => {
			expect(VersionFormatter.compare("v1.0.1", "v1.0.0")).toBe(1);
			expect(VersionFormatter.compare("v1.0.0", "v1.0.1")).toBe(-1);
		});

		it("should compare minor versions", () => {
			expect(VersionFormatter.compare("v1.1.0", "v1.0.0")).toBe(1);
			expect(VersionFormatter.compare("v1.0.0", "v1.1.0")).toBe(-1);
		});
	});

	describe("formatRelativeTime", () => {
		it("should format recent dates as 'just now'", () => {
			const now = new Date().toISOString();
			expect(VersionFormatter.formatRelativeTime(now)).toBe("just now");
		});

		it("should format minutes ago", () => {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(fiveMinutesAgo)).toBe("5 minutes ago");
		});

		it("should format hours ago", () => {
			const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(twoHoursAgo)).toBe("2 hours ago");
		});

		it("should format days ago", () => {
			const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(threeDaysAgo)).toBe("3 days ago");
		});

		it("should format weeks ago", () => {
			const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(twoWeeksAgo)).toBe("2 weeks ago");
		});

		it("should format months ago", () => {
			const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(twoMonthsAgo)).toBe("2 months ago");
		});

		it("should return Unknown for undefined", () => {
			expect(VersionFormatter.formatRelativeTime(undefined)).toBe("Unknown");
		});

		it("should return Unknown for invalid date", () => {
			expect(VersionFormatter.formatRelativeTime("invalid-date")).toBe("Unknown");
		});

		it("should handle singular forms", () => {
			const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(oneMinuteAgo)).toBe("1 minute ago");

			const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(oneHourAgo)).toBe("1 hour ago");

			const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
			expect(VersionFormatter.formatRelativeTime(oneDayAgo)).toBe("1 day ago");
		});
	});

	describe("enrichRelease", () => {
		const mockRelease: GitHubRelease = {
			id: 1,
			tag_name: "v1.0.0",
			name: "Release 1.0.0",
			draft: false,
			prerelease: false,
			assets: [
				{ name: "asset1.zip", browser_download_url: "https://example.com/asset1.zip" } as any,
			],
			published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
			tarball_url: "https://example.com/tarball",
			zipball_url: "https://example.com/zipball",
		};

		it("should enrich release with display metadata", () => {
			const enriched = VersionFormatter.enrichRelease(mockRelease);

			expect(enriched.displayVersion).toBe("v1.0.0");
			expect(enriched.normalizedVersion).toBe("1.0.0");
			expect(enriched.relativeTime).toBe("2 days ago");
			expect(enriched.isLatestStable).toBe(false);
			expect(enriched.isLatestBeta).toBe(false);
			expect(enriched.assetCount).toBe(1);
		});

		it("should preserve original release data", () => {
			const enriched = VersionFormatter.enrichRelease(mockRelease);

			expect(enriched.id).toBe(mockRelease.id);
			expect(enriched.tag_name).toBe(mockRelease.tag_name);
			expect(enriched.name).toBe(mockRelease.name);
			expect(enriched.draft).toBe(mockRelease.draft);
			expect(enriched.prerelease).toBe(mockRelease.prerelease);
		});
	});

	describe("enrichReleases", () => {
		it("should enrich multiple releases", () => {
			const releases: GitHubRelease[] = [
				{
					id: 1,
					tag_name: "v1.0.0",
					name: "Release 1",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-01-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
				{
					id: 2,
					tag_name: "v2.0.0",
					name: "Release 2",
					draft: false,
					prerelease: false,
					assets: [],
					published_at: "2024-02-01T00:00:00Z",
					tarball_url: "https://example.com/tarball",
					zipball_url: "https://example.com/zipball",
				},
			];

			const enriched = VersionFormatter.enrichReleases(releases);

			expect(enriched).toHaveLength(2);
			expect(enriched[0].displayVersion).toBe("v1.0.0");
			expect(enriched[1].displayVersion).toBe("v2.0.0");
		});
	});

	describe("isValidVersion", () => {
		it("should validate correct semantic versions", () => {
			expect(VersionFormatter.isValidVersion("1.0.0")).toBe(true);
			expect(VersionFormatter.isValidVersion("v1.0.0")).toBe(true);
			expect(VersionFormatter.isValidVersion("1.2.3")).toBe(true);
			expect(VersionFormatter.isValidVersion("10.20.30")).toBe(true);
		});

		it("should validate versions with prerelease", () => {
			expect(VersionFormatter.isValidVersion("1.0.0-beta")).toBe(true);
			expect(VersionFormatter.isValidVersion("v1.0.0-alpha.1")).toBe(true);
			expect(VersionFormatter.isValidVersion("1.0.0-rc.1")).toBe(true);
		});

		it("should reject invalid versions", () => {
			expect(VersionFormatter.isValidVersion("")).toBe(false);
			expect(VersionFormatter.isValidVersion("1.0")).toBe(false);
			expect(VersionFormatter.isValidVersion("v1")).toBe(false);
			expect(VersionFormatter.isValidVersion("abc")).toBe(false);
		});
	});

	describe("parseVersion", () => {
		it("should parse valid semantic version", () => {
			const parsed = VersionFormatter.parseVersion("v1.2.3");

			expect(parsed).not.toBeNull();
			expect(parsed?.major).toBe(1);
			expect(parsed?.minor).toBe(2);
			expect(parsed?.patch).toBe(3);
			expect(parsed?.prerelease).toBeUndefined();
		});

		it("should parse version with prerelease", () => {
			const parsed = VersionFormatter.parseVersion("1.0.0-beta.1");

			expect(parsed).not.toBeNull();
			expect(parsed?.major).toBe(1);
			expect(parsed?.minor).toBe(0);
			expect(parsed?.patch).toBe(0);
			expect(parsed?.prerelease).toBe("beta.1");
		});

		it("should return null for invalid version", () => {
			expect(VersionFormatter.parseVersion("invalid")).toBeNull();
			expect(VersionFormatter.parseVersion("1.0")).toBeNull();
		});
	});

	describe("isPrerelease", () => {
		it("should return true for prerelease versions", () => {
			expect(VersionFormatter.isPrerelease("1.0.0-beta")).toBe(true);
			expect(VersionFormatter.isPrerelease("v1.0.0-alpha.1")).toBe(true);
			expect(VersionFormatter.isPrerelease("1.0.0-rc.1")).toBe(true);
		});

		it("should return false for stable versions", () => {
			expect(VersionFormatter.isPrerelease("1.0.0")).toBe(false);
			expect(VersionFormatter.isPrerelease("v2.0.0")).toBe(false);
		});

		it("should return false for invalid versions", () => {
			expect(VersionFormatter.isPrerelease("invalid")).toBe(false);
		});
	});

	describe("sortVersions", () => {
		it("should sort versions in descending order", () => {
			const versions = ["1.0.0", "2.0.0", "1.5.0"];
			const sorted = VersionFormatter.sortVersions(versions);

			expect(sorted[0]).toBe("2.0.0");
			expect(sorted[1]).toBe("1.5.0");
			expect(sorted[2]).toBe("1.0.0");
		});

		it("should handle v prefix", () => {
			const versions = ["v1.0.0", "v2.0.0", "v1.5.0"];
			const sorted = VersionFormatter.sortVersions(versions);

			expect(sorted[0]).toBe("v2.0.0");
			expect(sorted[2]).toBe("v1.0.0");
		});

		it("should prioritize non-zero major versions", () => {
			const versions = ["0.9.0", "1.0.0", "0.5.0"];
			const sorted = VersionFormatter.sortVersions(versions);

			expect(sorted[0]).toBe("1.0.0"); // Non-zero major comes first
		});

		it("should not mutate original array", () => {
			const versions = ["1.0.0", "2.0.0"];
			const sorted = VersionFormatter.sortVersions(versions);

			expect(versions[0]).toBe("1.0.0"); // Original unchanged
			expect(sorted[0]).toBe("2.0.0");
		});
	});
});
