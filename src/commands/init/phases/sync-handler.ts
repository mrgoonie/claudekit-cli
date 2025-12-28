/**
 * Config sync detection and execution phase
 * Handles --sync flag logic: version checking, diff detection, and merge orchestration
 */

import { copyFile, mkdir, open, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	ConfigVersionChecker,
	MergeUI,
	SyncEngine,
	displayConfigUpdateNotification,
	validateSyncPath,
} from "@/domains/sync/index.js";
import type { SyncPlan } from "@/domains/sync/types.js";
import { readKitManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { TrackedFile } from "@/types";
import { pathExists } from "fs-extra";
import pc from "picocolors";
import type { InitContext } from "../types.js";

/**
 * Extended context with sync-specific fields
 */
interface SyncContext extends InitContext {
	syncInProgress?: boolean;
	syncTrackedFiles?: TrackedFile[];
	syncCurrentVersion?: string;
	syncLatestVersion?: string;
}

/**
 * Handle sync mode detection - runs early before selection
 * Sets up sync context if --sync flag is present and validates installation
 */
export async function handleSync(ctx: InitContext): Promise<InitContext> {
	// Skip if not in sync mode
	if (!ctx.options.sync) {
		return ctx;
	}

	// Compute claudeDir and resolvedDir early for sync mode
	const resolvedDir = ctx.options.global
		? PathResolver.getGlobalKitDir()
		: resolve(ctx.options.dir || ".");

	const claudeDir = ctx.options.global ? resolvedDir : join(resolvedDir, ".claude");

	// Check if .claude directory exists
	if (!(await pathExists(claudeDir))) {
		logger.error("Cannot sync: no .claude directory found");
		ctx.prompts.note("Run 'ck init' without --sync to install first.", "No Installation Found");
		return { ...ctx, cancelled: true };
	}

	// Read metadata to detect kit type
	const metadataPath = join(claudeDir, "metadata.json");
	if (!(await pathExists(metadataPath))) {
		logger.error("Cannot sync: no metadata.json found");
		ctx.prompts.note(
			"Your installation may be from an older version.\nRun 'ck init' to update.",
			"Legacy Installation",
		);
		return { ...ctx, cancelled: true };
	}

	// Try to determine kit type from options or existing metadata
	let kitType = ctx.options.kit as "engineer" | "marketing" | undefined;

	// If no kit specified, try to auto-detect from metadata
	if (!kitType) {
		const engineerMeta = await readKitManifest(claudeDir, "engineer");
		const marketingMeta = await readKitManifest(claudeDir, "marketing");

		if (engineerMeta && marketingMeta) {
			// Both installed - need user to specify
			if (!ctx.isNonInteractive) {
				kitType = (await ctx.prompts.selectKit()) as "engineer" | "marketing";
			} else {
				logger.error("Multiple kits installed. Please specify --kit engineer or --kit marketing");
				return { ...ctx, cancelled: true };
			}
		} else if (engineerMeta) {
			kitType = "engineer";
		} else if (marketingMeta) {
			kitType = "marketing";
		} else {
			logger.error("Cannot sync: no kit installation found in metadata");
			return { ...ctx, cancelled: true };
		}
	}

	// Read kit metadata
	const kitMetadata = await readKitManifest(claudeDir, kitType);
	if (!kitMetadata) {
		logger.error(`Cannot sync: ${kitType} kit not installed`);
		return { ...ctx, cancelled: true };
	}

	const currentVersion = kitMetadata.version;
	const trackedFiles = kitMetadata.files || [];

	if (trackedFiles.length === 0) {
		logger.warning("No tracked files found in metadata");
		ctx.prompts.note(
			"Your installation may be from an older version without file tracking.\nRun 'ck init' to update.",
			"Legacy Installation",
		);
		return { ...ctx, cancelled: true };
	}

	// Check for updates
	logger.info("Checking for config updates...");
	const updateResult = await ConfigVersionChecker.checkForUpdates(
		kitType,
		currentVersion,
		ctx.options.global,
	);

	if (!updateResult.hasUpdates) {
		ctx.prompts.note(
			`You're on the latest version (${updateResult.currentVersion})`,
			"Already Up to Date",
		);
		return { ...ctx, cancelled: true };
	}

	// Show update notification
	displayConfigUpdateNotification(
		updateResult.currentVersion,
		updateResult.latestVersion,
		ctx.options.global,
	);

	// Confirm sync operation
	if (!ctx.isNonInteractive) {
		const proceed = await ctx.prompts.confirm("Proceed with config sync?");
		if (!proceed) {
			return { ...ctx, cancelled: true };
		}
	}

	// Return enhanced context for downstream phases
	// Selection phase will skip version prompting since we're setting selectedVersion
	const syncCtx: SyncContext = {
		...ctx,
		resolvedDir,
		claudeDir,
		kitType,
		selectedVersion: `v${updateResult.latestVersion}`,
		syncInProgress: true,
		syncTrackedFiles: trackedFiles,
		syncCurrentVersion: currentVersion,
		syncLatestVersion: updateResult.latestVersion,
	};

	return syncCtx;
}

/** Lock timeout in ms */
const LOCK_TIMEOUT_MS = 30000;
/** Stale lock threshold - locks older than this are considered orphaned */
const STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Acquire exclusive lock for sync operations
 * Includes stale lock detection for orphaned locks
 * @returns Release function
 */
async function acquireSyncLock(global: boolean): Promise<() => Promise<void>> {
	const cacheDir = PathResolver.getCacheDir(global);
	const lockPath = join(cacheDir, ".sync-lock");
	const startTime = Date.now();

	// Ensure cache directory exists before trying to create lock
	await mkdir(dirname(lockPath), { recursive: true });

	while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
		try {
			// Exclusive create - fails if file exists
			const handle = await open(lockPath, "wx");

			return async () => {
				await handle.close();
				await unlink(lockPath).catch(() => {}); // Best effort cleanup
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EEXIST") {
				// Check if lock is stale (orphaned from crashed process)
				try {
					const lockStat = await stat(lockPath);
					const lockAge = Date.now() - lockStat.mtimeMs;

					if (lockAge > STALE_LOCK_THRESHOLD_MS) {
						logger.warning(`Removing stale sync lock (age: ${Math.round(lockAge / 1000)}s)`);
						await unlink(lockPath).catch(() => {});
						continue; // Retry immediately after removing stale lock
					}
				} catch {
					// Stat failed - lock might have been released, retry
				}

				// Lock held, wait and retry
				await new Promise((resolve) => setTimeout(resolve, 100));
				continue;
			}
			throw err;
		}
	}

	throw new Error("Failed to acquire sync lock: another sync operation may be in progress");
}

