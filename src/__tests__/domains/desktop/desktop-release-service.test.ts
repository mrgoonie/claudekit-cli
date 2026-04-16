import { describe, expect, mock, test } from "bun:test";
import {
	fetchDesktopReleaseManifest,
	getDesktopManifestUrl,
} from "@/domains/desktop/desktop-release-service.js";

describe("desktop-release-service", () => {
	test("builds latest and version-specific manifest URLs", () => {
		expect(getDesktopManifestUrl()).toBe(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-latest/desktop-manifest.json",
		);
		expect(getDesktopManifestUrl("0.1.0")).toBe(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-v0.1.0/desktop-manifest.json",
		);
	});

	test("fetches and parses the desktop manifest", async () => {
		const fetchFn = mock(async () => ({
			ok: true,
			json: async () => ({
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
			}),
		}));

		const manifest = await fetchDesktopReleaseManifest(
			undefined,
			fetchFn as unknown as typeof fetch,
		);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://github.com/mrgoonie/claudekit-cli/releases/download/desktop-latest/desktop-manifest.json",
		);
		expect(manifest.platforms["windows-x86_64"]?.assetType).toBe("portable-exe");
	});

	test("throws when the manifest request fails", async () => {
		const fetchFn = mock(async () => ({
			ok: false,
			status: 404,
			statusText: "Not Found",
		}));

		await expect(
			fetchDesktopReleaseManifest(undefined, fetchFn as unknown as typeof fetch),
		).rejects.toThrow(/404/i);
	});
});
