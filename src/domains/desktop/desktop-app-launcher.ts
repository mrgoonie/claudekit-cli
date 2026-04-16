import { spawn } from "node:child_process";

export interface DesktopLaunchCommand {
	command: string;
	args: string[];
}

export function buildDesktopLaunchCommand(
	binaryPath: string,
	options: { platform?: NodeJS.Platform } = {},
): DesktopLaunchCommand {
	const platform = options.platform || process.platform;
	if (platform === "darwin") {
		return {
			command: "open",
			args: [binaryPath],
		};
	}
	return {
		command: binaryPath,
		args: [],
	};
}

export function launchDesktopApp(
	binaryPath: string,
	options: {
		platform?: NodeJS.Platform;
		spawnFn?: (
			command: string,
			args: string[],
			options: {
				detached: boolean;
				stdio: "ignore";
				windowsHide: boolean;
			},
		) => { unref: () => void };
	} = {},
): void {
	const command = buildDesktopLaunchCommand(binaryPath, options);
	const spawnFn = options.spawnFn || spawn;
	const child = spawnFn(command.command, command.args, {
		detached: true,
		stdio: "ignore",
		windowsHide: (options.platform || process.platform) === "win32",
	});
	child.unref();
}
