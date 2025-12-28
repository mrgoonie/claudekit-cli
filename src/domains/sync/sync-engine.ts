/**
 * Sync engine - diff detection and hunk generation
 */
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative } from "node:path";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import type { TrackedFile } from "@/types";
import { applyPatch, structuredPatch } from "diff";
import type { FileHunk, SyncPlan } from "./types.js";

/** Max file size for sync operations (10MB) */
const MAX_SYNC_FILE_SIZE = 10 * 1024 * 1024;

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
				logger.warning(`Manual hunk application failed: ${fallbackError}`);
				// Return original content unchanged rather than corrupting
				return content;
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
				// Handle empty lines in hunk
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
	 */
	static isBinaryFile(content: string): boolean {
		// Empty files are not binary
		if (content.length === 0) {
			return false;
		}

		// Check for null bytes (common in binary files)
		if (content.includes("\0")) {
			return true;
		}

		// Check for high ratio of non-printable characters
		const nonPrintable = content.split("").filter((c) => {
			const code = c.charCodeAt(0);
			return code < 32 && code !== 9 && code !== 10 && code !== 13;
		});

		return nonPrintable.length / content.length > 0.1;
	}

	/**
	 * Load file content, detecting binary files
	 * Enforces size limit to prevent OOM
	 */
	static async loadFileContent(filePath: string): Promise<{ content: string; isBinary: boolean }> {
		try {
			// Check file size first to prevent OOM
			const stats = await stat(filePath);
			if (stats.size > MAX_SYNC_FILE_SIZE) {
				throw new Error(
					`File too large for sync (${Math.round(stats.size / 1024 / 1024)}MB > ${MAX_SYNC_FILE_SIZE / 1024 / 1024}MB limit)`,
				);
			}

			const content = await readFile(filePath, "utf8");
			const isBinary = SyncEngine.isBinaryFile(content);
			return { content, isBinary };
		} catch (error) {
			// Don't silently return empty - this could overwrite files!
			const errMsg = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Cannot read file for sync: ${filePath} - ${errMsg}`);
		}
	}
}

// Export validation function for use in sync-handler
export { validateSyncPath };
