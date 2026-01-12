import { existsSync, readdirSync, rmSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAllTrackedFiles } from "@/domains/migration/metadata-migration.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { KitType, Metadata, TrackedFile } from "@/types";
import { pathExists, readFile, writeFile } from "fs-extra";

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

/**
 * Analyze files for fresh installation based on ownership
 */
export async function analyzeFreshInstallation(claudeDir: string): Promise<FreshAnalysisResult> {
	const metadata = await readManifest(claudeDir);

	if (!metadata) {
		return {
			ckFiles: [],
			ckModifiedFiles: [],
			userFiles: [],
			hasMetadata: false,
		};
	}

	const allFiles = getAllTrackedFiles(metadata);

	if (allFiles.length === 0) {
		return {
			ckFiles: [],
			ckModifiedFiles: [],
			userFiles: [],
			hasMetadata: false,
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
	};
}

/**
 * Remove empty parent directories up to claudeDir
 */
function cleanupEmptyDirectories(filePath: string, claudeDir: string): void {
	let currentDir = dirname(filePath);

	while (currentDir !== claudeDir && currentDir.startsWith(claudeDir)) {
		try {
			const entries = readdirSync(currentDir);
			if (entries.length === 0) {
				rmdirSync(currentDir);
				logger.debug(`Removed empty directory: ${currentDir}`);
				currentDir = dirname(currentDir);
			} else {
				break;
			}
		} catch {
			break;
		}
	}
}

/**
 * Remove files by ownership tracking (smart removal)
 */
async function removeFilesByOwnership(
	claudeDir: string,
	analysis: FreshAnalysisResult,
	includeModified: boolean,
): Promise<FreshInstallResult> {
	const removedFiles: string[] = [];
	const preservedFiles: string[] = [];

	// Determine which files to remove
	const filesToRemove = includeModified
		? [...analysis.ckFiles, ...analysis.ckModifiedFiles]
		: analysis.ckFiles;

	const filesToPreserve = includeModified
		? analysis.userFiles
		: [...analysis.ckModifiedFiles, ...analysis.userFiles];

	// Remove CK-owned files
	for (const file of filesToRemove) {
		const fullPath = join(claudeDir, file.path);
		try {
			if (existsSync(fullPath)) {
				unlinkSync(fullPath);
				removedFiles.push(file.path);
				logger.debug(`Removed: ${file.path}`);

				// Cleanup empty parent directories
				cleanupEmptyDirectories(fullPath, claudeDir);
			}
		} catch (error) {
			logger.debug(`Failed to remove ${file.path}: ${error}`);
		}
	}

	// Track preserved files
	for (const file of filesToPreserve) {
		preservedFiles.push(file.path);
	}

	// Update metadata.json to remove tracking for deleted files
	await updateMetadataAfterFresh(claudeDir, removedFiles);

	return {
		success: true,
		removedCount: removedFiles.length,
		preservedCount: preservedFiles.length,
		removedFiles,
		preservedFiles,
	};
}

/**
 * Update metadata.json after fresh install to remove deleted file entries
 */
async function updateMetadataAfterFresh(claudeDir: string, removedFiles: string[]): Promise<void> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) {
		return;
	}

	try {
		const content = await readFile(metadataPath, "utf-8");
		const metadata: Metadata = JSON.parse(content);

		const removedSet = new Set(removedFiles);

		// Update each kit's files array
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

		await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
		logger.debug(`Updated metadata.json, removed ${removedFiles.length} file entries`);
	} catch (error) {
		logger.debug(`Failed to update metadata.json: ${error}`);
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

	// Start removal
	const spinner = createSpinner("Removing ClaudeKit files...").start();

	try {
		let result: FreshInstallResult;

		if (
			analysis.hasMetadata &&
			(analysis.ckFiles.length > 0 || analysis.ckModifiedFiles.length > 0)
		) {
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
		throw new Error(
			`Failed to remove files: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
