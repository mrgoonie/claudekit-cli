/**
 * Init command orchestrator
 * Coordinates all init phases using context pattern
 */

import { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import type { UpdateCommandOptions } from "@/types";
import {
	executeSyncMerge,
	handleConflicts,
	handleDownload,
	handleMerge,
	handleMigration,
	handlePostInstall,
	handleSelection,
	handleSync,
	handleTransforms,
	resolveOptions,
} from "./phases/index.js";
import type { InitContext, ValidatedOptions } from "./types.js";
import { isSyncContext } from "./types.js";

/**
 * Create initial context with default values
 */
function createInitContext(rawOptions: UpdateCommandOptions, prompts: PromptsManager): InitContext {
	// Create placeholder validated options (will be replaced by resolveOptions)
	const placeholderOptions: ValidatedOptions = {
		dir: ".",
		beta: false,
		global: false,
		yes: false,
		fresh: false,
		refresh: false,
		exclude: [],
		only: [],
		installSkills: false,
		withSudo: false,
		skipSetup: false,
		forceOverwrite: false,
		forceOverwriteSettings: false,
		dryRun: false,
		prefix: false,
		sync: false,
	};

	return {
		rawOptions,
		options: placeholderOptions,
		prompts,
		explicitDir: false,
		isNonInteractive: false,
		customClaudeFiles: [],
		includePatterns: [],
		installSkills: false,
		cancelled: false,
	};
}

/**
 * Main init command orchestrator
 * Runs all phases in sequence, passing context through each
 */
export async function initCommand(options: UpdateCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("Initialize/Update Project");

	try {
		// Create initial context
		let ctx = createInitContext(options, prompts);

		// Phase 1: Options resolution and validation
		ctx = await resolveOptions(ctx);
		if (ctx.cancelled) return;

		// Phase 1.5: Handle sync mode (--sync flag)
		// If sync mode, this sets up context and short-circuits normal flow
		ctx = await handleSync(ctx);
		if (ctx.cancelled) return;

		// Check if we're in sync mode (sync handler sets syncInProgress)
		const isSyncMode = isSyncContext(ctx);

		// Phase 2: Handle local installation conflicts (global mode only, skip in sync)
		if (!isSyncMode) {
			ctx = await handleConflicts(ctx);
			if (ctx.cancelled) return;
		}

		// Phase 3: Kit, directory, and version selection
		// In sync mode, selection handler uses pre-set values from handleSync
		ctx = await handleSelection(ctx);
		if (ctx.cancelled) return;

		// Phase 4: Download and extract release
		ctx = await handleDownload(ctx);
		if (ctx.cancelled) return;

		// Phase 5: Path transformations and folder configuration (skip in sync - claudeDir already set)
		if (!isSyncMode) {
			ctx = await handleTransforms(ctx);
			if (ctx.cancelled) return;
		}

		// Phase 5.5: Execute sync merge if in sync mode
		if (isSyncMode) {
			ctx = await executeSyncMerge(ctx);
			// executeSyncMerge sets cancelled=true to exit after completing
			if (ctx.cancelled) return;
		}

		// Phase 6: Skills migration (skip in sync mode)
		if (!isSyncMode) {
			ctx = await handleMigration(ctx);
			if (ctx.cancelled) return;
		}

		// Phase 7: File merge and manifest tracking (skip in sync mode)
		if (!isSyncMode) {
			ctx = await handleMerge(ctx);
			if (ctx.cancelled) return;
		}

		// Phase 8: Post-installation tasks (skip in sync mode)
		if (!isSyncMode) {
			ctx = await handlePostInstall(ctx);
			if (ctx.cancelled) return;
		}

		// Success outro (only for normal mode - sync has its own outro)
		prompts.outro(`Project initialized successfully at ${ctx.resolvedDir}`);

		// Show next steps
		const protectedNote =
			ctx.customClaudeFiles.length > 0
				? "Your project has been initialized with the latest version.\nProtected files (.env, .claude custom files, etc.) were not modified."
				: "Your project has been initialized with the latest version.\nProtected files (.env, etc.) were not modified.";

		prompts.note(protectedNote, "Initialization complete");
	} catch (error) {
		if (error instanceof Error && error.message === "Merge cancelled by user") {
			logger.warning("Update cancelled");
			return;
		}
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
