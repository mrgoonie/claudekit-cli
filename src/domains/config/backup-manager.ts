import { existsSync } from "node:fs";
import { copyFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";

export interface BackupOptions {
	maxBackups?: number;
	backupDir?: string;
}

const DEFAULT_MAX_BACKUPS = 5;

/**
 * Backup Manager - auto-backup config files before modifications
 * Strategy: Alongside config files (.ck.json.{timestamp}.bak)
 */
export class BackupManager {
	/**
	 * Create backup of config file before modification
	 * @returns Backup path or null if source doesn't exist
	 */
	static async createBackup(
		configPath: string,
		options: BackupOptions = {},
	): Promise<string | null> {
		if (!existsSync(configPath)) {
			return null;
		}

		const backupDir = options.backupDir ?? dirname(configPath);
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = configPath.split("/").pop() || "config";
		const backupPath = join(backupDir, `${fileName}.${timestamp}.bak`);

		try {
			// Copy file to backup
			await copyFile(configPath, backupPath);
			logger.debug(`Created backup: ${backupPath}`);

			// Cleanup old backups
			await BackupManager.cleanupOldBackups(
				backupDir,
				fileName,
				options.maxBackups ?? DEFAULT_MAX_BACKUPS,
			);

			return backupPath;
		} catch (error) {
			logger.warning(`Failed to create backup: ${error instanceof Error ? error.message : "Unknown"}`);
			return null;
		}
	}

	/**
	 * Atomic write with backup
	 * 1. Create backup of existing file
	 * 2. Write to temp file
	 * 3. Rename temp to target (atomic on POSIX)
	 */
	static async atomicWrite(
		configPath: string,
		content: string,
		options: BackupOptions = {},
	): Promise<{ success: boolean; backupPath: string | null }> {
		const backupPath = await BackupManager.createBackup(configPath, options);
		const tempPath = `${configPath}.tmp.${Date.now()}`;

		try {
			// Write to temp file
			await writeFile(tempPath, content, "utf-8");

			// Atomic rename
			await rename(tempPath, configPath);
			logger.debug(`Atomic write complete: ${configPath}`);

			return { success: true, backupPath };
		} catch (error) {
			// Cleanup temp file on failure
			try {
				if (existsSync(tempPath)) await rm(tempPath);
			} catch {
				/* ignore cleanup errors */
			}

			logger.error(`Atomic write failed: ${error instanceof Error ? error.message : "Unknown"}`);
			return { success: false, backupPath };
		}
	}

	/**
	 * List backups for a config file
	 */
	static async listBackups(configPath: string): Promise<string[]> {
		const dir = dirname(configPath);
		const fileName = configPath.split("/").pop() || "config";

		try {
			const files = await readdir(dir);
			return files
				.filter((f) => f.startsWith(fileName) && f.endsWith(".bak"))
				.sort()
				.reverse(); // Newest first
		} catch {
			return [];
		}
	}

	/**
	 * Restore from backup
	 */
	static async restore(backupPath: string, configPath: string): Promise<boolean> {
		if (!existsSync(backupPath)) {
			logger.error(`Backup not found: ${backupPath}`);
			return false;
		}

		try {
			await copyFile(backupPath, configPath);
			logger.info(`Restored from backup: ${backupPath}`);
			return true;
		} catch (error) {
			logger.error(`Restore failed: ${error instanceof Error ? error.message : "Unknown"}`);
			return false;
		}
	}

	/**
	 * Cleanup old backups, keeping only the most recent N backups
	 */
	private static async cleanupOldBackups(
		dir: string,
		fileName: string,
		maxBackups: number,
	): Promise<void> {
		try {
			const files = await readdir(dir);
			const backups = files
				.filter((f) => f.startsWith(fileName) && f.endsWith(".bak"))
				.sort()
				.reverse(); // Newest first

			// Remove excess backups
			for (let i = maxBackups; i < backups.length; i++) {
				const oldBackup = join(dir, backups[i]);
				await rm(oldBackup);
				logger.debug(`Removed old backup: ${oldBackup}`);
			}
		} catch {
			// Ignore cleanup errors
		}
	}
}
