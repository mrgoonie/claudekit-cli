import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCliInstance } from "@/cli/cli-config.js";
import { registerCommands } from "@/cli/command-registry.js";
import { createDestructiveOperationBackup } from "@/services/file-operations/destructive-operation-backup.js";
import { type TestPaths, setupTestPaths } from "../helpers/test-paths.js";

describe("backups command handlers", () => {
	let testPaths: TestPaths;
	let sourceRoot: string;
	let originalLog: typeof console.log;
	let originalError: typeof console.error;

	beforeEach(async () => {
		testPaths = setupTestPaths();
		sourceRoot = join(testPaths.testHome, "project", ".claude");
		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "test.md"), "original");

		originalLog = console.log;
		originalError = console.error;
		process.exitCode = undefined;
		console.log = mock(() => {}) as typeof console.log;
		console.error = mock(() => {}) as typeof console.error;
	});

	afterEach(async () => {
		console.log = originalLog;
		console.error = originalError;
		process.exitCode = undefined;
		await rm(join(testPaths.testHome, "project"), { recursive: true, force: true });
		testPaths.cleanup();
	});

	test("lists backups in JSON mode", async () => {
		await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		const { handleBackupsList } = await import("../../src/commands/backups/index.js");
		await handleBackupsList({ json: true });

		const output = (console.log as ReturnType<typeof mock>).mock.calls[0]?.[0];
		const parsed = JSON.parse(String(output));
		expect(parsed).toHaveLength(1);
		expect(parsed[0].operation).toBe("fresh-install");
	});

	test("dispatches through the real CLI parser", async () => {
		await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		const cli = createCliInstance();
		registerCommands(cli);
		cli.parse(["node", "ck", "backups", "list", "--json"]);
		await cli.runMatchedCommand();

		const output = (console.log as ReturnType<typeof mock>).mock.calls[0]?.[0];
		const parsed = JSON.parse(String(output));
		expect(parsed).toHaveLength(1);
	});

	test("restores a backup by id", async () => {
		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});
		await rm(join(sourceRoot, "commands", "test.md"));

		const { handleBackupsRestore } = await import("../../src/commands/backups/index.js");
		await handleBackupsRestore(backup.backupDir.split("/").pop() as string, {
			yes: true,
			json: true,
		});

		expect(await Bun.file(join(sourceRoot, "commands", "test.md")).text()).toBe("original");
		const output = (console.log as ReturnType<typeof mock>).mock.calls.at(-1)?.[0];
		const parsed = JSON.parse(String(output));
		expect(parsed.ok).toBe(true);
		expect(parsed.restored).toBe(true);
		expect(parsed.itemCount).toBe(1);
	});

	test("does not report success when restore is cancelled", async () => {
		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		const confirmSpy = mock(async () => false);
		const { handleBackupsRestore } = await import("../../src/commands/backups/index.js");
		await handleBackupsRestore(
			backup.backupDir.split("/").pop() as string,
			{ json: true },
			{ confirmFn: confirmSpy },
		);
		const output = (console.log as ReturnType<typeof mock>).mock.calls[0]?.[0];
		const parsed = JSON.parse(String(output));
		expect(parsed.cancelled).toBe(true);
		expect(parsed.restored).toBe(false);
	});

	test("prunes backups by keep count", async () => {
		await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});
		await writeFile(join(sourceRoot, "commands", "test.md"), "updated");
		await createDestructiveOperationBackup({
			operation: "uninstall",
			sourceRoot,
			deletePaths: ["commands/test.md"],
		});

		const { handleBackupsPrune } = await import("../../src/commands/backups/index.js");
		await handleBackupsPrune(undefined, { yes: true, json: true, keep: "1" });

		const output = (console.log as ReturnType<typeof mock>).mock.calls.at(-1)?.[0];
		const parsed = JSON.parse(String(output));
		expect(parsed.ok).toBe(true);
		expect(parsed.deletedIds).toHaveLength(1);
		expect(parsed.keptIds).toHaveLength(1);
	});

	test("returns structured JSON when prune is cancelled", async () => {
		const confirmSpy = mock(async () => false);
		const { handleBackupsPrune } = await import("../../src/commands/backups/index.js");
		await handleBackupsPrune(undefined, { json: true, keep: "1" }, { confirmFn: confirmSpy });
		const output = (console.log as ReturnType<typeof mock>).mock.calls[0]?.[0];
		const parsed = JSON.parse(String(output));
		expect(parsed.cancelled).toBe(true);
	});

	test("rejects malformed numeric input for list and prune", async () => {
		const { handleBackupsList, handleBackupsPrune } = await import(
			"../../src/commands/backups/index.js"
		);
		await expect(handleBackupsList({ limit: "1abc" })).rejects.toThrow("Invalid backup limit");
		await expect(handleBackupsPrune(undefined, { keep: "1abc", yes: true })).rejects.toThrow(
			"Invalid keep count",
		);
	});

	test("emits JSON error envelope for invalid CLI input", async () => {
		const result = spawnSync(
			"bun",
			["run", "src/index.ts", "backups", "prune", "--keep", "1abc", "--json", "--yes"],
			{
				cwd: process.cwd(),
				encoding: "utf-8",
			},
		);

		expect(result.status).toBe(1);
		expect(result.stdout).toBeTruthy();
		const parsed = JSON.parse(result.stdout);
		expect(parsed.ok).toBe(false);
		expect(parsed.error).toContain("Invalid keep count");
		expect(result.stderr).toBe("");
	});
});
