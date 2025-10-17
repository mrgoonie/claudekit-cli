import { describe, expect, test } from "bun:test";
import { GitHubClient } from "../../src/lib/github.js";
import type { GitHubRelease } from "../../src/types.js";

describe("GitHubClient - Asset Download Priority", () => {
	describe("getDownloadableAsset", () => {
		test("should prioritize ClaudeKit Engineer Package zip file", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "other-file.tar.gz",
						browser_download_url: "https://github.com/test/other-file.tar.gz",
						size: 1024,
						content_type: "application/gzip",
					},
					{
						id: 2,
						name: "ClaudeKit-Engineer-Package.zip",
						browser_download_url: "https://github.com/test/claudekit-package.zip",
						size: 2048,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit-Engineer-Package.zip");
			expect(result.url).toBe("https://github.com/test/claudekit-package.zip");
			expect(result.size).toBe(2048);
		});

		test("should prioritize ClaudeKit Marketing Package zip file", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "random.zip",
						browser_download_url: "https://github.com/test/random.zip",
						size: 512,
						content_type: "application/zip",
					},
					{
						id: 2,
						name: "ClaudeKit-Marketing-Package.zip",
						browser_download_url: "https://github.com/test/marketing-package.zip",
						size: 2048,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit-Marketing-Package.zip");
			expect(result.url).toBe("https://github.com/test/marketing-package.zip");
		});

		test("should match ClaudeKit package case-insensitively", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "claudekit-engineer-package.zip",
						browser_download_url: "https://github.com/test/package.zip",
						size: 2048,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("claudekit-engineer-package.zip");
		});

		test("should fallback to other zip files if no ClaudeKit package found", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "source-code.zip",
						browser_download_url: "https://github.com/test/source.zip",
						size: 1024,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("source-code.zip");
		});

		test("should fallback to tar.gz files if no zip found", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "release.tar.gz",
						browser_download_url: "https://github.com/test/release.tar.gz",
						size: 1024,
						content_type: "application/gzip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("release.tar.gz");
		});

		test("should fallback to tgz files", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "release.tgz",
						browser_download_url: "https://github.com/test/release.tgz",
						size: 1024,
						content_type: "application/gzip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("release.tgz");
		});

		test("should fallback to GitHub automatic tarball if no assets", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("tarball");
			expect(result.url).toBe("https://api.github.com/repos/test/repo/tarball/v1.0.0");
			expect(result.name).toBe("v1.0.0.tar.gz");
			expect(result.size).toBeUndefined();
		});

		test("should fallback to tarball if assets have no archive files", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "README.md",
						browser_download_url: "https://github.com/test/README.md",
						size: 128,
						content_type: "text/markdown",
					},
					{
						id: 2,
						name: "checksums.txt",
						browser_download_url: "https://github.com/test/checksums.txt",
						size: 64,
						content_type: "text/plain",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("tarball");
			expect(result.url).toBe("https://api.github.com/repos/test/repo/tarball/v1.0.0");
		});

		test("should prioritize ClaudeKit package over other archives", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "source.tar.gz",
						browser_download_url: "https://github.com/test/source.tar.gz",
						size: 5000,
						content_type: "application/gzip",
					},
					{
						id: 2,
						name: "docs.zip",
						browser_download_url: "https://github.com/test/docs.zip",
						size: 3000,
						content_type: "application/zip",
					},
					{
						id: 3,
						name: "ClaudeKit-Engineer-Package.zip",
						browser_download_url: "https://github.com/test/package.zip",
						size: 2000,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			// Should pick the ClaudeKit package even though it's listed last
			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit-Engineer-Package.zip");
			expect(result.size).toBe(2000);
		});

		test("should handle assets with variations in naming", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.0.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.0.0",
				assets: [
					{
						id: 1,
						name: "claudekit_marketing_package.zip",
						browser_download_url: "https://github.com/test/package.zip",
						size: 2000,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("claudekit_marketing_package.zip");
		});
	});
});
