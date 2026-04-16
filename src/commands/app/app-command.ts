import { configUICommand } from "@/commands/config/config-ui-command.js";
import {
	downloadDesktopBinary,
	getDesktopBinaryPath,
	getDesktopInstallPath,
	installDesktopBinary,
	launchDesktopApp,
	uninstallDesktopBinary,
} from "@/domains/desktop/index.js";
import { output } from "@/shared/output-manager.js";
import type { cac } from "cac";
import type { AppCommandDependencies, AppCommandOptions } from "./types.js";

const APP_ACTION_CONFLICT_ERROR =
	"Use only one of --web, --update, --path, or --uninstall per invocation.";

function ensureExclusiveAction(options: AppCommandOptions): void {
	const enabledFlags = [options.web, options.update, options.path, options.uninstall].filter(
		Boolean,
	);
	if (enabledFlags.length > 1) {
		throw new Error(APP_ACTION_CONFLICT_ERROR);
	}
}

export async function appCommand(
	options: AppCommandOptions = {},
	deps: AppCommandDependencies = {},
): Promise<void> {
	ensureExclusiveAction(options);

	const launchWeb = deps.launchWeb || configUICommand;
	const getBinaryPath = deps.getBinaryPath || getDesktopBinaryPath;
	const getInstallPath = deps.getInstallPath || getDesktopInstallPath;
	const downloadBinary = deps.downloadBinary || (() => downloadDesktopBinary());
	const installBinary = deps.installBinary || installDesktopBinary;
	const launchBinary = deps.launchBinary || launchDesktopApp;
	const uninstallBinary = deps.uninstallBinary || uninstallDesktopBinary;
	const info = deps.info || output.info.bind(output);
	const success = deps.success || output.success.bind(output);
	const printLine = deps.printLine || console.log;

	if (options.web) {
		info("Opening ClaudeKit web dashboard...");
		await launchWeb({});
		return;
	}

	if (options.path) {
		printLine(getBinaryPath() ?? getInstallPath());
		return;
	}

	if (options.uninstall) {
		const result = await uninstallBinary();
		if (result.removed) {
			success(`Removed ClaudeKit Control Center from ${result.path}`);
			return;
		}

		info(`ClaudeKit Control Center is not installed (${result.path})`);
		return;
	}

	const existingBinary = options.update ? null : getBinaryPath();
	if (existingBinary) {
		success("Launching ClaudeKit Control Center...");
		launchBinary(existingBinary);
		return;
	}

	info(
		options.update
			? "Downloading the latest ClaudeKit Control Center build..."
			: "ClaudeKit Control Center not found. Downloading...",
	);
	const downloadedBinary = await downloadBinary();
	const installedBinary = await installBinary(downloadedBinary);
	success(`Installed ClaudeKit Control Center to ${installedBinary}`);
	success("Launching ClaudeKit Control Center...");
	launchBinary(installedBinary);
}

export function registerAppCommand(cli: ReturnType<typeof cac>): void {
	cli
		.command("app", "Launch ClaudeKit Control Center desktop app")
		.option("--web", "Open the web dashboard instead of the desktop app")
		.option("--update", "Download and install the latest desktop build before launching")
		.option("--path", "Print the current install path (or target path) and exit")
		.option("--uninstall", "Remove the installed desktop app and exit")
		.action(async (options: AppCommandOptions) => {
			await appCommand(options);
		});
}