/**
 * Execute sync merge after download phase
 * This replaces the normal merge phase when in sync mode
 */
export async function executeSyncMerge(ctx: InitContext): Promise<InitContext> {
	const syncCtx = ctx as SyncContext;

	// Skip if not in sync mode
	if (!syncCtx.syncInProgress) {
		return ctx;
	}

	if (!syncCtx.extractDir || !syncCtx.claudeDir) {
		logger.error("Sync merge failed: missing paths");
		return { ...ctx, cancelled: true };
	}

	// Acquire lock
	const releaseLock = await acquireSyncLock(ctx.options.global);

	try {
		const trackedFiles = syncCtx.syncTrackedFiles || [];
		const upstreamDir = ctx.options.global
			? join(syncCtx.extractDir, ".claude")
			: syncCtx.extractDir;

		logger.info("Analyzing file changes...");

		// Create sync plan
		const plan = await SyncEngine.createSyncPlan(trackedFiles, syncCtx.claudeDir, upstreamDir);

		// Display plan summary
		displaySyncPlan(plan);

		if (plan.autoUpdate.length === 0 && plan.needsReview.length === 0) {
			ctx.prompts.note("All files are up to date or user-owned.", "No Changes Needed");
			return { ...ctx, cancelled: true };
		}

		// Create backup before making changes
		const backupDir = PathResolver.getBackupDir();
		await createBackup(syncCtx.claudeDir, trackedFiles, backupDir);
		logger.success(`Backup created at ${pc.dim(backupDir)}`);

		// Apply auto-updates
		if (plan.autoUpdate.length > 0) {
			logger.info(`Auto-updating ${plan.autoUpdate.length} file(s)...`);
			let updateSuccess = 0;
			let updateFailed = 0;

			for (const file of plan.autoUpdate) {
				try {
					const sourcePath = await validateSyncPath(upstreamDir, file.path);
					const targetPath = await validateSyncPath(syncCtx.claudeDir, file.path);

					// Ensure target directory exists
					const targetDir = join(targetPath, "..");
					await mkdir(targetDir, { recursive: true });

					// Copy file
					await copyFile(sourcePath, targetPath);
					logger.debug(`Updated: ${file.path}`);
					updateSuccess++;
				} catch (error) {
					const errCode = (error as NodeJS.ErrnoException).code;
					const errMsg = error instanceof Error ? error.message : "Unknown error";

					if (errCode === "ENOSPC") {
						// Disk full - this is critical, stop sync
						logger.error("Disk full: cannot complete sync operation");
						ctx.prompts.note("Your disk is full. Free up space and try again.", "Sync Failed");
						return { ...ctx, cancelled: true };
					}

					if (errCode === "EACCES" || errCode === "EPERM") {
						logger.warning(`Permission denied: ${file.path} - check file permissions`);
						updateFailed++;
					} else if (errMsg.includes("Symlink") || errMsg.includes("Path")) {
						logger.warning(`Skipping invalid path: ${file.path}`);
						updateFailed++;
					} else {
						logger.warning(`Failed to update ${file.path}: ${errMsg}`);
						updateFailed++;
					}
				}
			}

			if (updateSuccess > 0) {
				logger.success(
					`Auto-updated ${updateSuccess} file(s)${updateFailed > 0 ? ` (${updateFailed} failed)` : ""}`,
				);
			}
		}

		// Interactive merge for modified files
		if (plan.needsReview.length > 0 && !ctx.isNonInteractive) {
			logger.info(`${plan.needsReview.length} file(s) need interactive review...`);

			let totalApplied = 0;
			let totalRejected = 0;
			let skippedFiles = 0;

			for (const file of plan.needsReview) {
				let currentPath: string;
				let upstreamPath: string;
				try {
					currentPath = await validateSyncPath(syncCtx.claudeDir, file.path);
					upstreamPath = await validateSyncPath(upstreamDir, file.path);
				} catch (error) {
					logger.warning(`Skipping invalid path during review: ${file.path}`);
					skippedFiles++;
					continue;
				}

				// Load file contents
				const { content: currentContent, isBinary: currentBinary } =
					await SyncEngine.loadFileContent(currentPath);
				const { content: newContent, isBinary: newBinary } =
					await SyncEngine.loadFileContent(upstreamPath);

				// Skip binary files
				if (currentBinary || newBinary) {
					logger.warning(`Skipping binary file: ${file.path}`);
					skippedFiles++;
					continue;
				}

				// Generate hunks
				const hunks = SyncEngine.generateHunks(currentContent, newContent, file.path);

				if (hunks.length === 0) {
					logger.debug(`No changes in: ${file.path}`);
					continue;
				}

				// Run interactive merge
				const result = await MergeUI.mergeFile(file.path, currentContent, newContent, hunks);

				if (result === "skipped") {
					MergeUI.displaySkipped(file.path);
					skippedFiles++;
					continue;
				}

				// Write merged content
				try {
					await writeFile(currentPath, result.result, "utf-8");
				} catch (writeError) {
					const errCode = (writeError as NodeJS.ErrnoException).code;
					if (errCode === "ENOSPC") {
						logger.error("Disk full: cannot complete sync operation");
						ctx.prompts.note("Your disk is full. Free up space and try again.", "Sync Failed");
						return { ...ctx, cancelled: true };
					}
					throw writeError;
				}
				MergeUI.displayMergeSummary(file.path, result.applied, result.rejected);

				totalApplied += result.applied;
				totalRejected += result.rejected;
			}

			// Summary
			console.log("");
			console.log(pc.bold("Sync Summary:"));
			console.log(pc.dim("─".repeat(40)));
			if (plan.autoUpdate.length > 0) {
				console.log(pc.green(`  ✓ ${plan.autoUpdate.length} file(s) auto-updated`));
			}
			if (totalApplied > 0) {
				console.log(pc.green(`  ✓ ${totalApplied} hunk(s) applied`));
			}
			if (totalRejected > 0) {
				console.log(pc.yellow(`  ○ ${totalRejected} hunk(s) rejected`));
			}
			if (skippedFiles > 0) {
				console.log(pc.yellow(`  ○ ${skippedFiles} file(s) skipped`));
			}
			if (plan.skipped.length > 0) {
				console.log(pc.dim(`  ─ ${plan.skipped.length} user-owned file(s) unchanged`));
			}
		} else if (plan.needsReview.length > 0 && ctx.isNonInteractive) {
			// Fail fast in non-interactive mode - don't silently skip
			logger.error(
				`Cannot complete sync: ${plan.needsReview.length} file(s) require interactive review`,
			);
			ctx.prompts.note(
				`The following files have local modifications:\n${plan.needsReview
					.slice(0, 5)
					.map((f) => `  • ${f.path}`)
					.join(
						"\n",
					)}${plan.needsReview.length > 5 ? `\n  ... and ${plan.needsReview.length - 5} more` : ""}\n\nOptions:\n  1. Run 'ck init --sync' without --yes for interactive merge\n  2. Use --force-overwrite to accept all upstream changes\n  3. Manually resolve conflicts before syncing`,
				"Sync Blocked",
			);
			return { ...ctx, cancelled: true };
		}

		// Mark sync complete - set cancelled to skip remaining normal phases
		ctx.prompts.outro("Config sync completed successfully");
		// Cast to any to set the extended sync property
		return { ...ctx, cancelled: true } as InitContext;
	} finally {
		await releaseLock();
	}
}

