import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type TestPaths, setupTestPaths } from "../../../../tests/helpers/test-paths.js";

const actualFsPromises = await import("node:fs/promises");
const realRename = actualFsPromises.rename.bind(actualFsPromises);
const renameMock = mock(realRename);

mock.module("node:fs/promises", () => ({
	...actualFsPromises,
	rename: renameMock,
}));

const { createDestructiveOperationBackup, restoreDestructiveOperationBackup } = await import(
	"@/services/file-operations/destructive-operation-backup.js"
);

afterAll(() => {
	mock.restore();
});

describe("destructive operation backup atomicity", () => {
	let testPaths: TestPaths;
	let sourceRoot: string;

	beforeEach(async () => {
		testPaths = setupTestPaths();
		sourceRoot = join(testPaths.testHome, "installation", ".claude");
		await mkdir(join(sourceRoot, "commands"), { recursive: true });
		await writeFile(join(sourceRoot, "commands", "first.md"), "first-original");
		await writeFile(join(sourceRoot, "commands", "second.md"), "second-original");
		renameMock.mockReset();
		renameMock.mockImplementation(realRename);
	});

	afterEach(async () => {
		await rm(join(testPaths.testHome, "installation"), { recursive: true, force: true });
		testPaths.cleanup();
	});

	test("rolls back earlier restored items when a later swap fails", async () => {
		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/first.md", "commands/second.md"],
		});

		await writeFile(join(sourceRoot, "commands", "first.md"), "first-current");
		await writeFile(join(sourceRoot, "commands", "second.md"), "second-current");

		renameMock.mockImplementation(async (from, to) => {
			if (String(from).includes(".ck-restore-") && String(to).endsWith("second.md")) {
				throw new Error("forced second restore swap failure");
			}

			return realRename(from, to);
		});

		await expect(restoreDestructiveOperationBackup(backup)).rejects.toThrow(
			"forced second restore swap failure",
		);
		expect(await readFile(join(sourceRoot, "commands", "first.md"), "utf8")).toBe("first-current");
		expect(await readFile(join(sourceRoot, "commands", "second.md"), "utf8")).toBe(
			"second-current",
		);
	});

	test("keeps the original content when the first source rename fails", async () => {
		const backup = await createDestructiveOperationBackup({
			operation: "fresh-install",
			sourceRoot,
			deletePaths: ["commands/first.md"],
		});

		await writeFile(join(sourceRoot, "commands", "first.md"), "first-current");

		renameMock.mockImplementation(async (from, to) => {
			if (String(from).endsWith("first.md") && String(to).includes(".ck-current-first.md-")) {
				throw new Error("forced current staging failure");
			}

			return realRename(from, to);
		});

		await expect(restoreDestructiveOperationBackup(backup)).rejects.toThrow(
			"forced current staging failure",
		);
		expect(await readFile(join(sourceRoot, "commands", "first.md"), "utf8")).toBe("first-current");
	});
});
