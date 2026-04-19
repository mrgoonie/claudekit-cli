import { homedir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";

function getDesktopHomeDirectory(): string {
	return process.env.CK_TEST_HOME || process.env.HOME || process.env.USERPROFILE || homedir();
}

export function getDesktopInstallPath(options: { platform?: NodeJS.Platform } = {}): string {
	const platform = options.platform || process.platform;
	const homeDir = getDesktopHomeDirectory();

	if (platform === "darwin") {
		return join(homeDir, "Applications", "ClaudeKit Control Center.app");
	}
	if (platform === "linux") {
		return join(homeDir, ".local", "bin", "claudekit-control-center");
	}
	if (platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA || join(homeDir, "AppData", "Local");
		return win32.join(localAppData, "ClaudeKit", "ClaudeKit Control Center.exe");
	}

	throw new Error(`Unsupported install platform: ${platform}`);
}

export function getDesktopInstallDirectory(options: { platform?: NodeJS.Platform } = {}): string {
	return dirname(getDesktopInstallPath(options));
}

export function getDesktopInstallMetadataPath(
	options: { platform?: NodeJS.Platform } = {},
): string {
	return join(getDesktopInstallDirectory(options), "claudekit-control-center-install.json");
}

export function getDesktopDownloadDirectory(): string {
	return join(PathResolver.getCacheDir(false), "desktop-downloads");
}
