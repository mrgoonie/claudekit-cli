/**
 * Shell and system checks
 * Checks: shell detection, WSL boundary
 */

import type { CheckResult } from "../types.js";

/**
 * Check shell detection
 */
export async function checkShellDetection(): Promise<CheckResult> {
	const shell = process.env.SHELL || process.env.ComSpec || "unknown";

	let shellName = "Unknown";
	if (shell.includes("pwsh") || shell.includes("powershell")) {
		shellName = shell.includes("pwsh") ? "PowerShell Core" : "Windows PowerShell";
	} else if (shell.includes("cmd")) {
		shellName = "Command Prompt";
	} else if (shell.includes("bash")) {
		shellName = "Bash";
	} else if (shell.includes("zsh")) {
		shellName = "Zsh";
	} else if (shell.includes("fish")) {
		shellName = "Fish";
	}

	return {
		id: "shell-detection",
		name: "Shell",
		group: "platform",
		priority: "standard",
		status: "info",
		message: shellName,
		details: shell,
		autoFixable: false,
	};
}

/**
 * Check WSL boundary
 */
export async function checkWSLBoundary(): Promise<CheckResult> {
	const cwd = process.cwd();
	const accessingWindows = cwd.startsWith("/mnt/");

	return {
		id: "wsl-boundary",
		name: "WSL Boundary",
		group: "platform",
		priority: "standard",
		status: accessingWindows ? "warn" : "pass",
		message: accessingWindows
			? "Working in Windows filesystem from WSL"
			: "Working in native Linux filesystem",
		details: cwd,
		suggestion: accessingWindows
			? "Performance may be slower. Consider using native Linux paths."
			: undefined,
		autoFixable: false,
	};
}
