import { pathExists } from "fs-extra";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/safe-spinner.js";
import type { PromptsManager } from "./prompts.js";

/**
 * Handles fresh installation by completely removing the .claude directory
 * @param claudeDir - Path to the .claude directory to remove
 * @param prompts - PromptsManager instance for user confirmation
 * @returns Promise<boolean> - true if removal was successful or directory didn't exist, false if cancelled
 */
export async function handleFreshInstallation(
	claudeDir: string,
	prompts: PromptsManager,
): Promise<boolean> {
	// Check if directory exists
	if (!(await pathExists(claudeDir))) {
		logger.info(".claude directory does not exist, proceeding with fresh installation");
		return true;
	}

	// Prompt for confirmation
	const confirmed = await prompts.promptFreshConfirmation(claudeDir);

	if (!confirmed) {
		logger.info("Fresh installation cancelled");
		return false;
	}

	// Remove directory
	logger.info("Removing .claude directory...");
	const spinner = createSpinner("Removing .claude directory...").start();

	try {
		const { rmSync } = await import("node:fs");
		rmSync(claudeDir, { recursive: true, force: true });
		spinner.succeed("Successfully removed .claude directory");
		return true;
	} catch (error) {
		spinner.fail("Failed to remove .claude directory");
		throw new Error(
			`Failed to remove directory: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
