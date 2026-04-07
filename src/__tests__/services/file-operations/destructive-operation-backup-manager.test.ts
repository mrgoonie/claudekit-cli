import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT,
	cleanupOldDestructiveOperationBackups,
	deleteDestructiveOperationBackup,
	getDestructiveOperationBackupDir,
	listDestructiveOperationBackups,
	pruneDestructiveOperationBackups,
} from "@/services/file-operations/destructive-operation-backup-manager.js";
import { type TestPaths, setupTestPaths } from "../../../../tests/helpers/test-paths.js";

describe("destructive operation backup manager", () => {
	let testPaths: TestPaths;
	let backupsRoot: string;

	beforeEach(async () => {
		testPaths = setupTestPaths();
		backupsRoot = join(testPaths.testHome, ".claudekit", "backups");
		await mkdir(backupsRoot, { recursive: true });
	});

	afterEach(async () => {
		await rm(backupsRoot, { recursive: true, force: true });
		testPaths.cleanup();
	});

	async function createBackupDir(
		id: string,
		manifest: Record<string, unknown>,
		extraFile = "snapshot/file.txt",
	): Promise<string> {
		const backupDir = join(backupsRoot, id);
		await mkdir(join(backupDir, "snapshot"), { recursive: true });
		await writeFile(join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));
		await writeFile(join(backupDir, extraFile), "payload");
		return backupDir;
	}

	test("lists valid and invalid backups newest first", async () => {
		await createBackupDir("2026-04-06T10-00-00-000-abcd", {
			version: 1,
			operation: "fresh-install",
			createdAt: "2026-04-06T10:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-a", ".claude"),
			items: [],
			restoreNotes: [],
		});
		await createBackupDir("2026-04-05T09-00-00-000-bad1", {
			version: 999,
			broken: true,
		});

		const backups = await listDestructiveOperationBackups();

		expect(backups.map((backup) => backup.id)).toEqual([
			"2026-04-06T10-00-00-000-abcd",
			"2026-04-05T09-00-00-000-bad1",
		]);
		expect(backups[0].valid).toBe(true);
		expect(backups[1].valid).toBe(false);
	});

	test("prunes old backups while keeping the newest N", async () => {
		await createBackupDir("2026-04-06T10-00-00-000-a001", {
			version: 1,
			operation: "fresh-install",
			createdAt: "2026-04-06T10:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-a", ".claude"),
			items: [],
			restoreNotes: [],
		});
		await createBackupDir("2026-04-06T11-00-00-000-a002", {
			version: 1,
			operation: "uninstall",
			createdAt: "2026-04-06T11:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-b", ".claude"),
			items: [],
			restoreNotes: [],
		});
		await createBackupDir("2026-04-06T12-00-00-000-a003", {
			version: 1,
			operation: "uninstall",
			createdAt: "2026-04-06T12:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-c", ".claude"),
			items: [],
			restoreNotes: [],
		});

		const result = await pruneDestructiveOperationBackups({ keepCount: 2 });

		expect(result.deletedIds).toEqual(["2026-04-06T10-00-00-000-a001"]);
		expect(await listDestructiveOperationBackups()).toHaveLength(2);
	});

	test("resolves and deletes a specific backup id safely", async () => {
		await createBackupDir("2026-04-06T10-00-00-000-safe", {
			version: 1,
			operation: "fresh-install",
			createdAt: "2026-04-06T10:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-a", ".claude"),
			items: [],
			restoreNotes: [],
		});

		expect(await getDestructiveOperationBackupDir("2026-04-06T10-00-00-000-safe")).toContain(
			"2026-04-06T10-00-00-000-safe",
		);

		await deleteDestructiveOperationBackup("2026-04-06T10-00-00-000-safe");
		expect(await listDestructiveOperationBackups()).toHaveLength(0);
	});

	test("cleanup keeps the configured total count when excluding the newest current backup", async () => {
		for (let index = 0; index < DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT + 1; index++) {
			const hour = String(index).padStart(2, "0");
			await createBackupDir(`2026-04-06T${hour}-00-00-000-a${index}`, {
				version: 1,
				operation: "fresh-install",
				createdAt: `2026-04-06T${hour}:00:00.000Z`,
				sourceRoot: join(testPaths.testHome, `project-${index}`, ".claude"),
				items: [],
				restoreNotes: [],
			});
		}

		await cleanupOldDestructiveOperationBackups(
			DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT,
			"2026-04-06T10-00-00-000-a10",
		);

		expect(await listDestructiveOperationBackups()).toHaveLength(
			DEFAULT_DESTRUCTIVE_BACKUP_KEEP_COUNT,
		);
	});

	test("prune keeps the newest valid backups instead of lexically-high invalid directories", async () => {
		await createBackupDir("zz-invalid-dir", {
			version: 999,
			createdAt: "bad",
		});
		await createBackupDir("2026-04-06T10-00-00-000-a001", {
			version: 1,
			operation: "fresh-install",
			createdAt: "2026-04-06T10:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-a", ".claude"),
			items: [],
			restoreNotes: [],
		});
		await createBackupDir("2026-04-06T11-00-00-000-a002", {
			version: 1,
			operation: "uninstall",
			createdAt: "2026-04-06T11:00:00.000Z",
			sourceRoot: join(testPaths.testHome, "project-b", ".claude"),
			items: [],
			restoreNotes: [],
		});

		const result = await pruneDestructiveOperationBackups({ keepCount: 1 });

		expect(result.deletedIds).toContain("zz-invalid-dir");
		expect((await listDestructiveOperationBackups()).map((backup) => backup.id)).toContain(
			"2026-04-06T11-00-00-000-a002",
		);
	});
});
