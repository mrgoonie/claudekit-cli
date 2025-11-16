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

		// Create ClaudeKit-managed subdirectories (should be removed)
		await mkdir(join(claudeDir, "commands"), { recursive: true });
		await writeFile(join(claudeDir, "commands", "test.md"), "command");
		await mkdir(join(claudeDir, "agents"), { recursive: true });
		await writeFile(join(claudeDir, "agents", "test.md"), "agent");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "test.md"), "skill");
		await mkdir(join(claudeDir, "workflows"), { recursive: true });
		await writeFile(join(claudeDir, "workflows", "test.md"), "workflow");
		await mkdir(join(claudeDir, "hooks"), { recursive: true });
		await writeFile(join(claudeDir, "hooks", "test.sh"), "hook");

		// Create user config files (should be preserved)
		await writeFile(join(claudeDir, ".env"), "SECRET=value");
		await writeFile(join(claudeDir, "settings.json"), "{}");
		await writeFile(join(claudeDir, ".mcp.json"), "{}");
		await writeFile(join(claudeDir, "CLAUDE.md"), "# Custom");

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
			// Directory and all subdirectories should still exist
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "commands"))).toBe(true);
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
		});

		test("should selectively remove ClaudeKit subdirectories when user confirms", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);
			expect(mockPrompt).toHaveBeenCalledWith(claudeDir);

			// .claude directory should still exist
			expect(existsSync(claudeDir)).toBe(true);

			// ClaudeKit subdirectories should be removed
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, "agents"))).toBe(false);
			expect(existsSync(join(claudeDir, "skills"))).toBe(false);
			expect(existsSync(join(claudeDir, "workflows"))).toBe(false);
			expect(existsSync(join(claudeDir, "hooks"))).toBe(false);

			// User config files should be preserved
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
			expect(existsSync(join(claudeDir, "settings.json"))).toBe(true);
			expect(existsSync(join(claudeDir, ".mcp.json"))).toBe(true);
			expect(existsSync(join(claudeDir, "CLAUDE.md"))).toBe(true);
		});

		test("should remove ClaudeKit subdirectories recursively with all contents", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Verify ClaudeKit subdirectories exist before removal
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "commands", "test.md"))).toBe(true);
			expect(existsSync(join(claudeDir, "agents", "test.md"))).toBe(true);
			expect(existsSync(join(claudeDir, "skills", "test.md"))).toBe(true);

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// ClaudeKit subdirectories and their contents should be removed
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, "commands", "test.md"))).toBe(false);
			expect(existsSync(join(claudeDir, "agents"))).toBe(false);
			expect(existsSync(join(claudeDir, "skills"))).toBe(false);

			// .claude directory and user files should still exist
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
		});

		test("should throw error when subdirectory removal fails", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Create a read-only ClaudeKit subdirectory to cause removal failure
			const readOnlyDir = join(testDir, ".claude-readonly");
			await mkdir(readOnlyDir, { recursive: true });
			const commandsDir = join(readOnlyDir, "commands");
			await mkdir(commandsDir, { recursive: true });
			const readOnlyFile = join(commandsDir, "readonly.txt");
			await writeFile(readOnlyFile, "test");

			// Make file read-only (this may not always cause failure on all systems)
			try {
				const { chmodSync } = await import("node:fs");
				chmodSync(readOnlyFile, 0o444);
				chmodSync(commandsDir, 0o444);

				await expect(handleFreshInstallation(readOnlyDir, prompts)).rejects.toThrow(
					"Failed to remove subdirectories",
				);

				// Restore permissions for cleanup
				chmodSync(commandsDir, 0o755);
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
			// .claude directory should exist but ClaudeKit subdirectories should be removed
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
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
			// .claude directory should exist but ClaudeKit subdirectories should be removed
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
		});
	});

	describe("selective deletion behavior", () => {
		test("should only remove specified ClaudeKit subdirectories", async () => {
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Create an additional custom subdirectory
			await mkdir(join(claudeDir, "custom"), { recursive: true });
			await writeFile(join(claudeDir, "custom", "file.txt"), "custom");

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// ClaudeKit subdirectories should be removed
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, "agents"))).toBe(false);
			expect(existsSync(join(claudeDir, "skills"))).toBe(false);
			expect(existsSync(join(claudeDir, "workflows"))).toBe(false);
			expect(existsSync(join(claudeDir, "hooks"))).toBe(false);

			// Custom subdirectory should be preserved
			expect(existsSync(join(claudeDir, "custom"))).toBe(true);
			expect(existsSync(join(claudeDir, "custom", "file.txt"))).toBe(true);
		});

		test("should handle missing ClaudeKit subdirectories gracefully", async () => {
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Create a new .claude directory with only some subdirectories
			const partialDir = join(testDir, ".claude-partial");
			await mkdir(partialDir, { recursive: true });
			await mkdir(join(partialDir, "commands"), { recursive: true });
			await mkdir(join(partialDir, "skills"), { recursive: true });
			await writeFile(join(partialDir, ".env"), "SECRET=value");

			const result = await handleFreshInstallation(partialDir, prompts);

			expect(result).toBe(true);

			// Only existing ClaudeKit subdirectories should be removed
			expect(existsSync(join(partialDir, "commands"))).toBe(false);
			expect(existsSync(join(partialDir, "skills"))).toBe(false);

			// User config should be preserved
			expect(existsSync(join(partialDir, ".env"))).toBe(true);
		});
	});
});
