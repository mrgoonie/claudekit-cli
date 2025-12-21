/**
 * File Processor
 *
 * Handles file ownership checking and processing for cleanup operations.
 */

import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { OwnershipCheckResult } from "@/domains/ui/ownership-display.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import type { FileOwnership, Metadata } from "@/types";
import { remove } from "fs-extra";
import type { CleanupOptions } from "./prefix-utils.js";

/**
 * Mutable result structure for accumulating cleanup results
 */
export interface CleanupAccumulator {
	results: OwnershipCheckResult[];
	deletedCount: number;
	preservedCount: number;
}

/**
 * Recursively scan directory and collect all file paths
 * @param dir Directory to scan
 * @returns Array of absolute file paths
 */
export async function scanDirectoryFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stats = await lstat(fullPath);

		if (stats.isSymbolicLink()) {
			continue; // Skip symlinks for security
		}

		if (stats.isDirectory()) {
			files.push(...(await scanDirectoryFiles(fullPath)));
		} else if (stats.isFile()) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Process a single file based on ownership and options
 */
export async function processFileOwnership(
	file: string,
	relativePath: string,
	metadata: Metadata,
	claudeDir: string,
	options: CleanupOptions,
	accumulator: CleanupAccumulator,
): Promise<boolean> {
	const { dryRun = false, forceOverwrite = false } = options;
	const ownershipResult = await OwnershipChecker.checkOwnership(file, metadata, claudeDir);

	if (ownershipResult.ownership === "ck" && ownershipResult.exists) {
		// CK-owned pristine file -> can be deleted
		accumulator.results.push({
			path: relativePath,
			ownership: "ck",
			action: "delete",
		});

		if (!dryRun) {
			await remove(file);
			logger.verbose(`Deleted CK file: ${relativePath}`);
		}
		accumulator.deletedCount++;
		return true; // Can delete
	}

	if (ownershipResult.ownership === "ck-modified") {
		// Modified file - check forceOverwrite
		if (forceOverwrite) {
			accumulator.results.push({
				path: relativePath,
				ownership: "ck-modified",
				action: "delete",
				reason: "force overwrite",
			});

			if (!dryRun) {
				await remove(file);
				logger.verbose(`Force-deleted modified file: ${relativePath}`);
			}
			accumulator.deletedCount++;
			return true; // Can delete
		}

		accumulator.results.push({
			path: relativePath,
			ownership: "ck-modified",
			action: "preserve",
			reason: "modified by user",
		});
		accumulator.preservedCount++;
		logger.verbose(`Preserved modified file: ${relativePath}`);
		return false; // Cannot delete
	}

	// User-owned file
	if (forceOverwrite) {
		accumulator.results.push({
			path: relativePath,
			ownership: "user",
			action: "delete",
			reason: "force overwrite",
		});

		if (!dryRun) {
			await remove(file);
			logger.verbose(`Force-deleted user file: ${relativePath}`);
		}
		accumulator.deletedCount++;
		return true; // Can delete
	}

	accumulator.results.push({
		path: relativePath,
		ownership: "user",
		action: "preserve",
		reason: "user-created",
	});
	accumulator.preservedCount++;
	logger.verbose(`Preserved user file: ${relativePath}`);
	return false; // Cannot delete
}

/**
 * Add symlink skip result to accumulator
 */
export function addSymlinkSkip(entry: string, accumulator: CleanupAccumulator): void {
	logger.warning(`Skipping symlink: ${entry}`);
	accumulator.results.push({
		path: entry,
		ownership: "user" as FileOwnership,
		action: "skip",
		reason: "symlink (security)",
	});
	accumulator.preservedCount++;
}

/**
 * Log cleanup summary
 */
export function logCleanupSummary(
	deletedCount: number,
	preservedCount: number,
	dryRun: boolean,
	results: OwnershipCheckResult[],
): void {
	if (dryRun) {
		logger.info(`DRY RUN complete: would delete ${deletedCount}, preserve ${preservedCount}`);
	} else {
		logger.success(`Cleanup complete: deleted ${deletedCount}, preserved ${preservedCount}`);
	}

	if (preservedCount > 0 && !dryRun) {
		const preserved = results.filter((r) => r.action === "preserve");
		logger.info("Preserved files:");
		preserved.slice(0, 5).forEach((r) => logger.info(`  - ${r.path} (${r.reason})`));
		if (preserved.length > 5) {
			logger.info(`  ... and ${preserved.length - 5} more`);
		}
	}
}
