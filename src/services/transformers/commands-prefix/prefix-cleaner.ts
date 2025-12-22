/**
 * Prefix Cleaner
 *
 * Ownership-aware cleanup of commands directory before applying prefix.
 * Only removes CK-owned pristine files, preserves user files.
 */

import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getAllTrackedFiles } from "@/domains/migration/metadata-migration.js";
import type { OwnershipCheckResult } from "@/domains/ui/ownership-display.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { logger } from "@/shared/logger.js";
import { pathExists, remove } from "fs-extra";
import {
	addSymlinkSkip,
	logCleanupSummary,
	processFileOwnership,
	scanDirectoryFiles,
} from "./file-processor.js";
import { type CleanupOptions, validatePath } from "./prefix-utils.js";

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
	/** Files checked and their ownership/action */
	results: OwnershipCheckResult[];
	/** Number of files deleted */
	deletedCount: number;
	/** Number of files preserved */
	preservedCount: number;
	/** Whether operation was dry-run */
	wasDryRun: boolean;
}

/**
 * Clean up existing commands directory before applying prefix
 * OWNERSHIP-AWARE: Only removes CK-owned pristine files, preserves user files
 *
 * @param targetDir - Target directory (resolvedDir from update command)
 * @param isGlobal - Whether using global mode (affects path structure)
 * @param options - Cleanup options (dryRun, forceOverwrite)
 * @returns CleanupResult with detailed information about what was/would be done
 */
export async function cleanupCommandsDirectory(
	targetDir: string,
	isGlobal: boolean,
	options: CleanupOptions = {},
): Promise<CleanupResult> {
	const { dryRun = false } = options;

	// Validate input to prevent security vulnerabilities
	validatePath(targetDir, "targetDir");

	// Determine paths based on mode
	const claudeDir = isGlobal ? targetDir : join(targetDir, ".claude");
	const commandsDir = join(claudeDir, "commands");

	// Initialize result accumulator
	const accumulator = {
		results: [] as OwnershipCheckResult[],
		deletedCount: 0,
		preservedCount: 0,
	};

	const result: CleanupResult = {
		results: accumulator.results,
		deletedCount: 0,
		preservedCount: 0,
		wasDryRun: dryRun,
	};

	// Check if commands directory exists
	if (!(await pathExists(commandsDir))) {
		logger.verbose(`Commands directory does not exist: ${commandsDir}`);
		return result;
	}

	if (dryRun) {
		logger.info("DRY RUN: Analyzing ownership (no changes will be made)...");
	} else {
		logger.info("Checking ownership before cleanup...");
	}

	// Load metadata for ownership verification
	const metadata = await ManifestWriter.readManifest(claudeDir);
	const allTrackedFiles = metadata ? getAllTrackedFiles(metadata) : [];

	if (!metadata || allTrackedFiles.length === 0) {
		logger.verbose("No ownership metadata found - skipping cleanup (legacy/fresh install)");
		logger.verbose("All existing files will be preserved as user-owned");
		return result;
	}

	// Scan commands directory
	const entries = await readdir(commandsDir);
	if (entries.length === 0) {
		logger.verbose("Commands directory is empty");
		return result;
	}

	// Process each entry
	for (const entry of entries) {
		const entryPath = join(commandsDir, entry);
		const stats = await lstat(entryPath);

		if (stats.isSymbolicLink()) {
			addSymlinkSkip(entry, accumulator);
			continue;
		}

		if (stats.isDirectory()) {
			await processDirectory(entryPath, entry, claudeDir, metadata, options, accumulator, dryRun);
		} else {
			const relativePath = `commands/${entry}`;
			await processFileOwnership(
				entryPath,
				relativePath,
				metadata,
				claudeDir,
				options,
				accumulator,
			);
		}
	}

	// Update result counts
	result.deletedCount = accumulator.deletedCount;
	result.preservedCount = accumulator.preservedCount;

	// Log summary
	logCleanupSummary(result.deletedCount, result.preservedCount, dryRun, result.results);

	return result;
}

/**
 * Process a directory recursively for cleanup
 */
async function processDirectory(
	entryPath: string,
	entry: string,
	claudeDir: string,
	metadata: import("@/types").Metadata,
	options: CleanupOptions,
	accumulator: { results: OwnershipCheckResult[]; deletedCount: number; preservedCount: number },
	dryRun: boolean,
): Promise<void> {
	const dirFiles = await scanDirectoryFiles(entryPath);
	let canDeleteDir = true;

	for (const file of dirFiles) {
		const relativePath = file.replace(`${claudeDir}/`, "").replace(/\\/g, "/");
		const canDelete = await processFileOwnership(
			file,
			relativePath,
			metadata,
			claudeDir,
			options,
			accumulator,
		);
		if (!canDelete) {
			canDeleteDir = false;
		}
	}

	// Only remove empty directory if all files were deleted
	if (canDeleteDir && !dryRun) {
		await remove(entryPath);
		logger.verbose(`Removed directory: ${entry}`);
	}
}
