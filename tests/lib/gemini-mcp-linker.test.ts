import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	addGeminiToGitignore,
	checkExistingGeminiConfig,
	findMcpConfigPath,
	linkGeminiMcpConfig,
} from "@/services/package-installer/gemini-mcp-linker.js";

describe("gemini-mcp-linker", () => {
	let tempDir: string;
	const globalMcpPath = join(homedir(), ".claude", ".mcp.json");
	const hasGlobalMcpConfig = existsSync(globalMcpPath);

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-gemini-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("findMcpConfigPath", () => {
		test("returns global config path when no local config exists and global exists", () => {
			const result = findMcpConfigPath(tempDir);
			// If global exists, it returns global path; otherwise null
			if (hasGlobalMcpConfig) {
				expect(result).toBe(globalMcpPath);
			} else {
				expect(result).toBeNull();
			}
		});

		test("returns local .mcp.json path when it exists", async () => {
			const mcpPath = join(tempDir, ".mcp.json");
			await writeFile(mcpPath, JSON.stringify({ mcpServers: {} }));

			const result = findMcpConfigPath(tempDir);
			expect(result).toBe(mcpPath);
		});

		test("prioritizes local over global config", async () => {
			// Create local config
			const localMcpPath = join(tempDir, ".mcp.json");
			await writeFile(localMcpPath, JSON.stringify({ mcpServers: { local: {} } }));

			const result = findMcpConfigPath(tempDir);
			expect(result).toBe(localMcpPath);
		});
	});

	describe("checkExistingGeminiConfig", () => {
		test("returns exists=false when no .gemini/settings.json", () => {
			const result = checkExistingGeminiConfig(tempDir);
			expect(result.exists).toBe(false);
			expect(result.isSymlink).toBe(false);
		});

		test("returns exists=true, isSymlink=false for regular file", async () => {
			await mkdir(join(tempDir, ".gemini"), { recursive: true });
			await writeFile(join(tempDir, ".gemini", "settings.json"), JSON.stringify({ theme: "dark" }));

			const result = checkExistingGeminiConfig(tempDir);
			expect(result.exists).toBe(true);
			expect(result.isSymlink).toBe(false);
		});

		test("returns exists=true, isSymlink=true for symlink", async () => {
			// Create a target file first
			const targetPath = join(tempDir, "target.json");
			await writeFile(targetPath, JSON.stringify({ mcpServers: {} }));

			// Create symlink
			await mkdir(join(tempDir, ".gemini"), { recursive: true });
			const linkPath = join(tempDir, ".gemini", "settings.json");
			const { symlink } = await import("node:fs/promises");
			await symlink(targetPath, linkPath);

			const result = checkExistingGeminiConfig(tempDir);
			expect(result.exists).toBe(true);
			expect(result.isSymlink).toBe(true);
			expect(result.currentTarget).toBe(targetPath);
		});
	});

	describe("addGeminiToGitignore", () => {
		test("creates .gitignore with .gemini/ if it does not exist", async () => {
			await addGeminiToGitignore(tempDir);

			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(true);

			const content = await readFile(gitignorePath, "utf-8");
			expect(content).toContain(".gemini/");
			expect(content).toContain("# Gemini CLI settings");
		});

		test("appends .gemini/ to existing .gitignore", async () => {
			const gitignorePath = join(tempDir, ".gitignore");
			await writeFile(gitignorePath, "node_modules/\n.env\n");

			await addGeminiToGitignore(tempDir);

			const content = await readFile(gitignorePath, "utf-8");
			expect(content).toContain("node_modules/");
			expect(content).toContain(".env");
			expect(content).toContain(".gemini/");
		});

		test("does not duplicate .gemini/ if already present", async () => {
			const gitignorePath = join(tempDir, ".gitignore");
			await writeFile(gitignorePath, "node_modules/\n.gemini/\n");

			await addGeminiToGitignore(tempDir);

			const content = await readFile(gitignorePath, "utf-8");
			// Should only have one occurrence
			const matches = content.match(/\.gemini\//g);
			expect(matches?.length).toBe(1);
		});

		test("handles various .gemini patterns in gitignore", async () => {
			const patterns = [".gemini/", ".gemini", "/.gemini/", "/.gemini"];

			for (const pattern of patterns) {
				const testDir = join(tempDir, `test-${pattern.replace(/\//g, "-")}`);
				await mkdir(testDir, { recursive: true });
				const gitignorePath = join(testDir, ".gitignore");
				await writeFile(gitignorePath, `node_modules/\n${pattern}\n`);

				await addGeminiToGitignore(testDir);

				const content = await readFile(gitignorePath, "utf-8");
				// Should not add another .gemini/ entry
				expect(content).not.toContain("# Gemini CLI settings");
			}
		});
	});

	describe("linkGeminiMcpConfig", () => {
		test("handles case when no local MCP config found", async () => {
			const result = await linkGeminiMcpConfig(tempDir);

			// If global config exists, it will succeed using global config
			// Otherwise, it will fail with "No MCP config found"
			if (hasGlobalMcpConfig) {
				expect(result.success).toBe(true);
			} else {
				expect(result.success).toBe(false);
				expect(result.error).toContain("No MCP config found");
			}
		});

		test("creates symlink when no existing Gemini config", async () => {
			// Create local .mcp.json
			const mcpPath = join(tempDir, ".mcp.json");
			await writeFile(mcpPath, JSON.stringify({ mcpServers: { test: {} } }));

			const result = await linkGeminiMcpConfig(tempDir);

			expect(result.success).toBe(true);
			expect(result.method).toBe("symlink");

			// Verify symlink created
			const settingsPath = join(tempDir, ".gemini", "settings.json");
			expect(existsSync(settingsPath)).toBe(true);

			const stats = lstatSync(settingsPath);
			expect(stats.isSymbolicLink()).toBe(true);

			// Verify relative path (portable) - normalize for cross-platform (Windows uses \, Unix uses /)
			const linkTarget = readlinkSync(settingsPath);
			expect(linkTarget.replace(/\\/g, "/")).toBe("../.mcp.json");
		});

		test("skips when Gemini config is already a symlink", async () => {
			// Create local .mcp.json
			const mcpPath = join(tempDir, ".mcp.json");
			await writeFile(mcpPath, JSON.stringify({ mcpServers: {} }));

			// Create existing symlink
			await mkdir(join(tempDir, ".gemini"), { recursive: true });
			const settingsPath = join(tempDir, ".gemini", "settings.json");
			const { symlink } = await import("node:fs/promises");
			await symlink("../.mcp.json", settingsPath);

			const result = await linkGeminiMcpConfig(tempDir);

			expect(result.success).toBe(true);
			expect(result.method).toBe("skipped");
		});

		test("merges mcpServers into existing Gemini settings file", async () => {
			// Create local .mcp.json with mcpServers
			const mcpPath = join(tempDir, ".mcp.json");
			await writeFile(
				mcpPath,
				JSON.stringify({
					mcpServers: {
						"test-server": { command: "test" },
					},
				}),
			);

			// Create existing Gemini settings with user preferences
			await mkdir(join(tempDir, ".gemini"), { recursive: true });
			const settingsPath = join(tempDir, ".gemini", "settings.json");
			await writeFile(
				settingsPath,
				JSON.stringify({
					theme: "dark",
					preferredEditor: "vscode",
				}),
			);

			const result = await linkGeminiMcpConfig(tempDir);

			expect(result.success).toBe(true);
			expect(result.method).toBe("merge");

			// Verify merge preserved user settings and added mcpServers
			const mergedContent = JSON.parse(await readFile(settingsPath, "utf-8"));
			expect(mergedContent.theme).toBe("dark");
			expect(mergedContent.preferredEditor).toBe("vscode");
			expect(mergedContent.mcpServers).toEqual({ "test-server": { command: "test" } });
		});

		test("updates .gitignore by default", async () => {
			// Create local .mcp.json
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

			await linkGeminiMcpConfig(tempDir);

			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(true);
			const content = await readFile(gitignorePath, "utf-8");
			expect(content).toContain(".gemini/");
		});

		test("skips .gitignore update when skipGitignore=true", async () => {
			// Create local .mcp.json
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

			await linkGeminiMcpConfig(tempDir, { skipGitignore: true });

			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(false);
		});

		test("returns error when MCP config has no mcpServers (merge mode)", async () => {
			// Create .mcp.json without mcpServers
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ other: "value" }));

			// Create existing Gemini settings to trigger merge mode
			await mkdir(join(tempDir, ".gemini"), { recursive: true });
			await writeFile(join(tempDir, ".gemini", "settings.json"), JSON.stringify({ theme: "dark" }));

			const result = await linkGeminiMcpConfig(tempDir);

			expect(result.success).toBe(false);
			expect(result.method).toBe("merge");
			expect(result.error).toContain("no valid mcpServers");
		});

		test("returns error when mcpServers is an array instead of object", async () => {
			// Create .mcp.json with mcpServers as array (invalid)
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: ["invalid"] }));

			// Create existing Gemini settings to trigger merge mode
			await mkdir(join(tempDir, ".gemini"), { recursive: true });
			await writeFile(join(tempDir, ".gemini", "settings.json"), JSON.stringify({ theme: "dark" }));

			const result = await linkGeminiMcpConfig(tempDir);

			expect(result.success).toBe(false);
			expect(result.method).toBe("merge");
			expect(result.error).toContain("no valid mcpServers");
		});
	});
});
