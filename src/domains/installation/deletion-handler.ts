/**
 * Deletion handler for cleaning up archived/deprecated files during installation.
 * Reads `deletions` array from source kit metadata and removes listed paths.
 * Supports glob patterns (e.g., "commands/code/**") via picomatch.
 */
import { existsSync, lstatSync, readdirSync, rmSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import type { ClaudeKitMetadata, KitType, Metadata, TrackedFile } from "@/types";
import { pathExists, readFile, writeFile } from "fs-extra";
import picomatch from "picomatch";

/**
 * Result of deletion operation
 */
export interface DeletionResult {
	deletedPaths: string[];
	preservedPaths: string[];
	errors: string[];
}

/**
 * Find a file in user's metadata by path
 */
function findFileInMetadata(metadata: Metadata | null, path: string): TrackedFile | null {
	if (!metadata) return null;

	// Check multi-kit format
	if (metadata.kits) {
		for (const kitMeta of Object.values(metadata.kits)) {
			if (kitMeta?.files) {
				const found = kitMeta.files.find((f) => f.path === path);
				if (found) return found;
			}
		}
	}

	// Check legacy format
	if (metadata.files) {
		const found = metadata.files.find((f) => f.path === path);
		if (found) return found;
	}

	return null;
}

/**
 * Check if a path should be deleted based on ownership.
 * Returns true if path can be deleted (ck, ck-modified, or not tracked).
 * Returns false only if ownership is "user".
 */
function shouldDeletePath(path: string, metadata: Metadata | null): boolean {
	const tracked = findFileInMetadata(metadata, path);

	// Not tracked = safe to delete (was installed by CK but not in metadata)
	if (!tracked) return true;

	// Only preserve explicitly user-owned files
	return tracked.ownership !== "user";
}

/**
 * Check if a pattern contains glob characters.
 */
function isGlobPattern(pattern: string): boolean {
	return pattern.includes("*") || pattern.includes("?") || pattern.includes("{");
}

/**
 * Recursively collect all files in a directory (relative paths).
 */
function collectFilesRecursively(dir: string, baseDir: string): string[] {
	const results: string[] = [];
	if (!existsSync(dir)) return results;

	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relativePath = relative(baseDir, fullPath);
			if (entry.isDirectory()) {
				results.push(...collectFilesRecursively(fullPath, baseDir));
			} else {
				results.push(relativePath);
			}
		}
	} catch {
		// Permission or read errors - skip
	}
	return results;
}

/**
 * Expand glob patterns to actual file paths.
 * Returns array of concrete paths that match the patterns.
 */
function expandGlobPatterns(patterns: string[], claudeDir: string): string[] {
	const expanded: string[] = [];
	const allFiles = collectFilesRecursively(claudeDir, claudeDir);

	for (const pattern of patterns) {
		if (isGlobPattern(pattern)) {
			const matcher = picomatch(pattern);
			const matches = allFiles.filter((file) => matcher(file));
			expanded.push(...matches);
			if (matches.length > 0) {
				logger.debug(`Pattern "${pattern}" matched ${matches.length} files`);
			}
		} else {
			// Literal path - add as-is
			expanded.push(pattern);
		}
	}

	// Deduplicate
	return [...new Set(expanded)];
}

/**
 * Maximum iterations for empty directory cleanup to prevent infinite loops.
 * 50 levels is more than enough for any reasonable directory structure.
 */
const MAX_CLEANUP_ITERATIONS = 50;

/**
 * Remove empty parent directories up to claudeDir.
 * Uses path normalization to prevent symlink-based traversal.
 */
function cleanupEmptyDirectories(filePath: string, claudeDir: string): void {
	const normalizedClaudeDir = resolve(claudeDir);
	let currentDir = resolve(dirname(filePath));
	let iterations = 0;

	while (
		currentDir !== normalizedClaudeDir &&
		currentDir.startsWith(normalizedClaudeDir) &&
		iterations < MAX_CLEANUP_ITERATIONS
	) {
		iterations++;
		try {
			const entries = readdirSync(currentDir);
			if (entries.length === 0) {
				rmdirSync(currentDir);
				logger.debug(`Removed empty directory: ${currentDir}`);
				currentDir = resolve(dirname(currentDir));
			} else {
				break;
			}
		} catch {
			// ENOTEMPTY race condition or permission errors
			break;
		}
	}
}

/**
 * Delete a file or directory at the given path.
 * Validates path is within claudeDir to prevent traversal.
 */
