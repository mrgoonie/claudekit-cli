import { join } from "node:path";
import { pathExists } from "fs-extra";
import { logger } from "../../shared/logger.js";
import { createSpinner } from "../../shared/safe-spinner.js";
import type { PromptsManager } from "../ui/prompts.js";

/**
 * ClaudeKit-managed subdirectories that should be removed during fresh installation
 */
const CLAUDEKIT_SUBDIRECTORIES = ["commands", "agents", "skills", "workflows", "hooks"];

/**
 * Handles fresh installation by selectively removing ClaudeKit-managed subdirectories
 * @param claudeDir - Path to the .claude directory
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

	// Remove ClaudeKit-managed subdirectories selectively
	logger.info("Removing ClaudeKit-managed subdirectories...");
	const spinner = createSpinner("Removing ClaudeKit subdirectories...").start();

	try {
		const { rmSync } = await import("node:fs");
		let removedCount = 0;

		for (const subdir of CLAUDEKIT_SUBDIRECTORIES) {
			const subdirPath = join(claudeDir, subdir);
			if (await pathExists(subdirPath)) {
				rmSync(subdirPath, { recursive: true, force: true });
				removedCount++;
				logger.debug(`Removed subdirectory: ${subdir}/`);
			}
		}

		spinner.succeed(
			`Successfully removed ${removedCount} ClaudeKit subdirectories (preserving user configs)`,
		);
		return true;
	} catch (error) {
		spinner.fail("Failed to remove ClaudeKit subdirectories");
		throw new Error(
			`Failed to remove subdirectories: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
