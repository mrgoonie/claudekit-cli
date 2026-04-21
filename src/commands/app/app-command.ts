import { configUICommand } from "@/commands/config/config-ui-command.js";
import type { DesktopChannel } from "@/domains/desktop/desktop-release-service.js";
import {
	downloadDesktopBinary,
	getDesktopBinaryPath,
	getDesktopInstallHealth,
	getDesktopInstallPath,
	getDesktopUpdateStatus,
	installDesktopBinary,
	launchDesktopApp,
	uninstallDesktopBinary,
} from "@/domains/desktop/index.js";
import { isPrereleaseVersion } from "@/domains/versioning/checking/version-utils.js";
import { output } from "@/shared/output-manager.js";
import type { cac } from "cac";
import packageInfo from "../../../package.json" assert { type: "json" };
import type { AppCommandDependencies, AppCommandOptions } from "./types.js";

const APP_ACTION_CONFLICT_ERROR =
	"Use only one of --web, --update, --path, or --uninstall per invocation.";

const DEV_STABLE_CONFLICT_ERROR = "Use only one of --dev or --stable per invocation.";

function ensureExclusiveAction(options: AppCommandOptions): void {
	const enabledFlags = [options.web, options.update, options.path, options.uninstall].filter(
		Boolean,
	);
	if (enabledFlags.length > 1) {
		throw new Error(APP_ACTION_CONFLICT_ERROR);
	}
}

function resolveDesktopChannel(options: AppCommandOptions): DesktopChannel {
	if (options.dev && options.stable) {
		throw new Error(DEV_STABLE_CONFLICT_ERROR);
	}
	if (options.dev) return "dev";
	if (options.stable) return "stable";
	// Auto-detect: if the running CLI version is a prerelease, default to dev channel
	return isPrereleaseVersion(packageInfo.version) ? "dev" : "stable";
}

export async function appCommand(
	options: AppCommandOptions = {},
	deps: AppCommandDependencies = {},
): Promise<void> {
	ensureExclusiveAction(options);
	const channel = resolveDesktopChannel(options);

	const launchWeb = deps.launchWeb || configUICommand;
	const getBinaryPath = deps.getBinaryPath || getDesktopBinaryPath;
	const getInstallPath = deps.getInstallPath || getDesktopInstallPath;
	const getInstallHealth = deps.getInstallHealth || getDesktopInstallHealth;
	const getUpdateStatus = deps.getUpdateStatus || getDesktopUpdateStatus;
	const downloadBinary =
		deps.downloadBinary ||
		((opts?: { channel?: DesktopChannel }) =>
			downloadDesktopBinary(undefined, { channel: opts?.channel }));
	const installBinary = deps.installBinary || installDesktopBinary;
	const launchBinary = deps.launchBinary || launchDesktopApp;
	const uninstallBinary = deps.uninstallBinary || uninstallDesktopBinary;
	const info = deps.info || output.info.bind(output);
	const success = deps.success || output.success.bind(output);
	const printLine = deps.printLine || console.log;
	let repairingInstall = false;

	if (options.web) {
		info("Opening ClaudeKit web dashboard...");
		await launchWeb();
		return;
	}

	if (options.path) {
		const installedPath = getBinaryPath();
		printLine(installedPath ?? getInstallPath());
		if (!installedPath) {
			info("(not installed)");
		}
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

	const existingBinary = getBinaryPath();
	if (existingBinary && !options.update) {
		try {
			const installHealth = await getInstallHealth({ binaryPath: existingBinary });
			if (installHealth.healthy || installHealth.reason === "missing-metadata") {
				success("Launching ClaudeKit Control Center...");
				launchBinary(existingBinary);
				return;
			}

			info(
				installHealth.currentVersion
					? `Installed ClaudeKit Control Center build (${installHealth.currentVersion}) needs repair. Downloading the latest build...`
					: "Installed ClaudeKit Control Center needs repair. Downloading the latest build...",
			);
			repairingInstall = true;
		} catch {
			success("Launching ClaudeKit Control Center...");
			launchBinary(existingBinary);
			return;
		}
	}

	if (options.update && existingBinary) {
		const updateStatus = await getUpdateStatus({ channel, binaryPath: existingBinary });
		if (!updateStatus.updateAvailable) {
			success(
				updateStatus.reason === "installed-newer"
					? `Installed desktop build (${updateStatus.currentVersion}) is newer than the latest published build (${updateStatus.latestVersion})`
					: `ClaudeKit Control Center is already up to date (${updateStatus.latestVersion})`,
			);
			success("Launching ClaudeKit Control Center...");
			launchBinary(existingBinary);
			return;
		}
	}

	if (options.update) {
		info("Downloading and installing the latest ClaudeKit Control Center build...");
	} else if (!repairingInstall) {
		info("ClaudeKit Control Center not found. Downloading...");
	}
	const downloadedBinary = await downloadBinary({ channel });
	const installedBinary = await installBinary(downloadedBinary);
	success(`Installed ClaudeKit Control Center to ${installedBinary}`);
	success("Launching ClaudeKit Control Center...");
	launchBinary(installedBinary);
}

export function registerAppCommand(cli: ReturnType<typeof cac>): void {
	cli
		.command("app", "Launch ClaudeKit Control Center desktop app")
		.option("--web", "Open the web dashboard instead of the desktop app")
		.option("--update", "Check for a newer desktop build and install it before launching")
		.option("--path", "Print the current install path (or target path) and exit")
		.option("--uninstall", "Remove the installed desktop app and exit")
		.option("--dev", "Force dev channel for this invocation")
		.option("--stable", "Force stable channel for this invocation")
		.action(async (options: AppCommandOptions) => {
			await appCommand(options);
		});
}
