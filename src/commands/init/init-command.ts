/**
 * Init command orchestrator
 * Coordinates all init phases using context pattern
 */

import { GitHubClient } from "@/domains/github/github-client.js";
import { maybeShowConfigUpdateNotification } from "@/domains/sync/index.js";
import { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import { withProcessLock } from "@/shared/process-lock.js";
import type { KitType, UpdateCommandOptions } from "@/types";
import { AVAILABLE_KITS } from "@/types";
import {
	executeSyncMerge,
	handleConflicts,
	handleDownload,
	handleMerge,
	handleMigration,
	handleOpenCode,
	handlePostInstall,
	handleSelection,
	handleSync,
	handleTransforms,
	resolveOptions,
} from "./phases/index.js";
import type { InitContext, ValidatedOptions } from "./types.js";
import { isSyncContext } from "./types.js";

/**
 * Install additional kit (for multi-kit mode)
 * Runs phases 4-8 for a pending kit using shared context values from primary installation.
 *
 * @param baseCtx - Base context from primary kit installation (contains resolved directory, options, etc.)
 * @param kitType - Type of kit to install
 * @returns Updated context after installation
 * @throws {Error} If installation fails at any phase
 */
async function installAdditionalKit(baseCtx: InitContext, kitType: KitType): Promise<InitContext> {
	const kit = AVAILABLE_KITS[kitType];
	const github = new GitHubClient();

	logger.info(`\nInstalling additional kit: ${kit.name}`);

	// Match version strategy from primary kit installation:
	// - If user selected specific version, try to find same version for this kit
	// - Otherwise use latest release
	let release;
	if (baseCtx.selectedVersion && !baseCtx.selectedVersion.includes("latest")) {
		try {
			release = await github.getReleaseByTag(kit, baseCtx.selectedVersion);
			logger.success(`Found matching version: ${release.tag_name}`);
		} catch {
			// Version not available for this kit, fall back to latest
			logger.warning(
				`Version ${baseCtx.selectedVersion} not available for ${kit.name}, using latest`,
			);
			release = await github.getLatestRelease(kit, baseCtx.options.beta);
			logger.success(`Found: ${release.tag_name}`);
		}
	} else {
		release = await github.getLatestRelease(kit, baseCtx.options.beta);
		logger.success(`Found: ${release.tag_name}`);
	}

	// Create context for this kit, reusing shared values from base context
	let ctx: InitContext = {
		...baseCtx,
		kit,
		kitType,
		release,
		selectedVersion: release.tag_name,
		// Clear per-kit values that need to be regenerated
		tempDir: undefined,
		archivePath: undefined,
		extractDir: undefined,
	};

	// Phase 4: Download and extract release
	ctx = await handleDownload(ctx);
	if (ctx.cancelled) return ctx;

	// Phase 4.5: OpenCode relocation (global mode only)
	ctx = await handleOpenCode(ctx);
	if (ctx.cancelled) return ctx;

	// Phase 5: Path transformations
	ctx = await handleTransforms(ctx);
	if (ctx.cancelled) return ctx;

	// Phase 6: Skills migration
	ctx = await handleMigration(ctx);
	if (ctx.cancelled) return ctx;

	// Phase 7: File merge
	ctx = await handleMerge(ctx);
	if (ctx.cancelled) return ctx;

	// Phase 8: Post-installation
	ctx = await handlePostInstall(ctx);

	return ctx;
}

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
		useGit: false,
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
 * Internal init command implementation
 * Runs all phases in sequence, passing context through each
 */
async function executeInit(options: UpdateCommandOptions, prompts: PromptsManager): Promise<void> {
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

	// Phase 4.5: OpenCode relocation (global mode only, skip in sync)
	if (!isSyncMode) {
		ctx = await handleOpenCode(ctx);
		if (ctx.cancelled) return;
	}

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

	// Phase 9: Install additional kits (multi-kit mode)
	if (!isSyncMode && ctx.pendingKits && ctx.pendingKits.length > 0 && ctx.kitType) {
		const installedKits: KitType[] = [ctx.kitType];
		// Store pending kits before loop to prevent any potential context mutation issues
		const kitsToInstall = [...ctx.pendingKits];
		for (const pendingKit of kitsToInstall) {
			try {
				ctx = await installAdditionalKit(ctx, pendingKit);
				if (ctx.cancelled) {
					logger.warning(`Installation of ${AVAILABLE_KITS[pendingKit].name} was cancelled`);
					break;
				}
				installedKits.push(pendingKit);
			} catch (error) {
				logger.error(
					`Failed to install ${AVAILABLE_KITS[pendingKit].name}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
				if (installedKits.length > 1) {
					logger.info(
						`Successfully installed: ${installedKits.map((k) => AVAILABLE_KITS[k].name).join(", ")}`,
					);
				}
				throw error;
			}
		}
		logger.success(
			`\nInstalled ${installedKits.length} kits: ${installedKits.map((k) => AVAILABLE_KITS[k].name).join(", ")}`,
		);
	}

	// Success outro (only for normal mode - sync has its own outro)
	prompts.outro(`Project initialized successfully at ${ctx.resolvedDir}`);

	// Show next steps
	const protectedNote =
		ctx.customClaudeFiles.length > 0
			? "Your project has been initialized with the latest version.\nProtected files (.env, .claude custom files, etc.) were not modified."
			: "Your project has been initialized with the latest version.\nProtected files (.env, etc.) were not modified.";

	prompts.note(protectedNote, "Initialization complete");

	// Passive config update check (uses 24h cache, silent on errors)
	if (ctx.resolvedDir) {
		await maybeShowConfigUpdateNotification(ctx.resolvedDir, ctx.options.global);
	}
}

/**
 * Main init command orchestrator
 * Runs all phases in sequence with process locking
 */
export async function initCommand(options: UpdateCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("Initialize/Update Project");

	try {
		// Wrap entire init process with lock to prevent concurrent installations
		await withProcessLock("kit-install", async () => {
			await executeInit(options, prompts);
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Merge cancelled by user") {
			logger.warning("Update cancelled");
			return;
		}
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		// Throw instead of process.exit(1) to allow finally blocks (lock release) to complete
		process.exitCode = 1;
		throw error;
	}
}
