import { describe, expect, test } from "bun:test";
import {
	getCurrentDesktopPlatformKey,
	selectDesktopPlatformEntry,
} from "@/domains/desktop/desktop-asset-selector.js";
import type { DesktopReleaseManifest } from "@/types/desktop.js";

const manifest: DesktopReleaseManifest = {
	version: "0.1.0",
	date: "2026-04-15T21:00:00Z",
	channel: "stable",
	platforms: {
		"darwin-aarch64": {
			name: "mac-arm.zip",
			url: "https://example.com/mac-arm.zip",
			size: 100,
			assetType: "app-zip",
		},
		"darwin-x86_64": {
			name: "mac-x64.zip",
			url: "https://example.com/mac-x64.zip",
			size: 110,
			assetType: "app-zip",
		},
		"linux-x86_64": {
			name: "linux.AppImage",
			url: "https://example.com/linux.AppImage",
			size: 120,
			assetType: "appimage",
		},
		"windows-x86_64": {
			name: "windows.exe",
			url: "https://example.com/windows.exe",
			size: 130,
			assetType: "portable-exe",
		},
	},
};

describe("desktop-asset-selector", () => {
	test("maps supported runtime platforms to manifest keys", () => {
		expect(getCurrentDesktopPlatformKey("darwin", "arm64")).toBe("darwin-aarch64");
		expect(getCurrentDesktopPlatformKey("darwin", "x64")).toBe("darwin-x86_64");
		expect(getCurrentDesktopPlatformKey("linux", "x64")).toBe("linux-x86_64");
		expect(getCurrentDesktopPlatformKey("win32", "x64")).toBe("windows-x86_64");
	});

	test("throws on unsupported platform combinations", () => {
		expect(() => getCurrentDesktopPlatformKey("linux", "arm64")).toThrow(/unsupported/i);
		expect(() => getCurrentDesktopPlatformKey("freebsd", "x64")).toThrow(/unsupported/i);
	});

	test("selects the correct manifest entry for the current platform", () => {
		const entry = selectDesktopPlatformEntry(manifest, {
			platform: "linux",
			arch: "x64",
		});

		expect(entry.assetType).toBe("appimage");
		expect(entry.name).toBe("linux.AppImage");
	});
});
