import { describe, expect, mock, test } from "bun:test";
import { appCommand } from "@/commands/app/app-command.js";
import type { AppCommandDependencies } from "@/commands/app/types.js";

/** Minimal injectable stubs for channel resolution tests */
function makeStubs(overrides: Partial<AppCommandDependencies> = {}): AppCommandDependencies {
	return {
		getBinaryPath: mock(() => null),
		getInstallPath: mock(() => "/tmp/test-install"),
		downloadBinary: mock(async () => "/tmp/test-binary"),
		installBinary: mock(async (p: string) => p),
		launchBinary: mock(() => {}),
		uninstallBinary: mock(async () => ({ path: "/tmp/test-install", removed: false })),
		info: mock(() => {}),
		success: mock(() => {}),
		printLine: mock(() => {}),
		...overrides,
	};
}

describe("appCommand channel resolution", () => {
	test("--dev flag passes dev channel to downloadBinary", async () => {
		const deps = makeStubs();
		await appCommand({ dev: true }, deps);
		expect(deps.downloadBinary).toHaveBeenCalledWith({ channel: "dev" });
	});

	test("--stable flag passes stable channel to downloadBinary", async () => {
		const deps = makeStubs();
		await appCommand({ stable: true }, deps);
		expect(deps.downloadBinary).toHaveBeenCalledWith({ channel: "stable" });
	});

	test("--dev --stable together throws mutual exclusion error", async () => {
		const deps = makeStubs();
		await expect(appCommand({ dev: true, stable: true }, deps)).rejects.toThrow(/stable/i);
	});

	test("no flags causes downloadBinary to be called (auto-detect channel)", async () => {
		// packageInfo.version in the test environment is the real package.json version.
		// We only verify that downloadBinary is invoked — channel auto-detected.
		const deps = makeStubs();
		await appCommand({}, deps);
		expect(deps.downloadBinary).toHaveBeenCalled();
	});
});

