/**
 * Folder Renamer
 *
 * Handles directory renaming operations for folder path transformation
 */

import { rename } from "node:fs/promises";
import { join, relative } from "node:path";
import { logger } from "@/shared/logger.js";
import { DEFAULT_FOLDERS, type FoldersConfig } from "@/types";
import { pathExists } from "fs-extra";
import type { FolderTransformOptions } from "./path-replacer.js";

/**
 * Collect directories to rename based on folder configuration
 */
export async function collectDirsToRename(
	extractDir: string,
	folders: Required<FoldersConfig>,
): Promise<Array<{ from: string; to: string }>> {
	const dirsToRename: Array<{ from: string; to: string }> = [];

	if (folders.docs !== DEFAULT_FOLDERS.docs) {
		const docsPath = join(extractDir, DEFAULT_FOLDERS.docs);
		if (await pathExists(docsPath)) {
			dirsToRename.push({
				from: docsPath,
				to: join(extractDir, folders.docs),
			});
		}
		// Also check inside .claude directory
		const claudeDocsPath = join(extractDir, ".claude", DEFAULT_FOLDERS.docs);
		if (await pathExists(claudeDocsPath)) {
			dirsToRename.push({
				from: claudeDocsPath,
				to: join(extractDir, ".claude", folders.docs),
			});
		}
	}

	if (folders.plans !== DEFAULT_FOLDERS.plans) {
		const plansPath = join(extractDir, DEFAULT_FOLDERS.plans);
		if (await pathExists(plansPath)) {
			dirsToRename.push({
				from: plansPath,
				to: join(extractDir, folders.plans),
			});
		}
		// Also check inside .claude directory
		const claudePlansPath = join(extractDir, ".claude", DEFAULT_FOLDERS.plans);
		if (await pathExists(claudePlansPath)) {
			dirsToRename.push({
				from: claudePlansPath,
				to: join(extractDir, ".claude", folders.plans),
			});
		}
	}

	return dirsToRename;
}

/**
 * Rename directories and return count of successful renames
 */
export async function renameFolders(
	dirsToRename: Array<{ from: string; to: string }>,
	extractDir: string,
	options: FolderTransformOptions,
): Promise<number> {
	let foldersRenamed = 0;

	for (const { from, to } of dirsToRename) {
		if (options.dryRun) {
			logger.info(
				`[dry-run] Would rename: ${relative(extractDir, from)} -> ${relative(extractDir, to)}`,
			);
		} else {
			try {
				await rename(from, to);
				logger.debug(`Renamed: ${relative(extractDir, from)} -> ${relative(extractDir, to)}`);
				foldersRenamed++;
			} catch (error) {
				logger.warning(
					`Failed to rename ${from}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}
	}

	return foldersRenamed;
}
