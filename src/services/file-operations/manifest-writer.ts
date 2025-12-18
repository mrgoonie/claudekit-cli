import { join } from "node:path";
import {
	detectMetadataFormat,
	getAllTrackedFiles,
	getKitMetadata,
	migrateToMultiKit,
} from "@/domains/migration/metadata-migration.js";
import { logger } from "@/shared/logger.js";
import type { FileOwnership, KitMetadata, KitType, Metadata, TrackedFile } from "@/types";
import { MetadataSchema, USER_CONFIG_PATTERNS } from "@/types";
import { ensureFile, pathExists, readFile, writeFile } from "fs-extra";
import pLimit from "p-limit";
import { lock } from "proper-lockfile";
import { OwnershipChecker } from "./ownership-checker.js";

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

	/**
	 * Write or update metadata.json with installation manifest (multi-kit aware)
	 * Uses file locking to prevent race conditions during concurrent kit installations.
	 * @param claudeDir - Path to .claude directory
	 * @param kitName - Name of the kit being installed
	 * @param version - Version being installed
	 * @param scope - Installation scope (local or global)
	 * @param kitType - Kit type identifier (engineer, marketing)
	 */
	async writeManifest(
		claudeDir: string,
		kitName: string,
		version: string,
		scope: "local" | "global",
		kitType?: KitType,
	): Promise<void> {
		const metadataPath = join(claudeDir, "metadata.json");

		// Determine kit type from name if not provided (use word boundaries to avoid false matches)
		const kit: KitType = kitType || (/\bmarketing\b/i.test(kitName) ? "marketing" : "engineer");

		// Ensure file exists for locking (proper-lockfile requires existing file)
		await ensureFile(metadataPath);

		// Acquire exclusive lock to prevent concurrent modification
		let release: (() => Promise<void>) | null = null;
		try {
			release = await lock(metadataPath, {
				retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
				stale: 60000, // Consider lock stale after 60 seconds (allows for slow I/O and migrations)
			});
			logger.debug(`Acquired lock on ${metadataPath}`);

			// Migrate legacy metadata if needed (inside lock)
			const migrationResult = await migrateToMultiKit(claudeDir);
			if (!migrationResult.success) {
				logger.warning(`Metadata migration warning: ${migrationResult.error}`);
			}

			// Read existing metadata (now guaranteed multi-kit format after migration)
			let existingMetadata: Partial<Metadata> = { kits: {} };
			if (await pathExists(metadataPath)) {
				try {
					const content = await readFile(metadataPath, "utf-8");
					const parsed = JSON.parse(content);
					// Only use if it's a valid object (not empty from ensureFile)
					if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
						existingMetadata = parsed;
					}
				} catch (error) {
					logger.debug(`Could not read existing metadata: ${error}`);
				}
			}

			// Build kit-specific metadata
			const trackedFiles = this.getTrackedFiles();
			const installedAt = new Date().toISOString();
			const kitMetadata: KitMetadata = {
				version,
				installedAt,
				files: trackedFiles.length > 0 ? trackedFiles : undefined,
			};

			// Build multi-kit metadata structure (file tracking in kits[kit].files only - no duplication)
			const metadata: Metadata = {
				kits: {
					...(existingMetadata.kits || {}), // Explicit fallback for legacy installs without kits
					[kit]: kitMetadata,
				},
				scope,
				// Legacy fields preserved for `ck version` display and backward compatibility
				// These are NOT used for file tracking - only kits[kit].files is authoritative
				name: kitName,
				version,
				installedAt,
				userConfigFiles: [...USER_CONFIG_PATTERNS, ...this.getUserConfigFiles()],
				// NOTE: files and installedFiles removed - use kits[kit].files instead (DRY)
			};

			// Validate schema
			const validated = MetadataSchema.parse(metadata);

			// Write to file (still inside lock)
			await writeFile(metadataPath, JSON.stringify(validated, null, 2), "utf-8");
			logger.debug(`Wrote manifest for kit "${kit}" with ${trackedFiles.length} tracked files`);
		} finally {
			// Always release lock
			if (release) {
				await release();
				logger.debug(`Released lock on ${metadataPath}`);
			}
		}
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
	 * Read kit-specific manifest from metadata.json
	 * @param claudeDir - Path to .claude directory
	 * @param kit - Kit type to read
	 * @returns Kit metadata or null if not found
	 */
	static async readKitManifest(claudeDir: string, kit: KitType): Promise<KitMetadata | null> {
		const metadata = await ManifestWriter.readManifest(claudeDir);
		if (!metadata) return null;
		return getKitMetadata(metadata, kit);
	}

	/**
	 * Get files to remove during uninstall based on manifest (multi-kit aware)
	 * Falls back to legacy hardcoded list if no manifest exists
	 * @param claudeDir - Path to .claude directory
	 * @param kit - Optional kit type for kit-scoped uninstall
	 * @returns Object with files to remove and files to preserve
	 */
	static async getUninstallManifest(
		claudeDir: string,
		kit?: KitType,
	): Promise<{
		filesToRemove: string[];
		filesToPreserve: string[];
		hasManifest: boolean;
		isMultiKit: boolean;
		remainingKits: KitType[];
	}> {
		const detection = await detectMetadataFormat(claudeDir);

		// Multi-kit format
		if (detection.format === "multi-kit" && detection.metadata?.kits) {
			const installedKits = Object.keys(detection.metadata.kits) as KitType[];

			// Kit-scoped uninstall
			if (kit) {
				const kitMeta = detection.metadata.kits[kit];
				if (!kitMeta?.files) {
					return {
						filesToRemove: [],
						filesToPreserve: USER_CONFIG_PATTERNS,
						hasManifest: true,
						isMultiKit: true,
						remainingKits: installedKits.filter((k) => k !== kit),
					};
				}

				// Get files for this kit only
				const kitFiles = kitMeta.files.map((f) => f.path);

				// Check for shared files with other kits (preserve them)
				const sharedFiles = new Set<string>();
				for (const otherKit of installedKits) {
					if (otherKit !== kit) {
						const otherMeta = detection.metadata.kits[otherKit];
						if (otherMeta?.files) {
							for (const f of otherMeta.files) {
								sharedFiles.add(f.path);
							}
						}
					}
				}

				const filesToRemove = kitFiles.filter((f) => !sharedFiles.has(f));
				const filesToPreserve = [
					...USER_CONFIG_PATTERNS,
					...kitFiles.filter((f) => sharedFiles.has(f)),
				];

				return {
					filesToRemove,
					filesToPreserve,
					hasManifest: true,
					isMultiKit: true,
					remainingKits: installedKits.filter((k) => k !== kit),
				};
			}

			// Full uninstall - all kits
			const allFiles = getAllTrackedFiles(detection.metadata);
			return {
				filesToRemove: allFiles.map((f) => f.path),
				filesToPreserve: USER_CONFIG_PATTERNS,
				hasManifest: true,
				isMultiKit: true,
				remainingKits: [],
			};
		}

		// Legacy format
		if (detection.format === "legacy" && detection.metadata) {
			const legacyFiles = detection.metadata.files?.map((f) => f.path) || [];
			const installedFiles = detection.metadata.installedFiles || [];
			const hasFiles = legacyFiles.length > 0 || installedFiles.length > 0;

			// If no files tracked, fall through to legacy hardcoded directories
			if (!hasFiles) {
				const legacyDirs = ["commands", "agents", "skills", "workflows", "hooks", "scripts"];
				const legacyFileList = ["metadata.json"];
				return {
					filesToRemove: [...legacyDirs, ...legacyFileList],
					filesToPreserve: USER_CONFIG_PATTERNS,
					hasManifest: false,
					isMultiKit: false,
					remainingKits: [],
				};
			}

			return {
				filesToRemove: legacyFiles.length > 0 ? legacyFiles : installedFiles,
				filesToPreserve: detection.metadata.userConfigFiles || USER_CONFIG_PATTERNS,
				hasManifest: true,
				isMultiKit: false,
				remainingKits: [],
			};
		}

		// No manifest - fallback to legacy hardcoded directories
		const legacyDirs = ["commands", "agents", "skills", "workflows", "hooks", "scripts"];
		const legacyFiles = ["metadata.json"];

		return {
			filesToRemove: [...legacyDirs, ...legacyFiles],
			filesToPreserve: USER_CONFIG_PATTERNS,
			hasManifest: false,
			isMultiKit: false,
			remainingKits: [],
		};
	}

	/**
	 * Remove a kit from metadata.json (for kit-scoped uninstall)
	 * Uses file locking to prevent race conditions.
	 * @param claudeDir - Path to .claude directory
	 * @param kit - Kit to remove
	 * @returns true if kit was removed, false if not found
	 */
	static async removeKitFromManifest(claudeDir: string, kit: KitType): Promise<boolean> {
		const metadataPath = join(claudeDir, "metadata.json");

		if (!(await pathExists(metadataPath))) return false;

		// Acquire exclusive lock
		let release: (() => Promise<void>) | null = null;
		try {
			release = await lock(metadataPath, {
				retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
				stale: 60000, // Consider lock stale after 60 seconds (consistent with writeManifest)
			});
			logger.debug(`Acquired lock on ${metadataPath} for kit removal`);

			// Read current metadata inside lock
			const metadata = await ManifestWriter.readManifest(claudeDir);
			if (!metadata?.kits?.[kit]) return false;

			// Remove kit from kits object
			const { [kit]: _removed, ...remainingKits } = metadata.kits;

			// If no kits remaining, delete metadata.json
			if (Object.keys(remainingKits).length === 0) {
				logger.debug("No kits remaining, metadata.json will be cleaned up");
				return true;
			}

			// Update metadata with remaining kits
			const updated: Metadata = {
				...metadata,
				kits: remainingKits,
			};

			await writeFile(metadataPath, JSON.stringify(updated, null, 2), "utf-8");
			logger.debug(
				`Removed kit "${kit}" from metadata, ${Object.keys(remainingKits).length} kit(s) remaining`,
			);

			return true;
		} finally {
			if (release) {
				await release();
				logger.debug(`Released lock on ${metadataPath}`);
			}
		}
	}
}
