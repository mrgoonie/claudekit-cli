import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	getDesktopDownloadDirectory,
	getDesktopInstallPath,
} from "@/domains/desktop/desktop-install-path-resolver.js";
import { PathResolver } from "@/shared/path-resolver.js";

describe("desktop-install-path-resolver", () => {
	const originalTestHome = process.env.CK_TEST_HOME;
	const originalLocalAppData = process.env.LOCALAPPDATA;

	beforeEach(() => {
		process.env.CK_TEST_HOME = "/tmp/ck-phase-3-home";
		process.env.LOCALAPPDATA = "C:\\Users\\Kai\\AppData\\Local";
	});

	afterEach(() => {
		process.env.CK_TEST_HOME = originalTestHome;
		process.env.LOCALAPPDATA = originalLocalAppData;
	});

	test("resolves per-platform install targets inside the user profile", () => {
		expect(getDesktopInstallPath({ platform: "darwin" })).toBe(
			"/tmp/ck-phase-3-home/Applications/ClaudeKit Control Center.app",
		);
		expect(getDesktopInstallPath({ platform: "linux" })).toBe(
			"/tmp/ck-phase-3-home/.local/bin/claudekit-control-center",
		);
		expect(getDesktopInstallPath({ platform: "win32" })).toBe(
			"C:\\Users\\Kai\\AppData\\Local\\ClaudeKit\\ClaudeKit Control Center.exe",
		);
	});

	test("uses the shared cache directory for downloads", () => {
		expect(getDesktopDownloadDirectory()).toBe(
			join(PathResolver.getCacheDir(false), "desktop-downloads"),
		);
	});
});
