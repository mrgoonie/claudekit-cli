/**
 * Config sync detection and execution phase
 * Handles --sync flag logic: version checking, diff detection, and merge orchestration
 */

import { copyFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	ConfigVersionChecker,
	MergeUI,
	SyncEngine,
	displayConfigUpdateNotification,
	filterDeletionPaths,
	validateSyncPath,
} from "@/domains/sync/index.js";
import type { SyncPlan } from "@/domains/sync/types.js";
import { CCPluginSupportError } from "@/services/cc-version-checker.js";
import { readKitManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { ClaudeKitMetadata, TrackedFile } from "@/types";
import { pathExists } from "fs-extra";
import pc from "picocolors";
import type { InitContext, SyncContext } from "../types.js";
import { isSyncContext } from "../types.js";

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

	// Validate manifest structure
	if (typeof kitMetadata.version !== "string" || !kitMetadata.version) {
		logger.error("Cannot sync: invalid metadata (missing version)");
		return { ...ctx, cancelled: true };
	}

	if (!Array.isArray(kitMetadata.files)) {
		logger.error("Cannot sync: invalid metadata (missing files array)");
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

/** Default lock timeout in ms */
const DEFAULT_LOCK_TIMEOUT_MS = 30000;
/** Minimum lock timeout (5 seconds) */
const MIN_LOCK_TIMEOUT_MS = 5000;
/** Maximum lock timeout (5 minutes) */
const MAX_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Get lock timeout from env var or use default
 * Configurable via CK_SYNC_LOCK_TIMEOUT env var (in seconds)
 */
function getLockTimeout(): number {
	const envValue = process.env.CK_SYNC_LOCK_TIMEOUT;
	if (!envValue) return DEFAULT_LOCK_TIMEOUT_MS;

	const parsed = Number.parseInt(envValue, 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		logger.warning(`Invalid CK_SYNC_LOCK_TIMEOUT "${envValue}", using default (30s)`);
		return DEFAULT_LOCK_TIMEOUT_MS;
	}

	const timeoutMs = parsed * 1000;
	if (timeoutMs < MIN_LOCK_TIMEOUT_MS) {
		logger.warning(`CK_SYNC_LOCK_TIMEOUT too low (${parsed}s), using minimum (5s)`);
		return MIN_LOCK_TIMEOUT_MS;
	}
	if (timeoutMs > MAX_LOCK_TIMEOUT_MS) {
		logger.warning(`CK_SYNC_LOCK_TIMEOUT too high (${parsed}s), using maximum (300s)`);
		return MAX_LOCK_TIMEOUT_MS;
	}
	return timeoutMs;
}

/** Stale lock threshold - locks older than this are considered orphaned */
const STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface SyncLockPayload {
	pid: number;
	startedAt: string;
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		// EPERM means process exists but current user cannot signal it.
		return code === "EPERM";
	}
}

async function readLockPayload(lockPath: string): Promise<SyncLockPayload | null> {
	try {
		const raw = await readFile(lockPath, "utf-8");
		const parsed = JSON.parse(raw) as Partial<SyncLockPayload>;
		if (typeof parsed.pid === "number" && Number.isInteger(parsed.pid) && parsed.pid > 0) {
			return {
				pid: parsed.pid,
				startedAt:
					typeof parsed.startedAt === "string" && parsed.startedAt.length > 0
						? parsed.startedAt
						: "unknown",
			};
		}
	} catch {
		// Best-effort metadata; stale checks can still use mtime.
	}
	return null;
}

/**
 * Acquire exclusive lock for sync operations
 * Includes stale lock detection for orphaned locks
 * @returns Release function
 */
async function acquireSyncLock(global: boolean): Promise<() => Promise<void>> {
	const cacheDir = PathResolver.getCacheDir(global);
	const lockPath = join(cacheDir, ".sync-lock");
	const startTime = Date.now();
	const lockTimeout = getLockTimeout();

	// Ensure cache directory exists before trying to create lock
	await mkdir(dirname(lockPath), { recursive: true });

	while (Date.now() - startTime < lockTimeout) {
		try {
			// Exclusive create - fails if file exists
			const handle = await open(lockPath, "wx");
			await handle.writeFile(
				JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
				"utf-8",
			);

			return async () => {
				try {
					await handle.close();
				} catch {
					// Best effort; still try lock file cleanup
				}
				await unlink(lockPath).catch(() => {}); // Best effort cleanup
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EEXIST") {
				// Check if lock is stale (orphaned from crashed process)
				try {
					const lockStat = await stat(lockPath);
					const lockAge = Math.abs(Date.now() - lockStat.mtimeMs);
					const lockOwner = await readLockPayload(lockPath);

					if (lockOwner?.pid === process.pid) {
						throw new Error("Sync lock is already held by current process");
					}

					const ownerAlive = lockOwner?.pid ? isProcessAlive(lockOwner.pid) : null;

					if (lockAge > STALE_LOCK_THRESHOLD_MS && ownerAlive !== true) {
						logger.warning(
							`Removing stale sync lock (age: ${Math.round(lockAge / 1000)}s${lockOwner?.pid ? `, pid=${lockOwner.pid}` : ""})`,
						);
						await unlink(lockPath).catch(() => {});
						continue; // Retry immediately after removing stale lock
					}

					if (lockAge > STALE_LOCK_THRESHOLD_MS && ownerAlive === true) {
						logger.debug(
							`Sync lock older than threshold but owner pid=${lockOwner?.pid} still alive; waiting`,
						);
					}
				} catch (statError) {
					if (
						statError instanceof Error &&
						statError.message.includes("already held by current process")
					) {
						throw statError;
					}
					// Lock was deleted between EEXIST and stat (race condition)
					// This is fine - retry immediately to acquire it
					if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
						continue; // Retry immediately - lock was released
					}
					// Other stat errors (EACCES, etc.) - log and retry with delay
					logger.debug(`Lock stat failed: ${statError}`);
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
	// Skip if not in sync mode - use type guard for proper narrowing
	if (!isSyncContext(ctx)) {
		return ctx;
	}

	// TypeScript now knows ctx is SyncContext with all required fields
	if (!ctx.extractDir || !ctx.claudeDir) {
		logger.error("Sync merge failed: missing paths");
		return { ...ctx, cancelled: true };
	}

	// Acquire lock
	const releaseLock = await acquireSyncLock(ctx.options.global);

	try {
		const trackedFiles = ctx.syncTrackedFiles;
		const upstreamDir = ctx.options.global ? join(ctx.extractDir, ".claude") : ctx.extractDir;

		// Load source metadata to get deletions array.
		let deletions: string[] = [];
		try {
			const sourceMetadataPath = join(upstreamDir, "metadata.json");
			if (await pathExists(sourceMetadataPath)) {
				const content = await readFile(sourceMetadataPath, "utf-8");
				const sourceMetadata = JSON.parse(content) as ClaudeKitMetadata;
				deletions = sourceMetadata.deletions || [];
			}
		} catch (error) {
			logger.debug(`Failed to load source metadata for deletion filtering: ${error}`);
		}

		const { categorizeDeletions, handleDeletions } = await import(
			"@/domains/installation/deletion-handler.js"
		);
		const categorizedDeletions = categorizeDeletions(deletions);

		// Filter tracked files to exclude deletion paths.
		const filteredTrackedFiles = filterDeletionPaths(trackedFiles, deletions);
		if (deletions.length > 0) {
			const filtered = trackedFiles.length - filteredTrackedFiles.length;
			logger.debug(`Filtered ${filtered} files matching ${deletions.length} deletion patterns`);
		}

		logger.info("Analyzing file changes...");
		const plan = await SyncEngine.createSyncPlan(filteredTrackedFiles, ctx.claudeDir, upstreamDir);
		const forceOverwriteNonInteractive = ctx.isNonInteractive && ctx.options.forceOverwrite;
		const autoUpdateQueue = forceOverwriteNonInteractive
			? dedupeTrackedFiles([...plan.autoUpdate, ...plan.needsReview])
			: plan.autoUpdate;
		const reviewQueue = forceOverwriteNonInteractive ? [] : plan.needsReview;

		displaySyncPlan(plan);

		if (
			autoUpdateQueue.length === 0 &&
			reviewQueue.length === 0 &&
			categorizedDeletions.immediate.length === 0 &&
			categorizedDeletions.deferred.length === 0
		) {
			ctx.prompts.note("All files are up to date or user-owned.", "No Changes Needed");
		}

		// Fail fast in non-interactive mode before any write operation.
		if (reviewQueue.length > 0 && ctx.isNonInteractive) {
			logger.error(
				`Cannot complete sync: ${reviewQueue.length} file(s) require interactive review`,
			);
			ctx.prompts.note(
				`The following files have local modifications:\n${reviewQueue
					.slice(0, 5)
					.map((f) => `  • ${f.path}`)
					.join(
						"\n",
					)}${reviewQueue.length > 5 ? `\n  ... and ${reviewQueue.length - 5} more` : ""}\n\nOptions:\n  1. Run 'ck init --sync' without --yes for interactive merge\n  2. Use --force-overwrite to accept all upstream changes\n  3. Manually resolve conflicts before syncing`,
				"Sync Blocked",
			);
			return { ...ctx, cancelled: true };
		}

		if (forceOverwriteNonInteractive && plan.needsReview.length > 0) {
			logger.info(
				`--force-overwrite enabled: auto-updating ${plan.needsReview.length} locally modified file(s)`,
			);
		}

		const willModifyFiles =
			autoUpdateQueue.length > 0 ||
			reviewQueue.length > 0 ||
			categorizedDeletions.immediate.length > 0 ||
			categorizedDeletions.deferred.length > 0;
		if (willModifyFiles) {
			const backupDir = PathResolver.getBackupDir();
			await createBackup(ctx.claudeDir, trackedFiles, backupDir);
			logger.success(`Backup created at ${pc.dim(backupDir)}`);
		}

		if (autoUpdateQueue.length > 0) {
			logger.info(`Auto-updating ${autoUpdateQueue.length} file(s)...`);
			let updateSuccess = 0;
			let updateFailed = 0;

			for (const file of autoUpdateQueue) {
				try {
					const sourcePath = await validateSyncPath(upstreamDir, file.path);
					const targetPath = await validateSyncPath(ctx.claudeDir, file.path);
					const targetDir = dirname(targetPath);

					try {
						await mkdir(targetDir, { recursive: true });
					} catch (mkdirError) {
						const errCode = (mkdirError as NodeJS.ErrnoException).code;
						if (errCode === "ENOSPC") {
							logger.error("Disk full: cannot complete sync operation");
							ctx.prompts.note("Your disk is full. Free up space and try again.", "Sync Failed");
							return { ...ctx, cancelled: true };
						}
						if (errCode === "EROFS" || errCode === "EACCES" || errCode === "EPERM") {
							logger.warning(`Cannot create directory ${file.path}: ${errCode}`);
							updateFailed++;
							continue;
						}
						throw mkdirError;
					}

					await copyFile(sourcePath, targetPath);
					logger.debug(`Updated: ${file.path}`);
					updateSuccess++;
				} catch (error) {
					const errCode = (error as NodeJS.ErrnoException).code;
					const errMsg = error instanceof Error ? error.message : "Unknown error";

					if (errCode === "ENOSPC") {
						logger.error("Disk full: cannot complete sync operation");
						ctx.prompts.note("Your disk is full. Free up space and try again.", "Sync Failed");
						return { ...ctx, cancelled: true };
					}

					if (errCode === "EACCES" || errCode === "EPERM" || errCode === "EROFS") {
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
			if (updateSuccess === 0 && updateFailed > 0) {
				logger.warning("No files were updated due to write errors");
			}
		}

		if (reviewQueue.length > 0 && !ctx.isNonInteractive) {
			logger.info(`${reviewQueue.length} file(s) need interactive review...`);

			let totalApplied = 0;
			let totalRejected = 0;
			let skippedFiles = 0;

			for (const file of reviewQueue) {
				let currentPath: string;
				let upstreamPath: string;
				try {
					currentPath = await validateSyncPath(ctx.claudeDir, file.path);
					upstreamPath = await validateSyncPath(upstreamDir, file.path);
				} catch {
					logger.warning(`Skipping invalid path during review: ${file.path}`);
					skippedFiles++;
					continue;
				}

				const { content: currentContent, isBinary: currentBinary } =
					await SyncEngine.loadFileContent(currentPath);
				const { content: newContent, isBinary: newBinary } =
					await SyncEngine.loadFileContent(upstreamPath);

				if (currentBinary || newBinary) {
					logger.warning(`Skipping binary file: ${file.path}`);
					skippedFiles++;
					continue;
				}

				const hunks = SyncEngine.generateHunks(currentContent, newContent, file.path);
				if (hunks.length === 0) {
					logger.debug(`No changes in: ${file.path}`);
					continue;
				}

				const result = await MergeUI.mergeFile(file.path, currentContent, newContent, hunks);
				if (result === "skipped") {
					MergeUI.displaySkipped(file.path);
					skippedFiles++;
					continue;
				}

				try {
					const tempPath = `${currentPath}.tmp.${Date.now()}`;
					try {
						await writeFile(tempPath, result.result, "utf-8");
						await rename(tempPath, currentPath);
					} catch (atomicError) {
						await unlink(tempPath).catch(() => {});
						throw atomicError;
					}
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

			console.log("");
			console.log(pc.bold("Sync Summary:"));
			console.log(pc.dim("─".repeat(40)));
			if (autoUpdateQueue.length > 0) {
				console.log(pc.green(`  ✓ ${autoUpdateQueue.length} file(s) auto-updated`));
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
		}

		if (categorizedDeletions.immediate.length > 0) {
			try {
				const deletionResult = await handleDeletions(
					{ deletions: categorizedDeletions.immediate },
					ctx.claudeDir,
				);
				if (deletionResult.deletedPaths.length > 0) {
					logger.info(`Removed ${deletionResult.deletedPaths.length} deprecated file(s)`);
				}
				if (deletionResult.preservedPaths.length > 0) {
					logger.verbose(`Preserved ${deletionResult.preservedPaths.length} user-owned file(s)`);
				}
			} catch (error) {
				logger.debug(`Immediate deletion cleanup failed during sync: ${error}`);
			}
		}

		let pluginSupported = false;
		let pluginVerified = false;
		try {
			const { requireCCPluginSupport } = await import("@/services/cc-version-checker.js");
			await requireCCPluginSupport();
			pluginSupported = true;
		} catch (error) {
			if (error instanceof CCPluginSupportError) {
				logger.info(`Plugin install skipped during sync: ${error.message}`);
				if (error.code === "cc_version_too_old") {
					logger.info(
						"Upgrade Claude Code, then re-run: ck init --sync (plugin migration requires >= 1.0.33)",
					);
				}
				if (error.code === "cc_not_found") {
					logger.info("Install Claude Code CLI to enable /ck:* plugin skills");
				}
			} else {
				logger.debug(
					`Plugin version check failed during sync: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}

		if (pluginSupported && ctx.extractDir) {
			try {
				const { handlePluginInstall } = await import("@/services/plugin-installer.js");
				const pluginResult = await handlePluginInstall(ctx.extractDir);
				pluginVerified = pluginResult.verified;
				if (pluginResult.error) {
					logger.debug(`Plugin install issue: ${pluginResult.error}`);
				}
			} catch (error) {
				logger.debug(
					`Plugin install skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}

		if (ctx.claudeDir && ctx.kitType) {
			try {
				const { updateKitPluginState } = await import("@/domains/migration/metadata-migration.js");
				await updateKitPluginState(ctx.claudeDir, ctx.kitType, {
					pluginInstalled: pluginVerified,
					pluginInstalledAt: new Date().toISOString(),
					pluginVersion: ctx.selectedVersion || ctx.syncLatestVersion || "unknown",
				});
			} catch {
				// Non-fatal: metadata tracking is best-effort
			}
		}

		if (categorizedDeletions.deferred.length > 0) {
			if (pluginVerified) {
				try {
					const { migrateUserSkills } = await import("@/services/skill-migration-merger.js");
					const migration = await migrateUserSkills(ctx.claudeDir, pluginVerified);

					if (!migration.canDelete) {
						logger.warning(
							"Skill migration metadata unavailable during sync — preserving existing skills",
						);
					} else {
						const preservedDirs = new Set(migration.preserved.map(normalizeSkillDir));
						const safeDeletions = categorizedDeletions.deferred.filter((path) => {
							const skillDir = extractSkillDirFromDeletionPath(path);
							return !skillDir || !preservedDirs.has(normalizeSkillDir(skillDir));
						});

						if (safeDeletions.length > 0) {
							const deferredResult = await handleDeletions(
								{ deletions: safeDeletions },
								ctx.claudeDir,
							);
							if (deferredResult.deletedPaths.length > 0) {
								logger.info(
									`Removed ${deferredResult.deletedPaths.length} old skill file(s) during sync`,
								);
							}
						}
					}
				} catch (error) {
					logger.debug(`Deferred skill cleanup failed during sync: ${error}`);
				}
			} else {
				logger.info("Plugin not verified during sync — keeping existing skills as fallback");
			}
		}

		ctx.prompts.outro("Config sync completed successfully");
		return { ...ctx, cancelled: true } as InitContext;
	} finally {
		try {
			await releaseLock();
		} catch (error) {
			logger.debug(`Failed to release sync lock: ${error}`);
		}
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
				const targetDir = dirname(targetPath);
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

function dedupeTrackedFiles(files: TrackedFile[]): TrackedFile[] {
	const deduped = new Map<string, TrackedFile>();
	for (const file of files) {
		deduped.set(file.path, file);
	}
	return [...deduped.values()];
}

function normalizeSkillDir(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function extractSkillDirFromDeletionPath(path: string): string | null {
	const normalized = normalizeSkillDir(path);
	const parts = normalized.split("/").filter(Boolean);
	if (parts.length < 2 || parts[0] !== "skills") {
		return null;
	}
	return `skills/${parts[1]}`;
}
