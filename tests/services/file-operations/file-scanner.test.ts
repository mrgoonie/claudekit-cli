import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileScanner } from "@/services/file-operations/file-scanner.js";

describe("FileScanner", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "file-scanner-test-"));
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("getFiles", () => {
		it("returns empty array for non-existent directory", async () => {
			const nonExistentDir = join(testDir, "non-existent");
			const files = await FileScanner.getFiles(nonExistentDir);
			expect(files).toEqual([]);
		});

		it("returns empty array for empty directory", async () => {
			const emptyDir = join(testDir, "empty");
			await mkdir(emptyDir);
			const files = await FileScanner.getFiles(emptyDir);
			expect(files).toEqual([]);
		});

		it("lists all files recursively", async () => {
			await writeFile(join(testDir, "file1.txt"), "content1");
			await mkdir(join(testDir, "subdir"));
			await writeFile(join(testDir, "subdir", "file2.txt"), "content2");

			const files = await FileScanner.getFiles(testDir);
			expect(files.sort()).toEqual(["file1.txt", "subdir/file2.txt"].sort());
		});

		it("skips node_modules directory", async () => {
			await mkdir(join(testDir, "node_modules"));
			await writeFile(join(testDir, "node_modules", "file.js"), "js");
			await writeFile(join(testDir, "keep.txt"), "keep");

			const files = await FileScanner.getFiles(testDir);
			expect(files).toEqual(["keep.txt"]);
		});

		it("skips .git directory", async () => {
			await mkdir(join(testDir, ".git"));
			await writeFile(join(testDir, ".git", "config"), "config");
			await writeFile(join(testDir, "keep.txt"), "keep");

			const files = await FileScanner.getFiles(testDir);
			expect(files).toEqual(["keep.txt"]);
		});

		it("skips symlinks", async () => {
			const targetPath = join(testDir, "target.txt");
			const linkPath = join(testDir, "link.txt");
			await writeFile(targetPath, "target");
			await symlink(targetPath, linkPath);

			const files = await FileScanner.getFiles(testDir);
			// link.txt should be skipped, only target.txt should remain
			expect(files).toEqual(["target.txt"]);
		});

		it("uses POSIX paths on all platforms", async () => {
			// On Linux/macOS, this is the default behavior.
			// The test ensures the implementation's toPosixPath is called.
			await mkdir(join(testDir, "nested", "dir"), { recursive: true });
			await writeFile(join(testDir, "nested", "dir", "file.txt"), "content");

			const files = await FileScanner.getFiles(testDir);
			expect(files).toContain("nested/dir/file.txt");
			// Verify no backslashes are present
			files.forEach((file) => {
				expect(file).not.toContain("\\");
			});
		});
	});

	describe("findCustomFiles", () => {
		let sourceDir: string;
		let destDir: string;

		beforeEach(async () => {
			sourceDir = await mkdtemp(join(tmpdir(), "source-dir-"));
			destDir = await mkdtemp(join(tmpdir(), "dest-dir-"));
		});

		afterEach(async () => {
			await rm(sourceDir, { recursive: true, force: true });
			await rm(destDir, { recursive: true, force: true });
		});

		it("returns empty when directories are identical", async () => {
			await writeFile(join(sourceDir, "file.txt"), "content");
			await writeFile(join(destDir, "file.txt"), "content");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, "");
			expect(customFiles).toEqual([]);
		});

		it("finds files in dest not in source", async () => {
			await writeFile(join(sourceDir, "common.txt"), "common");
			await writeFile(join(destDir, "common.txt"), "common");
			await writeFile(join(destDir, "custom.txt"), "custom");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, "");
			expect(customFiles).toEqual(["custom.txt"]);
		});

		it("handles subPath correctly", async () => {
			const subPath = ".claude";
			await mkdir(join(sourceDir, subPath));
			await mkdir(join(destDir, subPath));

			await writeFile(join(sourceDir, subPath, "template.md"), "template");
			await writeFile(join(destDir, subPath, "template.md"), "template");
			await writeFile(join(destDir, subPath, "custom.md"), "custom");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, subPath);
			expect(customFiles).toEqual([".claude/custom.md"]);
		});

		it("returns empty for empty source with safeguard (>100 files)", async () => {
			// Mock source directory existing but being empty
			await mkdir(sourceDir, { recursive: true });

			// Create >100 files in dest
			for (let i = 0; i < 101; i++) {
				await writeFile(join(destDir, `file-${i}.txt`), "content");
			}

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, "");
			expect(customFiles).toEqual([]);
		});

		it("detects files as custom if source does not exist", async () => {
			const nonExistentSource = join(testDir, "missing-source");
			await writeFile(join(destDir, "custom.txt"), "custom");

			const customFiles = await FileScanner.findCustomFiles(destDir, nonExistentSource, "");
			expect(customFiles).toEqual(["custom.txt"]);
		});
	});
});
