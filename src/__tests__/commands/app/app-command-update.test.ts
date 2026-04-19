import { describe, expect, mock, test } from "bun:test";
import { appCommand } from "@/commands/app/app-command.js";

describe("appCommand update short-circuit", () => {
	test("skips download when the installed desktop build is already up to date", async () => {
		const downloadBinary = mock(async () => "/tmp/download.zip");
		const launchBinary = mock(() => {});
		const success = mock(() => {});

		await appCommand(
			{ dev: true, update: true },
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				getUpdateStatus: async () => ({
					currentVersion: "0.1.0-dev.2",
					latestVersion: "0.1.0-dev.2",
					updateAvailable: false,
					reason: "up-to-date",
				}),
				downloadBinary,
				installBinary: async (path) => path,
				launchBinary,
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info: () => {},
				success,
				printLine: () => {},
			},
		);

		expect(downloadBinary).not.toHaveBeenCalled();
		expect(launchBinary).toHaveBeenCalledWith("/Applications/ClaudeKit Control Center.app");
		expect(success).toHaveBeenCalledWith(
			"ClaudeKit Control Center is already up to date (0.1.0-dev.2)",
		);
	});

	test("downloads when update metadata is missing or stale", async () => {
		const downloadBinary = mock(async () => "/tmp/download.zip");
		const installBinary = mock(async () => "/Applications/ClaudeKit Control Center.app");

		await appCommand(
			{ dev: true, update: true },
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				getUpdateStatus: async () => ({
					currentVersion: null,
					latestVersion: "0.1.0-dev.2",
					updateAvailable: true,
					reason: "unknown-installed-version",
				}),
				downloadBinary,
				installBinary,
				launchBinary: () => {},
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info: () => {},
				success: () => {},
				printLine: () => {},
			},
		);

		expect(downloadBinary).toHaveBeenCalledWith({ channel: "dev" });
		expect(installBinary).toHaveBeenCalledWith("/tmp/download.zip");
	});
});
