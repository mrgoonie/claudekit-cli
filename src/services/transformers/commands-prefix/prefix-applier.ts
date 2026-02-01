/**
 * Prefix Applier
 *
 * Handles applying /ck: prefix to slash commands by:
 * 1. Reorganizing the commands directory structure
 * 2. Transforming command references in file contents
 */

import { lstat, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { copy, move, pathExists, remove } from "fs-extra";
import { transformCommandReferences } from "./content-transformer.js";
import { validatePath } from "./prefix-utils.js";

/**
 * Known kit prefix directories that should NOT be wrapped in ck/
 * These are native prefixes from different kits
 */
const KNOWN_KIT_PREFIXES = new Set(["ck", "mkt"]);

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
 * await applyPrefix("/tmp/extract-abc123");
 *
 * @remarks
 * - Idempotent: safe to call multiple times
 * - Creates backup before destructive operations
 * - Skips symlinks for security
 * - Rolls back on failure
 */
export async function applyPrefix(extractDir: string): Promise<void> {
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
		// Skip entries that are already known kit prefix directories
		let processedCount = 0;
		let skippedPrefixes = 0;
		for (const entry of entries) {
			const sourcePath = join(commandsDir, entry);

			// Security: Check if entry is a symlink and skip it
			const stats = await lstat(sourcePath);
			if (stats.isSymbolicLink()) {
				logger.warning(`Skipping symlink for security: ${entry}`);
				continue;
			}

			// Skip known kit prefix directories to prevent double-nesting
			if (stats.isDirectory() && KNOWN_KIT_PREFIXES.has(entry)) {
				logger.verbose(`Skipping pre-prefixed kit directory: ${entry}/`);
				skippedPrefixes++;
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

		if (processedCount === 0 && skippedPrefixes === 0) {
			logger.warning("No files to move (all were symlinks or invalid)");
			await remove(backupDir);
			await remove(tempDir);
			return;
		}

		if (processedCount === 0) {
			// Only skipped prefixes, no new files to wrap
			logger.info(
				`Skipped ${skippedPrefixes} pre-prefixed kit director${skippedPrefixes === 1 ? "y" : "ies"} (already organized)`,
			);
			await remove(backupDir);
			await remove(tempDir);
			return;
		}

		// If we have pre-existing kit prefixes, we need to preserve them
		if (skippedPrefixes > 0) {
			// Copy pre-existing kit prefix directories to temp dir
			for (const entry of entries) {
				const sourcePath = join(commandsDir, entry);
				const stats = await lstat(sourcePath);
				if (stats.isDirectory() && KNOWN_KIT_PREFIXES.has(entry)) {
					await copy(sourcePath, join(tempDir, entry));
					logger.verbose(`Preserved pre-existing kit prefix: ${entry}/`);
				}
			}
		}

		// Remove old commands directory
		await remove(commandsDir);

		// Move reorganized directory to commands location
		await move(tempDir, commandsDir);

		// Cleanup backup after successful operation
		await remove(backupDir);

		if (skippedPrefixes > 0) {
			logger.success(
				`Reorganized commands to /ck: prefix (preserved ${skippedPrefixes} pre-existing kit prefix${skippedPrefixes === 1 ? "" : "es"})`,
			);
		} else {
			logger.success("Successfully reorganized commands to /ck: prefix");
		}

		// Transform command references in file contents
		const claudeDir = join(extractDir, ".claude");
		logger.info("Transforming command references in file contents...");
		const transformResult = await transformCommandReferences(claudeDir, {
			verbose: logger.isVerbose(),
		});

		if (transformResult.totalReplacements > 0) {
			logger.success(
				`Transformed ${transformResult.totalReplacements} command ref(s) in ${transformResult.filesTransformed} file(s)`,
			);
		} else {
			logger.verbose("No command references needed transformation");
		}
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
