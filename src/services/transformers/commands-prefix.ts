/**
 * Commands Prefix - Facade Module
 *
 * Reorganizes .claude/commands directory to add /ck: prefix.
 * Moves all command files from `.claude/commands/**\/*` to `.claude/commands/ck/**\/*`
 * This enables all slash commands to have a /ck: prefix (e.g., /ck:plan, /ck:fix)
 *
 * This file re-exports all public APIs from the modular implementation.
 */

// Re-export types
export type { CleanupOptions } from "./commands-prefix/prefix-utils.js";
export type { CleanupResult } from "./commands-prefix/prefix-cleaner.js";

// Import functions for class-based API
import { applyPrefix } from "./commands-prefix/prefix-applier.js";
import { cleanupCommandsDirectory } from "./commands-prefix/prefix-cleaner.js";
import { shouldApplyPrefix } from "./commands-prefix/prefix-utils.js";

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
	static applyPrefix = applyPrefix;

	/**
	 * Check if prefix should be applied based on options
	 * @param options Command options object
	 * @returns true if --prefix flag is set
	 */
	static shouldApplyPrefix = shouldApplyPrefix;

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
	 */
	static cleanupCommandsDirectory = cleanupCommandsDirectory;
}
