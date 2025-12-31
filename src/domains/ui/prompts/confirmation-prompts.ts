/**
 * Confirmation Prompts
 *
 * Simple confirmation prompts and local migration prompts
 */

import { confirm, isCancel, select } from "@/shared/safe-prompts.js";

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
 */
export async function promptSkillsInstallation(): Promise<boolean> {
	const installSkills = await confirm({
		message:
			"Install skills dependencies (Python packages, system tools)? (Optional for advanced features)",
		initialValue: false,
	});

	if (isCancel(installSkills)) {
		return false;
	}

	return installSkills;
}
