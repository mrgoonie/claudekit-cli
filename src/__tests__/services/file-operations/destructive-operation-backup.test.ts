import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { chmod, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	createDestructiveOperationBackup,
	loadDestructiveOperationBackup,
	restoreDestructiveOperationBackup,
} from "@/services/file-operations/destructive-operation-backup.js";
import { type TestPaths, setupTestPaths } from "../../../../tests/helpers/test-paths.js";

describe("destructive operation backup", () => {
	let testPaths: TestPaths;
	let sourceRoot: string;

	beforeEach(async () => {
		testPaths = setupTestPaths();
		sourceRoot = join(testPaths.testHome, "installation", ".claude");
		await mkdir(sourceRoot, { recursive: true });
	});

	afterEach(async () => {
		await rm(join(testPaths.testHome, "installation"), { recursive: true, force: true });
		testPaths.cleanup();
	});

	test("creates snapshots and a manifest under CK-owned backup storage", async () => {
		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await mkdir(join(sourceRoot, "rules", "nested"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "command");
		await writeFile(join(sourceRoot, "rules", "nested", "rule.md"), "rule");
		await writeFile(join(sourceRoot, "metadata.json"), '{"version":"1.0.0"}');

		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md", "rules"],
			mutatePaths: ["metadata.json"],
			scope: "claude",
		});

		expect(backup.backupDir).toStartWith(join(testPaths.testHome, ".claudekit", "backups"));
		expect(backup.manifest.operation).toBe("fresh-install");
		expect(backup.manifest.items.map((item) => item.path).sort()).toEqual([
			"commands/test.md",
			"metadata.json",
			"rules",
		]);
		expect(existsSync(join(backup.backupDir, "snapshot", "commands", "test.md"))).toBe(true);
		expect(existsSync(join(backup.backupDir, "snapshot", "rules", "nested", "rule.md"))).toBe(true);
		expect(existsSync(join(backup.backupDir, "snapshot", "metadata.json"))).toBe(true);
	});

	test("restores deleted and mutated paths from backup", async () => {
		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "original command");
		await writeFile(join(sourceRoot, "metadata.json"), '{"version":"1.0.0"}');

		const backup = await createDestructiveOperationBackup({
			operation: "uninstall",
			sourceRoot,
			deletePaths: ["commands"],
			mutatePaths: ["metadata.json"],
			scope: "local",
		});

		await rm(join(sourceRoot, "commands"), { recursive: true, force: true });
		await writeFile(join(sourceRoot, "metadata.json"), '{"version":"broken"}');

		await restoreDestructiveOperationBackup(backup);

		expect(await readFile(join(sourceRoot, "commands", "test.md"), "utf8")).toBe(
			"original command",
		);
		expect(await readFile(join(sourceRoot, "metadata.json"), "utf8")).toBe('{"version":"1.0.0"}');
	});

	test("loads a valid manifest from CK-managed backup storage", async () => {
		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "command");

		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		const loaded = await loadDestructiveOperationBackup(backup.backupDir);

		expect(loaded.manifest.operation).toBe("fresh-install");
		expect(loaded.manifest.items.map((item) => item.path)).toEqual(["commands/test.md"]);
	});

	test("rejects malformed manifests when loading a backup", async () => {
		const backupDir = join(testPaths.testHome, ".claudekit", "backups", "manual-invalid");
		await mkdir(backupDir, { recursive: true });
		await writeFile(
			join(backupDir, "manifest.json"),
			JSON.stringify({
				version: 1,
				operation: "fresh-install",
				createdAt: new Date().toISOString(),
				sourceRoot: "/tmp/unsafe",
				items: [
					{ path: "../escape", mode: "delete", kind: "file", snapshotPath: "snapshot/../escape" },
				],
				restoreNotes: [],
			}),
		);

		await expect(loadDestructiveOperationBackup(backupDir)).rejects.toThrow();
	});

	test("rejects relative sourceRoot values when loading a backup", async () => {
		const backupDir = join(testPaths.testHome, ".claudekit", "backups", "manual-relative-root");
		await mkdir(backupDir, { recursive: true });
		await writeFile(
			join(backupDir, "manifest.json"),
			JSON.stringify({
				version: 1,
				operation: "fresh-install",
				createdAt: new Date().toISOString(),
				sourceRoot: ".",
				items: [],
				restoreNotes: [],
			}),
		);

		await expect(loadDestructiveOperationBackup(backupDir)).rejects.toThrow(
			"source root must be absolute",
		);
	});

	test("backs up and restores safe in-tree symlinks", async () => {
		if (process.platform === "win32") {
			return;
		}

		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "target.md"), "target");
		await symlink("target.md", join(sourceRoot, "commands", "alias.md"));

		const backup = await createDestructiveOperationBackup({
			operation: "uninstall",
			sourceRoot,
			deletePaths: ["commands/alias.md"],
		});

		await rm(join(sourceRoot, "commands", "alias.md"));
		await restoreDestructiveOperationBackup(backup);

		expect((await readlink(join(sourceRoot, "commands", "alias.md"))).replaceAll("\\", "/")).toBe(
			"target.md",
		);
	});

	test("rejects unsafe paths that escape the installation root", async () => {
		await expect(
			createDestructiveOperationBackup({
				operation: "fresh-install",
				sourceRoot,
				deletePaths: ["../outside.txt"],
			}),
		).rejects.toThrow("Path escapes installation root");
	});

	test("collapses nested targets when a parent directory is already being backed up", async () => {
		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "command");

		const backup = await createDestructiveOperationBackup({
			operation: "uninstall",
			sourceRoot,
			deletePaths: ["commands", "commands/test.md"],
		});

		expect(backup.manifest.items.map((item) => item.path)).toEqual(["commands"]);
	});

	test("keeps the current destination intact when rollback staging copy fails", async () => {
		if (process.platform === "win32") {
			return;
		}

		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "original");

		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		await writeFile(join(sourceRoot, "commands", "test.md"), "current-state");
		await chmod(join(sourceRoot, "commands"), 0o555);

		try {
			await expect(restoreDestructiveOperationBackup(backup)).rejects.toThrow();
			expect(await readFile(join(sourceRoot, "commands", "test.md"), "utf8")).toBe("current-state");
		} finally {
			await chmod(join(sourceRoot, "commands"), 0o755);
		}
	});

	test("removes the backup directory if snapshot creation fails partway through", async () => {
		if (process.platform === "win32") {
			return;
		}

		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "ok.md"), "ok");
		await writeFile(join(testPaths.testHome, "outside.md"), "outside");
		await symlink(join(testPaths.testHome, "outside.md"), join(sourceRoot, "commands", "link.md"));

		const backupRoot = join(testPaths.testHome, ".claudekit", "backups");
		const before = existsSync(backupRoot) ? readdirSync(backupRoot).length : 0;

		await expect(
			createDestructiveOperationBackup({
				operation: "uninstall",
				sourceRoot,
				deletePaths: ["commands/ok.md", "commands/link.md"],
			}),
		).rejects.toThrow("Symlink target escapes installation root");

		const after = existsSync(backupRoot) ? readdirSync(backupRoot).length : 0;
		expect(after).toBe(before);
	});

	test("rejects restores that would traverse a symlinked parent directory", async () => {
		if (process.platform === "win32") {
			return;
		}

		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "original");
		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		await rm(join(sourceRoot, "commands"), { recursive: true, force: true });
		await mkdir(join(testPaths.testHome, "escaped"), { recursive: true });
		await symlink(join(testPaths.testHome, "escaped"), join(sourceRoot, "commands"));

		await expect(restoreDestructiveOperationBackup(backup)).rejects.toThrow(
			"symlinked parent directory",
		);
	});

	test("rejects backup directories that are symlinks outside CK-managed storage", async () => {
		if (process.platform === "win32") {
			return;
		}

		const outsideDir = join(testPaths.testHome, "outside-backup");
		await mkdir(outsideDir, { recursive: true });
		await writeFile(
			join(outsideDir, "manifest.json"),
			JSON.stringify({
				version: 1,
				operation: "fresh-install",
				createdAt: new Date().toISOString(),
				sourceRoot,
				items: [],
				restoreNotes: [],
			}),
		);

		await mkdir(join(testPaths.testHome, ".claudekit", "backups"), { recursive: true });
		const symlinkDir = join(testPaths.testHome, ".claudekit", "backups", "linked-outside");
		await symlink(outsideDir, symlinkDir);

		await expect(loadDestructiveOperationBackup(symlinkDir)).rejects.toThrow(
			"outside ClaudeKit-managed storage",
		);
	});

	test("rejects nested directory symlinks that escape the installation root", async () => {
		if (process.platform === "win32") {
			return;
		}

		await mkdir(join(sourceRoot, "commands", "nested"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "nested", "ok.md"), "ok");
		await writeFile(join(testPaths.testHome, "outside.md"), "outside");
		await symlink(
			join(testPaths.testHome, "outside.md"),
			join(sourceRoot, "commands", "nested", "link.md"),
		);

		await expect(
			createDestructiveOperationBackup({
				operation: "uninstall",
				sourceRoot,
				deletePaths: ["commands"],
			}),
		).rejects.toThrow("Nested symlink target escapes installation root");
	});
});
