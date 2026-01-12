/**
 * Installation Prompts
 *
 * Prompts for update modes and directory selection during installation
 */

import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { confirm, isCancel, log, text } from "@/shared/safe-prompts.js";

/**
 * Prompt user to choose between updating everything or selective update
 */
export async function promptUpdateMode(): Promise<boolean> {
	const updateEverything = await confirm({
		message: "Do you want to update everything?",
	});

	if (isCancel(updateEverything)) {
		throw new Error("Update cancelled");
	}

	return updateEverything as boolean;
}

/**
 * Prompt user to select directories for selective update
 *
 * @param global - Whether to use global installation mode
 */
export async function promptDirectorySelection(global = false): Promise<string[]> {
	log.step("Select directories to update");

	const prefix = PathResolver.getPathPrefix(global);
	const categories = [
		{ key: "agents", label: "Agents", pattern: prefix ? `${prefix}/agents` : "agents" },
		{ key: "commands", label: "Commands", pattern: prefix ? `${prefix}/commands` : "commands" },
		{
			key: "rules",
			label: "Rules",
			pattern: prefix ? `${prefix}/rules` : "rules",
		},
		{ key: "skills", label: "Skills", pattern: prefix ? `${prefix}/skills` : "skills" },
		{ key: "hooks", label: "Hooks", pattern: prefix ? `${prefix}/hooks` : "hooks" },
	];

	const selectedCategories: string[] = [];

	for (const category of categories) {
		const shouldInclude = await confirm({
			message: `Include ${category.label}?`,
		});

		if (isCancel(shouldInclude)) {
			throw new Error("Update cancelled");
		}

		if (shouldInclude) {
			selectedCategories.push(category.pattern);
		}
	}

	if (selectedCategories.length === 0) {
		throw new Error("No directories selected for update");
	}

	return selectedCategories;
}

/**
 * Prompt user to confirm fresh installation (selective ClaudeKit directory removal)
 */
export async function promptFreshConfirmation(targetPath: string): Promise<boolean> {
	logger.warning("[!] Fresh installation will remove ClaudeKit-managed directories:");
	logger.info(`Path: ${targetPath}`);
	logger.info("  Removed: commands/, agents/, skills/, rules/, hooks/");
	logger.info("  Preserved: settings.json, Claude Code data, custom files");

	const confirmation = await text({
		message: "Type 'yes' to confirm:",
		placeholder: "yes",
		validate: (value) => {
			if (value.toLowerCase() !== "yes") {
				return "You must type 'yes' to confirm";
			}
			return;
		},
	});

	if (isCancel(confirmation)) {
		return false;
	}

	return confirmation.toLowerCase() === "yes";
}
