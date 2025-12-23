/**
 * New Command
 *
 * Main orchestrator for the new command (bootstrap new ClaudeKit project).
 */

import { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import { type NewCommandOptions, NewCommandOptionsSchema } from "@/types";
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
		let ctx = createNewContext(NewCommandOptionsSchema.parse(options), prompts);

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
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
