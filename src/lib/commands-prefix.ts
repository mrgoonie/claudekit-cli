import { lstat, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { copy, move, pathExists, remove } from "fs-extra";
import type { FileOwnership } from "../types.js";
import { logger } from "../utils/logger.js";
import { ManifestWriter } from "../utils/manifest-writer.js";
import { OwnershipChecker } from "./ownership-checker.js";
import type { OwnershipCheckResult } from "./ui/ownership-display.js";

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
	/** Dry-run mode: preview changes without applying */
	dryRun?: boolean;
	/** Force mode: override ownership protections */
	forceOverwrite?: boolean;
}

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
	/** Files checked and their ownership/action */
	results: OwnershipCheckResult[];
	/** Number of files deleted */
	deletedCount: number;
	/** Number of files preserved */
	preservedCount: number;
	/** Whether operation was dry-run */
	wasDryRun: boolean;
}

/**
 * Remove Windows drive prefixes (e.g., C:\, \\?\C:\) so that colon characters
 * used in drive letters don't trigger invalid character validation.
 */
function stripWindowsDrivePrefix(path: string): string {
	if (path.length >= 2 && /[a-zA-Z]/.test(path[0]) && path[1] === ":") {
		return path.slice(2);
	}

	if (path.startsWith("\\\\?\\")) {
		const remainder = path.slice(4);
		if (remainder.length >= 2 && /[a-zA-Z]/.test(remainder[0]) && remainder[1] === ":") {
			return remainder.slice(2);
		}
	}

	return path;
}

/**
 * Validate path to prevent security vulnerabilities
 * @param path Path to validate
 * @param paramName Parameter name for error messages
 * @throws {Error} If path is invalid or contains security risks
 */
function validatePath(path: string, paramName: string): void {
	if (!path || typeof path !== "string") {
		throw new Error(`${paramName} must be a non-empty string`);
	}
	if (path.length > 1000) {
		throw new Error(`${paramName} path too long (max 1000 chars)`);
	}
	// Block path traversal: ".." as complete path component (not inside filenames like "file..txt")
	// Also block "~" at start (Unix home expansion, but allow middle for Windows 8.3 short names)
	// Regex matches ".." only when preceded/followed by path separator or string boundary
	if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path) || path.startsWith("~")) {
		throw new Error(`${paramName} contains path traversal: ${path}`);
	}

	const sanitizedPath = stripWindowsDrivePrefix(path);
	if (/[<>:"|?*]/.test(sanitizedPath)) {
		logger.debug(`Path validation failed (invalid character) for ${paramName}: ${path}`);
		throw new Error(`${paramName} contains invalid characters: ${path}`);
	}
	// Check for control characters
	for (let i = 0; i < path.length; i++) {
		const code = path.charCodeAt(i);
		if (code < 32 || code === 127) {
			throw new Error(`${paramName} contains control characters`);
		}
	}
}

/**
 * CommandsPrefix - Reorganizes .claude/commands directory to add /ck: prefix
 *
 * Moves all command files from `.claude/commands/**\/*` to `.claude/commands/ck/**\/*`
 * This enables all slash commands to have a /ck: prefix (e.g., /ck:plan, /ck:fix)
 */
