import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { copy, move, pathExists, remove } from "fs-extra";
import { logger } from "../utils/logger.js";

/**
 * CommandsPrefix - Reorganizes .claude/commands directory to add /ck: prefix
 *
 * Moves all command files from `.claude/commands/**\/*` to `.claude/commands/ck/**\/*`
 * This enables all slash commands to have a /ck: prefix (e.g., /ck:plan, /ck:fix)
 */
export class CommandsPrefix {
	/**
	 * Apply prefix reorganization to commands directory
	 * @param extractDir The temporary extraction directory containing .claude folder
	 */
	static async applyPrefix(extractDir: string): Promise<void> {
		const commandsDir = join(extractDir, ".claude", "commands");

		// Check if commands directory exists
		if (!(await pathExists(commandsDir))) {
			logger.verbose("No commands directory found, skipping prefix application");
			return;
		}

		logger.info("Applying /ck: prefix to slash commands...");

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

			// Create temporary directory for reorganization
			const tempDir = join(extractDir, ".commands-prefix-temp");
			await mkdir(tempDir, { recursive: true });

			// Create ck subdirectory in temp
			const ckDir = join(tempDir, "ck");
			await mkdir(ckDir, { recursive: true });

			// Move all current commands to ck subdirectory
			for (const entry of entries) {
				const sourcePath = join(commandsDir, entry);
				const destPath = join(ckDir, entry);

				// Copy the file/directory to the new location
				await copy(sourcePath, destPath, {
					overwrite: false,
					errorOnExist: true,
				});

				logger.verbose(`Moved ${entry} to ck/${entry}`);
			}

			// Remove old commands directory
			await remove(commandsDir);

			// Move reorganized directory to commands location
			await move(tempDir, commandsDir);

			logger.success("Successfully applied /ck: prefix to all commands");
		} catch (error) {
			// If reorganization fails, attempt cleanup
			const tempDir = join(extractDir, ".commands-prefix-temp");
			if (await pathExists(tempDir)) {
				await remove(tempDir).catch(() => {
					// Silent cleanup failure
				});
			}

			logger.error("Failed to apply /ck: prefix to commands");
			throw error;
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
