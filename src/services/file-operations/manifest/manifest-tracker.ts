import { join } from "node:path";
import {
	type ReleaseManifest,
	ReleaseManifestLoader,
} from "@/domains/migration/release-manifest.js";
import { getOptimalConcurrency } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { FileOwnership, KitType, TrackedFile } from "@/types";
import pLimit from "p-limit";
import { OwnershipChecker } from "../ownership-checker.js";
import { writeManifest } from "./manifest-updater.js";

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
	/** Git commit timestamp from kit repo (ISO 8601) */
	sourceTimestamp?: string;
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
		sourceTimestamp?: string,
	): Promise<void> {
		const checksum = await OwnershipChecker.calculateChecksum(filePath);
		const normalized = relativePath.replace(/\\/g, "/");

		this.trackedFiles.set(normalized, {
			path: normalized,
			checksum,
			ownership,
			installedVersion,
			sourceTimestamp,
			installedAt: new Date().toISOString(),
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
						sourceTimestamp: file.sourceTimestamp,
						installedAt: new Date().toISOString(),
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

/**
 * Options for building file tracking list from installed files
 */
export interface BuildFileTrackingOptions {
	/** List of installed file paths (relative to project root, e.g., ".claude/skills/foo.md") */
	installedFiles: string[];
	/** Absolute path to .claude directory */
	claudeDir: string;
	/** Release manifest for determining file ownership (null = all files are user-owned) */
	releaseManifest: ReleaseManifest | null;
	/** Version string to record for installed files */
	installedVersion: string;
	/** Whether this is a global installation (affects path handling) */
	isGlobal?: boolean;
}

/**
 * Options for writing manifest after tracking
 */
export interface WriteManifestOptions {
	/** Absolute path to .claude directory */
	claudeDir: string;
	/** Kit name to record in manifest */
	kitName: string;
	/** Release tag/version string */
	releaseTag: string;
	/** Installation mode */
	mode: "local" | "global";
	/** Kit type for manifest metadata */
	kitType?: KitType;
}

/**
 * Build a FileTrackInfo list from installed files.
 * Determines ownership based on release manifest presence.
 *
 * @param options - Configuration for building tracking list
 * @returns Array of FileTrackInfo ready for batch tracking
 */
export function buildFileTrackingList(options: BuildFileTrackingOptions): FileTrackInfo[] {
	const {
		installedFiles,
		claudeDir,
		releaseManifest,
		installedVersion,
		isGlobal = false,
	} = options;
	const filesToTrack: FileTrackInfo[] = [];

	for (const installedPath of installedFiles) {
		// For local installs, only track files inside .claude/ directory
		if (!isGlobal && !installedPath.startsWith(".claude/")) continue;

		// Calculate relative path (strip .claude/ prefix for local, keep as-is for global)
		const relativePath = isGlobal ? installedPath : installedPath.replace(/^\.claude\//, "");
		const filePath = join(claudeDir, relativePath);

		// Determine ownership: if file exists in release manifest, it's CK-owned
		const manifestEntry = releaseManifest
			? ReleaseManifestLoader.findFile(releaseManifest, installedPath)
			: null;
		const ownership: FileOwnership = manifestEntry ? "ck" : "user";

		filesToTrack.push({
			filePath,
			relativePath,
			ownership,
			installedVersion,
			sourceTimestamp: manifestEntry?.lastModified,
		});
	}

	return filesToTrack;
}

/**
 * Track files with progress spinner and write manifest.
 * Consolidates the common pattern of tracking + manifest writing.
 *
 * @param filesToTrack - List of files to track (from buildFileTrackingList)
 * @param manifestOptions - Options for writing the manifest
 * @returns Batch tracking result with success/failed counts
 */
export async function trackFilesWithProgress(
	filesToTrack: FileTrackInfo[],
	manifestOptions: WriteManifestOptions,
): Promise<BatchTrackResult> {
	const tracker = new ManifestTracker();

	// Track files with spinner progress
	const trackingSpinner = createSpinner(`Tracking ${filesToTrack.length} installed files...`);
	trackingSpinner.start();

	const trackResult = await tracker.addTrackedFilesBatch(filesToTrack, {
		concurrency: getOptimalConcurrency(),
		onProgress: (processed, total) => {
			trackingSpinner.text = `Tracking files... (${processed}/${total})`;
		},
	});

	trackingSpinner.succeed(`Tracked ${trackResult.success} files`);

	// Write manifest with tracked files
	await writeManifest(
		manifestOptions.claudeDir,
		manifestOptions.kitName,
		manifestOptions.releaseTag,
		manifestOptions.mode,
		manifestOptions.kitType,
		tracker.getTrackedFiles(),
		tracker.getUserConfigFiles(),
	);

	return trackResult;
}
