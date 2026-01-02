/**
 * New Command
 *
 * Main orchestrator for the new command (bootstrap new ClaudeKit project).
 */

import { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import { log } from "@/shared/safe-prompts.js";
import { type NewCommandOptions, NewCommandOptionsSchema } from "@/types";
import picocolors from "picocolors";
import { handleDirectorySetup, handlePostSetup, handleProjectCreation } from "./phases/index.js";
import type { NewContext } from "./types.js";

/**
 * Create initial context for new command
 */
function createNewContext(options: NewCommandOptions, prompts: PromptsManager): NewContext {
	return {
		options,
		prompts,
		isNonInteractive: !process.stdin.isTTY || process.env.CI === "true",
		cancelled: false,
	};
}

export async function newCommand(options: NewCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🚀 ClaudeKit - Create New Project");

	try {
		// Create context with validated options
		const validOptions = NewCommandOptionsSchema.parse(options);

		// Validate mutually exclusive download methods
		const downloadMethods = [
			validOptions.useGit && "--use-git",
			validOptions.archive && "--archive",
			validOptions.kitPath && "--kit-path",
		].filter(Boolean) as string[];

		if (downloadMethods.length > 1) {
			throw new Error(
				`Options ${downloadMethods.join(", ")} are mutually exclusive.\n\nPlease use only one download method.`,
			);
		}

		// Validate --use-git requires --release (can't list versions without API auth)
		// Note: --archive and --kit-path do NOT require --release
		if (validOptions.useGit && !validOptions.release) {
			throw new Error(
				"--use-git requires --release <tag> to specify the version.\n\n" +
					"Git clone mode cannot list versions without GitHub API access.\n" +
					"Example: ck new --use-git --release v2.1.0",
			);
		}

		let ctx = createNewContext(validOptions, prompts);

		// Phase 1: Directory setup
		ctx = await handleDirectorySetup(ctx);
		if (ctx.cancelled) return;

		// Phase 2: Project creation (download, extract, install)
		ctx = await handleProjectCreation(ctx);
		if (ctx.cancelled) return;

		// Phase 3: Post-setup (optional packages, skills)
		ctx = await handlePostSetup(ctx);
		if (ctx.cancelled) return;

		prompts.outro(`✨ Project created successfully at ${ctx.resolvedDir}`);

		// Show update hint for future reference
		log.info(
			`${picocolors.dim("Tip:")} To update later: ${picocolors.cyan("ck update")} (CLI) + ${picocolors.cyan("ck init")} (kit content)`,
		);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
