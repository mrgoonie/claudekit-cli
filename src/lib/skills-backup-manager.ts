import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { SkillsMigrationError } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Manages backup and rollback of skills directory during migration
 * Provides safety net for migration process
 */
export class SkillsBackupManager {
	private static readonly BACKUP_PREFIX = ".skills-backup-";

	/**
	 * Create backup of skills directory
	 *
	 * @param skillsDir Path to skills directory
	 * @param parentDir Parent directory for backup (defaults to skillsDir parent)
	 * @returns Path to backup directory
	 */
	static async createBackup(skillsDir: string, parentDir?: string): Promise<string> {
		if (!(await pathExists(skillsDir))) {
			throw new SkillsMigrationError(
				`Cannot create backup: Skills directory does not exist: ${skillsDir}`,
			);
		}

		// Generate backup directory name with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupDirName = `${SkillsBackupManager.BACKUP_PREFIX}${timestamp}`;
		const backupDir = parentDir
			? join(parentDir, backupDirName)
			: join(skillsDir, "..", backupDirName);

		logger.info(`Creating backup at: ${backupDir}`);

		try {
			// Create backup directory
			await mkdir(backupDir, { recursive: true });

			// Copy all files
			await SkillsBackupManager.copyDirectory(skillsDir, backupDir);

			logger.success("Backup created successfully");
			return backupDir;
		} catch (error) {
			// Cleanup failed backup
			try {
				await rm(backupDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}

			throw new SkillsMigrationError(
				`Failed to create backup: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Restore skills directory from backup
	 *
	 * @param backupDir Path to backup directory
	 * @param targetDir Path to target skills directory
	 */
	static async restoreBackup(backupDir: string, targetDir: string): Promise<void> {
		if (!(await pathExists(backupDir))) {
			throw new SkillsMigrationError(
				`Cannot restore: Backup directory does not exist: ${backupDir}`,
			);
		}

		logger.info(`Restoring from backup: ${backupDir}`);

		try {
			// Remove current skills directory if exists
			if (await pathExists(targetDir)) {
				await rm(targetDir, { recursive: true, force: true });
			}

			// Create target directory
			await mkdir(targetDir, { recursive: true });

			// Copy backup to target
			await SkillsBackupManager.copyDirectory(backupDir, targetDir);

			logger.success("Backup restored successfully");
		} catch (error) {
			throw new SkillsMigrationError(
				`Failed to restore backup: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Delete backup directory
	 *
	 * @param backupDir Path to backup directory
	 */
	static async deleteBackup(backupDir: string): Promise<void> {
		if (!(await pathExists(backupDir))) {
			logger.warning(`Backup directory does not exist: ${backupDir}`);
			return;
		}

		logger.debug(`Deleting backup: ${backupDir}`);

		try {
			await rm(backupDir, { recursive: true, force: true });
			logger.debug("Backup deleted successfully");
		} catch (error) {
			logger.warning(
				`Failed to delete backup: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * List all backups in a directory
	 *
	 * @param parentDir Parent directory to search for backups
	 * @returns Array of backup directory paths
	 */
	static async listBackups(parentDir: string): Promise<string[]> {
		if (!(await pathExists(parentDir))) {
			return [];
		}

		try {
			const entries = await readdir(parentDir, { withFileTypes: true });
			const backups = entries
				.filter(
					(entry) =>
						entry.isDirectory() && entry.name.startsWith(SkillsBackupManager.BACKUP_PREFIX),
				)
				.map((entry) => join(parentDir, entry.name));

			// Sort by timestamp (newest first)
			backups.sort().reverse();

			return backups;
		} catch (error) {
			logger.warning(
				`Failed to list backups: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return [];
		}
	}

	/**
	 * Clean up old backups (keep only N most recent)
	 *
	 * @param parentDir Parent directory containing backups
	 * @param keepCount Number of backups to keep (default: 3)
	 */
	static async cleanupOldBackups(parentDir: string, keepCount = 3): Promise<void> {
		const backups = await SkillsBackupManager.listBackups(parentDir);

		if (backups.length <= keepCount) {
			return;
		}

		const toDelete = backups.slice(keepCount);
		logger.debug(`Cleaning up ${toDelete.length} old backup(s)`);

		for (const backup of toDelete) {
			await SkillsBackupManager.deleteBackup(backup);
		}
	}

	/**
	 * Get backup size in bytes
	 *
	 * @param backupDir Path to backup directory
	 * @returns Size in bytes
	 */
	static async getBackupSize(backupDir: string): Promise<number> {
		if (!(await pathExists(backupDir))) {
			return 0;
		}

		return await SkillsBackupManager.getDirectorySize(backupDir);
	}

	/**
	 * Copy directory recursively
	 *
	 * @param sourceDir Source directory
	 * @param destDir Destination directory
	 */
	private static async copyDirectory(sourceDir: string, destDir: string): Promise<void> {
		const entries = await readdir(sourceDir, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath = join(sourceDir, entry.name);
			const destPath = join(destDir, entry.name);

			// Skip hidden files and node_modules
			if (entry.name.startsWith(".") || entry.name === "node_modules") {
				continue;
			}

			if (entry.isDirectory()) {
				await mkdir(destPath, { recursive: true });
				await SkillsBackupManager.copyDirectory(sourcePath, destPath);
			} else if (entry.isFile()) {
				await copyFile(sourcePath, destPath);
			}
		}
	}

	/**
	 * Get directory size recursively
	 *
	 * @param dirPath Directory path
	 * @returns Size in bytes
	 */
	private static async getDirectorySize(dirPath: string): Promise<number> {
		let size = 0;
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);

			if (entry.isDirectory()) {
				size += await SkillsBackupManager.getDirectorySize(fullPath);
			} else if (entry.isFile()) {
				const stats = await stat(fullPath);
				size += stats.size;
			}
		}

		return size;
	}

	/**
	 * Extract timestamp from backup directory name
	 *
	 * @param backupPath Path to backup directory
	 * @returns ISO timestamp string or null
	 */
	static extractBackupTimestamp(backupPath: string): string | null {
		const basename = backupPath.split("/").pop() || "";
		if (!basename.startsWith(SkillsBackupManager.BACKUP_PREFIX)) {
			return null;
		}

		const timestamp = basename.replace(SkillsBackupManager.BACKUP_PREFIX, "").replace(/-/g, ":");
		return timestamp;
	}
}
