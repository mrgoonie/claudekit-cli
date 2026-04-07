import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	createDestructiveOperationBackup,
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
});
