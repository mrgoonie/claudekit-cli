/**
 * Deletion handler for cleaning up archived/deprecated files during installation.
 * Reads `deletions` array from source kit metadata and removes listed paths.
 * Supports glob patterns (e.g., "commands/code/**") via picomatch.
 */
import {
	existsSync,
	lstatSync,
	readdirSync,
	realpathSync,
	rmSync,
	rmdirSync,
	unlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { KitType, Metadata, TrackedFile } from "@/types";
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
	const normalizedPath = normalizeRelativePath(path);

	// Check multi-kit format
	if (metadata.kits) {
		for (const kitMeta of Object.values(metadata.kits)) {
			if (kitMeta?.files) {
				const found = kitMeta.files.find((f) => normalizeRelativePath(f.path) === normalizedPath);
				if (found) return found;
			}
		}
	}

	// Check legacy format
	if (metadata.files) {
		const found = metadata.files.find((f) => normalizeRelativePath(f.path) === normalizedPath);
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
				results.push(normalizeRelativePath(relativePath));
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
		const normalizedPattern = normalizeRelativePath(pattern);
		if (PathResolver.isGlobPattern(normalizedPattern)) {
			const matcher = picomatch(normalizedPattern);
			const matches = allFiles.filter((file) => matcher(file));
			expanded.push(...matches);
			if (matches.length > 0) {
				logger.debug(`Pattern "${normalizedPattern}" matched ${matches.length} files`);
			}
		} else {
			// Literal path - add as-is
			expanded.push(normalizedPattern);
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
 * Normalize a relative path to slash-separated form for cross-platform matching.
 */
function normalizeRelativePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "")
		.replace(/\/+/g, "/");
}

/**
 * True when candidate path is inside or equal to base path.
 */
function isWithinBase(candidatePath: string, basePath: string): boolean {
	return candidatePath === basePath || candidatePath.startsWith(`${basePath}${sep}`);
}

/**
 * Validate an existing deletion target against lexical and realpath-based escapes.
 * Allows deleting symlinks that reside inside base, but blocks symlinked traversal
 * where parent/target resolves outside base.
 */
function validateExistingDeletionTarget(fullPath: string, claudeDir: string): void {
	const normalizedPath = resolve(fullPath);
	const normalizedClaudeDir = resolve(claudeDir);

	if (!isWithinBase(normalizedPath, normalizedClaudeDir)) {
		throw new Error(`Path traversal detected: ${fullPath}`);
	}

	let realBase = normalizedClaudeDir;
	try {
		realBase = realpathSync(normalizedClaudeDir);
	} catch {
		// Fall back to lexical base if realpath fails unexpectedly.
	}

	// Parent directory must resolve within base (blocks intermediate symlink escapes).
	try {
		const realParent = realpathSync(dirname(fullPath));
		if (!isWithinBase(realParent, realBase)) {
			throw new Error(`Path escapes base via symlink parent: ${fullPath}`);
		}
	} catch (error) {
		throw new Error(`Failed to validate deletion parent for ${fullPath}: ${String(error)}`);
	}

	// If the target isn't itself a symlink, its realpath must be inside base.
	// For symlink files, deleting the link itself is safe once parent is validated.
	try {
		const stat = lstatSync(fullPath);
		if (!stat.isSymbolicLink()) {
			const realTarget = realpathSync(fullPath);
			if (!isWithinBase(realTarget, realBase)) {
				throw new Error(`Path escapes base via symlink target: ${fullPath}`);
			}
		}
	} catch (error) {
		throw new Error(`Failed to validate deletion target ${fullPath}: ${String(error)}`);
	}
}

/**
 * Delete a file or directory at the given path.
 * Validates path is within claudeDir to prevent traversal.
 */
function deletePath(fullPath: string, claudeDir: string): void {
	validateExistingDeletionTarget(fullPath, claudeDir);

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
 * Categorized deletions: immediate (commands, agents) vs deferred (skills).
 * Skills are deferred to Phase 8 so they're only deleted after plugin verification.
 */
export interface CategorizedDeletions {
	/** Safe to delete immediately: agents/*, commands/*, command-archive/** */
	immediate: string[];
	/** Deferred until plugin verification: skills/** */
	deferred: string[];
}

/**
 * Split deletion patterns into immediate and deferred categories.
 * Skills are deferred because they should only be deleted after plugin
 * installation is verified (prevents losing skills if plugin install fails).
 */
export function categorizeDeletions(deletions: string[]): CategorizedDeletions {
	const immediate: string[] = [];
	const deferred: string[] = [];

	for (const path of deletions) {
		if (path.startsWith("skills/") || path.startsWith("skills\\")) {
			deferred.push(path);
		} else {
			immediate.push(path);
		}
	}

	return { immediate, deferred };
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
	sourceMetadata: { deletions?: string[] },
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
		const normalizedRelativePath = normalizeRelativePath(path);
		const fullPath = join(claudeDir, normalizedRelativePath);

		// Safety: validate path is within claudeDir (prevent traversal)
		const normalizedResolvedPath = resolve(fullPath);
		const normalizedClaudeDir = resolve(claudeDir);

		if (!isWithinBase(normalizedResolvedPath, normalizedClaudeDir)) {
			logger.warning(`Skipping invalid path: ${normalizedRelativePath}`);
			result.errors.push(normalizedRelativePath);
			continue;
		}

		// Check ownership - preserve user files
		if (!shouldDeletePath(normalizedRelativePath, userMetadata)) {
			result.preservedPaths.push(normalizedRelativePath);
			logger.verbose(`Preserved user file: ${normalizedRelativePath}`);
			continue;
		}

		// Delete if exists
		if (existsSync(fullPath)) {
			try {
				deletePath(fullPath, claudeDir);
				result.deletedPaths.push(normalizedRelativePath);
				logger.verbose(`Deleted: ${normalizedRelativePath}`);
			} catch (error) {
				result.errors.push(normalizedRelativePath);
				logger.debug(`Failed to delete ${normalizedRelativePath}: ${error}`);
			}
		}
	}

	// Update metadata to remove deleted entries
	if (result.deletedPaths.length > 0) {
		await updateMetadataAfterDeletion(claudeDir, result.deletedPaths);
	}

	return result;
}
