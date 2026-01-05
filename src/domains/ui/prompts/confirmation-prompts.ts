/**
 * Confirmation Prompts
 *
 * Simple confirmation prompts and local migration prompts
 */

import { platform } from "node:os";
import { output } from "@/shared/output-manager.js";
import { confirm, isCancel, log, note, select } from "@/shared/safe-prompts.js";
import {
	SKILLS_DEPENDENCIES,
	formatDependencyList,
	getInstallCommand,
	getVenvPath,
} from "@/types/skills-dependencies.js";

/**
 * Confirm action
 */
export async function confirmAction(message: string): Promise<boolean> {
	const result = await confirm({
		message,
	});

	if (isCancel(result)) {
		return false;
	}

	return result;
}

/**
 * Prompt user to handle local installation when switching to global mode
 * Returns: "remove" to delete local .claude/, "keep" to proceed with warning, "cancel" to abort
 */
export async function promptLocalMigration(): Promise<"remove" | "keep" | "cancel"> {
	const result = await select({
		message: "Local ClaudeKit installation detected. Local settings take precedence over global.",
		options: [
			{
				value: "remove",
				label: "Remove local installation",
				hint: "Delete .claude/ and use global only",
			},
			{
				value: "keep",
				label: "Keep both installations",
				hint: "Local will take precedence",
			},
			{ value: "cancel", label: "Cancel", hint: "Abort global installation" },
		],
	});

	if (isCancel(result)) {
		return "cancel";
	}

	return result as "remove" | "keep" | "cancel";
}

/**
 * Prompt for skills dependencies installation
 *
 * Shows detailed breakdown of what will be installed:
 * - Python packages (into venv)
 * - System tools (optional, may require sudo)
 * - Node.js packages
 */
export async function promptSkillsInstallation(): Promise<boolean> {
	// In JSON mode, interactive prompts are not supported
	if (output.isJson()) {
		return false;
	}

	const isWindows = platform() === "win32";

	// Build dependency list message from constants
	const pythonDeps = formatDependencyList(SKILLS_DEPENDENCIES.python);
	const systemDeps = formatDependencyList(SKILLS_DEPENDENCIES.system);
	const nodeDeps = formatDependencyList(SKILLS_DEPENDENCIES.node);

	// Show detailed info about what will be installed
	note(
		`This installs dependencies required by ClaudeKit skills:

  Python packages (into ${getVenvPath(isWindows)}):
${pythonDeps}

  System tools (optional${isWindows ? "" : " - may require sudo"}):
${systemDeps}

  Node.js packages:
${nodeDeps}`,
		"Skills Dependencies",
	);

	// Show platform-specific install command for deferred installation
	log.info(`Run '${getInstallCommand(isWindows)}' to install/update later.`);
	console.log();

	const installSkills = await confirm({
		message: "Install skills dependencies now?",
		initialValue: false,
	});

	if (isCancel(installSkills)) {
		return false;
	}

	return installSkills;
}
