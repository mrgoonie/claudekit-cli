import { join } from "node:path";
import { pathExists, readFile, writeFile } from "fs-extra";
import pLimit from "p-limit";
import { OwnershipChecker } from "../lib/ownership-checker.js";
import type { FileOwnership, Metadata, TrackedFile } from "../types.js";
import { MetadataSchema, USER_CONFIG_PATTERNS } from "../types.js";
import { logger } from "./logger.js";

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
 * ManifestWriter handles reading and writing installation manifests to metadata.json
 * This tracks exactly what files ClaudeKit installed for accurate uninstall
 */
export class ManifestWriter {
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

		// Track progress as tasks complete (thread-safe via settled promises)
		let completed = 0;
		const progressInterval = Math.max(1, Math.floor(total / 20)); // Adaptive: ~20 updates max

		const results = await Promise.all(
			tasks.map(async (task) => {
				const result = await task;
				completed++;
				// Call progress on adaptive interval or final item
				if (completed % progressInterval === 0 || completed === total) {
					onProgress?.(completed, total);
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

	/**
	 * Write or update metadata.json with installation manifest
	 * @param claudeDir - Path to .claude directory
	 * @param kitName - Name of the kit being installed
	 * @param version - Version being installed
	 * @param scope - Installation scope (local or global)
	 */
	async writeManifest(
		claudeDir: string,
		kitName: string,
		version: string,
		scope: "local" | "global",
	): Promise<void> {
		const metadataPath = join(claudeDir, "metadata.json");

		// Read existing metadata if present
		let existingMetadata: Partial<Metadata> = {};
		if (await pathExists(metadataPath)) {
			try {
				const content = await readFile(metadataPath, "utf-8");
				existingMetadata = JSON.parse(content);
			} catch (error) {
				logger.debug(`Could not read existing metadata: ${error}`);
			}
		}

		// Build new metadata with manifest
		const trackedFiles = this.getTrackedFiles();
		const metadata: Metadata = {
			...existingMetadata,
			name: kitName,
			version,
			installedAt: new Date().toISOString(),
			scope,
			installedFiles: this.getInstalledFiles(), // DEPRECATED - kept for backward compat
			userConfigFiles: [...USER_CONFIG_PATTERNS, ...this.getUserConfigFiles()],
			files: trackedFiles.length > 0 ? trackedFiles : undefined, // NEW ownership tracking
		};

		// Validate schema
		const validated = MetadataSchema.parse(metadata);

		// Write to file
		await writeFile(metadataPath, JSON.stringify(validated, null, 2), "utf-8");
		logger.debug(
			`Wrote manifest with ${this.installedFiles.size} installed files, ${trackedFiles.length} tracked`,
		);
	}

	/**
	 * Read manifest from existing metadata.json
	 * @param claudeDir - Path to .claude directory
	 * @returns Metadata with manifest or null if not found
	 */
	static async readManifest(claudeDir: string): Promise<Metadata | null> {
		const metadataPath = join(claudeDir, "metadata.json");

		if (!(await pathExists(metadataPath))) {
			return null;
		}

		try {
			const content = await readFile(metadataPath, "utf-8");
			const parsed = JSON.parse(content);
			return MetadataSchema.parse(parsed);
		} catch (error) {
			logger.debug(`Failed to read manifest: ${error}`);
			return null;
		}
	}

	/**
	 * Get files to remove during uninstall based on manifest
	 * Falls back to legacy hardcoded list if no manifest exists
	 * @param claudeDir - Path to .claude directory
	 * @returns Object with files to remove and files to preserve
	 */
	static async getUninstallManifest(claudeDir: string): Promise<{
		filesToRemove: string[];
		filesToPreserve: string[];
		hasManifest: boolean;
	}> {
		const metadata = await ManifestWriter.readManifest(claudeDir);

		if (metadata?.installedFiles && metadata.installedFiles.length > 0) {
			// Use manifest for accurate uninstall
			return {
				filesToRemove: metadata.installedFiles,
				filesToPreserve: metadata.userConfigFiles || USER_CONFIG_PATTERNS,
				hasManifest: true,
			};
		}

		// Fallback to legacy hardcoded directories for backward compatibility
		const legacyDirs = ["commands", "agents", "skills", "workflows", "hooks", "scripts"];
		const legacyFiles = ["metadata.json"];

		return {
			filesToRemove: [...legacyDirs, ...legacyFiles],
			filesToPreserve: USER_CONFIG_PATTERNS,
			hasManifest: false,
		};
	}
}
