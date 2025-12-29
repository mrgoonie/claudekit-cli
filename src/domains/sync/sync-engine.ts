/**
 * Sync engine - diff detection and hunk generation
 */
import { lstat, readFile, readlink, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative } from "node:path";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import type { TrackedFile } from "@/types";
import { applyPatch, structuredPatch } from "diff";
import type { FileHunk, SyncPlan } from "./types.js";

/** Max file size for sync operations (10MB) */
const MAX_SYNC_FILE_SIZE = 10 * 1024 * 1024;

/** Max symlink chain depth to prevent DoS */
const MAX_SYMLINK_DEPTH = 20;

/**
 * Validate symlink chain depth and ensure targets stay within base directory
 * @param path - Path to check
 * @param basePath - Base directory that symlinks must stay within
 * @param maxDepth - Maximum allowed depth
 * @throws Error if chain exceeds maxDepth or escapes base directory
 */
async function validateSymlinkChain(
	path: string,
	basePath: string,
	maxDepth = MAX_SYMLINK_DEPTH,
): Promise<void> {
	let current = path;
	let depth = 0;

	while (depth < maxDepth) {
		try {
			const stats = await lstat(current);
			if (!stats.isSymbolicLink()) break;

			const target = await readlink(current);
			// Resolve relative symlinks against current directory
			const resolvedTarget = isAbsolute(target) ? target : join(current, "..", target);
			const normalizedTarget = normalize(resolvedTarget);

			// Validate target stays within base directory
			const rel = relative(basePath, normalizedTarget);
			if (rel.startsWith("..") || isAbsolute(rel)) {
				throw new Error(`Symlink chain escapes base directory at depth ${depth}: ${path}`);
			}

			current = normalizedTarget;
			depth++;
		} catch (error) {
			// Re-throw our validation errors
			if (error instanceof Error && error.message.includes("Symlink chain")) {
				throw error;
			}
			// File doesn't exist or permission error - stop traversal
			break;
		}
	}

	if (depth >= maxDepth) {
		throw new Error(`Symlink chain too deep (>${maxDepth}): ${path}`);
	}
}

/**
 * Validate file path against directory traversal attacks
 * Resolves symlinks to prevent escape via symlink chains
 * @throws Error if path is malicious
 */
async function validateSyncPath(basePath: string, filePath: string): Promise<string> {
	// Reject empty paths
	if (!filePath || filePath.trim() === "") {
		throw new Error("Empty file path not allowed");
	}

	// Reject null bytes
	if (filePath.includes("\0")) {
		throw new Error(`Invalid file path (null byte): ${filePath}`);
	}

	// Reject overly long paths
	if (filePath.length > 1024) {
		throw new Error(`Path too long: ${filePath.slice(0, 50)}...`);
	}

	const normalized = normalize(filePath);

	// Reject absolute paths
	if (isAbsolute(normalized)) {
		throw new Error(`Absolute paths not allowed: ${filePath}`);
	}

	// Reject traversal patterns
	if (normalized.startsWith("..") || normalized.includes("/../")) {
		throw new Error(`Path traversal not allowed: ${filePath}`);
	}

	const fullPath = join(basePath, normalized);

	// Pre-symlink check
	const rel = relative(basePath, fullPath);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(`Path escapes base directory: ${filePath}`);
	}

	// Check symlink depth and validate targets stay within base
	await validateSymlinkChain(fullPath, basePath);

	// Resolve symlinks and verify final path is still within base
	try {
		const resolvedBase = await realpath(basePath);
		const resolvedFull = await realpath(fullPath);
		const resolvedRel = relative(resolvedBase, resolvedFull);

		if (resolvedRel.startsWith("..") || isAbsolute(resolvedRel)) {
			throw new Error(`Symlink escapes base directory: ${filePath}`);
		}
	} catch (error) {
		// If file doesn't exist yet, realpath fails - that's OK for new files
		// Only the parent directory needs to exist and be validated
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			// File doesn't exist - validate parent directory instead
			const parentPath = join(fullPath, "..");
			try {
				const resolvedBase = await realpath(basePath);
				const resolvedParent = await realpath(parentPath);
				const resolvedRel = relative(resolvedBase, resolvedParent);

				if (resolvedRel.startsWith("..") || isAbsolute(resolvedRel)) {
					throw new Error(`Parent symlink escapes base directory: ${filePath}`);
				}
			} catch (parentError) {
				// Parent doesn't exist either - will be created, skip symlink check
				if ((parentError as NodeJS.ErrnoException).code !== "ENOENT") {
					throw parentError;
				}
			}
		} else {
			throw error;
		}
	}

	return fullPath;
}

