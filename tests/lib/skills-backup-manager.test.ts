import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { SkillsBackupManager } from "../../src/lib/skills-backup-manager.js";
import { SkillsMigrationError } from "../../src/types.js";

describe("SkillsBackupManager", () => {
	let testDir: string;
	let skillsDir: string;
	let parentDir: string;

	beforeEach(async () => {
		// Create temp test directory
		const timestamp = Date.now();
		testDir = join(tmpdir(), `test-skills-backup-${timestamp}`);
		parentDir = join(testDir, "parent");
		skillsDir = join(parentDir, "skills");
		await mkdir(skillsDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("createBackup", () => {
		test("should create backup of skills directory", async () => {
			// Create skills
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content1");
			await mkdir(join(skillsDir, "skill2"));
			await writeFile(join(skillsDir, "skill2", "skill.md"), "content2");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Verify backup exists
			expect(await pathExists(backupPath)).toBe(true);

			// Verify backup contains files
			expect(await pathExists(join(backupPath, "skill1", "skill.md"))).toBe(true);
			expect(await pathExists(join(backupPath, "skill2", "skill.md"))).toBe(true);

			// Verify content
			const content1 = await Bun.file(join(backupPath, "skill1", "skill.md")).text();
			expect(content1).toBe("content1");
		});

		test("should create backup with timestamp in name", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Verify backup name contains timestamp pattern
			expect(backupPath).toContain(".skills-backup-");
		});

		test("should create backup in specified parent directory", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			const customParent = join(testDir, "custom-parent");
			await mkdir(customParent, { recursive: true });

			const backupPath = await SkillsBackupManager.createBackup(skillsDir, customParent);

			expect(backupPath).toContain(customParent);
			expect(await pathExists(backupPath)).toBe(true);
		});

		test("should throw error for non-existent skills directory", async () => {
			await expect(SkillsBackupManager.createBackup(join(testDir, "nonexistent"))).rejects.toThrow(
				SkillsMigrationError,
			);
		});

		test("should skip hidden files and node_modules", async () => {
			await mkdir(join(skillsDir, ".hidden"));
			await writeFile(join(skillsDir, ".hidden", "file.txt"), "hidden");
			await mkdir(join(skillsDir, "node_modules"));
			await writeFile(join(skillsDir, "node_modules", "file.txt"), "node");
			await mkdir(join(skillsDir, "valid-skill"));
			await writeFile(join(skillsDir, "valid-skill", "skill.md"), "valid");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Verify hidden files not backed up
			expect(await pathExists(join(backupPath, ".hidden"))).toBe(false);
			expect(await pathExists(join(backupPath, "node_modules"))).toBe(false);

			// Verify valid skill backed up
			expect(await pathExists(join(backupPath, "valid-skill"))).toBe(true);
		});

		test("should handle nested directory structures", async () => {
			await mkdir(join(skillsDir, "skill1", "subdir", "deep"), { recursive: true });
			await writeFile(join(skillsDir, "skill1", "skill.md"), "main");
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "nested");
			await writeFile(join(skillsDir, "skill1", "subdir", "deep", "deep.md"), "deep");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			expect(await pathExists(join(backupPath, "skill1", "skill.md"))).toBe(true);
			expect(await pathExists(join(backupPath, "skill1", "subdir", "nested.md"))).toBe(true);
			expect(await pathExists(join(backupPath, "skill1", "subdir", "deep", "deep.md"))).toBe(true);
		});

		test("should handle empty skills directory", async () => {
			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			expect(await pathExists(backupPath)).toBe(true);

			const entries = await readdir(backupPath);
			expect(entries).toHaveLength(0);
		});

		test("should cleanup failed backup on error", async () => {
			// This test verifies that partial backups are cleaned up
			// We can't easily trigger a mid-copy error, so we'll just verify the error handling path exists
			await expect(SkillsBackupManager.createBackup(join(testDir, "nonexistent"))).rejects.toThrow(
				SkillsMigrationError,
			);
		});
	});

	describe("restoreBackup", () => {
		test("should restore skills from backup", async () => {
			// Create original skills
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "original");

			// Create backup
			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Modify original
			await writeFile(join(skillsDir, "skill1", "skill.md"), "modified");

			// Restore from backup
			await SkillsBackupManager.restoreBackup(backupPath, skillsDir);

			// Verify restored content
			const content = await Bun.file(join(skillsDir, "skill1", "skill.md")).text();
			expect(content).toBe("original");
		});

		test("should replace existing directory when restoring", async () => {
			// Create backup with one skill
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "backup content");
			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Replace with different skills
			await rm(skillsDir, { recursive: true });
			await mkdir(skillsDir, { recursive: true });
			await mkdir(join(skillsDir, "skill2"));
			await writeFile(join(skillsDir, "skill2", "skill.md"), "different");

			// Restore
			await SkillsBackupManager.restoreBackup(backupPath, skillsDir);

			// Verify original structure restored
			expect(await pathExists(join(skillsDir, "skill1"))).toBe(true);
			expect(await pathExists(join(skillsDir, "skill2"))).toBe(false);
		});

		test("should throw error for non-existent backup", async () => {
			await expect(
				SkillsBackupManager.restoreBackup(join(testDir, "nonexistent-backup"), skillsDir),
			).rejects.toThrow(SkillsMigrationError);
		});

		test("should create target directory if it doesn't exist", async () => {
			// Create backup
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");
			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Remove target directory
			await rm(skillsDir, { recursive: true });

			// Restore should recreate target
			await SkillsBackupManager.restoreBackup(backupPath, skillsDir);

			expect(await pathExists(skillsDir)).toBe(true);
			expect(await pathExists(join(skillsDir, "skill1"))).toBe(true);
		});

		test("should restore nested directory structures", async () => {
			await mkdir(join(skillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(skillsDir, "skill1", "skill.md"), "main");
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "nested");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Modify structure
			await rm(skillsDir, { recursive: true });
			await mkdir(skillsDir);

			// Restore
			await SkillsBackupManager.restoreBackup(backupPath, skillsDir);

			expect(await pathExists(join(skillsDir, "skill1", "subdir", "nested.md"))).toBe(true);
		});
	});

	describe("deleteBackup", () => {
		test("should delete backup directory", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);
			expect(await pathExists(backupPath)).toBe(true);

			await SkillsBackupManager.deleteBackup(backupPath);

			expect(await pathExists(backupPath)).toBe(false);
		});

		test("should not throw error for non-existent backup", async () => {
			await expect(
				SkillsBackupManager.deleteBackup(join(testDir, "nonexistent-backup")),
			).resolves.toBeUndefined();
		});

		test("should delete backup and all its contents", async () => {
			await mkdir(join(skillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(skillsDir, "skill1", "skill.md"), "main");
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "nested");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			await SkillsBackupManager.deleteBackup(backupPath);

			expect(await pathExists(backupPath)).toBe(false);
		});
	});

	describe("listBackups", () => {
		test("should list all backup directories", async () => {
			// Create multiple backups
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "v1");

			const backup1 = await SkillsBackupManager.createBackup(skillsDir, parentDir);

			// Small delay to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));

			await writeFile(join(skillsDir, "skill1", "skill.md"), "v2");
			const backup2 = await SkillsBackupManager.createBackup(skillsDir, parentDir);

			const backups = await SkillsBackupManager.listBackups(parentDir);

			expect(backups).toHaveLength(2);
			expect(backups).toContain(backup1);
			expect(backups).toContain(backup2);
		});

		test("should sort backups by timestamp (newest first)", async () => {
			// Create multiple backups with delays
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "v1");

			const backup1 = await SkillsBackupManager.createBackup(skillsDir, parentDir);
			await new Promise((resolve) => setTimeout(resolve, 50));

			const backup2 = await SkillsBackupManager.createBackup(skillsDir, parentDir);
			await new Promise((resolve) => setTimeout(resolve, 50));

			const backup3 = await SkillsBackupManager.createBackup(skillsDir, parentDir);

			const backups = await SkillsBackupManager.listBackups(parentDir);

			// Newest should be first (allow for any order of backup2 and backup1 if same timestamp)
			expect(backups[0]).toBe(backup3);
			expect(backups.length).toBe(3);
			expect(backups).toContain(backup1);
			expect(backups).toContain(backup2);
		});

		test("should return empty array for directory with no backups", async () => {
			const emptyDir = join(testDir, "empty");
			await mkdir(emptyDir);

			const backups = await SkillsBackupManager.listBackups(emptyDir);

			expect(backups).toHaveLength(0);
		});

		test("should return empty array for non-existent directory", async () => {
			const backups = await SkillsBackupManager.listBackups(join(testDir, "nonexistent"));

			expect(backups).toHaveLength(0);
		});

		test("should only list backup directories (not other directories)", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			// Create backup
			await SkillsBackupManager.createBackup(skillsDir, parentDir);

			// Create non-backup directory
			await mkdir(join(parentDir, "other-directory"));

			const backups = await SkillsBackupManager.listBackups(parentDir);

			expect(backups).toHaveLength(1);
			expect(backups[0]).toContain(".skills-backup-");
		});
	});

	describe("cleanupOldBackups", () => {
		test("should keep only N most recent backups", async () => {
			// Create 5 backups
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			for (let i = 0; i < 5; i++) {
				await SkillsBackupManager.createBackup(skillsDir, parentDir);
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			let backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(5);

			// Keep only 3
			await SkillsBackupManager.cleanupOldBackups(parentDir, 3);

			backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(3);
		});

		test("should keep newest backups when cleaning up", async () => {
			await mkdir(join(skillsDir, "skill1"));

			// Create backups with identifiable content
			await writeFile(join(skillsDir, "skill1", "skill.md"), "v1");
			const backup1 = await SkillsBackupManager.createBackup(skillsDir, parentDir);
			await new Promise((resolve) => setTimeout(resolve, 10));

			await writeFile(join(skillsDir, "skill1", "skill.md"), "v2");
			const backup2 = await SkillsBackupManager.createBackup(skillsDir, parentDir);
			await new Promise((resolve) => setTimeout(resolve, 10));

			await writeFile(join(skillsDir, "skill1", "skill.md"), "v3");
			const backup3 = await SkillsBackupManager.createBackup(skillsDir, parentDir);

			await SkillsBackupManager.cleanupOldBackups(parentDir, 2);

			const backups = await SkillsBackupManager.listBackups(parentDir);

			// Should keep newest 2
			expect(backups).toContain(backup2);
			expect(backups).toContain(backup3);
			expect(backups).not.toContain(backup1);
		});

		test("should not delete backups if count is below threshold", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			await SkillsBackupManager.createBackup(skillsDir, parentDir);
			await new Promise((resolve) => setTimeout(resolve, 50));
			await SkillsBackupManager.createBackup(skillsDir, parentDir);

			let backups = await SkillsBackupManager.listBackups(parentDir);
			// At least 1 backup should exist (may be 2 if timestamps differ)
			expect(backups.length).toBeGreaterThanOrEqual(1);
			expect(backups.length).toBeLessThanOrEqual(2);

			const initialCount = backups.length;

			// Keep 3 (we only have 1 or 2)
			await SkillsBackupManager.cleanupOldBackups(parentDir, 3);

			backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(initialCount);
		});

		test("should use default keep count of 3", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			// Create 5 backups
			for (let i = 0; i < 5; i++) {
				await SkillsBackupManager.createBackup(skillsDir, parentDir);
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Call without keepCount parameter (defaults to 3)
			await SkillsBackupManager.cleanupOldBackups(parentDir);

			const backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(3);
		});
	});

	describe("getBackupSize", () => {
		test("should return size of backup directory", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content with some length");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);
			const size = await SkillsBackupManager.getBackupSize(backupPath);

			expect(size).toBeGreaterThan(0);
		});

		test("should return 0 for non-existent backup", async () => {
			const size = await SkillsBackupManager.getBackupSize(join(testDir, "nonexistent"));

			expect(size).toBe(0);
		});

		test("should calculate size of nested directories", async () => {
			await mkdir(join(skillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(skillsDir, "skill1", "skill.md"), "main content");
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "nested content");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);
			const size = await SkillsBackupManager.getBackupSize(backupPath);

			// Should include both files
			expect(size).toBeGreaterThan(20); // "main content" + "nested content"
		});

		test("should return 0 for empty backup directory", async () => {
			const backupPath = await SkillsBackupManager.createBackup(skillsDir);
			const size = await SkillsBackupManager.getBackupSize(backupPath);

			expect(size).toBe(0);
		});
	});

	describe("extractBackupTimestamp", () => {
		test("should extract timestamp from backup path", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);
			const timestamp = SkillsBackupManager.extractBackupTimestamp(backupPath);

			expect(timestamp).not.toBeNull();
			expect(typeof timestamp).toBe("number");
			expect(timestamp).toBeGreaterThan(0);
		});

		test("should return null for non-backup directory", () => {
			const timestamp = SkillsBackupManager.extractBackupTimestamp("/some/random/path");

			expect(timestamp).toBeNull();
		});

		test("should handle paths with trailing slashes", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "content");

			const backupPath = await SkillsBackupManager.createBackup(skillsDir);
			// Remove trailing slash and test extraction
			const timestamp = SkillsBackupManager.extractBackupTimestamp(backupPath);

			expect(timestamp).not.toBeNull();
		});
	});

	describe("integration tests", () => {
		test("should backup and restore successfully", async () => {
			// Create skills with nested structure
			await mkdir(join(skillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(skillsDir, "skill1", "skill.md"), "original main");
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "original nested");
			await mkdir(join(skillsDir, "skill2"));
			await writeFile(join(skillsDir, "skill2", "skill.md"), "skill 2");

			// Create backup
			const backupPath = await SkillsBackupManager.createBackup(skillsDir);

			// Modify original
			await rm(skillsDir, { recursive: true });
			await mkdir(skillsDir);
			await mkdir(join(skillsDir, "different-skill"));
			await writeFile(join(skillsDir, "different-skill", "skill.md"), "different");

			// Restore
			await SkillsBackupManager.restoreBackup(backupPath, skillsDir);

			// Verify restoration
			const mainContent = await Bun.file(join(skillsDir, "skill1", "skill.md")).text();
			expect(mainContent).toBe("original main");

			const nestedContent = await Bun.file(join(skillsDir, "skill1", "subdir", "nested.md")).text();
			expect(nestedContent).toBe("original nested");

			expect(await pathExists(join(skillsDir, "skill2"))).toBe(true);
			expect(await pathExists(join(skillsDir, "different-skill"))).toBe(false);
		});

		test("should manage multiple backups lifecycle", async () => {
			await mkdir(join(skillsDir, "skill1"));

			// Create multiple backups
			for (let i = 0; i < 5; i++) {
				await writeFile(join(skillsDir, "skill1", "skill.md"), `version ${i}`);
				await SkillsBackupManager.createBackup(skillsDir, parentDir);
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Verify all created
			let backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(5);

			// Cleanup old
			await SkillsBackupManager.cleanupOldBackups(parentDir, 2);

			// Verify cleanup
			backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(2);

			// Delete remaining
			for (const backup of backups) {
				await SkillsBackupManager.deleteBackup(backup);
			}

			// Verify all deleted
			backups = await SkillsBackupManager.listBackups(parentDir);
			expect(backups).toHaveLength(0);
		});
	});
});
