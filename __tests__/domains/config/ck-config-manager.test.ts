import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CkConfigManager } from "../../../src/domains/config/ck-config-manager.js";
import {
	CK_HOOK_NAMES,
	type CkConfig,
	CkConfigSchema,
	DEFAULT_CK_CONFIG,
} from "../../../src/types/ck-config.js";

describe("CkConfigManager", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-config-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("projectConfigExists", () => {
		it("should detect project config at dir/.claude/.ck.json (isGlobal=false)", async () => {
			// Create project structure: projectDir/.claude/.ck.json
			const projectDir = join(tempDir, "myproject");
			const claudeDir = join(projectDir, ".claude");
			const configPath = join(claudeDir, ".ck.json");

			await mkdir(claudeDir, { recursive: true });
			await writeFile(configPath, JSON.stringify({}));

			const exists = CkConfigManager.projectConfigExists(projectDir, false);
			expect(exists).toBe(true);
		});

		it("should detect global config at dir/.ck.json (isGlobal=true)", async () => {
			// Create global structure: ~/.ck.json
			const globalPath = join(tempDir, ".ck.json");
			await writeFile(globalPath, JSON.stringify({}));

			const exists = CkConfigManager.projectConfigExists(tempDir, true);
			expect(exists).toBe(true);
		});

		it("should return false when project config doesn't exist (isGlobal=false)", async () => {
			const projectDir = join(tempDir, "nonexistent-project");

			const exists = CkConfigManager.projectConfigExists(projectDir, false);
			expect(exists).toBe(false);
		});

		it("should return false when global config doesn't exist (isGlobal=true)", async () => {
			const exists = CkConfigManager.projectConfigExists(tempDir, true);
			expect(exists).toBe(false);
		});

		it("should default to isGlobal=false when undefined", async () => {
			// Create project structure
			const projectDir = join(tempDir, "myproject");
			const claudeDir = join(projectDir, ".claude");
			const configPath = join(claudeDir, ".ck.json");

			await mkdir(claudeDir, { recursive: true });
			await writeFile(configPath, JSON.stringify({}));

			// Call without isGlobal - should default to false (project config)
			const exists = CkConfigManager.projectConfigExists(projectDir);
			expect(exists).toBe(true);
		});

		it("should handle nested project directories", async () => {
			const projectDir = join(tempDir, "a", "b", "c", "myproject");
			const claudeDir = join(projectDir, ".claude");
			const configPath = join(claudeDir, ".ck.json");

			await mkdir(claudeDir, { recursive: true });
			await writeFile(configPath, JSON.stringify({}));

			const exists = CkConfigManager.projectConfigExists(projectDir, false);
			expect(exists).toBe(true);
		});
	});

	describe("Hook schema sync", () => {
		it("should have consistent hook counts across all locations", () => {
			const hooksInNames = CK_HOOK_NAMES.length;
			const hooksInDefaults = Object.keys(DEFAULT_CK_CONFIG.hooks ?? {}).length;
			// Both should be 9 (matching the hook count)
			expect(hooksInNames).toBe(9);
			expect(hooksInDefaults).toBe(9);
		});

		it("should have all hooks from CK_HOOK_NAMES in DEFAULT_CK_CONFIG.hooks", () => {
			for (const hookName of CK_HOOK_NAMES) {
				expect(DEFAULT_CK_CONFIG.hooks).toHaveProperty(hookName);
			}
		});

		it("should have all hooks in DEFAULT_CK_CONFIG.hooks set to true", () => {
			const hooks = DEFAULT_CK_CONFIG.hooks;
			expect(hooks).toBeDefined();
			if (!hooks) return;
			for (const hookName of CK_HOOK_NAMES) {
				const hookValue = hooks[hookName as keyof typeof hooks];
				expect(hookValue).toBe(true);
			}
		});

		it("should have all DEFAULT_CK_CONFIG.hooks entries in CK_HOOK_NAMES", () => {
			expect(DEFAULT_CK_CONFIG.hooks).toBeDefined();
			const hookEntries = Object.keys(DEFAULT_CK_CONFIG.hooks as Record<string, boolean>);
			for (const hookEntry of hookEntries) {
				expect(CK_HOOK_NAMES).toContain(hookEntry as any);
			}
		});

		it("should parse valid hooks config with all 9 hooks", async () => {
			const hooksConfig = {
				"session-init": true,
				"subagent-init": true,
				"descriptive-name": true,
				"dev-rules-reminder": true,
				"usage-context-awareness": true,
				"context-tracking": true,
				"scout-block": true,
				"privacy-block": true,
				"post-edit-simplify-reminder": true,
			};

			const testConfig: CkConfig = {
				...DEFAULT_CK_CONFIG,
				hooks: hooksConfig,
			};

			const result = CkConfigSchema.parse(testConfig);
			expect(result.hooks).toEqual(hooksConfig);
		});

		it("should allow optional hooks in schema (partial config)", async () => {
			const partialConfig: CkConfig = {
				hooks: {
					"session-init": false,
					"privacy-block": true,
				},
			};

			const result = CkConfigSchema.parse(partialConfig);
			expect(result.hooks?.["session-init"]).toBe(false);
			expect(result.hooks?.["privacy-block"]).toBe(true);
		});

		it("should validate that CK_HOOK_NAMES includes all expected hooks", () => {
			const expectedHooks = [
				"session-init",
				"subagent-init",
				"descriptive-name",
				"dev-rules-reminder",
				"usage-context-awareness",
				"context-tracking",
				"scout-block",
				"privacy-block",
				"post-edit-simplify-reminder",
			];

			for (const hook of expectedHooks) {
				expect(CK_HOOK_NAMES).toContain(hook as any);
			}
		});

		it("should have no unexpected hooks in CK_HOOK_NAMES", () => {
			const expectedHooks = new Set([
				"session-init",
				"subagent-init",
				"descriptive-name",
				"dev-rules-reminder",
				"usage-context-awareness",
				"context-tracking",
				"scout-block",
				"privacy-block",
				"post-edit-simplify-reminder",
			]);

			for (const hook of CK_HOOK_NAMES) {
				expect(expectedHooks.has(hook)).toBe(true);
			}
		});

		it("should maintain hook schema consistency across all three locations", () => {
			// All three must have exactly the same hooks
			const hooksInNames = new Set(CK_HOOK_NAMES);
			expect(DEFAULT_CK_CONFIG.hooks).toBeDefined();
			const hooksInConfig = new Set(
				Object.keys(DEFAULT_CK_CONFIG.hooks as Record<string, boolean>),
			);

			expect(hooksInNames.size).toBe(hooksInConfig.size);
			for (const hook of hooksInNames) {
				expect(hooksInConfig.has(hook)).toBe(true);
			}
		});
	});

	describe("Config file operations", () => {
		it("should save and load full config", async () => {
			const projectDir = join(tempDir, "project");
			const claudeDir = join(projectDir, ".claude");
			await mkdir(claudeDir, { recursive: true });

			const config: CkConfig = {
				...DEFAULT_CK_CONFIG,
				codingLevel: 2,
			};

			await CkConfigManager.saveFull(config, "project", projectDir);

			const loaded = await CkConfigManager.loadScope("project", projectDir);
			expect(loaded).toBeDefined();
			expect(loaded?.codingLevel).toBe(2);
		});

		it("should load global config path correctly", () => {
			const globalPath = CkConfigManager.getGlobalConfigPath();
			expect(globalPath).toContain(".claude");
			expect(globalPath).toContain(".ck.json");
			expect(globalPath).toContain(homedir());
		});

		it("should load project config path correctly", () => {
			const projectDir = join(tmpdir(), "myproject");
			const projectPath = CkConfigManager.getProjectConfigPath(projectDir);
			expect(projectPath).toContain(".claude");
			expect(projectPath).toContain(".ck.json");
			expect(projectPath).toContain("myproject");
		});

		it("should validate config on save using CkConfigSchema", async () => {
			const projectDir = join(tempDir, "project");
			const claudeDir = join(projectDir, ".claude");
			await mkdir(claudeDir, { recursive: true });

			const validConfig: CkConfig = {
				codingLevel: 1,
				hooks: { "session-init": true },
			};

			const path = await CkConfigManager.saveFull(validConfig, "project", projectDir);
			expect(existsSync(path)).toBe(true);

			const content = await readFile(path, "utf-8");
			const parsed = JSON.parse(content);
			expect(parsed.codingLevel).toBe(1);
		});
	});

	describe("Config existence checks", () => {
		it("should check if project config exists", async () => {
			const projectDir = join(tempDir, "project");
			const claudeDir = join(projectDir, ".claude");
			await mkdir(claudeDir, { recursive: true });

			expect(CkConfigManager.configExists("project", projectDir)).toBe(false);

			const configPath = join(claudeDir, ".ck.json");
			await writeFile(configPath, JSON.stringify({}));

			expect(CkConfigManager.configExists("project", projectDir)).toBe(true);
		});

		it("should return false for project scope when projectDir is null", () => {
			const exists = CkConfigManager.configExists("project", null);
			expect(exists).toBe(false);
		});
	});

	describe("Integrated test scenarios", () => {
		it("should handle complete project config lifecycle", async () => {
			const projectDir = join(tempDir, "myapp");

			// Initially should not exist
			expect(CkConfigManager.projectConfigExists(projectDir, false)).toBe(false);

			// Create and save config
			const claudeDir = join(projectDir, ".claude");
			await mkdir(claudeDir, { recursive: true });

			const initialConfig: CkConfig = {
				...DEFAULT_CK_CONFIG,
				codingLevel: 0,
				statusline: "compact",
			};

			await CkConfigManager.saveFull(initialConfig, "project", projectDir);

			// Should now exist
			expect(CkConfigManager.projectConfigExists(projectDir, false)).toBe(true);

			// Should be loadable
			const loaded = await CkConfigManager.loadScope("project", projectDir);
			expect(loaded?.codingLevel).toBe(0);
			expect(loaded?.statusline).toBe("compact");
		});

		it("should preserve hook configuration through save/load cycle", async () => {
			const projectDir = join(tempDir, "project");
			const claudeDir = join(projectDir, ".claude");
			await mkdir(claudeDir, { recursive: true });

			const customConfig: CkConfig = {
				...DEFAULT_CK_CONFIG,
				hooks: {
					"session-init": true,
					"privacy-block": false,
					"scout-block": true,
				},
			};

			await CkConfigManager.saveFull(customConfig, "project", projectDir);

			const loaded = await CkConfigManager.loadScope("project", projectDir);
			expect(loaded?.hooks?.["session-init"]).toBe(true);
			expect(loaded?.hooks?.["privacy-block"]).toBe(false);
			expect(loaded?.hooks?.["scout-block"]).toBe(true);
		});
	});

	describe("Edge cases", () => {
		it("should handle non-existent directory for projectConfigExists", () => {
			const nonexistentPath = join(tempDir, "this", "does", "not", "exist");
			const exists = CkConfigManager.projectConfigExists(nonexistentPath, false);
			expect(exists).toBe(false);
		});

		it("should distinguish between global and project config correctly", async () => {
			// Create both global and project configs
			const globalPath = join(tempDir, ".ck.json");
			await writeFile(globalPath, JSON.stringify({ codingLevel: 0 }));

			const projectDir = join(tempDir, "project");
			const claudeDir = join(projectDir, ".claude");
			await mkdir(claudeDir, { recursive: true });
			const projectPath = join(claudeDir, ".ck.json");
			await writeFile(projectPath, JSON.stringify({ codingLevel: 1 }));

			// Check global
			expect(CkConfigManager.projectConfigExists(tempDir, true)).toBe(true);

			// Check project
			expect(CkConfigManager.projectConfigExists(projectDir, false)).toBe(true);

			// They should be different files
			const globalContent = await readFile(globalPath, "utf-8");
			const projectContent = await readFile(projectPath, "utf-8");
			expect(globalContent).not.toBe(projectContent);
		});
	});
});
