import { describe, expect, test } from "bun:test";
import { GitHubClient } from "../../src/domains/github/github-client.js";
import type { GitHubRelease } from "../../src/types/index.js";

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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/other-file.tar.gz",
						size: 1024,
						content_type: "application/gzip",
					},
					{
						id: 2,
						name: "ClaudeKit-Engineer-Package.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
						browser_download_url: "https://github.com/test/claudekit-package.zip",
						size: 2048,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit-Engineer-Package.zip");
			expect(result.url).toBe("https://api.github.com/repos/test/repo/releases/assets/2");
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/random.zip",
						size: 512,
						content_type: "application/zip",
					},
					{
						id: 2,
						name: "ClaudeKit-Marketing-Package.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
						browser_download_url: "https://github.com/test/marketing-package.zip",
						size: 2048,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit-Marketing-Package.zip");
			expect(result.url).toBe("https://api.github.com/repos/test/repo/releases/assets/2");
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
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
						name: "release-package.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/release.zip",
						size: 1024,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("release-package.zip");
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/README.md",
						size: 128,
						content_type: "text/markdown",
					},
					{
						id: 2,
						name: "checksums.txt",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/source.tar.gz",
						size: 5000,
						content_type: "application/gzip",
					},
					{
						id: 2,
						name: "docs.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
						browser_download_url: "https://github.com/test/docs.zip",
						size: 3000,
						content_type: "application/zip",
					},
					{
						id: 3,
						name: "ClaudeKit-Engineer-Package.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/3",
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
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
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

		test("should handle assets with spaces in name", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.4.0",
				name: "Release 1.4.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.4.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.4.0",
				assets: [
					{
						id: 1,
						name: "Changelog",
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/changelog",
						size: 7979,
						content_type: "text/plain",
					},
					{
						id: 2,
						name: "ClaudeKit Engineer Package.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
						browser_download_url: "https://github.com/test/package.zip",
						size: 3334963,
						content_type: "application/zip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit Engineer Package.zip");
			expect(result.size).toBe(3334963);
		});

		test("should exclude assets named 'Source code' or starting with 'source'", () => {
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
						name: "Source code.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/source.zip",
						size: 5000,
						content_type: "application/zip",
					},
					{
						id: 2,
						name: "source-archive.tar.gz",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
						browser_download_url: "https://github.com/test/source.tar.gz",
						size: 4500,
						content_type: "application/gzip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			// Should fall back to tarball instead of using "Source code" assets
			expect(result.type).toBe("tarball");
			expect(result.url).toBe("https://api.github.com/repos/test/repo/tarball/v1.0.0");
		});

		test("should prioritize ClaudeKit package over source code archives", () => {
			const release: GitHubRelease = {
				id: 1,
				tag_name: "v1.4.0",
				name: "Release 1.4.0",
				draft: false,
				prerelease: false,
				tarball_url: "https://api.github.com/repos/test/repo/tarball/v1.4.0",
				zipball_url: "https://api.github.com/repos/test/repo/zipball/v1.4.0",
				assets: [
					{
						id: 1,
						name: "Source code.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/1",
						browser_download_url: "https://github.com/test/source.zip",
						size: 5000,
						content_type: "application/zip",
					},
					{
						id: 2,
						name: "ClaudeKit Engineer Package.zip",
						url: "https://api.github.com/repos/test/repo/releases/assets/2",
						browser_download_url: "https://github.com/test/package.zip",
						size: 3334963,
						content_type: "application/zip",
					},
					{
						id: 3,
						name: "Source code.tar.gz",
						url: "https://api.github.com/repos/test/repo/releases/assets/3",
						browser_download_url: "https://github.com/test/source.tar.gz",
						size: 4500,
						content_type: "application/gzip",
					},
				],
			};

			const result = GitHubClient.getDownloadableAsset(release);

			// Should pick the ClaudeKit package and ignore source code archives
			expect(result.type).toBe("asset");
			expect(result.name).toBe("ClaudeKit Engineer Package.zip");
			expect(result.size).toBe(3334963);
		});
	});
});
