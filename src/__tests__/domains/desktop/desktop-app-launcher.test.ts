import { describe, expect, mock, test } from "bun:test";
import {
	buildDesktopLaunchCommand,
	launchDesktopApp,
} from "@/domains/desktop/desktop-app-launcher.js";

describe("desktop-app-launcher", () => {
	test("builds platform-specific launch commands", () => {
		expect(
			buildDesktopLaunchCommand("/tmp/ClaudeKit Control Center.app", { platform: "darwin" }),
		).toEqual({
			command: "open",
			args: ["/tmp/ClaudeKit Control Center.app"],
		});
		expect(
			buildDesktopLaunchCommand("/tmp/claudekit-control-center", { platform: "linux" }),
		).toEqual({
			command: "/tmp/claudekit-control-center",
			args: [],
		});
		expect(
			buildDesktopLaunchCommand("C:\\ClaudeKit\\ClaudeKit Control Center.exe", {
				platform: "win32",
			}),
		).toEqual({
			command: "C:\\ClaudeKit\\ClaudeKit Control Center.exe",
			args: [],
		});
	});

	test("launches the app with detached ignored stdio", () => {
		const unref = mock(() => {});
		const spawnFn = mock(() => ({ unref }));

		launchDesktopApp("/tmp/claudekit-control-center", {
			platform: "linux",
			spawnFn,
		});

		expect(spawnFn).toHaveBeenCalledWith("/tmp/claudekit-control-center", [], {
			detached: true,
			stdio: "ignore",
			windowsHide: false,
		});
		expect(unref).toHaveBeenCalled();
	});
});
