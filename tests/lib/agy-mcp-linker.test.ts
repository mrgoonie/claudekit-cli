import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	addAgyToGitignore,
	checkExistingAgyConfig,
	findMcpConfigPath,
	getAgyMcpConfigPath,
	linkAgyMcpConfig,
} from "@/services/package-installer/agy-mcp-linker.js";

describe("agy-mcp-linker", () => {
	let tempDir: string;
	const globalMcpPath = join(homedir(), ".claude", ".mcp.json");
	const hasGlobalMcpConfig = existsSync(globalMcpPath);

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-agy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

	describe("getAgyMcpConfigPath", () => {
		test("returns local .agents/mcp_config.json for non-global installs", () => {
			const result = getAgyMcpConfigPath(tempDir, false);
			expect(result).toBe(join(tempDir, ".agents", "mcp_config.json"));
		});

		test("returns global ~/.gemini/config/mcp_config.json for global installs", () => {
			const result = getAgyMcpConfigPath(tempDir, true);
			expect(result).toBe(join(homedir(), ".gemini", "config", "mcp_config.json"));
		});
	});

	describe("checkExistingAgyConfig", () => {
		test("returns exists=false when no .agents/mcp_config.json", () => {
			const result = checkExistingAgyConfig(tempDir);
			expect(result.exists).toBe(false);
			expect(result.isSymlink).toBe(false);
			expect(result.settingsPath).toBe(join(tempDir, ".agents", "mcp_config.json"));
		});

		test("returns exists=true, isSymlink=false for regular file", async () => {
			await mkdir(join(tempDir, ".agents"), { recursive: true });
			await writeFile(
				join(tempDir, ".agents", "mcp_config.json"),
				JSON.stringify({ mcpServers: {} }),
			);

			const result = checkExistingAgyConfig(tempDir);
			expect(result.exists).toBe(true);
			expect(result.isSymlink).toBe(false);
		});

		test("returns exists=true, isSymlink=true for symlink", async () => {
			// Create a target file first
			const targetPath = join(tempDir, "target.json");
			await writeFile(targetPath, JSON.stringify({ mcpServers: {} }));

			// Create symlink
			await mkdir(join(tempDir, ".agents"), { recursive: true });
			const linkPath = join(tempDir, ".agents", "mcp_config.json");
			const { symlink } = await import("node:fs/promises");
			await symlink(targetPath, linkPath);

			const result = checkExistingAgyConfig(tempDir);
			expect(result.exists).toBe(true);
			expect(result.isSymlink).toBe(true);
			expect(result.currentTarget).toBe(targetPath);
		});

		test("checks global path when isGlobal=true", () => {
			const result = checkExistingAgyConfig(tempDir, true);
			expect(result.settingsPath).toBe(join(homedir(), ".gemini", "config", "mcp_config.json"));
		});
	});

	describe("addAgyToGitignore", () => {
		test("creates .gitignore with .agents/mcp_config.json if it does not exist", async () => {
			await addAgyToGitignore(tempDir);

			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(true);

			const content = await readFile(gitignorePath, "utf-8");
			expect(content).toContain(".agents/mcp_config.json");
			expect(content).toContain("# Antigravity CLI MCP config");
		});

		test("appends .agents/mcp_config.json to existing .gitignore", async () => {
			const gitignorePath = join(tempDir, ".gitignore");
			await writeFile(gitignorePath, "node_modules/\n.env\n");

			await addAgyToGitignore(tempDir);

			const content = await readFile(gitignorePath, "utf-8");
			expect(content).toContain("node_modules/");
			expect(content).toContain(".env");
			expect(content).toContain(".agents/mcp_config.json");
		});

		test("does not duplicate .agents/mcp_config.json if already present", async () => {
			const gitignorePath = join(tempDir, ".gitignore");
			await writeFile(gitignorePath, "node_modules/\n.agents/mcp_config.json\n");

			await addAgyToGitignore(tempDir);

			const content = await readFile(gitignorePath, "utf-8");
			// Should only have one occurrence
			const matches = content.match(/\.agents\/mcp_config\.json/g);
			expect(matches?.length).toBe(1);
		});

		test("handles various .agents/mcp_config.json patterns in gitignore", async () => {
			const patterns = [".agents/mcp_config.json", "/.agents/mcp_config.json"];

			for (const pattern of patterns) {
				const testDir = join(tempDir, `test-${pattern.replace(/\//g, "-")}`);
				await mkdir(testDir, { recursive: true });
				const gitignorePath = join(testDir, ".gitignore");
				await writeFile(gitignorePath, `node_modules/\n${pattern}\n`);

				await addAgyToGitignore(testDir);

				const content = await readFile(gitignorePath, "utf-8");
				// Should not add another entry
				expect(content).not.toContain("# Antigravity CLI MCP config");
			}
		});
	});

	describe("linkAgyMcpConfig", () => {
		test("handles case when no local MCP config found", async () => {
			const result = await linkAgyMcpConfig(tempDir);

			// If global config exists, it will succeed using global config
			// Otherwise, it will fail with "No MCP config found"
			if (hasGlobalMcpConfig) {
				expect(result.success).toBe(true);
			} else {
				expect(result.success).toBe(false);
				expect(result.error).toContain("No MCP config found");
			}
		});

		test("creates symlink when no existing agy config", async () => {
			// Create local .mcp.json
			const mcpPath = join(tempDir, ".mcp.json");
			await writeFile(mcpPath, JSON.stringify({ mcpServers: { test: {} } }));

			const result = await linkAgyMcpConfig(tempDir);

			expect(result.success).toBe(true);
			expect(result.method).toBe("symlink");

			// Verify symlink created
			const configPath = join(tempDir, ".agents", "mcp_config.json");
			expect(existsSync(configPath)).toBe(true);

			const stats = lstatSync(configPath);
			expect(stats.isSymbolicLink()).toBe(true);

			// Verify relative path (portable) - normalize for cross-platform (Windows uses \, Unix uses /)
			const linkTarget = readlinkSync(configPath);
			expect(linkTarget.replace(/\\/g, "/")).toBe("../.mcp.json");
		});

		test("skips when agy config is already a symlink", async () => {
			// Create local .mcp.json
			const mcpPath = join(tempDir, ".mcp.json");
			await writeFile(mcpPath, JSON.stringify({ mcpServers: {} }));

			// Create existing symlink
			await mkdir(join(tempDir, ".agents"), { recursive: true });
			const configPath = join(tempDir, ".agents", "mcp_config.json");
			const { symlink } = await import("node:fs/promises");
			await symlink("../.mcp.json", configPath);

			const result = await linkAgyMcpConfig(tempDir);

			expect(result.success).toBe(true);
			expect(result.method).toBe("skipped");
		});

		test("merges mcpServers into existing agy config file", async () => {
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

			// Create existing agy mcp_config.json with extra user keys
			await mkdir(join(tempDir, ".agents"), { recursive: true });
			const configPath = join(tempDir, ".agents", "mcp_config.json");
			await writeFile(
				configPath,
				JSON.stringify({
					theme: "dark",
					preferredEditor: "vscode",
				}),
			);

			const result = await linkAgyMcpConfig(tempDir);

			expect(result.success).toBe(true);
			expect(result.method).toBe("merge");

			// Verify merge preserved user keys and added mcpServers
			const mergedContent = JSON.parse(await readFile(configPath, "utf-8"));
			expect(mergedContent.theme).toBe("dark");
			expect(mergedContent.preferredEditor).toBe("vscode");
			expect(mergedContent.mcpServers).toEqual({ "test-server": { command: "test" } });
		});

		test("updates .gitignore by default", async () => {
			// Create local .mcp.json
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

			await linkAgyMcpConfig(tempDir);

			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(true);
			const content = await readFile(gitignorePath, "utf-8");
			expect(content).toContain(".agents/mcp_config.json");
		});

		test("skips .gitignore update when skipGitignore=true", async () => {
			// Create local .mcp.json
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

			await linkAgyMcpConfig(tempDir, { skipGitignore: true });

			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(false);
		});

		test("returns error when MCP config has no mcpServers (merge mode)", async () => {
			// Create .mcp.json without mcpServers
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ other: "value" }));

			// Create existing agy config to trigger merge mode
			await mkdir(join(tempDir, ".agents"), { recursive: true });
			await writeFile(
				join(tempDir, ".agents", "mcp_config.json"),
				JSON.stringify({ theme: "dark" }),
			);

			const result = await linkAgyMcpConfig(tempDir);

			expect(result.success).toBe(false);
			expect(result.method).toBe("merge");
			expect(result.error).toContain("no valid mcpServers");
		});

		test("returns error when mcpServers is an array instead of object", async () => {
			// Create .mcp.json with mcpServers as array (invalid)
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: ["invalid"] }));

			// Create existing agy config to trigger merge mode
			await mkdir(join(tempDir, ".agents"), { recursive: true });
			await writeFile(
				join(tempDir, ".agents", "mcp_config.json"),
				JSON.stringify({ theme: "dark" }),
			);

			const result = await linkAgyMcpConfig(tempDir);

			expect(result.success).toBe(false);
			expect(result.method).toBe("merge");
			expect(result.error).toContain("no valid mcpServers");
		});

		test("skips .gitignore update when isGlobal=true", async () => {
			// Create local .mcp.json
			await writeFile(join(tempDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

			// Note: For global installs, the symlink would go to ~/.gemini/config/mcp_config.json
			// We can't easily test that without modifying user's home directory
			// So we test that gitignore is NOT updated for global installs
			await linkAgyMcpConfig(tempDir, { isGlobal: true, skipGitignore: false });

			// For global installs, .gitignore should NOT be updated (project gitignore is irrelevant)
			const gitignorePath = join(tempDir, ".gitignore");
			expect(existsSync(gitignorePath)).toBe(false);
		});
	});
});