/**
 * SyncEngine handles diff detection, hunk generation, and merge operations
 */
export class SyncEngine {
	/**
	 * Create sync plan by categorizing files based on modification status
	 *
	 * @param trackedFiles - Files tracked in metadata
	 * @param claudeDir - Path to local .claude directory
	 * @param upstreamDir - Path to extracted upstream files
	 * @returns Categorized sync plan
	 */
	static async createSyncPlan(
		trackedFiles: TrackedFile[],
		claudeDir: string,
		upstreamDir: string,
	): Promise<SyncPlan> {
		const plan: SyncPlan = { autoUpdate: [], needsReview: [], skipped: [] };

		for (const file of trackedFiles) {
			// User-owned files are never touched
			if (file.ownership === "user") {
				plan.skipped.push(file);
				continue;
			}

			// Validate and get upstream path
			let upstreamPath: string;
			try {
				upstreamPath = await validateSyncPath(upstreamDir, file.path);
			} catch (error) {
				logger.warning(`Skipping invalid path: ${file.path}`);
				plan.skipped.push(file);
				continue;
			}

			// Check if upstream file exists
			try {
				await stat(upstreamPath);
			} catch {
				// Upstream doesn't have this file → skip
				plan.skipped.push(file);
				continue;
			}

			// Validate and get local path
			let localPath: string;
			try {
				localPath = await validateSyncPath(claudeDir, file.path);
			} catch (error) {
				logger.warning(`Skipping invalid local path: ${file.path}`);
				plan.skipped.push(file);
				continue;
			}

			try {
				await stat(localPath);
			} catch {
				// Local file doesn't exist → auto-update (will be created)
				plan.autoUpdate.push(file);
				continue;
			}

			// Kit-owned files always auto-update
			if (file.ownership === "ck") {
				plan.autoUpdate.push(file);
				continue;
			}

			// For ck-modified or files without baseChecksum, check if user modified
			const currentChecksum = await OwnershipChecker.calculateChecksum(localPath);

			// Use baseChecksum if available, otherwise fall back to checksum (migration)
			const baseChecksum = file.baseChecksum || file.checksum;

			if (currentChecksum === baseChecksum) {
				// User hasn't modified → safe to auto-update
				plan.autoUpdate.push(file);
			} else {
				// User modified → needs interactive review
				plan.needsReview.push(file);
			}
		}

		return plan;
	}

	/**
	 * Generate hunks for a file diff
	 *
	 * @param currentContent - Current file content
	 * @param newContent - New upstream content
	 * @param filename - Filename for display
	 * @param contextLines - Number of context lines (default 3)
	 * @returns Array of hunks
	 */
	static generateHunks(
		currentContent: string,
		newContent: string,
		filename: string,
		contextLines = 3,
	): FileHunk[] {
		const patch = structuredPatch(filename, filename, currentContent, newContent, "", "", {
			context: contextLines,
		});

		return patch.hunks.map((hunk) => ({
			oldStart: hunk.oldStart,
			oldLines: hunk.oldLines,
			newStart: hunk.newStart,
			newLines: hunk.newLines,
			lines: hunk.lines,
		}));
	}