function deletePath(fullPath: string, claudeDir: string): void {
	// Safety: validate path is within claudeDir
	const normalizedPath = resolve(fullPath);
	const normalizedClaudeDir = resolve(claudeDir);

	if (
		!normalizedPath.startsWith(`${normalizedClaudeDir}${sep}`) &&
		normalizedPath !== normalizedClaudeDir
	) {
		throw new Error(`Path traversal detected: ${fullPath}`);
	}

	try {
		const stat = lstatSync(fullPath);
		if (stat.isDirectory()) {
			rmSync(fullPath, { recursive: true, force: true });
		} else {
			unlinkSync(fullPath);
			// Cleanup empty parent directories after file deletion
			cleanupEmptyDirectories(fullPath, claudeDir);
		}
	} catch (error) {
		throw new Error(
			`Failed to delete ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Update user's metadata.json to remove deleted file entries.
 */
async function updateMetadataAfterDeletion(
	claudeDir: string,
	deletedPaths: string[],
): Promise<void> {
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) {
		return;
	}

	let content: string;
	try {
		content = await readFile(metadataPath, "utf-8");
	} catch {
		logger.debug("Failed to read metadata.json for cleanup");
		return;
	}

	let metadata: Metadata;
	try {
		metadata = JSON.parse(content);
	} catch {
		logger.debug("Failed to parse metadata.json for cleanup");
		return;
	}

	const deletedSet = new Set(deletedPaths);

	// Also match directory deletions (if "commands/old" deleted, remove "commands/old/file.md")
	const isDeletedOrInDeletedDir = (path: string): boolean => {
		if (deletedSet.has(path)) return true;
		for (const deleted of deletedPaths) {
			if (path.startsWith(`${deleted}/`)) return true;
		}
		return false;
	};

	// Update each kit's files array
	if (metadata.kits) {
		for (const kitName of Object.keys(metadata.kits)) {
			const kit = metadata.kits[kitName as KitType];
			if (kit?.files) {
				kit.files = kit.files.filter((f) => !isDeletedOrInDeletedDir(f.path));
			}
		}
	}

	// Update legacy files array if present
	if (metadata.files) {
		metadata.files = metadata.files.filter((f) => !isDeletedOrInDeletedDir(f.path));
	}

	try {
		await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
		logger.debug(`Updated metadata.json, removed ${deletedPaths.length} entries`);
	} catch {
		logger.debug("Failed to write updated metadata.json");
	}
}

/**
 * Handle deletions from source kit metadata.
 * Removes deprecated/archived files from user's .claude directory.
 *
 * @param sourceMetadata - Kit's metadata.json with deletions array
 * @param claudeDir - Path to user's .claude directory
 * @returns Deletion result with lists of deleted, preserved, and errored paths
 */
export async function handleDeletions(
	sourceMetadata: ClaudeKitMetadata,
	claudeDir: string,
): Promise<DeletionResult> {
	const deletionPatterns = sourceMetadata.deletions || [];

	if (deletionPatterns.length === 0) {
		return { deletedPaths: [], preservedPaths: [], errors: [] };
	}

	// Expand glob patterns to concrete file paths
	const deletions = expandGlobPatterns(deletionPatterns, claudeDir);

	const userMetadata = await readManifest(claudeDir);
	const result: DeletionResult = { deletedPaths: [], preservedPaths: [], errors: [] };

	for (const path of deletions) {
		const fullPath = join(claudeDir, path);

		// Safety: validate path is within claudeDir (prevent traversal)
		const normalizedPath = resolve(fullPath);
		const normalizedClaudeDir = resolve(claudeDir);

		if (!normalizedPath.startsWith(`${normalizedClaudeDir}${sep}`)) {
			logger.warning(`Skipping invalid path: ${path}`);
			result.errors.push(path);
			continue;
		}

		// Check ownership - preserve user files
		if (!shouldDeletePath(path, userMetadata)) {
			result.preservedPaths.push(path);
			logger.verbose(`Preserved user file: ${path}`);
			continue;
		}

		// Delete if exists
		if (existsSync(fullPath)) {
			try {
				deletePath(fullPath, claudeDir);
				result.deletedPaths.push(path);
				logger.verbose(`Deleted: ${path}`);
			} catch (error) {
				result.errors.push(path);
				logger.debug(`Failed to delete ${path}: ${error}`);
			}
		}
	}

	// Update metadata to remove deleted entries
	if (result.deletedPaths.length > 0) {
		await updateMetadataAfterDeletion(claudeDir, result.deletedPaths);
	}

	return result;
}
