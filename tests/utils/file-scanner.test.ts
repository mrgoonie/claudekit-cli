import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdir, remove, writeFile } from "fs-extra";
import { FileScanner } from "../../src/utils/file-scanner.js";

describe("FileScanner", () => {
	const testDir = join(__dirname, "..", "..", "temp-test-file-scanner");
	const destDir = join(testDir, "dest");
	const sourceDir = join(testDir, "source");

	beforeEach(async () => {
		// Clean up and create test directories
		await remove(testDir);
		await mkdir(testDir, { recursive: true });
		await mkdir(destDir, { recursive: true });
		await mkdir(sourceDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up test directories
		await remove(testDir);
	});

	describe("getFiles", () => {
		test("should return empty array for non-existent directory", async () => {
			const files = await FileScanner.getFiles(join(testDir, "non-existent"));
			expect(files).toEqual([]);
		});

		test("should return files from directory", async () => {
			// Create test files
			await writeFile(join(destDir, "file1.txt"), "content1");
			await writeFile(join(destDir, "file2.txt"), "content2");

			const files = await FileScanner.getFiles(destDir);

			expect(files).toHaveLength(2);
			expect(files).toContain("file1.txt");
			expect(files).toContain("file2.txt");
		});

		test("should recursively scan subdirectories", async () => {
			// Create nested structure
			await mkdir(join(destDir, "subdir"), { recursive: true });
			await writeFile(join(destDir, "file1.txt"), "content1");
			await writeFile(join(destDir, "subdir", "file2.txt"), "content2");

			const files = await FileScanner.getFiles(destDir);

			expect(files).toHaveLength(2);
			expect(files).toContain("file1.txt");
			expect(files).toContain("subdir/file2.txt");
		});

		test("should handle empty directory", async () => {
			const files = await FileScanner.getFiles(destDir);
			expect(files).toEqual([]);
		});

		test("should handle deeply nested directories", async () => {
			// Create deeply nested structure
			const deepPath = join(destDir, "a", "b", "c", "d");
			await mkdir(deepPath, { recursive: true });
			await writeFile(join(deepPath, "deep.txt"), "deep content");

			const files = await FileScanner.getFiles(destDir);

			expect(files).toHaveLength(1);
			expect(files).toContain("a/b/c/d/deep.txt");
		});

		test("should return relative paths", async () => {
			await mkdir(join(destDir, "subdir"), { recursive: true });
			await writeFile(join(destDir, "subdir", "file.txt"), "content");

			const files = await FileScanner.getFiles(destDir);

			// Should return relative path, not absolute
			expect(files[0]).toBe("subdir/file.txt");
			expect(files[0]).not.toContain(destDir);
		});
	});

	describe("findCustomFiles", () => {
		test("should identify files in dest but not in source", async () => {
			// Create .claude directories
			const destClaudeDir = join(destDir, ".claude");
			const sourceClaudeDir = join(sourceDir, ".claude");
			await mkdir(destClaudeDir, { recursive: true });
			await mkdir(sourceClaudeDir, { recursive: true });

			// Create files
			await writeFile(join(destClaudeDir, "custom.md"), "custom content");
			await writeFile(join(destClaudeDir, "standard.md"), "standard content");
			await writeFile(join(sourceClaudeDir, "standard.md"), "standard content");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toHaveLength(1);
			expect(customFiles).toContain(".claude/custom.md");
		});

		test("should return empty array when no custom files exist", async () => {
			// Create .claude directories
			const destClaudeDir = join(destDir, ".claude");
			const sourceClaudeDir = join(sourceDir, ".claude");
			await mkdir(destClaudeDir, { recursive: true });
			await mkdir(sourceClaudeDir, { recursive: true });

			// Create same files in both
			await writeFile(join(destClaudeDir, "file1.md"), "content1");
			await writeFile(join(sourceClaudeDir, "file1.md"), "content1");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toEqual([]);
		});

		test("should handle missing .claude in destination", async () => {
			// Only create source .claude directory
			const sourceClaudeDir = join(sourceDir, ".claude");
			await mkdir(sourceClaudeDir, { recursive: true });
			await writeFile(join(sourceClaudeDir, "file1.md"), "content1");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toEqual([]);
		});

		test("should handle missing .claude in source", async () => {
			// Only create dest .claude directory
			const destClaudeDir = join(destDir, ".claude");
			await mkdir(destClaudeDir, { recursive: true });
			await writeFile(join(destClaudeDir, "custom.md"), "custom content");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toHaveLength(1);
			expect(customFiles).toContain(".claude/custom.md");
		});

		test("should handle nested subdirectories", async () => {
			// Create nested structure
			const destNestedDir = join(destDir, ".claude", "commands");
			const sourceNestedDir = join(sourceDir, ".claude", "commands");
			await mkdir(destNestedDir, { recursive: true });
			await mkdir(sourceNestedDir, { recursive: true });

			// Create custom file in nested dir
			await writeFile(join(destNestedDir, "custom-cmd.md"), "custom command");
			await writeFile(join(destNestedDir, "standard-cmd.md"), "standard command");
			await writeFile(join(sourceNestedDir, "standard-cmd.md"), "standard command");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toHaveLength(1);
			expect(customFiles).toContain(".claude/commands/custom-cmd.md");
		});

		test("should handle multiple custom files", async () => {
			// Create .claude directories
			const destClaudeDir = join(destDir, ".claude");
			const sourceClaudeDir = join(sourceDir, ".claude");
			await mkdir(destClaudeDir, { recursive: true });
			await mkdir(sourceClaudeDir, { recursive: true });

			// Create multiple custom files
			await writeFile(join(destClaudeDir, "custom1.md"), "custom1");
			await writeFile(join(destClaudeDir, "custom2.md"), "custom2");
			await writeFile(join(destClaudeDir, "custom3.md"), "custom3");
			await writeFile(join(destClaudeDir, "standard.md"), "standard");
			await writeFile(join(sourceClaudeDir, "standard.md"), "standard");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toHaveLength(3);
			expect(customFiles).toContain(".claude/custom1.md");
			expect(customFiles).toContain(".claude/custom2.md");
			expect(customFiles).toContain(".claude/custom3.md");
		});

		test("should handle files with special characters in names", async () => {
			// Create .claude directories
			const destClaudeDir = join(destDir, ".claude");
			const sourceClaudeDir = join(sourceDir, ".claude");
			await mkdir(destClaudeDir, { recursive: true });
			await mkdir(sourceClaudeDir, { recursive: true });

			// Create files with special characters
			await writeFile(join(destClaudeDir, "file-with-dash.md"), "content");
			await writeFile(join(destClaudeDir, "file_with_underscore.md"), "content");
			await writeFile(join(destClaudeDir, "file.multiple.dots.md"), "content");

			const customFiles = await FileScanner.findCustomFiles(destDir, sourceDir, ".claude");

			expect(customFiles).toHaveLength(3);
			expect(customFiles).toContain(".claude/file-with-dash.md");
			expect(customFiles).toContain(".claude/file_with_underscore.md");
			expect(customFiles).toContain(".claude/file.multiple.dots.md");
		});
	});
});
