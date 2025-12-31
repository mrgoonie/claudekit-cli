import { exec, execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

export const execAsync = promisify(exec);
export const execFileAsync = promisify(execFile);

/**
 * Execute a command with real-time output streaming
 *
 * Always inherits stdout/stderr to show installation progress to user.
 * This is critical for Windows users who need to see PowerShell script output.
 * Fixes #213 - Windows users couldn't see installation progress.
 *
 * @param command - The command to execute
 * @param args - Command arguments
 * @param options - Spawn options (timeout, cwd, env)
 * @returns Promise that resolves when command completes successfully
 */
export function executeInteractiveScript(
	command: string,
	args: string[],
	options?: { timeout?: number; cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<void> {
	return new Promise((resolve, reject) => {
		// Always inherit stdout/stderr for real-time feedback
		// This fixes #213 - Windows users couldn't see installation progress
		const child = spawn(command, args, {
			stdio: ["ignore", "inherit", "inherit"],
			cwd: options?.cwd,
			env: options?.env || process.env,
		});

		// Handle timeout
		let timeoutId: NodeJS.Timeout | undefined;
		if (options?.timeout) {
			timeoutId = setTimeout(() => {
				child.kill("SIGTERM");
				reject(new Error(`Command timed out after ${options.timeout}ms`));
			}, options.timeout);
		}

		// Handle process completion
		child.on("exit", (code, signal) => {
			if (timeoutId) clearTimeout(timeoutId);

			if (signal) {
				reject(new Error(`Command terminated by signal ${signal}`));
			} else if (code !== 0) {
				reject(new Error(`Command exited with code ${code}`));
			} else {
				resolve();
			}
		});

		// Handle process errors
		child.on("error", (error) => {
			if (timeoutId) clearTimeout(timeoutId);
			reject(error);
		});
	});
}

/**
 * Get platform-specific npm command
 */
export function getNpmCommand(): string {
	const platform = process.platform;
	return platform === "win32" ? "npm.cmd" : "npm";
}
