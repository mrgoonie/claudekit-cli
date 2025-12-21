/**
 * Folder Path Transformer - Facade Module
 *
 * Transforms default folder names (docs/, plans/) to custom names during
 * ClaudeKit installation. Handles both directory renaming and path reference
 * updates in markdown and config files.
 *
 * This file re-exports all public APIs from the modular implementation.
 */

import { logger } from "@/shared/logger.js";
import { DEFAULT_FOLDERS, type FoldersConfig } from "@/types";
import { collectDirsToRename, renameFolders } from "./folder-transform/folder-renamer.js";
import {
	type FolderTransformOptions,
	buildReplacementMap,
	compileReplacements,
	transformFileContents,
} from "./folder-transform/path-replacer.js";

// Re-export types and functions
export type { FolderTransformOptions } from "./folder-transform/path-replacer.js";
export {
	validateFolderOptions,
	validateFolderName,
} from "./folder-transform/transform-validator.js";

export interface FolderTransformResult {
	foldersRenamed: number;
	filesTransformed: number;
	totalReferences: number;
}

/**
 * Transform folder names and references in extracted files
 */
export async function transformFolderPaths(
	extractDir: string,
	folders: Required<FoldersConfig>,
	options: FolderTransformOptions = {},
): Promise<FolderTransformResult> {
	const result: FolderTransformResult = {
		foldersRenamed: 0,
		filesTransformed: 0,
		totalReferences: 0,
	};

	// Check if any transformation is needed
	const needsTransform =
		folders.docs !== DEFAULT_FOLDERS.docs || folders.plans !== DEFAULT_FOLDERS.plans;

	if (!needsTransform) {
		logger.debug("No folder transformation needed (using defaults)");
		return result;
	}

	logger.info("Transforming folder paths...");

	// Build replacement map
	const replacements = buildReplacementMap(folders);

	// Step 1: Collect and rename directories
	const dirsToRename = await collectDirsToRename(extractDir, folders);
	result.foldersRenamed = await renameFolders(dirsToRename, extractDir, options);

	// Step 2: Transform file contents
	// Pre-compile regex patterns once for efficiency (avoid recreating per-file)
	const compiledReplacements = compileReplacements(replacements);

	const transformedFiles = await transformFileContents(extractDir, compiledReplacements, options);
	result.filesTransformed = transformedFiles.filesChanged;
	result.totalReferences = transformedFiles.replacementsCount;

	if (options.verbose) {
		logger.info(
			`Folder transformation complete: ${result.foldersRenamed} folders renamed, ` +
				`${result.filesTransformed} files updated, ${result.totalReferences} references changed`,
		);
	}

	return result;
}
