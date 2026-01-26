import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	analyzeFreshInstallation,
	handleFreshInstallation,
} from "@/domains/installation/fresh-installer.js";
import { PromptsManager } from "@/domains/ui/prompts.js";

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
		await mkdir(join(claudeDir, "rules"), { recursive: true });
		await writeFile(join(claudeDir, "rules", "test.md"), "workflow");
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

	// Valid SHA-256 checksums (64 hex characters)
	const CHECKSUM_1 = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
	const CHECKSUM_2 = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
	const CHECKSUM_3 = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
	const CHECKSUM_4 = "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5";

	describe("analyzeFreshInstallation", () => {
		test("should return hasMetadata=false when no metadata.json exists", async () => {
			const analysis = await analyzeFreshInstallation(claudeDir);

			expect(analysis.hasMetadata).toBe(false);
			expect(analysis.ckFiles).toEqual([]);
			expect(analysis.userFiles).toEqual([]);
		});

		test("should categorize files by ownership from metadata", async () => {
			// Create metadata with tracked files
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/test.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "agents/test.md",
								checksum: CHECKSUM_2,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/custom.md",
								checksum: CHECKSUM_3,
								ownership: "user",
								installedVersion: "1.0.0",
							},
							{
								path: "hooks/modified.sh",
								checksum: CHECKSUM_4,
								ownership: "ck-modified",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			const analysis = await analyzeFreshInstallation(claudeDir);

			expect(analysis.hasMetadata).toBe(true);
			expect(analysis.ckFiles.length).toBe(2);
			expect(analysis.ckModifiedFiles.length).toBe(1);
			expect(analysis.userFiles.length).toBe(1);
			expect(analysis.ckFiles.map((f) => f.path)).toContain("commands/test.md");
			expect(analysis.userFiles.map((f) => f.path)).toContain("skills/custom.md");
		});

		test("should handle empty files array in metadata", async () => {
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			const analysis = await analyzeFreshInstallation(claudeDir);

			expect(analysis.hasMetadata).toBe(false);
		});
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
			// Directory and all subdirectories should still exist
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "commands"))).toBe(true);
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
		});

		test("should use fallback directory removal when no metadata exists", async () => {
			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// .claude directory should still exist
			expect(existsSync(claudeDir)).toBe(true);

			// ClaudeKit subdirectories should be removed (fallback behavior)
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, "agents"))).toBe(false);
			expect(existsSync(join(claudeDir, "skills"))).toBe(false);
			expect(existsSync(join(claudeDir, "rules"))).toBe(false);
			expect(existsSync(join(claudeDir, "hooks"))).toBe(false);

			// User config files should be preserved
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
			expect(existsSync(join(claudeDir, "settings.json"))).toBe(true);
			expect(existsSync(join(claudeDir, ".mcp.json"))).toBe(true);
			expect(existsSync(join(claudeDir, "CLAUDE.md"))).toBe(true);
		});
	});

	describe("ownership-aware removal", () => {
		test("should only remove CK-owned files when metadata exists", async () => {
			// Create metadata with mixed ownership
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/test.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "agents/test.md",
								checksum: CHECKSUM_2,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/test.md",
								checksum: CHECKSUM_3,
								ownership: "user",
								installedVersion: "1.0.0",
							},
							{
								path: "hooks/test.sh",
								checksum: CHECKSUM_4,
								ownership: "ck-modified",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// CK-owned files should be removed
			expect(existsSync(join(claudeDir, "commands", "test.md"))).toBe(false);
			expect(existsSync(join(claudeDir, "agents", "test.md"))).toBe(false);

			// CK-modified files should be removed (included in removal)
			expect(existsSync(join(claudeDir, "hooks", "test.sh"))).toBe(false);

			// User-owned files should be preserved
			expect(existsSync(join(claudeDir, "skills", "test.md"))).toBe(true);

			// Root user config files should still exist
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
			expect(existsSync(join(claudeDir, "settings.json"))).toBe(true);
		});

		test("should preserve user-created files inside CK directories", async () => {
			// Create user file inside skills directory
			await writeFile(join(claudeDir, "skills", "my-custom-skill.md"), "custom skill content");

			// Create metadata tracking both CK and user files
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "skills/test.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/my-custom-skill.md",
								checksum: CHECKSUM_2,
								ownership: "user",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// CK file should be removed
			expect(existsSync(join(claudeDir, "skills", "test.md"))).toBe(false);

			// User file should be preserved
			expect(existsSync(join(claudeDir, "skills", "my-custom-skill.md"))).toBe(true);

			// Skills directory should still exist (has user file)
			expect(existsSync(join(claudeDir, "skills"))).toBe(true);
		});

		test("should cleanup empty directories after removing CK files", async () => {
			// Create nested directory structure
			await mkdir(join(claudeDir, "skills", "nested"), { recursive: true });
			await writeFile(join(claudeDir, "skills", "nested", "ck-file.md"), "ck content");

			// Create metadata tracking only CK files
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "skills/test.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/nested/ck-file.md",
								checksum: CHECKSUM_2,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// Files should be removed
			expect(existsSync(join(claudeDir, "skills", "test.md"))).toBe(false);
			expect(existsSync(join(claudeDir, "skills", "nested", "ck-file.md"))).toBe(false);

			// Empty nested directory should be cleaned up
			expect(existsSync(join(claudeDir, "skills", "nested"))).toBe(false);

			// Skills directory should be cleaned up (all contents removed)
			expect(existsSync(join(claudeDir, "skills"))).toBe(false);
		});

		test("should update metadata.json after removal", async () => {
			// Create metadata with tracked files
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/test.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/user-skill.md",
								checksum: CHECKSUM_2,
								ownership: "user",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));
			await writeFile(join(claudeDir, "skills", "user-skill.md"), "user skill");

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			await handleFreshInstallation(claudeDir, prompts);

			// Read updated metadata
			const updatedMetadata = JSON.parse(await Bun.file(join(claudeDir, "metadata.json")).text());

			// CK file entry should be removed from metadata
			const files = updatedMetadata.kits.engineer.files;
			expect(files.length).toBe(1);
			expect(files[0].path).toBe("skills/user-skill.md");
		});
	});

	describe("multi-kit support", () => {
		test("should handle files from multiple kits", async () => {
			// Create metadata with files from two kits
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/engineer-cmd.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
					marketing: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/marketing-cmd.md",
								checksum: CHECKSUM_2,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/custom.md",
								checksum: CHECKSUM_3,
								ownership: "user",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));
			await writeFile(join(claudeDir, "commands", "engineer-cmd.md"), "engineer");
			await writeFile(join(claudeDir, "commands", "marketing-cmd.md"), "marketing");
			await writeFile(join(claudeDir, "skills", "custom.md"), "custom");

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// CK files from both kits should be removed
			expect(existsSync(join(claudeDir, "commands", "engineer-cmd.md"))).toBe(false);
			expect(existsSync(join(claudeDir, "commands", "marketing-cmd.md"))).toBe(false);

			// User file should be preserved
			expect(existsSync(join(claudeDir, "skills", "custom.md"))).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should handle missing files gracefully", async () => {
			// Create metadata referencing files that don't exist
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/nonexistent.md",
								checksum: CHECKSUM_1,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "commands/test.md",
								checksum: CHECKSUM_2,
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Should not throw
			const result = await handleFreshInstallation(claudeDir, prompts);
			expect(result).toBe(true);
		});

		test("should handle corrupted metadata.json gracefully", async () => {
			// Create invalid JSON
			await writeFile(join(claudeDir, "metadata.json"), "not valid json {{{");

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			// Should fall back to directory removal
			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);
			// Should use fallback behavior
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
		});

		test("should preserve custom directories not in CK list", async () => {
			// Create a custom directory
			await mkdir(join(claudeDir, "my-custom-dir"), { recursive: true });
			await writeFile(join(claudeDir, "my-custom-dir", "file.txt"), "custom");

			// Mock promptFreshConfirmation to return true
			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const result = await handleFreshInstallation(claudeDir, prompts);

			expect(result).toBe(true);

			// Custom directory should be preserved (not in CK list)
			expect(existsSync(join(claudeDir, "my-custom-dir"))).toBe(true);
			expect(existsSync(join(claudeDir, "my-custom-dir", "file.txt"))).toBe(true);
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
			// This test is only relevant on Windows - skip on other platforms
			if (process.platform !== "win32") {
				return;
			}

			const mockPrompt = mock(() => Promise.resolve(true));
			prompts.promptFreshConfirmation = mockPrompt;

			const pathWithBackslashes = join(testDir, ".claude");
			const result = await handleFreshInstallation(pathWithBackslashes, prompts);

			expect(result).toBe(true);
			expect(existsSync(claudeDir)).toBe(true);
			expect(existsSync(join(claudeDir, "commands"))).toBe(false);
			expect(existsSync(join(claudeDir, ".env"))).toBe(true);
		});
	});
});
