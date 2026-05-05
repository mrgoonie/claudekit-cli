import { existsSync, readdirSync, rmSync, rmdirSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { getAllTrackedFiles } from "@/domains/migration/metadata-migration.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import { cleanupOldDestructiveOperationBackups } from "@/services/file-operations/destructive-operation-backup-manager.js";
import {
	type DestructiveOperationBackup,
	createDestructiveOperationBackup,
	restoreDestructiveOperationBackup,
} from "@/services/file-operations/destructive-operation-backup.js";
import { acquireInstallationStateLock } from "@/services/file-operations/installation-state-lock.js";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { KitType, Metadata, TrackedFile } from "@/types";
import { pathExists, writeFile } from "fs-extra";

/**
 * The metadata manifest file name — managed exclusively by updateMetadataAfterFresh,
 * never deleted as a regular tracked file during the removal loop.
 */
const KIT_MANIFEST_FILE = "metadata.json";

/**
 * ClaudeKit-managed subdirectories (fallback when no metadata)
 */
const CLAUDEKIT_SUBDIRECTORIES = ["commands", "agents", "skills", "rules", "hooks"];

/**
 * Result of fresh installation analysis
 */
export interface FreshAnalysisResult {
	ckFiles: TrackedFile[]; // Files owned by CK (will be removed)
	ckModifiedFiles: TrackedFile[]; // CK files modified by user (need confirmation)
	userFiles: TrackedFile[]; // User-created files (will be preserved)
	hasMetadata: boolean;
	/** In-memory snapshot of the parsed metadata — used to avoid re-reading metadata.json
	 *  after tracked files (potentially including metadata.json itself) are deleted. */
	metadata: Metadata | null;
}

/**
 * Result of fresh installation
 */
export interface FreshInstallResult {
	success: boolean;
	removedCount: number;
	preservedCount: number;
	removedFiles: string[];
	preservedFiles: string[];
}

interface FreshBackupTargets {
	deletePaths: string[];
	mutatePaths: string[];
}

/**
 * Analyze files for fresh installation based on ownership.
 * Returns the parsed metadata in-memory so callers can write it back
 * without re-reading the file (which may be gone after the delete loop).
 */
export async function analyzeFreshInstallation(claudeDir: string): Promise<FreshAnalysisResult> {
	const metadata = await readManifest(claudeDir);

	if (!metadata) {
		return {
			ckFiles: [],
			ckModifiedFiles: [],
			userFiles: [],
			hasMetadata: false,
			metadata: null,
		};
	}

	const allFiles = getAllTrackedFiles(metadata);

	if (allFiles.length === 0) {
		return {
			ckFiles: [],
			ckModifiedFiles: [],
			userFiles: [],
			hasMetadata: false,
			metadata: null,
		};
	}

	const ckFiles: TrackedFile[] = [];
	const ckModifiedFiles: TrackedFile[] = [];
	const userFiles: TrackedFile[] = [];

	for (const file of allFiles) {
		switch (file.ownership) {
			case "ck":
				ckFiles.push(file);
				break;
			case "ck-modified":
				ckModifiedFiles.push(file);
				break;
			case "user":
				userFiles.push(file);
				break;
		}
	}

	return {
		ckFiles,
		ckModifiedFiles,
		userFiles,
		hasMetadata: true,
		metadata,
	};
}

/**
 * Remove empty parent directories up to claudeDir
 * Uses path normalization to prevent symlink-based traversal
 */
function cleanupEmptyDirectories(filePath: string, claudeDir: string): void {
	// Normalize paths to prevent symlink-based traversal
	const normalizedClaudeDir = resolve(claudeDir);
	let currentDir = resolve(dirname(filePath));

	while (currentDir !== normalizedClaudeDir && currentDir.startsWith(normalizedClaudeDir)) {
		try {
			const entries = readdirSync(currentDir);
			if (entries.length === 0) {
				rmdirSync(currentDir);
				logger.debug(`Removed empty directory: ${currentDir}`);
				currentDir = resolve(dirname(currentDir));
			} else {
				break;
			}
		} catch (error) {
			// Handle ENOTEMPTY race condition or permission errors
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.debug(`Could not remove directory ${currentDir}: ${errorMsg}`);
			break;
		}
	}
}

/**
 * Remove files by ownership tracking (smart removal).
 *
 * Defense-in-depth against the metadata.json self-tracking bug (#777):
 * 1. metadata.json is excluded from the delete loop — it is managed exclusively
 *    by updateMetadataAfterFresh.
 * 2. updateMetadataAfterFresh operates on the in-memory metadata snapshot captured
 *    by analyzeFreshInstallation, so it never re-reads metadata.json from disk.
 * 3. If metadata.json is absent at write time (race / prior partial run), it is
 *    recreated from the in-memory snapshot rather than throwing.
 */
async function removeFilesByOwnership(
	claudeDir: string,
	analysis: FreshAnalysisResult,
	includeModified: boolean,
): Promise<FreshInstallResult> {
	const removedFiles: string[] = [];
	const preservedFiles: string[] = [];

	// Determine which files to remove
	const allFilesToRemove = includeModified
		? [...analysis.ckFiles, ...analysis.ckModifiedFiles]
		: analysis.ckFiles;

	const filesToPreserve = includeModified
		? analysis.userFiles
		: [...analysis.ckModifiedFiles, ...analysis.userFiles];

	// Defense layer 2: exclude metadata.json from the delete loop.
	// It is managed solely by updateMetadataAfterFresh below.
	const filesToRemove = allFilesToRemove.filter((f) => f.path !== KIT_MANIFEST_FILE);
	const selfTrackedManifest = allFilesToRemove.some((f) => f.path === KIT_MANIFEST_FILE);
	if (selfTrackedManifest) {
		logger.debug(
			`${KIT_MANIFEST_FILE} was self-tracked; skipping from delete loop — will be rewritten by updateMetadataAfterFresh`,
		);
	}

	// Remove CK-owned files (metadata.json excluded above)
	for (const file of filesToRemove) {
		const fullPath = join(claudeDir, file.path);
		if (!existsSync(fullPath)) {
			continue;
		}

		try {
			unlinkSync(fullPath);
			removedFiles.push(file.path);
			logger.debug(`Removed: ${file.path}`);

			// Cleanup empty parent directories
			cleanupEmptyDirectories(fullPath, claudeDir);
		} catch (error) {
			throw new Error(
				`Failed to remove ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// Track preserved files
	for (const file of filesToPreserve) {
		preservedFiles.push(file.path);
	}

	// Update metadata.json using the in-memory snapshot (defense layer 1 + 3)
	if (analysis.metadata) {
		await updateMetadataAfterFresh(claudeDir, removedFiles, analysis.metadata);
	}

	return {
		success: true,
		removedCount: removedFiles.length,
		preservedCount: preservedFiles.length,
		removedFiles,
		preservedFiles,
	};
}

/**
 * Update metadata.json after fresh install to remove deleted file entries.
 *
 * Operates on the in-memory metadata snapshot from analyzeFreshInstallation to
 * avoid a second disk read — which would fail if metadata.json was self-tracked
 * and deleted during the removal loop.
 *
 * Defense layer 3: if metadata.json is absent on disk (race condition / partial
 * prior run), it is recreated from the in-memory snapshot with a warning instead
 * of throwing.
 *
 * Callers must already hold the installation-state lock for claudeDir.
 */
async function updateMetadataAfterFresh(
	claudeDir: string,
	removedFiles: string[],
	metadata: Metadata,
): Promise<void> {
	const metadataPath = join(claudeDir, KIT_MANIFEST_FILE);
	const removedSet = new Set(removedFiles);

	// Filter removed files out of the in-memory snapshot
	if (metadata.kits) {
		for (const kitName of Object.keys(metadata.kits)) {
			const kit = metadata.kits[kitName as KitType];
			if (kit?.files) {
				kit.files = kit.files.filter((f) => !removedSet.has(f.path));
			}
		}
	}

	// Update legacy files array if present
	if (metadata.files) {
		metadata.files = metadata.files.filter((f) => !removedSet.has(f.path));
	}

	// Defense layer 3: tolerate absence — recreate from in-memory snapshot
	if (!(await pathExists(metadataPath))) {
		logger.warning(
			`${KIT_MANIFEST_FILE} was absent at write time (self-tracked or race condition) — recreating from in-memory snapshot`,
		);
	}

	// Write updated metadata (create or overwrite)
	try {
		await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
		logger.debug(`Updated ${KIT_MANIFEST_FILE}, removed ${removedFiles.length} file entries`);
	} catch (writeError) {
		throw new Error(
			`Failed to write ${KIT_MANIFEST_FILE}: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
		);
	}
}

function getFreshBackupTargets(
	claudeDir: string,
	analysis: FreshAnalysisResult,
	includeModified: boolean,
): FreshBackupTargets {
	if (analysis.hasMetadata) {
		const filesToRemove = includeModified
			? [...analysis.ckFiles, ...analysis.ckModifiedFiles]
			: analysis.ckFiles;

		return {
			deletePaths: filesToRemove.map((file) => file.path),
			mutatePaths: filesToRemove.length > 0 ? ["metadata.json"] : [],
		};
	}

	const deletePaths = CLAUDEKIT_SUBDIRECTORIES.filter((subdir) =>
		existsSync(join(claudeDir, subdir)),
	);

	if (existsSync(join(claudeDir, "metadata.json"))) {
		deletePaths.push("metadata.json");
	}

	return {
		deletePaths,
		mutatePaths: [],
	};
}

async function restoreFreshBackup(backup: DestructiveOperationBackup): Promise<void> {
	const restoreSpinner = createSpinner("Restoring ClaudeKit files from recovery backup...").start();

	try {
		await restoreDestructiveOperationBackup(backup);
		restoreSpinner.succeed(`Restored previous state from ${backup.backupDir}`);
	} catch (error) {
		restoreSpinner.fail("Failed to restore ClaudeKit files from recovery backup");
		throw new Error(
			`Fresh install rollback failed: ${error instanceof Error ? error.message : "Unknown error"}. Recovery backup retained at ${backup.backupDir}`,
		);
	}
}

/**
 * Fallback: Remove entire ClaudeKit subdirectories (legacy behavior)
 */
async function removeSubdirectoriesFallback(claudeDir: string): Promise<FreshInstallResult> {
	const removedFiles: string[] = [];
	let removedDirCount = 0;

	for (const subdir of CLAUDEKIT_SUBDIRECTORIES) {
		const subdirPath = join(claudeDir, subdir);
		if (await pathExists(subdirPath)) {
			rmSync(subdirPath, { recursive: true, force: true });
			removedDirCount++;
			removedFiles.push(`${subdir}/ (entire directory)`);
			logger.debug(`Removed subdirectory: ${subdir}/`);
		}
	}

	// Also clear metadata.json when doing fallback
	const metadataPath = join(claudeDir, "metadata.json");
	if (await pathExists(metadataPath)) {
		unlinkSync(metadataPath);
		removedFiles.push("metadata.json");
	}

	return {
		success: true,
		removedCount: removedDirCount,
		preservedCount: 0,
		removedFiles,
		preservedFiles: [],
	};
}

/**
 * Handles fresh installation with ownership-aware file removal
 *
 * Smart behavior:
 * - If metadata.json exists with tracked files: Only remove CK-owned files, preserve user files
 * - If no metadata: Fall back to removing entire CK subdirectories
 *
 * @param claudeDir - Path to the .claude directory
 * @param prompts - PromptsManager instance for user confirmation
 * @returns Promise<boolean> - true if successful, false if cancelled
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

	// Analyze what will be removed
	const analysis = await analyzeFreshInstallation(claudeDir);

	// Prompt for confirmation with accurate information
	const confirmed = await prompts.promptFreshConfirmation(claudeDir, analysis);

	if (!confirmed) {
		logger.info("Fresh installation cancelled");
		return false;
	}

	const backupTargets = getFreshBackupTargets(claudeDir, analysis, true);
	let backup: DestructiveOperationBackup | null = null;
	let releaseInstallationLock: (() => Promise<void>) | null = null;

	try {
		releaseInstallationLock = await acquireInstallationStateLock(claudeDir);

		if (backupTargets.deletePaths.length > 0 || backupTargets.mutatePaths.length > 0) {
			const backupSpinner = createSpinner("Creating recovery backup...").start();

			try {
				backup = await createDestructiveOperationBackup({
					operation: "fresh-install",
					sourceRoot: claudeDir,
					deletePaths: backupTargets.deletePaths,
					mutatePaths: backupTargets.mutatePaths,
					scope: "claude",
				});
				await cleanupOldDestructiveOperationBackups(undefined, basename(backup.backupDir));
				backupSpinner.succeed(`Recovery backup saved to ${backup.backupDir}`);
			} catch (error) {
				backupSpinner.fail("Failed to create recovery backup");
				throw new Error(
					`Fresh install aborted before deletion: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}

		// Start removal
		const spinner = createSpinner("Removing ClaudeKit files...").start();

		try {
			let result: FreshInstallResult;

			if (analysis.hasMetadata) {
				// Smart removal: ownership-aware
				// For now, include ck-modified files in removal (they'll be reinstalled)
				result = await removeFilesByOwnership(claudeDir, analysis, true);

				spinner.succeed(
					`Removed ${result.removedCount} CK files, preserved ${result.preservedCount} user files`,
				);
			} else {
				// Fallback: remove entire directories (no metadata to guide us)
				result = await removeSubdirectoriesFallback(claudeDir);

				spinner.succeed(`Removed ${result.removedCount} ClaudeKit directories`);
			}

			// Log details in verbose mode
			if (result.preservedCount > 0) {
				logger.verbose(
					`Preserved user files: ${result.preservedFiles.slice(0, 5).join(", ")}${result.preservedFiles.length > 5 ? ` and ${result.preservedFiles.length - 5} more` : ""}`,
				);
			}

			return true;
		} catch (error) {
			spinner.fail("Failed to remove ClaudeKit files");
			if (backup) {
				await restoreFreshBackup(backup);
			}

			throw new Error(
				`Failed to remove files: ${error instanceof Error ? error.message : "Unknown error"}${backup ? `. Recovery backup retained at ${backup.backupDir}` : ""}`,
			);
		}
	} finally {
		if (releaseInstallationLock) {
			await releaseInstallationLock();
		}
	}
}
