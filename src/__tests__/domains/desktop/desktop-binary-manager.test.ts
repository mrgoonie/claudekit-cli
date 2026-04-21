import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rm } from "node:fs/promises";
import {
	downloadDesktopBinary,
	getDesktopBinaryPath,
	getDesktopInstallHealth,
	getDesktopUpdateStatus,
} from "@/domains/desktop/desktop-binary-manager.js";
import { writeDesktopInstallMetadata } from "@/domains/desktop/desktop-install-metadata.js";
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
		return rm("/tmp/ck-phase-3-home", { recursive: true, force: true });
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

	test("reports no update when installed desktop metadata matches the latest manifest", async () => {
		await writeDesktopInstallMetadata(
			{
				version: "0.1.0",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "stable",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
				assetSize: 202,
				installedAt: "2026-04-15T21:05:00Z",
			},
			{ platform: "linux" },
		);

		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "linux",
			arch: "x64",
			fetchManifest: async () => manifest,
			binaryPath: "/tmp/ck-phase-3-home/.local/bin/claudekit-control-center",
			validateInstalledArtifact: async () => true,
		});

		expect(status).toEqual({
			currentVersion: "0.1.0",
			latestVersion: "0.1.0",
			updateAvailable: false,
			reason: "up-to-date",
		});
	});

	test("reports an update when installed metadata is missing", async () => {
		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "linux",
			arch: "x64",
			fetchManifest: async () => manifest,
			binaryPath: "/tmp/ck-phase-3-home/.local/bin/claudekit-control-center",
			validateInstalledArtifact: async () => true,
		});

		expect(status).toEqual({
			currentVersion: null,
			latestVersion: "0.1.0",
			updateAvailable: true,
			reason: "unknown-installed-version",
		});
	});

	test("reports unhealthy install when metadata exists but the binary is missing", async () => {
		await writeDesktopInstallMetadata(
			{
				version: "0.1.0",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "stable",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
				assetSize: 202,
				installedAt: "2026-04-15T21:05:00Z",
			},
			{ platform: "linux" },
		);

		const health = await getDesktopInstallHealth({
			platform: "linux",
			binaryPath: null,
			validateInstalledArtifact: async () => true,
		});

		expect(health).toEqual({
			currentVersion: "0.1.0",
			healthy: false,
			reason: "missing-binary",
		});
	});

	test("reports missing-binary when update metadata exists but the binary path is gone", async () => {
		await writeDesktopInstallMetadata(
			{
				version: "0.1.0",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "stable",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
				assetSize: 202,
				installedAt: "2026-04-15T21:05:00Z",
			},
			{ platform: "linux" },
		);

		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "linux",
			arch: "x64",
			fetchManifest: async () => manifest,
			binaryPath: null,
			validateInstalledArtifact: async () => true,
		});

		expect(status).toEqual({
			currentVersion: "0.1.0",
			latestVersion: "0.1.0",
			updateAvailable: true,
			reason: "missing-binary",
		});
	});

	test("reports installed-newer when the installed build is newer on the same channel", async () => {
		await writeDesktopInstallMetadata(
			{
				version: "0.1.1",
				manifestDate: "2026-04-20T00:00:00Z",
				channel: "stable",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.1_linux-x86_64.AppImage",
				assetSize: 999,
				installedAt: "2026-04-20T00:05:00Z",
			},
			{ platform: "linux" },
		);

		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "linux",
			arch: "x64",
			fetchManifest: async () => manifest,
			binaryPath: "/tmp/ck-phase-3-home/.local/bin/claudekit-control-center",
			validateInstalledArtifact: async () => true,
		});

		expect(status).toEqual({
			currentVersion: "0.1.1",
			latestVersion: "0.1.0",
			updateAvailable: false,
			reason: "installed-newer",
		});
	});

	test("forces a reinstall when the installed artifact does not match the recorded metadata", async () => {
		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "linux",
			arch: "x64",
			fetchManifest: async () => manifest,
			readInstallMetadata: async () => ({
				version: "0.1.0",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "stable",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0_linux-x86_64.AppImage",
				assetSize: 202,
				installedAt: "2026-04-15T21:05:00Z",
			}),
			binaryPath: "/tmp/ck-phase-3-home/.local/bin/claudekit-control-center",
			validateInstalledArtifact: async () => false,
		});

		expect(status).toEqual({
			currentVersion: "0.1.0",
			latestVersion: "0.1.0",
			updateAvailable: true,
			reason: "update-available",
		});
	});

	test("reports the actual installed version when install health detects artifact drift", async () => {
		const health = await getDesktopInstallHealth({
			platform: "darwin",
			binaryPath: "/tmp/ck-phase-3-home/Applications/ClaudeKit Control Center.app",
			readInstallMetadata: async () => ({
				version: "0.1.0-dev.6",
				manifestDate: "2026-04-20T03:29:54Z",
				channel: "dev",
				platformKey: "darwin-aarch64",
				assetName: "claudekit-control-center_0.1.0-dev.6_macos-universal.app.zip",
				assetSize: 12598654,
				installedAt: "2026-04-20T03:31:34.201Z",
			}),
			validateInstalledArtifact: async () => false,
			readInstalledArtifactVersion: async () => "0.1.0-dev.5",
		});

		expect(health).toEqual({
			currentVersion: "0.1.0-dev.5",
			healthy: false,
			reason: "artifact-invalid",
		});
	});

	test("reports the actual installed bundle version when metadata is ahead of the artifact", async () => {
		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "darwin",
			arch: "arm64",
			fetchManifest: async () => manifest,
			readInstallMetadata: async () => ({
				version: "0.1.0-dev.6",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "stable",
				platformKey: "darwin-aarch64",
				assetName: "claudekit-control-center_0.1.0_macos-universal.app.zip",
				assetSize: 101,
				installedAt: "2026-04-15T21:05:00Z",
			}),
			binaryPath: "/tmp/ck-phase-3-home/Applications/ClaudeKit Control Center.app",
			validateInstalledArtifact: async () => false,
			readInstalledArtifactVersion: async () => "0.1.0-dev.5",
		});

		expect(status).toEqual({
			currentVersion: "0.1.0-dev.5",
			latestVersion: "0.1.0",
			updateAvailable: true,
			reason: "update-available",
		});
	});

	test("does not downgrade when the actual installed bundle is newer than the latest manifest", async () => {
		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "darwin",
			arch: "arm64",
			fetchManifest: async () => manifest,
			readInstallMetadata: async () => ({
				version: "0.1.0",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "stable",
				platformKey: "darwin-aarch64",
				assetName: "claudekit-control-center_0.1.0_macos-universal.app.zip",
				assetSize: 101,
				installedAt: "2026-04-15T21:05:00Z",
			}),
			binaryPath: "/tmp/ck-phase-3-home/Applications/ClaudeKit Control Center.app",
			validateInstalledArtifact: async () => false,
			readInstalledArtifactVersion: async () => "0.1.1",
		});

		expect(status).toEqual({
			currentVersion: "0.1.1",
			latestVersion: "0.1.0",
			updateAvailable: false,
			reason: "installed-newer",
		});
	});

	test("forces an update when the installed desktop metadata is for a different channel", async () => {
		const status = await getDesktopUpdateStatus({
			channel: "stable",
			platform: "linux",
			arch: "x64",
			fetchManifest: async () => manifest,
			readInstallMetadata: async () => ({
				version: "0.1.0-dev.2",
				manifestDate: "2026-04-15T21:00:00Z",
				channel: "dev",
				platformKey: "linux-x86_64",
				assetName: "claudekit-control-center_0.1.0-dev.2_linux-x86_64.AppImage",
				assetSize: 202,
				installedAt: "2026-04-15T21:05:00Z",
			}),
			binaryPath: "/tmp/ck-phase-3-home/.local/bin/claudekit-control-center",
			validateInstalledArtifact: async () => true,
		});

		expect(status).toEqual({
			currentVersion: "0.1.0-dev.2",
			latestVersion: "0.1.0",
			updateAvailable: true,
			reason: "update-available",
		});
	});
});
