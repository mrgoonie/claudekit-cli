/**
 * Backup and restore functionality for swarm patches
 * Uses .ck-backup suffix to avoid conflicts with claude-sneakpeek
 */

import {
	copyFileSync,
	existsSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";

/**
 * Get the backup path for a given cli.js file
 *
 * @param cliJsPath - Path to the cli.js file
 * @returns Path to the backup file
 */
export function getBackupPath(cliJsPath: string): string {
	return `${cliJsPath}.ck-backup`;
}

/**
 * Check if a backup exists for the given cli.js file
 *
 * @param cliJsPath - Path to the cli.js file
 * @returns True if backup exists, false otherwise
 */
export function hasBackup(cliJsPath: string): boolean {
	const backupPath = getBackupPath(cliJsPath);
	return existsSync(backupPath);
}

/**
 * Create a backup of the cli.js file
 *
 * @param cliJsPath - Path to the cli.js file
 * @returns Path to the created backup file
 * @throws Error if backup fails
 */
export async function createBackup(cliJsPath: string): Promise<string> {
	if (!existsSync(cliJsPath)) {
		throw new Error(`Cannot backup: cli.js not found at ${cliJsPath}`);
	}

	const backupPath = getBackupPath(cliJsPath);

	// If backup already exists, verify it's valid before overwriting
	if (existsSync(backupPath)) {
		try {
			// Try to read the backup to ensure it's valid
			readFileSync(backupPath, "utf8");
			// Backup exists and is valid - no need to create new one
			return backupPath;
		} catch {
			// Backup is corrupted - remove and create new one
			unlinkSync(backupPath);
		}
	}

	try {
		// Create backup by copying the file
		copyFileSync(cliJsPath, backupPath);
		return backupPath;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to create backup: ${message}`);
	}
}

/**
 * Restore the cli.js file from backup
 *
 * @param cliJsPath - Path to the cli.js file
 * @throws Error if restore fails or backup doesn't exist
 */
export async function restoreFromBackup(cliJsPath: string): Promise<void> {
	const backupPath = getBackupPath(cliJsPath);
	const tempPath = `${cliJsPath}.tmp`;

	if (!existsSync(backupPath)) {
		throw new Error(`Cannot restore: backup not found at ${backupPath}`);
	}

	try {
		const backupContent = readFileSync(backupPath, "utf8");

		// Atomic: write to temp, then rename
		writeFileSync(tempPath, backupContent, "utf8");
		renameSync(tempPath, cliJsPath);

		// Only delete backup after successful restore
		unlinkSync(backupPath);
	} catch (error) {
		// Clean up temp file on error
		if (existsSync(tempPath)) {
			try {
				unlinkSync(tempPath);
			} catch {}
		}
		throw new Error(`Failed to restore: ${error instanceof Error ? error.message : String(error)}`);
	}
}
