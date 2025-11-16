import { lstat, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { copy, move, pathExists, remove } from "fs-extra";
import { logger } from "../utils/logger.js";

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
	if (path.includes("..") || path.includes("~")) {
		throw new Error(`${paramName} contains path traversal: ${path}`);
	}
	if (/[<>:"|?*]/.test(path)) {
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
}