export class CommandsPrefix {
	/**
	 * Apply prefix reorganization to commands directory
	 *
	 * Moves all files from .claude/commands/ to .claude/commands/ck/
	 * This enables slash commands to have /ck: prefix (e.g., /ck:plan)
	 *
	 * @param extractDir - Temporary extraction directory containing .claude folder
	 *                     Must be absolute path, no path traversal allowed
	 *
	 * @throws {Error} If extractDir contains path traversal or invalid chars
	 * @throws {Error} If commands directory is corrupted
	 * @throws {Error} If filesystem operations fail
	 *
	 * @example
	 * await CommandsPrefix.applyPrefix("/tmp/extract-abc123");
	 *
	 * @remarks
	 * - Idempotent: safe to call multiple times
	 * - Creates backup before destructive operations
	 * - Skips symlinks for security
	 * - Rolls back on failure
	 */
	static async applyPrefix(extractDir: string): Promise<void> {
		// Validate input to prevent security vulnerabilities
		validatePath(extractDir, "extractDir");

		const commandsDir = join(extractDir, ".claude", "commands");

		// Check if commands directory exists
		if (!(await pathExists(commandsDir))) {
			logger.verbose("No commands directory found, skipping prefix application");
			return;
		}

		logger.info("Applying /ck: prefix to slash commands...");

		const backupDir = join(extractDir, ".commands-backup");
		const tempDir = join(extractDir, ".commands-prefix-temp");

		try {
			// Check if directory is empty
			const entries = await readdir(commandsDir);
			if (entries.length === 0) {
				logger.verbose("Commands directory is empty, skipping prefix application");
				return;
			}

			// Check if already prefixed (ck subdirectory exists and is the only entry)
			if (entries.length === 1 && entries[0] === "ck") {
				const ckDir = join(commandsDir, "ck");
				const ckStat = await stat(ckDir);
				if (ckStat.isDirectory()) {
					logger.verbose("Commands already have /ck: prefix, skipping");
					return;
				}
			}

			// Create backup before destructive operations
			await copy(commandsDir, backupDir);
			logger.verbose("Created backup of commands directory");

			// Create temporary directory for reorganization
			await mkdir(tempDir, { recursive: true });

			// Create ck subdirectory in temp
			const ckDir = join(tempDir, "ck");
			await mkdir(ckDir, { recursive: true });

			// Move all current commands to ck subdirectory
			let processedCount = 0;
			for (const entry of entries) {
				const sourcePath = join(commandsDir, entry);

				// Security: Check if entry is a symlink and skip it
				const stats = await lstat(sourcePath);
				if (stats.isSymbolicLink()) {
					logger.warning(`Skipping symlink for security: ${entry}`);
					continue;
				}

				const destPath = join(ckDir, entry);

				// Copy the file/directory to the new location
				await copy(sourcePath, destPath, {
					overwrite: false,
					errorOnExist: true,
				});

				processedCount++;
				logger.verbose(`Moved ${entry} to ck/${entry}`);
			}

			if (processedCount === 0) {
				logger.warning("No files to move (all were symlinks or invalid)");
				await remove(backupDir);
				await remove(tempDir);
				return;
			}

			// Remove old commands directory
			await remove(commandsDir);

			// Move reorganized directory to commands location
			await move(tempDir, commandsDir);

			// Cleanup backup after successful operation
			await remove(backupDir);

			logger.success("Successfully applied /ck: prefix to all commands");
		} catch (error) {
			// Restore backup if exists
			if (await pathExists(backupDir)) {
				try {
					await remove(commandsDir).catch(() => {});
					await move(backupDir, commandsDir);
					logger.info("Restored original commands directory from backup");
				} catch (rollbackError) {
					logger.error(`Rollback failed: ${rollbackError}`);
				}
			}

			// Cleanup temp directory
			if (await pathExists(tempDir)) {
				await remove(tempDir).catch(() => {
					// Silent cleanup failure
				});
			}

			logger.error("Failed to apply /ck: prefix to commands");
			throw error;
		} finally {
			// Always cleanup backup and temp directories
			if (await pathExists(backupDir)) {
				await remove(backupDir).catch(() => {});
			}
			if (await pathExists(tempDir)) {
				await remove(tempDir).catch(() => {});
			}
		}
	}

	/**
	 * Check if prefix should be applied based on options
	 * @param options Command options object
	 * @returns true if --prefix flag is set
	 */
	static shouldApplyPrefix(options: { prefix?: boolean }): boolean {
		return options.prefix === true;
	}

