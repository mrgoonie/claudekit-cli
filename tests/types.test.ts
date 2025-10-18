import { describe, expect, test } from "bun:test";
import {
	AVAILABLE_KITS,
	AuthenticationError,
	ClaudeKitError,
	ConfigSchema,
	DownloadError,
	ExtractionError,
	GitHubError,
	GitHubReleaseAssetSchema,
	GitHubReleaseSchema,
	KitConfigSchema,
	KitType,
	NewCommandOptionsSchema,
	UpdateCommandOptionsSchema,
} from "../src/types.js";

describe("Types and Schemas", () => {
	describe("KitType", () => {
		test("should validate correct kit types", () => {
			expect(KitType.parse("engineer")).toBe("engineer");
			expect(KitType.parse("marketing")).toBe("marketing");
		});

		test("should reject invalid kit types", () => {
			expect(() => KitType.parse("invalid")).toThrow();
			expect(() => KitType.parse("")).toThrow();
			expect(() => KitType.parse(123)).toThrow();
		});
	});

	describe("NewCommandOptionsSchema", () => {
		test("should validate correct options", () => {
			const result = NewCommandOptionsSchema.parse({
				dir: "./test",
				kit: "engineer",
				version: "v1.0.0",
			});
			expect(result.dir).toBe("./test");
			expect(result.kit).toBe("engineer");
			expect(result.version).toBe("v1.0.0");
		});

		test("should use default values", () => {
			const result = NewCommandOptionsSchema.parse({});
			expect(result.dir).toBe(".");
			expect(result.kit).toBeUndefined();
			expect(result.version).toBeUndefined();
		});

		test("should accept optional fields", () => {
			const result = NewCommandOptionsSchema.parse({ dir: "./custom" });
			expect(result.dir).toBe("./custom");
			expect(result.kit).toBeUndefined();
		});
	});

	describe("UpdateCommandOptionsSchema", () => {
		test("should validate correct options", () => {
			const result = UpdateCommandOptionsSchema.parse({
				dir: "./test",
				kit: "engineer",
				version: "v2.0.0",
			});
			expect(result.dir).toBe("./test");
			expect(result.kit).toBe("engineer");
			expect(result.version).toBe("v2.0.0");
		});

		test("should use default values", () => {
			const result = UpdateCommandOptionsSchema.parse({});
			expect(result.dir).toBe(".");
		});
	});

	describe("ConfigSchema", () => {
		test("should validate complete config", () => {
			const config = {
				github: {
					token: "ghp_test123456789",
				},
				defaults: {
					kit: "engineer",
					dir: "./projects",
				},
			};
			const result = ConfigSchema.parse(config);
			expect(result.github?.token).toBe("ghp_test123456789");
			expect(result.defaults?.kit).toBe("engineer");
			expect(result.defaults?.dir).toBe("./projects");
		});

		test("should validate empty config", () => {
			const result = ConfigSchema.parse({});
			expect(result.github).toBeUndefined();
			expect(result.defaults).toBeUndefined();
		});

		test("should validate partial config", () => {
			const result = ConfigSchema.parse({ github: {} });
			expect(result.github).toEqual({});
			expect(result.defaults).toBeUndefined();
		});
	});

	describe("GitHubReleaseAssetSchema", () => {
		test("should validate correct asset", () => {
			const asset = {
				id: 123,
				name: "release.tar.gz",
				url: "https://api.github.com/repos/test/repo/releases/assets/123",
				browser_download_url: "https://github.com/test/release.tar.gz",
				size: 1024,
				content_type: "application/gzip",
			};
			const result = GitHubReleaseAssetSchema.parse(asset);
			expect(result.id).toBe(123);
			expect(result.name).toBe("release.tar.gz");
			expect(result.size).toBe(1024);
		});

		test("should reject invalid URL", () => {
			const asset = {
				id: 123,
				name: "release.tar.gz",
				url: "not-a-url",
				browser_download_url: "not-a-url",
				size: 1024,
				content_type: "application/gzip",
			};
			expect(() => GitHubReleaseAssetSchema.parse(asset)).toThrow();
		});

		test("should reject missing required fields", () => {
			const asset = {
				id: 123,
				name: "release.tar.gz",
			};
			expect(() => GitHubReleaseAssetSchema.parse(asset)).toThrow();
		});
	});

	describe("GitHubReleaseSchema", () => {
		test("should validate complete release", () => {
			const release = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Version 1.0.0",
				draft: false,
				prerelease: false,
				assets: [
					{
						id: 123,
						name: "release.tar.gz",
						url: "https://api.github.com/repos/test/repo/releases/assets/123",
						browser_download_url: "https://github.com/test/release.tar.gz",
						size: 1024,
						content_type: "application/gzip",
					},
				],
				published_at: "2024-01-01T00:00:00Z",
				tarball_url: "https://api.github.com/repos/test/test-repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/test-repo/zipball/v1.0.0",
			};
			const result = GitHubReleaseSchema.parse(release);
			expect(result.id).toBe(1);
			expect(result.tag_name).toBe("v1.0.0");
			expect(result.assets).toHaveLength(1);
		});

		test("should validate release without published_at", () => {
			const release = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Version 1.0.0",
				draft: false,
				prerelease: false,
				assets: [],
				tarball_url: "https://api.github.com/repos/test/test-repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/test-repo/zipball/v1.0.0",
			};
			const result = GitHubReleaseSchema.parse(release);
			expect(result.published_at).toBeUndefined();
		});
	});

	describe("KitConfigSchema", () => {
		test("should validate correct kit config", () => {
			const config = {
				name: "Test Kit",
				repo: "test-repo",
				owner: "test-owner",
				description: "Test description",
			};
			const result = KitConfigSchema.parse(config);
			expect(result.name).toBe("Test Kit");
			expect(result.repo).toBe("test-repo");
		});

		test("should reject missing fields", () => {
			const config = {
				name: "Test Kit",
				repo: "test-repo",
			};
			expect(() => KitConfigSchema.parse(config)).toThrow();
		});
	});

	describe("AVAILABLE_KITS", () => {
		test("should have engineer kit", () => {
			expect(AVAILABLE_KITS.engineer).toBeDefined();
			expect(AVAILABLE_KITS.engineer.name).toBe("ClaudeKit Engineer");
			expect(AVAILABLE_KITS.engineer.repo).toBe("claudekit-engineer");
		});

		test("should have marketing kit", () => {
			expect(AVAILABLE_KITS.marketing).toBeDefined();
			expect(AVAILABLE_KITS.marketing.name).toBe("ClaudeKit Marketing");
			expect(AVAILABLE_KITS.marketing.repo).toBe("claudekit-marketing");
		});
	});

	describe("Custom Error Classes", () => {
		test("ClaudeKitError should store code and statusCode", () => {
			const error = new ClaudeKitError("Test error", "TEST_CODE", 500);
			expect(error.message).toBe("Test error");
			expect(error.code).toBe("TEST_CODE");
			expect(error.statusCode).toBe(500);
			expect(error.name).toBe("ClaudeKitError");
		});

		test("AuthenticationError should set correct defaults", () => {
			const error = new AuthenticationError("Auth failed");
			expect(error.message).toBe("Auth failed");
			expect(error.code).toBe("AUTH_ERROR");
			expect(error.statusCode).toBe(401);
			expect(error.name).toBe("AuthenticationError");
		});

		test("GitHubError should store statusCode", () => {
			const error = new GitHubError("GitHub failed", 404);
			expect(error.message).toBe("GitHub failed");
			expect(error.code).toBe("GITHUB_ERROR");
			expect(error.statusCode).toBe(404);
			expect(error.name).toBe("GitHubError");
		});

		test("DownloadError should have correct code", () => {
			const error = new DownloadError("Download failed");
			expect(error.message).toBe("Download failed");
			expect(error.code).toBe("DOWNLOAD_ERROR");
			expect(error.name).toBe("DownloadError");
		});

		test("ExtractionError should have correct code", () => {
			const error = new ExtractionError("Extract failed");
			expect(error.message).toBe("Extract failed");
			expect(error.code).toBe("EXTRACTION_ERROR");
			expect(error.name).toBe("ExtractionError");
		});
	});
});
