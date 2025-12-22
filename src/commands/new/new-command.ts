/**
 * New Command
 *
 * Main orchestrator for the new command (bootstrap new ClaudeKit project).
 */

import { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import { type NewCommandOptions, NewCommandOptionsSchema } from "@/types";
import { directorySetup } from "./phases/directory-setup.js";
import { postSetup } from "./phases/post-setup.js";
import { projectCreation } from "./phases/project-creation.js";

export async function newCommand(options: NewCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🚀 ClaudeKit - Create New Project");

	try {
		// Validate and parse options
		const validOptions = NewCommandOptionsSchema.parse(options);

		// Phase 1: Directory setup
		const setupResult = await directorySetup(validOptions, prompts);
		if (!setupResult) {
			return; // User cancelled
		}

		const { kit, resolvedDir, isNonInteractive } = setupResult;

		// Phase 2: Project creation (download, extract, install)
		const creationResult = await projectCreation(
			kit,
			resolvedDir,
			validOptions,
			isNonInteractive,
			prompts,
		);
		if (!creationResult) {
			return; // Operation failed or cancelled
		}

		// Phase 3: Post-setup (optional packages, skills)
		await postSetup(resolvedDir, validOptions, isNonInteractive, prompts);

		prompts.outro(`✨ Project created successfully at ${resolvedDir}`);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
