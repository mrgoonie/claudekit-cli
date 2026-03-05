/**
 * Local installation conflict handling phase
 * Detects and resolves conflicts when using global mode with existing local installation
 */

import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { pathExists, remove } from "fs-extra";
import type { InitContext } from "../types.js";

/**
 * Handle local installation conflicts in global mode
 * Prompts user to remove, keep, or cancel when local .claude exists
 */
export async function handleConflicts(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled) return ctx;

	// Only check in global mode
	if (!ctx.options.global) return ctx;

	// Skip if at HOME directory (local === global, no conflict possible)
	if (PathResolver.isLocalSameAsGlobal()) {
		return ctx;
	}

	const localSettingsPath = join(process.cwd(), ".claude", "settings.json");

	if (!(await pathExists(localSettingsPath))) {
		return ctx;
	}

	if (ctx.isNonInteractive) {
		// CI mode: warn and proceed
		logger.warning(
			"Local .claude/settings.json detected. Local settings take precedence over global.",
		);
		logger.warning("Consider removing local installation: rm -rf .claude");
		return ctx;
	}

	// Interactive mode: prompt user
	const choice = await ctx.prompts.promptLocalMigration();

	if (choice === "cancel") {
		ctx.prompts.outro("Installation cancelled.");
		return { ...ctx, cancelled: true };
	}

	if (choice === "remove") {
		const localClaudeDir = join(process.cwd(), ".claude");
		try {
			await remove(localClaudeDir);
			logger.success("Removed local .claude/ directory");
		} catch (error) {
			logger.error(
				`Failed to remove local installation: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			logger.warning("Proceeding with global installation anyway.");
		}
	}

	if (choice === "keep") {
		logger.warning("Proceeding with global installation. Local settings will take precedence.");
	}

	return ctx;
}