/**
 * Display sync plan summary
 */
function displaySyncPlan(plan: SyncPlan): void {
	console.log("");
	console.log(pc.bold("Sync Plan:"));
	console.log(pc.dim("─".repeat(40)));

	if (plan.autoUpdate.length > 0) {
		console.log(pc.green(`  ${plan.autoUpdate.length} file(s) will be auto-updated`));
		for (const file of plan.autoUpdate.slice(0, 5)) {
			console.log(pc.dim(`    • ${file.path}`));
		}
		if (plan.autoUpdate.length > 5) {
			console.log(pc.dim(`    ... and ${plan.autoUpdate.length - 5} more`));
		}
	}

	if (plan.needsReview.length > 0) {
		console.log(pc.yellow(`  ${plan.needsReview.length} file(s) need interactive review`));
		for (const file of plan.needsReview.slice(0, 5)) {
			console.log(pc.dim(`    • ${file.path}`));
		}
		if (plan.needsReview.length > 5) {
			console.log(pc.dim(`    ... and ${plan.needsReview.length - 5} more`));
		}
	}

	if (plan.skipped.length > 0) {
		console.log(pc.dim(`  ${plan.skipped.length} user-owned file(s) will be skipped`));
	}

	console.log(pc.dim("─".repeat(40)));
}

/**
 * Create backup of tracked files before sync
 */
async function createBackup(
	claudeDir: string,
	files: TrackedFile[],
	backupDir: string,
): Promise<void> {
	await mkdir(backupDir, { recursive: true });

	for (const file of files) {
		try {
			const sourcePath = await validateSyncPath(claudeDir, file.path);
			if (await pathExists(sourcePath)) {
				const targetPath = await validateSyncPath(backupDir, file.path);
				const targetDir = join(targetPath, "..");
				await mkdir(targetDir, { recursive: true });
				await copyFile(sourcePath, targetPath);
			}
		} catch (error) {
			const errCode = (error as NodeJS.ErrnoException).code;
			if (errCode === "ENOSPC") {
				throw new Error("Disk full: cannot create backup");
			}
			logger.warning(`Skipping invalid path during backup: ${file.path}`);
		}
	}
}
