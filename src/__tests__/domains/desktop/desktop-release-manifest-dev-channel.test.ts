import { describe, expect, test } from "bun:test";
import { buildDesktopReleaseManifest } from "@/domains/desktop/desktop-release-manifest.js";

describe("desktop-release-manifest dev channel", () => {
	test("marks dev releases with channel=dev for update metadata", () => {
		const manifest = buildDesktopReleaseManifest({
			version: "0.1.0-dev.2",
			publishedAt: "2026-04-19T00:00:00Z",
			channel: "dev",
			assets: [
				{
					id: 1,
					name: "claudekit-control-center_0.1.0-dev.2_macos-universal.app.zip",
					url: "https://api.example.com/assets/1",
					browser_download_url:
						"https://example.com/claudekit-control-center_0.1.0-dev.2_macos-universal.app.zip",
					size: 100,
					content_type: "application/zip",
				},
				{
					id: 2,
					name: "claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
					url: "https://api.example.com/assets/2",
					browser_download_url:
						"https://example.com/claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
					size: 200,
					content_type: "application/octet-stream",
				},
				{
					id: 3,
					name: "claudekit-control-center_0.1.0-dev.2_windows-x86_64-portable.exe",
					url: "https://api.example.com/assets/3",
					browser_download_url:
						"https://example.com/claudekit-control-center_0.1.0-dev.2_windows-x86_64-portable.exe",
					size: 300,
					content_type: "application/octet-stream",
				},
			],
		});

		expect(manifest.channel).toBe("dev");
	});
});
