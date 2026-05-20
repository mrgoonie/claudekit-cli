import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { relative } from "node:path";
import { getAllTrackedFiles } from "@/domains/migration/metadata-migration.js";
import { mapWithLimit } from "@/shared/concurrent-file-ops.js";
import { operationError } from "@/shared/error-utils.js";
import type { FileOwnership, Metadata } from "@/types";

/**
 * Result of an ownership check operation
 */
export interface OwnershipCheckResult {
	path: string;
	ownership: FileOwnership;
	expectedChecksum?: string;
	actualChecksum?: string;
	exists: boolean;
}

/**
 * OwnershipChecker - Verifies file ownership using SHA-256 checksums
 *
 * Implements pip RECORD pattern for file tracking:
 * - Files in metadata with matching checksum → "ck" (CK-owned, pristine)
 * - Files in metadata with different checksum → "ck-modified" (user modified)
 * - Files not in metadata → "user" (user-created)
 */
export class OwnershipChecker {
	/**
	 * Calculate SHA-256 checksum of a tracked file
	 * Uses direct reads because tracked ClaudeKit assets are small and Bun's
	 * Node stream shim can stall under large concurrent test runs.
	 *
	 * @param filePath Absolute path to file
	 * @returns Hex string (64 chars)
	 * @throws Error if file doesn't exist or can't be read
	 */
	static async calculateChecksum(filePath: string): Promise<string> {
		try {
			return createHash("sha256")
				.update(await readFile(filePath))
				.digest("hex");
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(operationError("Checksum calculation", filePath, message));
		}
	}

	/**
	 * Determine file ownership based on metadata
	 *
	 * Logic:
	 * - File doesn't exist → user ownership, exists: false
	 * - No metadata or empty files array → user (legacy install)
	 * - File in metadata with matching checksum → ck
	 * - File in metadata with different checksum → ck-modified
	 * - File not in metadata → user
	 *
	 * @param filePath Absolute path to file
	 * @param metadata Installation metadata (null for legacy installs)
	 * @param claudeDir Absolute path to .claude directory
	 * @returns Ownership classification result
	 */
	static async checkOwnership(
		filePath: string,
		metadata: Metadata | null,
		claudeDir: string,
	): Promise<OwnershipCheckResult> {
		// Check file existence
		try {
			await stat(filePath);
		} catch {
			return { path: filePath, ownership: "user", exists: false };
		}

		// Get all tracked files (handles both multi-kit and legacy format)
		const allTrackedFiles = metadata ? getAllTrackedFiles(metadata) : [];

		// No metadata or empty files → assume user-owned (legacy install)
		if (!metadata || allTrackedFiles.length === 0) {
			return { path: filePath, ownership: "user", exists: true };
		}

		// Get relative path for metadata lookup (normalize to forward slashes)
		const relativePath = relative(claudeDir, filePath).replace(/\\/g, "/");

		// Find file in tracked files (works with both kits[kit].files and legacy metadata.files)
		const tracked = allTrackedFiles.find((f) => f.path.replace(/\\/g, "/") === relativePath);
		if (!tracked) {
			// File not in metadata → user-created
			return { path: filePath, ownership: "user", exists: true };
		}

		// Calculate current checksum
		const actualChecksum = await OwnershipChecker.calculateChecksum(filePath);

		// Compare checksums
		if (actualChecksum === tracked.checksum) {
			return {
				path: filePath,
				ownership: "ck",
				expectedChecksum: tracked.checksum,
				actualChecksum,
				exists: true,
			};
		}
		return {
			path: filePath,
			ownership: "ck-modified",
			expectedChecksum: tracked.checksum,
			actualChecksum,
			exists: true,
		};
	}

	/**
	 * Batch check multiple files with concurrency limiting
	 * Prevents EMFILE errors on Windows with large file sets
	 *
	 * @param filePaths Array of absolute paths
	 * @param metadata Installation metadata
	 * @param claudeDir Absolute path to .claude directory
	 * @returns Map of path → ownership result
	 */
	static async checkBatch(
		filePaths: string[],
		metadata: Metadata | null,
		claudeDir: string,
	): Promise<Map<string, OwnershipCheckResult>> {
		const results = await mapWithLimit(filePaths, (path) =>
			OwnershipChecker.checkOwnership(path, metadata, claudeDir),
		);

		return new Map(results.map((r) => [r.path, r]));
	}
}
