import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { transformFolderPaths, validateFolderName } from "../src/lib/folder-path-transformer.js";
import { DEFAULT_FOLDERS } from "../src/types.js";

describe("Folder Path Transformer", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `ck-folder-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("transformFolderPaths", () => {
		test("should skip transformation when using default folders", async () => {
			// Create default folders
			await mkdir(join(testDir, "docs"), { recursive: true });
			await mkdir(join(testDir, "plans"), { recursive: true });
			await writeFile(join(testDir, "docs", "test.md"), "# Test");
			await writeFile(join(testDir, "plans", "test.md"), "# Plan");

			const result = await transformFolderPaths(testDir, DEFAULT_FOLDERS);

			expect(result.foldersRenamed).toBe(0);
			expect(result.filesTransformed).toBe(0);
			expect(result.totalReferences).toBe(0);
		});

		test("should rename docs folder to custom name", async () => {
			// Create default docs folder
			await mkdir(join(testDir, "docs"), { recursive: true });
			await writeFile(join(testDir, "docs", "readme.md"), "# Documentation");

			const result = await transformFolderPaths(testDir, {
				docs: "ck-docs",
				plans: "plans", // Keep default
			});

			expect(result.foldersRenamed).toBe(1);
			expect(await pathExists(join(testDir, "ck-docs"))).toBe(true);
			expect(await pathExists(join(testDir, "docs"))).toBe(false);
		});

		test("should rename plans folder to custom name", async () => {
			// Create default plans folder
			await mkdir(join(testDir, "plans"), { recursive: true });
			await writeFile(join(testDir, "plans", "plan.md"), "# Implementation Plan");

			const result = await transformFolderPaths(testDir, {
				docs: "docs", // Keep default
				plans: "ck-plans",
			});

			expect(result.foldersRenamed).toBe(1);
			expect(await pathExists(join(testDir, "ck-plans"))).toBe(true);
			expect(await pathExists(join(testDir, "plans"))).toBe(false);
		});

		test("should rename both folders", async () => {
			await mkdir(join(testDir, "docs"), { recursive: true });
			await mkdir(join(testDir, "plans"), { recursive: true });

			const result = await transformFolderPaths(testDir, {
				docs: "documentation",
				plans: "implementation-plans",
			});

			expect(result.foldersRenamed).toBe(2);
			expect(await pathExists(join(testDir, "documentation"))).toBe(true);
			expect(await pathExists(join(testDir, "implementation-plans"))).toBe(true);
		});

		test("should transform references in markdown files", async () => {
			// Create folders
			await mkdir(join(testDir, "docs"), { recursive: true });

			// Create file with references
			const content = `
# Project

Documentation is in docs/ folder.
See ./docs/readme.md for details.
Link: [docs](docs/)
			`;
			await writeFile(join(testDir, "README.md"), content);

			const result = await transformFolderPaths(testDir, {
				docs: "ck-docs",
				plans: "plans",
			});

			expect(result.filesTransformed).toBeGreaterThanOrEqual(1);
			expect(result.totalReferences).toBeGreaterThanOrEqual(1);

			// Check content was transformed
			const newContent = await readFile(join(testDir, "README.md"), "utf-8");
			expect(newContent).toContain("ck-docs/");
			expect(newContent).toContain("./ck-docs");
		});

		test("should handle .claude subdirectory", async () => {
			// Create .claude/docs structure
			await mkdir(join(testDir, ".claude", "docs"), { recursive: true });
			await writeFile(join(testDir, ".claude", "docs", "test.md"), "# Test");

			await transformFolderPaths(testDir, {
				docs: "ck-docs",
				plans: "plans",
			});

			expect(await pathExists(join(testDir, ".claude", "ck-docs"))).toBe(true);
			expect(await pathExists(join(testDir, ".claude", "docs"))).toBe(false);
		});

		test("should handle dry-run mode", async () => {
			await mkdir(join(testDir, "docs"), { recursive: true });
			await writeFile(join(testDir, "docs", "test.md"), "# Test");

			await transformFolderPaths(
				testDir,
				{
					docs: "ck-docs",
					plans: "plans",
				},
				{ dryRun: true },
			);

			// Dry run should not actually rename
			expect(await pathExists(join(testDir, "docs"))).toBe(true);
			expect(await pathExists(join(testDir, "ck-docs"))).toBe(false);
		});
	});

	describe("validateFolderName", () => {
		test("should accept valid folder names", () => {
			expect(validateFolderName("docs")).toBeNull();
			expect(validateFolderName("ck-docs")).toBeNull();
			expect(validateFolderName("my_plans")).toBeNull();
			expect(validateFolderName("MyDocs123")).toBeNull();
			expect(validateFolderName(".hidden-docs")).toBeNull();
		});

		test("should reject empty folder names", () => {
			expect(validateFolderName("")).not.toBeNull();
			expect(validateFolderName("   ")).not.toBeNull();
		});

		test("should reject path traversal attempts", () => {
			expect(validateFolderName("..")).not.toBeNull();
			expect(validateFolderName("../docs")).not.toBeNull();
			expect(validateFolderName("docs/..")).not.toBeNull();
		});

		test("should reject path separators", () => {
			expect(validateFolderName("docs/sub")).not.toBeNull();
			expect(validateFolderName("docs\\sub")).not.toBeNull();
		});

		test("should reject invalid characters", () => {
			expect(validateFolderName("docs<>")).not.toBeNull();
			expect(validateFolderName("docs:name")).not.toBeNull();
			expect(validateFolderName('docs"name')).not.toBeNull();
			expect(validateFolderName("docs|name")).not.toBeNull();
			expect(validateFolderName("docs?name")).not.toBeNull();
			expect(validateFolderName("docs*name")).not.toBeNull();
		});

		test("should reject Windows reserved names", () => {
			expect(validateFolderName("CON")).not.toBeNull();
			expect(validateFolderName("PRN")).not.toBeNull();
			expect(validateFolderName("AUX")).not.toBeNull();
			expect(validateFolderName("NUL")).not.toBeNull();
			expect(validateFolderName("COM1")).not.toBeNull();
			expect(validateFolderName("LPT1")).not.toBeNull();
			// Case insensitive
			expect(validateFolderName("con")).not.toBeNull();
			expect(validateFolderName("Con")).not.toBeNull();
		});

		test("should reject names that are too long", () => {
			const longName = "a".repeat(256);
			expect(validateFolderName(longName)).not.toBeNull();
		});

		test("should accept names at max length", () => {
			const maxName = "a".repeat(255);
			expect(validateFolderName(maxName)).toBeNull();
		});
	});
});