	/**
	 * Clean up existing commands directory before applying prefix
	 * OWNERSHIP-AWARE: Only removes CK-owned pristine files, preserves user files
	 *
	 * @param targetDir - Target directory (resolvedDir from update command)
	 *                    Must be absolute path, no path traversal allowed
	 * @param isGlobal - Whether using global mode (affects path structure)
	 * @param options - Cleanup options (dryRun, forceOverwrite)
	 *
	 * @returns CleanupResult with detailed information about what was/would be done
	 *
	 * @throws {Error} If targetDir contains path traversal or invalid chars
	 * @throws {Error} If no ownership metadata exists (legacy install needs migration)
	 * @throws {Error} If filesystem operations fail
	 *
	 * @example
	 * // Local mode: cleans .claude/commands/ preserving user files
	 * await CommandsPrefix.cleanupCommandsDirectory("/project", false);
	 *
	 * // Dry-run mode: preview changes without applying
	 * const result = await CommandsPrefix.cleanupCommandsDirectory("/project", false, { dryRun: true });
	 *
	 * // Force mode: delete even user-modified files
	 * await CommandsPrefix.cleanupCommandsDirectory("/project", false, { forceOverwrite: true });
	 *
	 * @remarks
	 * - Checks ownership BEFORE deletion
	 * - Only deletes files with ownership="ck" and matching checksum
	 * - Preserves user-created and user-modified files (unless forceOverwrite)
	 * - Logs all preservation decisions
	 * - Throws error if no metadata (legacy install must migrate first)
	 */
	static async cleanupCommandsDirectory(
		targetDir: string,
		isGlobal: boolean,
		options: CleanupOptions = {},
	): Promise<CleanupResult> {
		const { dryRun = false, forceOverwrite = false } = options;

		// Validate input to prevent security vulnerabilities
		validatePath(targetDir, "targetDir");

		// Determine paths based on mode
		// Local mode:  <targetDir>/.claude/commands/
		// Global mode: <targetDir>/commands/ (no .claude prefix)
		const claudeDir = isGlobal ? targetDir : join(targetDir, ".claude");
		const commandsDir = join(claudeDir, "commands");

		// Initialize result
		const result: CleanupResult = {
			results: [],
			deletedCount: 0,
			preservedCount: 0,
			wasDryRun: dryRun,
		};

		// Check if commands directory exists
		if (!(await pathExists(commandsDir))) {
			logger.verbose(`Commands directory does not exist: ${commandsDir}`);
			return result;
		}

		if (dryRun) {
			logger.info("DRY RUN: Analyzing ownership (no changes will be made)...");
		} else {
			logger.info("Checking ownership before cleanup...");
		}

		// Load metadata for ownership verification
		const metadata = await ManifestWriter.readManifest(claudeDir);

		if (!metadata || !metadata.files || metadata.files.length === 0) {
			logger.warning("No ownership metadata found - aborting cleanup for safety");
			logger.warning("Run 'ck init' to migrate legacy installation first");
			throw new Error("Cannot cleanup without ownership metadata (legacy install detected)");
		}

		// Scan commands directory
		const entries = await readdir(commandsDir);
		if (entries.length === 0) {
			logger.verbose("Commands directory is empty");
			return result;
		}

		for (const entry of entries) {
			const entryPath = join(commandsDir, entry);

			// Security: Skip symlinks
			const stats = await lstat(entryPath);
			if (stats.isSymbolicLink()) {
				logger.warning(`Skipping symlink: ${entry}`);
				result.results.push({
					path: entry,
					ownership: "user" as FileOwnership,
					action: "skip",
					reason: "symlink (security)",
				});
				result.preservedCount++;
				continue;
			}

			// For directories, we need to handle recursively
			if (stats.isDirectory()) {
				// Check if any files inside are user-owned
				const dirFiles = await CommandsPrefix.scanDirectoryFiles(entryPath);
				let canDeleteDir = true;

				for (const file of dirFiles) {
					const relativePath = file.replace(`${claudeDir}/`, "").replace(/\\/g, "/");
					const ownershipResult = await OwnershipChecker.checkOwnership(file, metadata, claudeDir);

					if (ownershipResult.ownership === "ck" && ownershipResult.exists) {
						// CK-owned pristine file → can be deleted
						result.results.push({
							path: relativePath,
							ownership: "ck",
							action: "delete",
						});

						if (!dryRun) {
							await remove(file);
							logger.verbose(`Deleted CK file: ${relativePath}`);
						}
						result.deletedCount++;
					} else if (ownershipResult.ownership === "ck-modified") {
						// Modified file - check forceOverwrite
						if (forceOverwrite) {
							result.results.push({
								path: relativePath,
								ownership: "ck-modified",
								action: "delete",
								reason: "force overwrite",
							});

							if (!dryRun) {
								await remove(file);
								logger.verbose(`Force-deleted modified file: ${relativePath}`);
							}
							result.deletedCount++;
						} else {
							canDeleteDir = false;
							result.results.push({
								path: relativePath,
								ownership: "ck-modified",
								action: "preserve",
								reason: "modified by user",
							});
							result.preservedCount++;
							logger.verbose(`Preserved modified file: ${relativePath}`);
						}
					} else {
						// User-owned file
						if (forceOverwrite) {
							result.results.push({
								path: relativePath,
								ownership: "user",
								action: "delete",
								reason: "force overwrite",
							});

							if (!dryRun) {
								await remove(file);
								logger.verbose(`Force-deleted user file: ${relativePath}`);
							}
							result.deletedCount++;
						} else {
							canDeleteDir = false;
							result.results.push({
								path: relativePath,
								ownership: "user",
								action: "preserve",
								reason: "user-created",
							});
							result.preservedCount++;
							logger.verbose(`Preserved user file: ${relativePath}`);
						}
					}
				}

				// Only remove empty directory if all files were deleted
				if (canDeleteDir && !dryRun) {
					await remove(entryPath);
					logger.verbose(`Removed directory: ${entry}`);
				}
			} else {
				// Single file - check ownership
				const relativePath = `commands/${entry}`;
				const ownershipResult = await OwnershipChecker.checkOwnership(
					entryPath,
					metadata,
					claudeDir,
				);

				if (ownershipResult.ownership === "ck" && ownershipResult.exists) {
					// CK-owned pristine file → safe to delete
					result.results.push({
						path: relativePath,
						ownership: "ck",
						action: "delete",
					});

					if (!dryRun) {
						await remove(entryPath);
						logger.verbose(`Deleted CK file: ${entry}`);
					}
					result.deletedCount++;
				} else if (ownershipResult.ownership === "ck-modified") {
					// CK file modified by user
					if (forceOverwrite) {
						result.results.push({
							path: relativePath,
							ownership: "ck-modified",
							action: "delete",
							reason: "force overwrite",
						});

						if (!dryRun) {
							await remove(entryPath);
							logger.verbose(`Force-deleted modified file: ${entry}`);
						}
						result.deletedCount++;
					} else {
						result.results.push({
							path: relativePath,
							ownership: "ck-modified",
							action: "preserve",
							reason: "modified by user",
						});
						result.preservedCount++;
						logger.verbose(`Preserved modified file: ${entry}`);
					}
				} else {
					// User-owned file
					if (forceOverwrite) {
						result.results.push({
							path: relativePath,
							ownership: "user",
							action: "delete",
							reason: "force overwrite",
						});

						if (!dryRun) {
							await remove(entryPath);
							logger.verbose(`Force-deleted user file: ${entry}`);
						}
						result.deletedCount++;
					} else {
						result.results.push({
							path: relativePath,
							ownership: "user",
							action: "preserve",
							reason: "user-created",
						});
						result.preservedCount++;
						logger.verbose(`Preserved user file: ${entry}`);
					}
				}
			}
		}

		// Summary
		if (dryRun) {
			logger.info(
				`DRY RUN complete: would delete ${result.deletedCount}, preserve ${result.preservedCount}`,
			);
		} else {
			logger.success(
				`Cleanup complete: deleted ${result.deletedCount}, preserved ${result.preservedCount}`,
			);
		}

		if (result.preservedCount > 0 && !dryRun) {
			const preserved = result.results.filter((r) => r.action === "preserve");
			logger.info("Preserved files:");
			preserved.slice(0, 5).forEach((r) => logger.info(`  - ${r.path} (${r.reason})`));
			if (preserved.length > 5) {
				logger.info(`  ... and ${preserved.length - 5} more`);
			}
		}

		return result;
	}

	/**
	 * Recursively scan directory and collect all file paths
	 * @param dir Directory to scan
	 * @returns Array of absolute file paths
	 */
	private static async scanDirectoryFiles(dir: string): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await lstat(fullPath);

			if (stats.isSymbolicLink()) {
				continue; // Skip symlinks for security
			}

			if (stats.isDirectory()) {
				files.push(...(await CommandsPrefix.scanDirectoryFiles(fullPath)));
			} else if (stats.isFile()) {
				files.push(fullPath);
			}
		}

		return files;
	}
}