	/**
	 * Apply selected hunks to content in reverse order
	 * Reverse order prevents line number shifts from affecting subsequent hunks
	 *
	 * @param content - Original content
	 * @param hunks - All hunks
	 * @param accepted - Boolean array indicating which hunks to apply
	 * @returns Merged content
	 */
	static applyHunks(content: string, hunks: FileHunk[], accepted: boolean[]): string {
		// Filter to only accepted hunks
		const acceptedHunks = hunks.filter((_, i) => accepted[i]);

		if (acceptedHunks.length === 0) {
			return content;
		}

		// Build a patch with only accepted hunks and apply it
		const patchStr = SyncEngine.buildUnifiedDiff(content, acceptedHunks);
		const result = applyPatch(content, patchStr);

		// applyPatch returns false on failure
		if (result === false) {
			// Fallback: apply hunks one by one in reverse order
			try {
				return SyncEngine.applyHunksManually(content, acceptedHunks);
			} catch (fallbackError) {
				// Both methods failed - throw error instead of silently returning original
				throw new Error(
					`Failed to apply ${acceptedHunks.length} hunk(s): patch and manual methods both failed. ` +
						`Manual error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
				);
			}
		}

		return result;
	}

	/**
	 * Build unified diff string from hunks
	 */
	private static buildUnifiedDiff(_content: string, hunks: FileHunk[]): string {
		let diff = "--- a\n+++ b\n";

		for (const hunk of hunks) {
			diff += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
			for (const line of hunk.lines) {
				diff += `${line}\n`;
			}
		}

		return diff;
	}

	/**
	 * Manual hunk application as fallback
	 * Applies hunks in reverse order to preserve line numbers
	 */
	private static applyHunksManually(content: string, hunks: FileHunk[]): string {
		const lines = content.split("\n");

		// Sort hunks by oldStart descending (apply from bottom to top)
		const sortedHunks = [...hunks].sort((a, b) => b.oldStart - a.oldStart);

		for (const hunk of sortedHunks) {
			const startIndex = hunk.oldStart - 1; // Convert to 0-based

			// Bounds check - ensure hunk targets valid line range
			if (startIndex < 0 || startIndex > lines.length) {
				logger.warning(
					`Hunk start ${hunk.oldStart} out of bounds (file has ${lines.length} lines)`,
				);
				continue;
			}

			// Calculate new lines (lines starting with + or space, without the prefix)
			const newLines: string[] = [];
			let deleteCount = 0;

			for (const line of hunk.lines) {
				// Skip malformed/empty hunk lines - valid diff lines always have a prefix (+/-/space)
				// Empty lines in actual content appear as " " (space prefix + empty content)
				if (!line || line.length === 0) {
					continue;
				}
				const prefix = line[0];
				const lineContent = line.slice(1);

				if (prefix === "-") {
					deleteCount++;
				} else if (prefix === "+" || prefix === " ") {
					newLines.push(lineContent);
				}
			}

			// Verify we won't delete past end of file
			if (startIndex + deleteCount > lines.length) {
				logger.warning(
					`Hunk would delete past EOF (start: ${startIndex}, delete: ${deleteCount}, lines: ${lines.length})`,
				);
				continue;
			}

			// Apply the hunk
			lines.splice(startIndex, deleteCount, ...newLines);
		}

		return lines.join("\n");
	}

	/**
	 * Check if a file appears to be binary
	 * Uses counting loop instead of split+filter for memory efficiency on large files
	 * Only samples first 8KB for performance (sufficient for binary detection)
	 */
	static isBinaryFile(content: string): boolean {
		// Empty files are not binary
		if (content.length === 0) {
			return false;
		}

		// Only sample first 8KB for large files (performance optimization)
		const sampleSize = Math.min(content.length, 8192);

		// Count non-printable characters efficiently (no array allocation)
		// Also check for null bytes (common in binary files) within sample
		let nonPrintableCount = 0;

		for (let i = 0; i < sampleSize; i++) {
			const code = content.charCodeAt(i);
			// Null byte = definitely binary
			if (code === 0) {
				return true;
			}
			// Non-printable: < 32 except tab (9), newline (10), carriage return (13)
			if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
				nonPrintableCount++;
			}
		}

		return nonPrintableCount / sampleSize > 0.1;
	}

	/**
	 * Load file content, detecting binary files
	 * Enforces size limit to prevent OOM
	 * Uses lstat() for atomic symlink + size check to prevent TOCTOU
	 */
	static async loadFileContent(filePath: string): Promise<{ content: string; isBinary: boolean }> {
		try {
			// Use lstat() for BOTH symlink and size check atomically (prevents TOCTOU)
			// lstat() doesn't follow symlinks, so we get the link's own stats
			const lstats = await lstat(filePath);

			// Reject symlinks - they could point anywhere
			if (lstats.isSymbolicLink()) {
				throw new Error(`Symlink not allowed for sync: ${filePath}`);
			}

			// Check file size to prevent OOM
			if (lstats.size > MAX_SYNC_FILE_SIZE) {
				throw new Error(
					`File too large for sync (${Math.round(lstats.size / 1024 / 1024)}MB > ${MAX_SYNC_FILE_SIZE / 1024 / 1024}MB limit)`,
				);
			}

			// Read file - at this point we know it's not a symlink
			// Note: Theoretical race still exists, but defense-in-depth approach
			const buffer = await readFile(filePath);

			// Check for null bytes in raw buffer (binary indicator)
			if (buffer.includes(0)) {
				return { content: "", isBinary: true };
			}

			const content = buffer.toString("utf8");

			// Check for replacement characters (invalid UTF-8 sequences)
			if (content.includes("\uFFFD")) {
				return { content: "", isBinary: true };
			}

			// Additional binary check: high non-printable ratio
			if (SyncEngine.isBinaryFile(content)) {
				return { content: "", isBinary: true };
			}

			return { content, isBinary: false };
		} catch (error) {
			// Don't silently return empty - this could overwrite files!
			const errMsg = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Cannot read file for sync: ${filePath} - ${errMsg}`);
		}
	}
}

// Export validation function for use in sync-handler
export { validateSyncPath };
