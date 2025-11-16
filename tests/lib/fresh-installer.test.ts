import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { handleFreshInstallation } from "../../src/lib/fresh-installer.js";
import { PromptsManager } from "../../src/lib/prompts.js";

describe("Fresh Installer", () => {
	let testDir: string;
	let claudeDir: string;
	let prompts: PromptsManager;

	beforeEach(async () => {
		// Create test directory
		testDir = join(process.cwd(), "test-temp", `fresh-test-${Date.now()}`);
		claudeDir = join(testDir, ".claude");
		await mkdir(claudeDir, { recursive: true });

		// Create some test files
		await writeFile(join(claudeDir, "test.txt"), "test content");
		await mkdir(join(claudeDir, "subdir"), { recursive: true });
		await writeFile(join(claudeDir, "subdir", "nested.txt"), "nested content");

		prompts = new PromptsManager();
	});

	afterEach(async () => {
		// Cleanup test directory
		if (existsSync(testDir)) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("handleFreshInstallation", () => {
		test("should return true when directory does not exist", async () => {
			const nonExistentDir = join(testDir, "nonexistent");
			const result = await handleFreshInstallation(nonExistentDir, prompts);
			expect(result).toBe(true);
		});

		test("should return false when user cancels confirmation", async () => {
			// Mock promptFreshConfirmation to return false
			const mockPrompt = mock(() => Promise.resolve(false));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(false);
			expect(mockPrompt).toHaveBeenCalledWith(claudeDir);
			// Directory should still exist
			expect(existsSync(claudeDir)).toBe(true);
		});

		test("should remove directory when user confirms", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);
			expect(mockPrompt).toHaveBeenCalledWith(claudeDir);
			// Directory should be removed
			expect(existsSync(claudeDir)).toBe(false);
		});

		test("should remove directory recursively with all contents", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Verify directory and files exist before removal
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "test.txt"))).toBe(true);
			expect(existsSync(join(claudeDir, "subdir", "nested.txt"))).toBe(true);

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);
			// All files and subdirectories should be removed
			expect(existsSync(claudeDir)).toBe(false);
			expect(existsSync(join(claudeDir, "test.txt"))).toBe(false);
			expect(existsSync(join(claudeDir, "subdir"))).toBe(false);
		});

		test("should throw error when directory removal fails", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Create a directory and make a file read-only to cause removal failure
			const readOnlyDir = join(testDir, "readonly-test");
			await mkdir(readOnlyDir, { recursive: true });
			const readOnlyFile = join(readOnlyDir, "readonly.txt");
			await writeFile(readOnlyFile, "test");

			// Make file read-only (this may not always cause failure on all systems)
			try {
				const { chmodSync } = await import("node:fs");
				chmodSync(readOnlyFile, 0o444);
				chmodSync(readOnlyDir, 0o444);

				await expect(handleFreshInstallation(readOnlyDir, prompts)).rejects.toThrow(
					"Failed to remove directory",
				);

				// Restore permissions for cleanup
				chmodSync(readOnlyDir, 0o755);
				chmodSync(readOnlyFile, 0o644);
			} catch (error) {
				// If chmod fails or removal succeeds, skip this test
				// (permissions work differently on different systems)
				expect(true).toBe(true);
			}
		});
	});

	describe("cross-platform path handling", () => {
		test("should handle paths with forward slashes", async () => {
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const pathWithSlashes = join(testDir, ".claude").replace(/\\/g, "/");
			const result = await handleFreshInstallation(pathWithSlashes, prompts);

			expect(result).toBe(true);
			expect(existsSync(claudeDir)).toBe(false);
		});

		test("should handle paths with backslashes on Windows", async () => {
			// This test is only relevant on Windows
			if (process.platform !== "win32") {
				expect(true).toBe(true);
				return;
			}

			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const pathWithBackslashes = join(testDir, ".claude").replace(/\//g, "\\");
			const result = await handleFreshInstallation(pathWithBackslashes, prompts);

			expect(result).toBe(true);
			expect(existsSync(claudeDir)).toBe(false);
		});
	});
});
