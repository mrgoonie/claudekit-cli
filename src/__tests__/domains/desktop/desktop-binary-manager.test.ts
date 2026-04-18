import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	downloadDesktopBinary,
	getDesktopBinaryPath,
} from "@/domains/desktop/desktop-binary-manager.js";
import type { DesktopReleaseManifest } from "@/types/desktop.js";

const manifest: DesktopReleaseManifest = {
	version: "0.1.0",
	date: "2026-04-15T21:00:00Z",
	channel: "stable",
	platforms: {
		"darwin-aarch64": {
			name: "claudekit-control-center_0.1.0_macos-universal.app.zip",
			url: "https://example.com/mac.zip",
			size: 101,
			assetType: "app-zip",
		},
		"darwin-x86_64": {
			name: "claudekit-control-center_0.1.0_macos-universal.app.zip",
			url: "https://example.com/mac.zip",
			size: 101,
			assetType: "app-zip",
		},
		"linux-x86_64": {
			name: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
			url: "https://example.com/linux.AppImage",
			size: 202,
			assetType: "appimage",
		},
		"windows-x86_64": {
			name: "claudekit-control-center_0.1.0_windows-x86_64-portable.exe",
			url: "https://example.com/windows.exe",
			size: 303,
			assetType: "portable-exe",
		},
	},
};

describe("desktop-binary-manager", () => {
	const originalTestHome = process.env.CK_TEST_HOME;

	beforeEach(() => {
		process.env.CK_TEST_HOME = "/tmp/ck-phase-3-home";
	});

	afterEach(() => {
		process.env.CK_TEST_HOME = originalTestHome;
	});

	test("returns null when the installed binary is missing", () => {
		const result = getDesktopBinaryPath({
			platform: "linux",
			existsFn: () => false,
		});

		expect(result).toBeNull();
	});

	test("returns the install path when the binary exists", () => {
		const result = getDesktopBinaryPath({
			platform: "linux",
			existsFn: () => true,
		});

		expect(result).toBe("/tmp/ck-phase-3-home/.local/bin/claudekit-control-center");
	});

	test("downloads the current platform asset from the manifest", async () => {
		const fetchManifest = mock(async () => manifest);
		const downloadFile = mock(async () => "/tmp/downloads/linux.AppImage");
		const getDownloadDirectory = mock(() => "/tmp/downloads");

		const result = await downloadDesktopBinary(undefined, {
			platform: "linux",
			arch: "x64",
			fetchManifest,
			downloadFile,
			getDownloadDirectory,
		});

		expect(fetchManifest).toHaveBeenCalled();
		expect(downloadFile).toHaveBeenCalledWith({
			url: "https://example.com/linux.AppImage",
			name: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
			size: 202,
			destDir: "/tmp/downloads",
		});
		expect(result).toBe("/tmp/downloads/linux.AppImage");
	});
});
