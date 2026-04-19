import { describe, expect, test } from "bun:test";
import {
	buildDesktopReleaseManifest,
	parseDesktopReleaseManifest,
} from "@/domains/desktop/desktop-release-manifest.js";
import type { GitHubReleaseAsset } from "@/types";

function createAsset(
	name: string,
	size: number,
	browserDownloadUrl = `https://example.com/${name}`,
): GitHubReleaseAsset {
	return {
		id: size,
		name,
		url: `https://api.example.com/assets/${size}`,
		browser_download_url: browserDownloadUrl,
		size,
		content_type: "application/octet-stream",
	};
}

describe("desktop-release-manifest", () => {
	test("builds a plain desktop manifest from portable release assets", () => {
		const manifest = buildDesktopReleaseManifest({
			version: "0.1.0",
			publishedAt: "2026-04-15T21:00:00Z",
			assets: [
				createAsset("claudekit-control-center_0.1.0_macos-universal.app.zip", 101),
				createAsset("claudekit-control-center_0.1.0_linux-x86_64.AppImage", 202),
				createAsset("claudekit-control-center_0.1.0_windows-x86_64-portable.exe", 303),
			],
		});
		const macArm = manifest.platforms["darwin-aarch64"];
		const macIntel = manifest.platforms["darwin-x86_64"];
		const linux = manifest.platforms["linux-x86_64"];
		const windows = manifest.platforms["windows-x86_64"];

		expect(manifest.version).toBe("0.1.0");
		expect(manifest.date).toBe("2026-04-15T21:00:00Z");
		expect(manifest.channel).toBe("stable");
		expect(macArm).toBeDefined();
		expect(macIntel).toBeDefined();
		expect(linux).toBeDefined();
		expect(windows).toBeDefined();
		expect(macArm?.assetType).toBe("app-zip");
		expect(macIntel?.url).toContain("macos-universal.app.zip");
		expect(linux).toEqual({
			name: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
			url: "https://example.com/claudekit-control-center_0.1.0_linux-x86_64.AppImage",
			size: 202,
			assetType: "appimage",
		});
		expect(windows?.assetType).toBe("portable-exe");
	});

	test("parses a valid manifest payload", () => {
		const parsed = parseDesktopReleaseManifest({
			version: "0.1.0",
			date: "2026-04-15T21:00:00Z",
			platforms: {
				"darwin-aarch64": {
					name: "mac.zip",
					url: "https://example.com/mac.zip",
					size: 100,
					assetType: "app-zip",
				},
				"darwin-x86_64": {
					name: "mac.zip",
					url: "https://example.com/mac.zip",
					size: 100,
					assetType: "app-zip",
				},
				"linux-x86_64": {
					name: "linux.AppImage",
					url: "https://example.com/linux.AppImage",
					size: 200,
					assetType: "appimage",
				},
				"windows-x86_64": {
					name: "windows.exe",
					url: "https://example.com/windows.exe",
					size: 300,
					assetType: "portable-exe",
				},
			},
		});

		expect(parsed.platforms["windows-x86_64"]?.name).toBe("windows.exe");
	});

	test("throws when a required portable asset is missing", () => {
		expect(() =>
			buildDesktopReleaseManifest({
				version: "0.1.0",
				publishedAt: "2026-04-15T21:00:00Z",
				assets: [
					createAsset("claudekit-control-center_0.1.0_macos-universal.app.zip", 101),
					createAsset("claudekit-control-center_0.1.0_linux-x86_64.AppImage", 202),
				],
			}),
		).toThrow(/windows/i);
	});

	test("throws on malformed manifest payload", () => {
		expect(() =>
			parseDesktopReleaseManifest({
				version: "0.1.0",
				date: "2026-04-15T21:00:00Z",
				platforms: {
					"darwin-aarch64": {
						name: "mac.zip",
						url: "not-a-url",
						size: 100,
						assetType: "app-zip",
					},
				},
			}),
		).toThrow();
	});

	test("rejects non-HTTPS asset URLs", () => {
		expect(() =>
			parseDesktopReleaseManifest({
				version: "0.1.0",
				date: "2026-04-15T21:00:00Z",
				platforms: {
					"darwin-aarch64": {
						name: "mac.zip",
						url: "http://example.com/mac.zip",
						size: 100,
						assetType: "app-zip",
					},
					"darwin-x86_64": {
						name: "mac.zip",
						url: "https://example.com/mac.zip",
						size: 100,
						assetType: "app-zip",
					},
					"linux-x86_64": {
						name: "linux.AppImage",
						url: "https://example.com/linux.AppImage",
						size: 200,
						assetType: "appimage",
					},
					"windows-x86_64": {
						name: "windows.exe",
						url: "https://example.com/windows.exe",
						size: 300,
						assetType: "portable-exe",
					},
				},
			}),
		).toThrow(/https/i);
	});

	test("throws when a platform entry is missing from the manifest payload", () => {
		expect(() =>
			parseDesktopReleaseManifest({
				version: "0.1.0",
				date: "2026-04-15T21:00:00Z",
				platforms: {
					"darwin-aarch64": {
						name: "mac.zip",
						url: "https://example.com/mac.zip",
						size: 100,
						assetType: "app-zip",
					},
					"darwin-x86_64": {
						name: "mac.zip",
						url: "https://example.com/mac.zip",
						size: 100,
						assetType: "app-zip",
					},
					"linux-x86_64": {
						name: "linux.AppImage",
						url: "https://example.com/linux.AppImage",
						size: 200,
						assetType: "appimage",
					},
				},
			}),
		).toThrow();
	});

	test("parses manifest with explicit channel field", () => {
		const parsed = parseDesktopReleaseManifest({
			version: "0.1.0",
			date: "2026-04-15T21:00:00Z",
			channel: "dev",
			platforms: {
				"darwin-aarch64": {
					name: "mac.zip",
					url: "https://example.com/mac.zip",
					size: 100,
					assetType: "app-zip",
				},
				"darwin-x86_64": {
					name: "mac.zip",
					url: "https://example.com/mac.zip",
					size: 100,
					assetType: "app-zip",
				},
				"linux-x86_64": {
					name: "linux.AppImage",
					url: "https://example.com/linux.AppImage",
					size: 200,
					assetType: "appimage",
				},
				"windows-x86_64": {
					name: "windows.exe",
					url: "https://example.com/windows.exe",
					size: 300,
					assetType: "portable-exe",
				},
			},
		});
		expect(parsed.channel).toBe("dev");
	});

	test("builds a dev manifest when requested", () => {
		const manifest = buildDesktopReleaseManifest({
			version: "0.1.0-dev.2",
			publishedAt: "2026-04-15T21:00:00Z",
			channel: "dev",
			assets: [
				createAsset("claudekit-control-center_0.1.0-dev.2_macos-universal.app.zip", 101),
				createAsset("claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage", 202),
				createAsset("claudekit-control-center_0.1.0-dev.2_windows-x86_64-portable.exe", 303),
			],
		});

		expect(manifest.channel).toBe("dev");
	});

	test("defaults channel to stable when field is absent (backward compat)", () => {
		const parsed = parseDesktopReleaseManifest({
			version: "0.1.0",
			date: "2026-04-15T21:00:00Z",
			platforms: {
				"darwin-aarch64": {
					name: "mac.zip",
					url: "https://example.com/mac.zip",
					size: 100,
					assetType: "app-zip",
				},
				"darwin-x86_64": {
					name: "mac.zip",
					url: "https://example.com/mac.zip",
					size: 100,
					assetType: "app-zip",
				},
				"linux-x86_64": {
					name: "linux.AppImage",
					url: "https://example.com/linux.AppImage",
					size: 200,
					assetType: "appimage",
				},
				"windows-x86_64": {
					name: "windows.exe",
					url: "https://example.com/windows.exe",
					size: 300,
					assetType: "portable-exe",
				},
			},
		});
		expect(parsed.channel).toBe("stable");
	});
});
