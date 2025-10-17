import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileMerger } from "../../src/lib/merge.js";

describe("FileMerger", () => {
	let merger: FileMerger;
	let testSourceDir: string;
	let testDestDir: string;

	beforeEach(async () => {
		merger = new FileMerger();

		// Create temporary test directories
		const timestamp = Date.now();
		testSourceDir = join(tmpdir(), `test-source-${timestamp}`);
		testDestDir = join(tmpdir(), `test-dest-${timestamp}`);

		await mkdir(testSourceDir, { recursive: true });
		await mkdir(testDestDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup test directories
		if (existsSync(testSourceDir)) {
			await rm(testSourceDir, { recursive: true, force: true });
		}
		if (existsSync(testDestDir)) {
			await rm(testDestDir, { recursive: true, force: true });
		}
	});

	describe("constructor", () => {
		test("should create FileMerger instance", () => {
			expect(merger).toBeInstanceOf(FileMerger);
		});
	});

	describe("addIgnorePatterns", () => {
		test("should add custom ignore patterns", () => {
			const patterns = ["*.log", "temp/**"];
			expect(() => merger.addIgnorePatterns(patterns)).not.toThrow();
		});

		test("should accept empty array", () => {
			expect(() => merger.addIgnorePatterns([])).not.toThrow();
		});
	});

	describe("merge with skipConfirmation", () => {
		test("should copy files from source to destination", async () => {
			// Create test files
			await writeFile(join(testSourceDir, "test.txt"), "test content");
			await writeFile(join(testSourceDir, "readme.md"), "# README");

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify files were copied
			expect(existsSync(join(testDestDir, "test.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, "readme.md"))).toBe(true);
		});

		test("should skip protected files like .env", async () => {
			// Create test files including protected ones
			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, ".env"), "SECRET=value");

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify normal file was copied but .env was not
			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, ".env"))).toBe(false);
		});

		test("should skip protected patterns like *.key", async () => {
			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, "private.key"), "key data");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, "private.key"))).toBe(false);
		});

		test("should handle nested directories", async () => {
			const nestedDir = join(testSourceDir, "nested", "deep");
			await mkdir(nestedDir, { recursive: true });
			await writeFile(join(nestedDir, "file.txt"), "nested content");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "nested", "deep", "file.txt"))).toBe(true);
		});

		test("should overwrite existing files", async () => {
			// Create files in both directories
			await writeFile(join(testSourceDir, "file.txt"), "new content");
			await writeFile(join(testDestDir, "file.txt"), "old content");

			await merger.merge(testSourceDir, testDestDir, true);

			const content = await Bun.file(join(testDestDir, "file.txt")).text();
			expect(content).toBe("new content");
		});

		test("should handle empty source directory", async () => {
			// Empty directory should complete without errors
			await merger.merge(testSourceDir, testDestDir, true);
			// If we get here, the test passed
			expect(true).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should handle files with special characters in names", async () => {
			const specialFileName = "file with spaces.txt";
			await writeFile(join(testSourceDir, specialFileName), "content");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, specialFileName))).toBe(true);
		});

		test("should skip custom ignore patterns", async () => {
			merger.addIgnorePatterns(["custom-*"]);

			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, "custom-ignore.txt"), "ignore me");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, "custom-ignore.txt"))).toBe(false);
		});
	});

	describe("custom .claude file preservation", () => {
		test("should preserve custom .claude files when patterns are added", async () => {
			// Create .claude directories
			const sourceClaudeDir = join(testSourceDir, ".claude");
			const destClaudeDir = join(testDestDir, ".claude");
			await mkdir(sourceClaudeDir, { recursive: true });
			await mkdir(destClaudeDir, { recursive: true });

			// Create files in source (from release package)
			await writeFile(join(sourceClaudeDir, "standard.md"), "standard content");

			// Create files in destination (existing + custom)
			await writeFile(join(destClaudeDir, "standard.md"), "old standard content");
			await writeFile(join(destClaudeDir, "custom.md"), "custom content");

			// Add custom file to ignore patterns (this would be done by update.ts)
			merger.addIgnorePatterns([".claude/custom.md"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Standard file should be overwritten
			const standardContent = await Bun.file(join(destClaudeDir, "standard.md")).text();
			expect(standardContent).toBe("standard content");

			// Custom file should be preserved
			expect(existsSync(join(destClaudeDir, "custom.md"))).toBe(true);
			const customContent = await Bun.file(join(destClaudeDir, "custom.md")).text();
			expect(customContent).toBe("custom content");
		});

		test("should preserve nested custom .claude files", async () => {
			// Create nested .claude structure
			const sourceCommandsDir = join(testSourceDir, ".claude", "commands");
			const destCommandsDir = join(testDestDir, ".claude", "commands");
			await mkdir(sourceCommandsDir, { recursive: true });
			await mkdir(destCommandsDir, { recursive: true });

			// Create standard file in source
			await writeFile(join(sourceCommandsDir, "standard-cmd.md"), "standard command");

			// Create custom file in destination
			await writeFile(join(destCommandsDir, "custom-cmd.md"), "custom command");

			// Add custom file to ignore patterns
			merger.addIgnorePatterns([".claude/commands/custom-cmd.md"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Custom file should be preserved
			expect(existsSync(join(destCommandsDir, "custom-cmd.md"))).toBe(true);
			const customContent = await Bun.file(join(destCommandsDir, "custom-cmd.md")).text();
			expect(customContent).toBe("custom command");
		});

		test("should preserve multiple custom .claude files", async () => {
			const sourceClaudeDir = join(testSourceDir, ".claude");
			const destClaudeDir = join(testDestDir, ".claude");
			await mkdir(sourceClaudeDir, { recursive: true });
			await mkdir(destClaudeDir, { recursive: true });

			// Create multiple custom files in destination
			await writeFile(join(destClaudeDir, "custom1.md"), "custom1");
			await writeFile(join(destClaudeDir, "custom2.md"), "custom2");
			await writeFile(join(destClaudeDir, "custom3.md"), "custom3");

			// Add all custom files to ignore patterns
			merger.addIgnorePatterns([".claude/custom1.md", ".claude/custom2.md", ".claude/custom3.md"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// All custom files should be preserved
			expect(existsSync(join(destClaudeDir, "custom1.md"))).toBe(true);
			expect(existsSync(join(destClaudeDir, "custom2.md"))).toBe(true);
			expect(existsSync(join(destClaudeDir, "custom3.md"))).toBe(true);
		});
	});
});
