import { spawn } from "node:child_process";
/**
 * Action Executor - Platform-aware process spawning
 * Opens terminal, editor, or Claude Code at a given path
 */
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { logger } from "@/shared/logger.js";

export type ActionResult = {
	success: boolean;
	error?: string;
};

/**
 * Open a terminal at the specified path
 */
export async function openTerminal(path: string): Promise<ActionResult> {
	if (!existsSync(path)) {
		return { success: false, error: `Path does not exist: ${path}` };
	}

	const os = platform();

	try {
		if (os === "darwin") {
			// macOS: Use open -a Terminal
			spawn("open", ["-a", "Terminal", path], { detached: true, stdio: "ignore" }).unref();
		} else if (os === "win32") {
			// Windows: Use start cmd
			spawn("cmd", ["/c", "start", "cmd", "/K", `cd /d "${path}"`], {
				detached: true,
				stdio: "ignore",
				shell: true,
			}).unref();
		} else {
			// Linux: Try common terminal emulators
			const terminals = [
				["gnome-terminal", ["--working-directory", path]],
				["konsole", ["--workdir", path]],
				["xfce4-terminal", ["--working-directory", path]],
				["xterm", ["-e", `cd "${path}" && $SHELL`]],
			] as const;

			let launched = false;
			for (const [cmd, args] of terminals) {
				try {
					const proc = spawn(cmd, [...args], { detached: true, stdio: "ignore" });
					proc.unref();
					launched = true;
					break;
				} catch {
					// Try next terminal
				}
			}

			if (!launched) {
				return { success: false, error: "No supported terminal emulator found" };
			}
		}

		return { success: true };
	} catch (error) {
		logger.error(`Failed to open terminal: ${error}`);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}

/**
 * Open an editor at the specified path
 * Tries VS Code, Cursor, then falls back to system default
 */
export async function openEditor(path: string): Promise<ActionResult> {
	if (!existsSync(path)) {
		return { success: false, error: `Path does not exist: ${path}` };
	}

	const os = platform();
	const editors =
		os === "win32" ? ["code.cmd", "cursor.cmd", "code", "cursor"] : ["code", "cursor"];

	try {
		for (const editor of editors) {
			try {
				const proc = spawn(editor, [path], { detached: true, stdio: "ignore" });
				proc.unref();
				return { success: true };
			} catch {
				// Try next editor
			}
		}

		// Fallback: open with system default
		if (os === "darwin") {
			spawn("open", [path], { detached: true, stdio: "ignore" }).unref();
			return { success: true };
		}
		if (os === "win32") {
			spawn("explorer", [path], { detached: true, stdio: "ignore", shell: true }).unref();
			return { success: true };
		}
		spawn("xdg-open", [path], { detached: true, stdio: "ignore" }).unref();
		return { success: true };
	} catch (error) {
		logger.error(`Failed to open editor: ${error}`);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}

/**
 * Launch Claude Code at the specified path
 */
export async function launchClaude(path: string): Promise<ActionResult> {
	if (!existsSync(path)) {
		return { success: false, error: `Path does not exist: ${path}` };
	}

	const os = platform();

	try {
		if (os === "darwin") {
			// macOS: Try launching Claude.app
			spawn("open", ["-a", "Claude", path], { detached: true, stdio: "ignore" }).unref();
		} else if (os === "win32") {
			// Windows: Try launching Claude from PATH or common locations
			const claudePaths = [
				"claude",
				`${process.env.LOCALAPPDATA}\\Programs\\Claude\\claude.exe`,
				`${process.env.ProgramFiles}\\Claude\\claude.exe`,
			];

			let launched = false;
			for (const claudePath of claudePaths) {
				try {
					spawn(claudePath, [path], { detached: true, stdio: "ignore", shell: true }).unref();
					launched = true;
					break;
				} catch {
					// Try next path
				}
			}

			if (!launched) {
				return { success: false, error: "Claude not found. Please install Claude Code." };
			}
		} else {
			// Linux: Try claude CLI
			try {
				spawn("claude", [path], { detached: true, stdio: "ignore" }).unref();
			} catch {
				return { success: false, error: "Claude CLI not found. Please install Claude Code." };
			}
		}

		return { success: true };
	} catch (error) {
		logger.error(`Failed to launch Claude: ${error}`);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}

/**
 * Execute a CCS (ClaudeKit CLI) command
 * @param command - The CCS command to run (e.g., "doctor", "config list")
 */
export async function executeCcsCommand(
	command: string,
): Promise<ActionResult & { output?: string }> {
	return new Promise((resolve) => {
		try {
			// Use ck (the CLI command) to execute
			const args = command.split(" ").filter(Boolean);
			const proc = spawn("ck", args, {
				stdio: ["ignore", "pipe", "pipe"],
				shell: true,
			});

			let stdout = "";
			let stderr = "";

			proc.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			proc.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (code === 0) {
					resolve({ success: true, output: stdout });
				} else {
					resolve({ success: false, error: stderr || `Exit code: ${code}`, output: stdout });
				}
			});

			proc.on("error", (error) => {
				resolve({ success: false, error: error.message });
			});

			// Timeout after 30 seconds
			setTimeout(() => {
				proc.kill();
				resolve({ success: false, error: "Command timed out" });
			}, 30000);
		} catch (error) {
			logger.error(`Failed to execute CCS command: ${error}`);
			resolve({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
		}
	});
}