describe("appCommand", () => {
	test("launches the installed desktop binary when it already exists", async () => {
		const launchBinary = mock(() => {});
		const success = mock(() => {});
		const downloadBinary = mock(async () => "/tmp/download.zip");

		await appCommand(
			{},
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallHealth: async () => ({
					currentVersion: "0.1.0-dev.7",
					healthy: true,
					reason: "healthy",
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
		expect(success).toHaveBeenCalledWith("Launching ClaudeKit Control Center...");
	});

	test("auto-repairs an unhealthy installed desktop binary on normal launch", async () => {
		const downloadBinary = mock(async () => "/tmp/download.zip");
		const installBinary = mock(async () => "/Applications/ClaudeKit Control Center.app");
		const launchBinary = mock(() => {});
		const info = mock(() => {});
		const success = mock(() => {});

		await appCommand(
			{},
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallHealth: async () => ({
					currentVersion: "0.1.0-dev.5",
					healthy: false,
					reason: "artifact-invalid",
				}),
				downloadBinary,
				installBinary,
				launchBinary,
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info,
				success,
				printLine: () => {},
			},
		);

		expect(info).toHaveBeenCalledWith(
			"Installed ClaudeKit Control Center build (0.1.0-dev.5) needs repair. Downloading the latest build...",
		);
		expect(info).not.toHaveBeenCalledWith("ClaudeKit Control Center not found. Downloading...");
		expect(downloadBinary).toHaveBeenCalled();
		expect(installBinary).toHaveBeenCalledWith("/tmp/download.zip");
		expect(launchBinary).toHaveBeenCalledWith("/Applications/ClaudeKit Control Center.app");
	});

	test("launches the installed desktop binary when metadata is missing", async () => {
		const downloadBinary = mock(async () => "/tmp/download.zip");
		const launchBinary = mock(() => {});
		const success = mock(() => {});

		await appCommand(
			{},
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallHealth: async () => ({
					currentVersion: null,
					healthy: false,
					reason: "missing-metadata",
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
		expect(success).toHaveBeenCalledWith("Launching ClaudeKit Control Center...");
	});

	test("downloads, installs, and launches when the desktop binary is missing", async () => {
		const downloadBinary = mock(async () => "/tmp/download.zip");
		const installBinary = mock(async () => "/Applications/ClaudeKit Control Center.app");
		const launchBinary = mock(() => {});
		const info = mock(() => {});
		const success = mock(() => {});

		await appCommand(
			{},
			{
				getBinaryPath: () => null,
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				downloadBinary,
				installBinary,
				launchBinary,
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info,
				success,
				printLine: () => {},
			},
		);

		expect(info).toHaveBeenCalledWith("ClaudeKit Control Center not found. Downloading...");
		expect(downloadBinary).toHaveBeenCalled();
		expect(installBinary).toHaveBeenCalledWith("/tmp/download.zip");
		expect(launchBinary).toHaveBeenCalledWith("/Applications/ClaudeKit Control Center.app");
		expect(success).toHaveBeenCalledWith(
			"Installed ClaudeKit Control Center to /Applications/ClaudeKit Control Center.app",
		);
	});

	test("downloads and reinstalls when --update finds a newer desktop build", async () => {
		const downloadBinary = mock(async () => "/tmp/download.zip");
		const installBinary = mock(async () => "/Applications/ClaudeKit Control Center.app");

		await appCommand(
			{ update: true },
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				getUpdateStatus: async () => ({
					currentVersion: "0.1.0-dev.1",
					latestVersion: "0.1.0-dev.2",
					updateAvailable: true,
					reason: "update-available",
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

		expect(downloadBinary).toHaveBeenCalled();
		expect(installBinary).toHaveBeenCalledWith("/tmp/download.zip");
	});

	test("delegates to the web dashboard when --web is used", async () => {
		const launchWeb = mock(async () => {});
		const info = mock(() => {});

		await appCommand(
			{ web: true },
			{
				launchWeb,
				getBinaryPath: () => null,
				getInstallPath: () => "/unused",
				downloadBinary: async () => "/unused",
				installBinary: async (path) => path,
				launchBinary: () => {},
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info,
				success: () => {},
				printLine: () => {},
			},
		);

		expect(info).toHaveBeenCalledWith("Opening ClaudeKit web dashboard...");
		expect(launchWeb).toHaveBeenCalledWith();
	});

	test("prints the install path and notes when --path is used before installation", async () => {
		const printLine = mock(() => {});
		const info = mock(() => {});

		await appCommand(
			{ path: true },
			{
				getBinaryPath: () => null,
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				downloadBinary: async () => "/unused",
				installBinary: async (path) => path,
				launchBinary: () => {},
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info,
				success: () => {},
				printLine,
			},
		);

		expect(printLine).toHaveBeenCalledWith("/Applications/ClaudeKit Control Center.app");
		expect(info).toHaveBeenCalledWith("(not installed)");
	});

	test("prints the installed path without the note when --path finds an installed binary", async () => {
		const printLine = mock(() => {});
		const info = mock(() => {});

		await appCommand(
			{ path: true },
			{
				getBinaryPath: () => "/Applications/ClaudeKit Control Center.app",
				getInstallPath: () => "/Applications/ClaudeKit Control Center.app",
				downloadBinary: async () => "/unused",
				installBinary: async (path) => path,
				launchBinary: () => {},
				uninstallBinary: async () => ({ path: "/unused", removed: false }),
				info,
				success: () => {},
				printLine,
			},
		);

		expect(printLine).toHaveBeenCalledWith("/Applications/ClaudeKit Control Center.app");
		expect(info).not.toHaveBeenCalled();
	});

	test("removes the desktop binary when --uninstall is used", async () => {
		const uninstallBinary = mock(async () => ({
			path: "/Applications/ClaudeKit Control Center.app",
			removed: true,
		}));
		const success = mock(() => {});

		await appCommand(
			{ uninstall: true },
			{
				getBinaryPath: () => null,
				getInstallPath: () => "/unused",
				downloadBinary: async () => "/unused",
				installBinary: async (path) => path,
				launchBinary: () => {},
				uninstallBinary,
				info: () => {},
				success,
				printLine: () => {},
			},
		);

		expect(uninstallBinary).toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith(
			"Removed ClaudeKit Control Center from /Applications/ClaudeKit Control Center.app",
		);
	});

	test("reports when --uninstall is used but the desktop binary is not installed", async () => {
		const uninstallBinary = mock(async () => ({
			path: "/Applications/ClaudeKit Control Center.app",
			removed: false,
		}));
		const info = mock(() => {});
		const success = mock(() => {});

		await appCommand(
			{ uninstall: true },
			{
				getBinaryPath: () => null,
				getInstallPath: () => "/unused",
				downloadBinary: async () => "/unused",
				installBinary: async (path) => path,
				launchBinary: () => {},
				uninstallBinary,
				info,
				success,
				printLine: () => {},
			},
		);

		expect(info).toHaveBeenCalledWith(
			"ClaudeKit Control Center is not installed (/Applications/ClaudeKit Control Center.app)",
		);
		expect(success).not.toHaveBeenCalled();
	});

	test("rejects conflicting action flags", async () => {
		await expect(
			appCommand(
				{ web: true, update: true },
				{
					getBinaryPath: () => null,
					getInstallPath: () => "/unused",
					downloadBinary: async () => "/unused",
					installBinary: async (path) => path,
					launchBinary: () => {},
					uninstallBinary: async () => ({ path: "/unused", removed: false }),
					info: () => {},
					success: () => {},
					printLine: () => {},
				},
			),
		).rejects.toThrow("Use only one of --web, --update, --path, or --uninstall per invocation.");
	});
});
