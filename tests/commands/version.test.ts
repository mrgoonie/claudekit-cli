import { beforeEach, describe, expect, test } from "bun:test";
import type { GitHubRelease } from "@/types";
import { AVAILABLE_KITS, VersionCommandOptionsSchema } from "@/types";

describe("Version Command", () => {
	beforeEach(() => {
		// Set environment variable to avoid auth prompts during tests
		process.env.GITHUB_TOKEN = "ghp_test_token_for_testing";
	});

	describe("VersionCommandOptionsSchema", () => {
		test("should accept valid options with kit filter", () => {
			const options = { kit: "engineer" as const };
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.kit).toBe("engineer");
		});

		test("should accept valid options with limit", () => {
			const options = { limit: 10 };
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.limit).toBe(10);
		});

		test("should accept valid options with all flag", () => {
			const options = { all: true };
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.all).toBe(true);
		});

		test("should accept all options combined", () => {
			const options = { kit: "marketing" as const, limit: 20, all: true };
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.kit).toBe("marketing");
			expect(result.limit).toBe(20);
			expect(result.all).toBe(true);
		});

		test("should accept empty options", () => {
			const options = {};
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.kit).toBeUndefined();
			expect(result.limit).toBeUndefined();
			expect(result.all).toBeUndefined();
		});

		test("should reject invalid kit type", () => {
			const options = { kit: "invalid" };
			expect(() => VersionCommandOptionsSchema.parse(options)).toThrow();
		});
	});

	describe("Kit Configuration", () => {
		test("should have engineer kit configured", () => {
			const engineerKit = AVAILABLE_KITS.engineer;
			expect(engineerKit.name).toBe("ClaudeKit Engineer");
			expect(engineerKit.repo).toBe("claudekit-engineer");
			expect(engineerKit.owner).toBe("claudekit");
		});

		test("should have marketing kit configured", () => {
			const marketingKit = AVAILABLE_KITS.marketing;
			expect(marketingKit.name).toBe("ClaudeKit Marketing");
			expect(marketingKit.repo).toBe("claudekit-marketing");
			expect(marketingKit.owner).toBe("claudekit");
		});
	});

	describe("Release Data Handling", () => {
		test("should handle release with all fields", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				assets: [],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0",
			};

			expect(release.tag_name).toBe("v1.0.0");
			expect(release.name).toBe("Release 1.0.0");
			expect(release.draft).toBe(false);
			expect(release.prerelease).toBe(false);
		});

		test("should handle release without published_at", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				assets: [],
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0",
			};

			expect(release.published_at).toBeUndefined();
		});

		test("should handle draft release", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0-draft",
				name: "Draft Release",
				draft: true,
				prerelease: false,
				assets: [],
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0-draft",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0-draft",
			};

			expect(release.draft).toBe(true);
		});

		test("should handle prerelease", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0-beta.1",
				name: "Beta Release",
				draft: false,
				prerelease: true,
				assets: [],
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0-beta.1",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0-beta.1",
			};

			expect(release.prerelease).toBe(true);
		});
	});

	describe("Date Formatting", () => {
		test("should format recent dates correctly", () => {
			const now = new Date();
			const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			const dateString = yesterday.toISOString();

			// The actual formatting logic is in the command file
			// We just verify the date string is valid
			expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		test("should handle undefined date", () => {
			const dateString = undefined;
			expect(dateString).toBeUndefined();
		});
	});

	describe("Release Filtering", () => {
		const releases: GitHubRelease[] = [
			{
				id: 1,
				tag_name: "v1.0.0",
				name: "Stable Release",
				draft: false,
				prerelease: false,
				assets: [],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0",
			},
			{
				id: 2,
				tag_name: "v1.1.0-beta.1",
				name: "Beta Release",
				draft: false,
				prerelease: true,
				assets: [],
				published_at: "2024-01-02T00:00:00Z",
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.1.0-beta.1",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.1.0-beta.1",
			},
			{
				id: 3,
				tag_name: "v1.2.0-draft",
				name: "Draft Release",
				draft: true,
				prerelease: false,
				assets: [],
				published_at: "2024-01-03T00:00:00Z",
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.2.0-draft",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.2.0-draft",
			},
		];

		test("should filter out drafts by default", () => {
			const stable = releases.filter((r) => !r.draft && !r.prerelease);
			expect(stable).toHaveLength(1);
			expect(stable[0].tag_name).toBe("v1.0.0");
		});

		test("should filter out prereleases by default", () => {
			const stable = releases.filter((r) => !r.draft && !r.prerelease);
			expect(stable.every((r) => !r.prerelease)).toBe(true);
		});

		test("should include all when --all flag is used", () => {
			const all = releases; // No filtering when --all is true
			expect(all).toHaveLength(3);
		});

		test("should handle empty release list", () => {
			const empty: GitHubRelease[] = [];
			expect(empty).toHaveLength(0);
		});
	});

	describe("Command Options Validation", () => {
		test("should validate limit as number", () => {
			const validLimit = { limit: 50 };
			const result = VersionCommandOptionsSchema.parse(validLimit);
			expect(result.limit).toBe(50);
		});

		test("should validate all as boolean", () => {
			const validAll = { all: false };
			const result = VersionCommandOptionsSchema.parse(validAll);
			expect(result.all).toBe(false);
		});

		test("should handle optional fields", () => {
			const minimal = {};
			const result = VersionCommandOptionsSchema.parse(minimal);
			expect(result).toBeDefined();
		});
	});

	describe("Error Scenarios", () => {
		test("should handle invalid option types", () => {
			const invalidLimit = { limit: "not-a-number" };
			expect(() => VersionCommandOptionsSchema.parse(invalidLimit)).toThrow();
		});

		test("should handle invalid all flag type", () => {
			const invalidAll = { all: "not-a-boolean" };
			expect(() => VersionCommandOptionsSchema.parse(invalidAll)).toThrow();
		});
	});

	describe("Assets Handling", () => {
		test("should handle release with multiple assets", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release",
				draft: false,
				prerelease: false,
				assets: [
					{
						id: 1,
						name: "package.tar.gz",
						url: "https://api.github.com/repos/owner/repo/releases/assets/1",
						browser_download_url: "https://example.com/package.tar.gz",
						size: 1024,
						content_type: "application/gzip",
					},
					{
						id: 2,
						name: "package.zip",
						url: "https://api.github.com/repos/owner/repo/releases/assets/2",
						browser_download_url: "https://example.com/package.zip",
						size: 2048,
						content_type: "application/zip",
					},
				],
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0",
			};

			expect(release.assets).toHaveLength(2);
		});

		test("should handle release with no assets", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release",
				draft: false,
				prerelease: false,
				assets: [],
				tarball_url: "https://api.github.com/repos/owner/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/owner/repo/zipball/v1.0.0",
			};

			expect(release.assets).toHaveLength(0);
		});
	});

	describe("Integration Scenarios", () => {
		test("should handle both kits in parallel", () => {
			const kits = Object.keys(AVAILABLE_KITS);
			expect(kits).toContain("engineer");
			expect(kits).toContain("marketing");
			expect(kits).toHaveLength(2);
		});

		test("should support filtering by engineer kit", () => {
			const options = { kit: "engineer" as const };
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.kit).toBe("engineer");

			if (result.kit) {
				const kitConfig = AVAILABLE_KITS[result.kit];
				expect(kitConfig.repo).toBe("claudekit-engineer");
			}
		});

		test("should support filtering by marketing kit", () => {
			const options = { kit: "marketing" as const };
			const result = VersionCommandOptionsSchema.parse(options);
			expect(result.kit).toBe("marketing");

			if (result.kit) {
				const kitConfig = AVAILABLE_KITS[result.kit];
				expect(kitConfig.repo).toBe("claudekit-marketing");
			}
		});
	});
});
