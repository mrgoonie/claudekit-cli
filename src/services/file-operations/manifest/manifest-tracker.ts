import { logger } from "@/shared/logger.js";
import type { FileOwnership, TrackedFile } from "@/types";
import pLimit from "p-limit";
import { OwnershipChecker } from "../ownership-checker.js";

/**
 * Options for batch file tracking
 */
export interface BatchTrackOptions {
	/**
	 * Max concurrent checksum operations (default: 20)
	 * Tuned for typical SSD I/O - higher values show diminishing returns
	 * due to OS file descriptor limits and disk queue saturation.
	 * Lower to 10 for HDD or network filesystems.
	 */
	concurrency?: number;
	/** Progress callback called after each file is processed */
	onProgress?: (processed: number, total: number) => void;
}

/**
 * Result of batch file tracking operation
 */
export interface BatchTrackResult {
	/** Number of successfully tracked files */
	success: number;
	/** Number of files that failed to track */
	failed: number;
	/** Total files attempted */
	total: number;
}

/**
 * File info for batch tracking
 */
export interface FileTrackInfo {
	/** Absolute path to the file */
	filePath: string;
	/** Path relative to .claude directory */
	relativePath: string;
	/** Ownership classification */
	ownership: FileOwnership;
	/** Version of the kit that installed this file */
	installedVersion: string;
}

/**
 * ManifestTracker handles tracking installed files with checksums and ownership
 */
export class ManifestTracker {
	private installedFiles: Set<string> = new Set();
	private userConfigFiles: Set<string> = new Set();
	private trackedFiles: Map<string, TrackedFile> = new Map();

	/**
	 * Add a file or directory to the installed files manifest
	 * @param relativePath - Path relative to .claude directory
	 */
	addInstalledFile(relativePath: string): void {
		// Normalize path separators
		const normalized = relativePath.replace(/\\/g, "/");
		this.installedFiles.add(normalized);
	}

	/**
	 * Add multiple files/directories to the manifest
	 */
	addInstalledFiles(relativePaths: string[]): void {
		for (const path of relativePaths) {
			this.addInstalledFile(path);
		}
	}

	/**
	 * Mark a file as user config (should be preserved during uninstall)
	 */
	addUserConfigFile(relativePath: string): void {
		const normalized = relativePath.replace(/\\/g, "/");
		this.userConfigFiles.add(normalized);
	}

	/**
	 * Get list of installed files
	 */
	getInstalledFiles(): string[] {
		return Array.from(this.installedFiles).sort();
	}

	/**
	 * Get list of user config files
	 */
	getUserConfigFiles(): string[] {
		return Array.from(this.userConfigFiles).sort();
	}

	/**
	 * Add a tracked file with checksum and ownership
	 * @param filePath - Absolute path to the file
	 * @param relativePath - Path relative to .claude directory
	 * @param ownership - Ownership classification
	 * @param installedVersion - Version of the kit that installed this file
	 */
	async addTrackedFile(
		filePath: string,
		relativePath: string,
		ownership: FileOwnership,
		installedVersion: string,
	): Promise<void> {
		const checksum = await OwnershipChecker.calculateChecksum(filePath);
		const normalized = relativePath.replace(/\\/g, "/");

		this.trackedFiles.set(normalized, {
			path: normalized,
			checksum,
			ownership,
			installedVersion,
		});

		// Also add to legacy installedFiles for backward compat
		this.installedFiles.add(normalized);
	}

	/**
	 * Add multiple tracked files in parallel with progress reporting
	 * Uses p-limit for controlled concurrency to avoid overwhelming I/O
	 *
	 * @param files - Array of file info objects to track
	 * @param options - Batch processing options (concurrency, progress callback)
	 * @returns BatchTrackResult with success/failed counts
	 */
	async addTrackedFilesBatch(
		files: FileTrackInfo[],
		options: BatchTrackOptions = {},
	): Promise<BatchTrackResult> {
		const { concurrency = 20, onProgress } = options;
		const limit = pLimit(concurrency);
		const total = files.length;

		// Track completion via Promise results for thread-safety
		const tasks = files.map((file) =>
			limit(async (): Promise<boolean> => {
				try {
					const checksum = await OwnershipChecker.calculateChecksum(file.filePath);
					const normalized = file.relativePath.replace(/\\/g, "/");

					this.trackedFiles.set(normalized, {
						path: normalized,
						checksum,
						ownership: file.ownership,
						installedVersion: file.installedVersion,
					});

					// Also add to legacy installedFiles for backward compat
					this.installedFiles.add(normalized);

					return true; // Success
				} catch (error) {
					// Log but don't fail entire batch for single file errors
					logger.debug(`Failed to track file ${file.relativePath}: ${error}`);
					return false; // Failed
				}
			}),
		);

		// Track progress atomically using Promise.allSettled
		const progressInterval = Math.max(1, Math.floor(total / 20)); // Adaptive: ~20 updates max
		let reportedProgress = 0;

		const results = await Promise.all(
			tasks.map(async (task, index) => {
				const result = await task;
				// Atomic progress reporting based on index (deterministic order)
				const completed = index + 1;
				if (completed % progressInterval === 0 || completed === total) {
					// Only report if we haven't already reported this milestone
					if (completed > reportedProgress) {
						reportedProgress = completed;
						onProgress?.(completed, total);
					}
				}
				return result;
			}),
		);

		const success = results.filter(Boolean).length;
		const failed = total - success;

		// Warn user if significant failures occurred
		if (failed > 0) {
			logger.warning(`Failed to track ${failed} of ${total} files (check debug logs for details)`);
		}

		return { success, failed, total };
	}

	/**
	 * Get tracked files as array sorted by path
	 */
	getTrackedFiles(): TrackedFile[] {
		return Array.from(this.trackedFiles.values()).sort((a, b) => a.path.localeCompare(b.path));
	}
}
