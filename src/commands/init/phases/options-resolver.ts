/**
 * Options validation and mode detection phase
 * Handles CLI option parsing, global flag setup, and non-interactive detection
 */

import { ConfigManager } from "@/domains/config/config-manager.js";
import { FolderValidator } from "@/domains/installation/folder-validator.js";
import { logger } from "@/shared/logger.js";
import { UpdateCommandOptionsSchema } from "@/types";
import type { InitContext, ValidatedOptions } from "../types.js";

/**
 * Resolve and validate CLI options
 * Sets up global flag, detects non-interactive mode
 */
export async function resolveOptions(ctx: InitContext): Promise<InitContext> {
	// Check if --dir was explicitly provided (before schema applies defaults)
	const explicitDir = ctx.rawOptions.dir !== undefined;

	// Validate and parse options
	const parsed = UpdateCommandOptionsSchema.parse(ctx.rawOptions);

	const validOptions: ValidatedOptions = {
		kit: parsed.kit,
		dir: parsed.dir,
		release: parsed.release,
		folder: parsed.folder,
		beta: parsed.beta ?? false,
		global: parsed.global ?? false,
		yes: parsed.yes ?? false,
		fresh: parsed.fresh ?? false,
		refresh: parsed.refresh ?? false,
		exclude: parsed.exclude ?? [],
		only: parsed.only ?? [],
		docsDir: parsed.docsDir,
		plansDir: parsed.plansDir,
		installSkills: parsed.installSkills ?? false,
		skipSetup: parsed.skipSetup ?? false,
		forceOverwrite: parsed.forceOverwrite ?? false,
		forceOverwriteSettings: parsed.forceOverwriteSettings ?? false,
		dryRun: parsed.dryRun ?? false,
		prefix: parsed.prefix ?? false,
	};

	// Set global flag for ConfigManager
	ConfigManager.setGlobalFlag(validOptions.global);

	// Check mutual exclusivity: --folder and --release cannot be used together
	if (validOptions.folder && validOptions.release) {
		logger.error("--folder and --release flags are mutually exclusive");
		logger.info("Use either --folder for local source OR --release for specific version");
		return { ...ctx, cancelled: true };
	}

	// Validate folder if provided
	let isLocalFolder = false;
	if (validOptions.folder) {
		const validation = await FolderValidator.validate(validOptions.folder);
		if (!validation.valid) {
			logger.error(validation.error || "Folder validation failed");
			return { ...ctx, cancelled: true };
		}
		isLocalFolder = true;
		logger.success(`Using local folder: ${validation.resolvedPath}`);
		if (validation.version) {
			logger.info(`Detected version: ${validation.version}`);
		}
	}

	// Log installation mode
	if (validOptions.global) {
		logger.info("Global mode enabled - using platform-specific user configuration");
	}

	// Detect non-interactive mode (--yes flag, no TTY, or CI environment)
	const isNonInteractive =
		validOptions.yes ||
		!process.stdin.isTTY ||
		process.env.CI === "true" ||
		process.env.NON_INTERACTIVE === "true";

	// Log if using --yes flag for clarity
	if (validOptions.yes) {
		logger.info("Running in non-interactive mode (--yes flag)");
	}

	return {
		...ctx,
		options: validOptions,
		explicitDir,
		isNonInteractive,
		isLocalFolder,
	};
}
