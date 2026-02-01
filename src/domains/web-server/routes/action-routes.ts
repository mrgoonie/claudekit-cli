/**
 * Action API routes — cross-platform open actions (terminal, editor, launch)
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isMacOS, isWindows } from "@/shared/environment.js";
import type { Express, Request, Response } from "express";

const VALID_ACTIONS = ["terminal", "editor", "launch"] as const;
type ActionType = (typeof VALID_ACTIONS)[number];

interface SpawnCommand {
	command: string;
	args: string[];
}

/** Get platform-specific terminal command */
function getTerminalCommand(dirPath: string): SpawnCommand {
	if (isMacOS()) {
		return { command: "open", args: ["-a", "Terminal", dirPath] };
	}
	if (isWindows()) {
		return { command: "cmd.exe", args: ["/c", "start", "cmd", "/k", `cd /d "${dirPath}"`] };
	}
	// Linux: try x-terminal-emulator (Debian/Ubuntu), fallback to common terminals
	return { command: "x-terminal-emulator", args: ["--working-directory", dirPath] };
}

/** Get editor command — respects $EDITOR, falls back to VS Code */
function getEditorCommand(dirPath: string): SpawnCommand {
	const editor = process.env.EDITOR || process.env.VISUAL || "code";
	return { command: editor, args: [dirPath] };
}

/** Get launch command — open terminal and run claude CLI */
function getLaunchCommand(dirPath: string): SpawnCommand {
	if (isMacOS()) {
		// AppleScript: open Terminal, cd to path, run claude
		const script = `tell app "Terminal" to do script "cd '${dirPath}' && claude"`;
		return { command: "osascript", args: ["-e", script] };
	}
	if (isWindows()) {
		return {
			command: "cmd.exe",
			args: ["/c", "start", "cmd", "/k", `cd /d "${dirPath}" && claude`],
		};
	}
	// Linux: open terminal with claude command
	return { command: "x-terminal-emulator", args: ["-e", `bash -c 'cd "${dirPath}" && claude'`] };
}

/** Resolve action to platform command */
function resolveCommand(action: ActionType, dirPath: string): SpawnCommand {
	switch (action) {
		case "terminal":
			return getTerminalCommand(dirPath);
		case "editor":
			return getEditorCommand(dirPath);
		case "launch":
			return getLaunchCommand(dirPath);
	}
}

export function registerActionRoutes(app: Express): void {
	// POST /api/actions/open — spawn external process (terminal, editor, claude)
	app.post("/api/actions/open", (req: Request, res: Response) => {
		try {
			const { action, path: rawPath } = req.body;

			// Validate action
			if (!VALID_ACTIONS.includes(action)) {
				res
					.status(400)
					.json({
						error: `Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(", ")}`,
					});
				return;
			}

			// Validate path
			if (!rawPath || typeof rawPath !== "string") {
				res.status(400).json({ error: "Missing or invalid path" });
				return;
			}

			const dirPath = resolve(rawPath);
			if (!existsSync(dirPath)) {
				res.status(400).json({ error: `Path does not exist: ${dirPath}` });
				return;
			}

			// Resolve and spawn
			const { command, args } = resolveCommand(action as ActionType, dirPath);
			const child = spawn(command, args, {
				detached: true,
				stdio: "ignore",
				cwd: dirPath,
			});
			child.unref();

			// Listen for spawn errors (e.g., command not found)
			child.on("error", (err) => {
				// Can't send response here (already sent), just log
				console.error(`[actions] Spawn error for ${action}: ${err.message}`);
			});

			res.json({ success: true, action, path: dirPath });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: msg });
		}
	});
}
