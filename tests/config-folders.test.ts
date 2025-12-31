import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { DEFAULT_FOLDERS } from "@/types";
import { pathExists } from "fs-extra";

describe("ConfigManager Folders Support", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `ck-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("loadProjectConfig", () => {
		test("should return null when no config file exists", async () => {
			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result).toBeNull();
		});

		test("should load .claude/.ck.json config with paths key", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "ck-docs",
						plans: "ck-plans",
					},
				}),
			);

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result).not.toBeNull();
			expect(result?.docs).toBe("ck-docs");
			expect(result?.plans).toBe("ck-plans");
		});

		test("should handle flat structure (paths at root)", async () => {
			// Fallback: flat structure without "paths" wrapper
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					docs: "flat-docs",
					plans: "flat-plans",
				}),
			);

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result?.docs).toBe("flat-docs");
			expect(result?.plans).toBe("flat-plans");
		});
	});

	describe("saveProjectConfig", () => {
		test("should save config to .claude/.ck.json with paths key", async () => {
			await ConfigManager.saveProjectConfig(testDir, {
				docs: "saved-docs",
				plans: "saved-plans",
			});

			expect(await pathExists(join(testDir, ".claude", ".ck.json"))).toBe(true);

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result?.docs).toBe("saved-docs");
			expect(result?.plans).toBe("saved-plans");
		});

		test("should save partial config", async () => {
			await ConfigManager.saveProjectConfig(testDir, {
				docs: "only-docs",
			});

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result?.docs).toBe("only-docs");
			expect(result?.plans).toBeUndefined();
		});

		test("should preserve existing user settings when updating paths (selective merge)", async () => {
			// Create existing config with user customizations
			await mkdir(join(testDir, ".claude"), { recursive: true });
			const existingConfig = {
				codingLevel: -1,
				privacyBlock: true,
				plan: {
					namingFormat: "{date}-{issue}-{slug}",
					validation: { mode: "prompt", minQuestions: 3 },
				},
				paths: { docs: "docs", plans: "plans" },
				locale: { thinkingLanguage: "vi" },
			};
			await writeFile(join(testDir, ".claude", ".ck.json"), JSON.stringify(existingConfig));

			// Update only docs path
			await ConfigManager.saveProjectConfig(testDir, { docs: "my-docs" });

			// Read raw file to verify all settings preserved
			const content = await readFile(join(testDir, ".claude", ".ck.json"), "utf-8");
			const savedConfig = JSON.parse(content);

			// Verify user settings are preserved
			expect(savedConfig.codingLevel).toBe(-1);
			expect(savedConfig.privacyBlock).toBe(true);
			expect(savedConfig.plan.namingFormat).toBe("{date}-{issue}-{slug}");
			expect(savedConfig.plan.validation.mode).toBe("prompt");
			expect(savedConfig.locale.thinkingLanguage).toBe("vi");

			// Verify paths are correctly updated
			expect(savedConfig.paths.docs).toBe("my-docs");
			expect(savedConfig.paths.plans).toBe("plans"); // preserved from existing
		});

		test("should merge paths while preserving other path fields", async () => {
			// Create existing config with extra path fields
			await mkdir(join(testDir, ".claude"), { recursive: true });
			const existingConfig = {
				paths: { docs: "old-docs", plans: "old-plans", custom: "custom-path" },
			};
			await writeFile(join(testDir, ".claude", ".ck.json"), JSON.stringify(existingConfig));

			// Update only docs
			await ConfigManager.saveProjectConfig(testDir, { docs: "new-docs" });

			const content = await readFile(join(testDir, ".claude", ".ck.json"), "utf-8");
			const savedConfig = JSON.parse(content);

			// Verify merge behavior
			expect(savedConfig.paths.docs).toBe("new-docs"); // updated
			expect(savedConfig.paths.plans).toBe("old-plans"); // preserved
			expect(savedConfig.paths.custom).toBe("custom-path"); // preserved
		});

		test("should handle corrupted JSON gracefully and start fresh", async () => {
			// Create corrupted config file
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(join(testDir, ".claude", ".ck.json"), "{ invalid json }");

			// Should not throw, should create new config
			await ConfigManager.saveProjectConfig(testDir, { docs: "new-docs" });

			const content = await readFile(join(testDir, ".claude", ".ck.json"), "utf-8");
			const savedConfig = JSON.parse(content);

			expect(savedConfig.paths.docs).toBe("new-docs");
		});

		test("should handle malformed paths (non-object) gracefully", async () => {
			// Create config with paths as a string instead of object
			await mkdir(join(testDir, ".claude"), { recursive: true });
			const malformedConfig = {
				codingLevel: 2,
				paths: "invalid-string-instead-of-object",
			};
			await writeFile(join(testDir, ".claude", ".ck.json"), JSON.stringify(malformedConfig));

			// Should not throw, should replace malformed paths with valid object
			await ConfigManager.saveProjectConfig(testDir, { docs: "new-docs" });

			const content = await readFile(join(testDir, ".claude", ".ck.json"), "utf-8");
			const savedConfig = JSON.parse(content);

			// Other settings should be preserved
			expect(savedConfig.codingLevel).toBe(2);
			// Paths should be a valid object now
			expect(savedConfig.paths.docs).toBe("new-docs");
		});
	});

	describe("resolveFoldersConfig", () => {
		test("should return defaults when no config exists", async () => {
			const result = await ConfigManager.resolveFoldersConfig(testDir);

			expect(result.docs).toBe(DEFAULT_FOLDERS.docs);
			expect(result.plans).toBe(DEFAULT_FOLDERS.plans);
		});

		test("should use project config values", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "project-docs",
						plans: "project-plans",
					},
				}),
			);

			const result = await ConfigManager.resolveFoldersConfig(testDir);

			expect(result.docs).toBe("project-docs");
			expect(result.plans).toBe("project-plans");
		});

		test("should override with CLI options", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "project-docs",
						plans: "project-plans",
					},
				}),
			);

			const result = await ConfigManager.resolveFoldersConfig(testDir, {
				docsDir: "cli-docs",
			});

			expect(result.docs).toBe("cli-docs"); // CLI overrides
			expect(result.plans).toBe("project-plans"); // Config value preserved
		});

		test("should prioritize CLI options over all other sources", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "project-docs",
						plans: "project-plans",
					},
				}),
			);

			const result = await ConfigManager.resolveFoldersConfig(testDir, {
				docsDir: "cli-docs",
				plansDir: "cli-plans",
			});

			expect(result.docs).toBe("cli-docs");
			expect(result.plans).toBe("cli-plans");
		});
	});

	describe("projectConfigExists", () => {
		test("should return false when no config exists", () => {
			expect(ConfigManager.projectConfigExists(testDir)).toBe(false);
		});

		test("should return true when .claude/.ck.json exists", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(join(testDir, ".claude", ".ck.json"), "{}");
			expect(ConfigManager.projectConfigExists(testDir)).toBe(true);
		});
	});

	describe("global mode support", () => {
		let globalDir: string;

		beforeEach(async () => {
			// Simulate ~/.claude directory for global mode
			globalDir = join(testDir, ".claude");
			await mkdir(globalDir, { recursive: true });
		});

		describe("saveProjectConfig with global=true", () => {
			test("should save to projectDir/.ck.json in global mode", async () => {
				// In global mode, projectDir is already ~/.claude
				await ConfigManager.saveProjectConfig(
					globalDir,
					{
						docs: "global-docs",
						plans: "global-plans",
					},
					true,
				);

				// Should save directly to globalDir/.ck.json, NOT globalDir/.claude/.ck.json
				expect(await pathExists(join(globalDir, ".ck.json"))).toBe(true);
				expect(await pathExists(join(globalDir, ".claude", ".ck.json"))).toBe(false);
			});

			test("should save to projectDir/.claude/.ck.json in local mode (default)", async () => {
				await ConfigManager.saveProjectConfig(testDir, {
					docs: "local-docs",
					plans: "local-plans",
				});

				// Should save to testDir/.claude/.ck.json
				expect(await pathExists(join(testDir, ".claude", ".ck.json"))).toBe(true);
			});
		});

		describe("loadProjectConfig with global=true", () => {
			test("should load from projectDir/.ck.json in global mode", async () => {
				// Create config at global location
				await writeFile(
					join(globalDir, ".ck.json"),
					JSON.stringify({
						paths: {
							docs: "global-docs",
							plans: "global-plans",
						},
					}),
				);

				const result = await ConfigManager.loadProjectConfig(globalDir, true);
				expect(result).not.toBeNull();
				expect(result?.docs).toBe("global-docs");
				expect(result?.plans).toBe("global-plans");
			});

			test("should return null when global config does not exist", async () => {
				const result = await ConfigManager.loadProjectConfig(globalDir, true);
				expect(result).toBeNull();
			});
		});

		describe("projectConfigExists with global=true", () => {
			test("should check projectDir/.ck.json in global mode", async () => {
				expect(ConfigManager.projectConfigExists(globalDir, true)).toBe(false);

				await writeFile(join(globalDir, ".ck.json"), "{}");
				expect(ConfigManager.projectConfigExists(globalDir, true)).toBe(true);
			});

			test("should not find config at nested path in global mode", async () => {
				// Create config at wrong nested location
				await mkdir(join(globalDir, ".claude"), { recursive: true });
				await writeFile(join(globalDir, ".claude", ".ck.json"), "{}");

				// Global mode should NOT find this
				expect(ConfigManager.projectConfigExists(globalDir, true)).toBe(false);
			});
		});

		describe("migration: detect and fix nested .ck.json", () => {
			test("should migrate ~/.claude/.claude/.ck.json to ~/.claude/.ck.json", async () => {
				// Simulate the bug: config at nested location
				const nestedClaudeDir = join(globalDir, ".claude");
				await mkdir(nestedClaudeDir, { recursive: true });
				await writeFile(
					join(nestedClaudeDir, ".ck.json"),
					JSON.stringify({
						paths: {
							docs: "old-docs",
							plans: "old-plans",
						},
					}),
				);

				// Run migration
				const migrated = await ConfigManager.migrateNestedConfig(globalDir);
				expect(migrated).toBe(true);

				// Should now exist at correct location
				expect(await pathExists(join(globalDir, ".ck.json"))).toBe(true);
				// Old location should be removed
				expect(await pathExists(join(nestedClaudeDir, ".ck.json"))).toBe(false);

				// Verify content
				const result = await ConfigManager.loadProjectConfig(globalDir, true);
				expect(result?.docs).toBe("old-docs");
				expect(result?.plans).toBe("old-plans");
			});

			test("should not migrate if correct config already exists", async () => {
				// Config at correct location
				await writeFile(
					join(globalDir, ".ck.json"),
					JSON.stringify({
						paths: {
							docs: "correct-docs",
							plans: "correct-plans",
						},
					}),
				);

				// Also have old nested config (shouldn't overwrite)
				const nestedClaudeDir = join(globalDir, ".claude");
				await mkdir(nestedClaudeDir, { recursive: true });
				await writeFile(
					join(nestedClaudeDir, ".ck.json"),
					JSON.stringify({
						paths: {
							docs: "old-docs",
							plans: "old-plans",
						},
					}),
				);

				const migrated = await ConfigManager.migrateNestedConfig(globalDir);
				expect(migrated).toBe(false);

				// Original config should be preserved
				const result = await ConfigManager.loadProjectConfig(globalDir, true);
				expect(result?.docs).toBe("correct-docs");
			});

			test("should return false if no migration needed", async () => {
				const migrated = await ConfigManager.migrateNestedConfig(globalDir);
				expect(migrated).toBe(false);
			});

			test("should not remove nested .claude directory if it contains other files", async () => {
				// Simulate the bug: config at nested location with other files
				const nestedClaudeDir = join(globalDir, ".claude");
				await mkdir(nestedClaudeDir, { recursive: true });
				await writeFile(
					join(nestedClaudeDir, ".ck.json"),
					JSON.stringify({
						paths: {
							docs: "old-docs",
							plans: "old-plans",
						},
					}),
				);
				// Add another file so directory isn't empty after migration
				await writeFile(join(nestedClaudeDir, "other-file.txt"), "some content");

				const migrated = await ConfigManager.migrateNestedConfig(globalDir);
				expect(migrated).toBe(true);

				// Config should be moved to correct location
				expect(await pathExists(join(globalDir, ".ck.json"))).toBe(true);
				// Old .ck.json should be removed
				expect(await pathExists(join(nestedClaudeDir, ".ck.json"))).toBe(false);
				// Nested directory should still exist (has other files)
				expect(await pathExists(nestedClaudeDir)).toBe(true);
				// Other file should be preserved
				expect(await pathExists(join(nestedClaudeDir, "other-file.txt"))).toBe(true);

				// Verify content was migrated correctly
				const result = await ConfigManager.loadProjectConfig(globalDir, true);
				expect(result?.docs).toBe("old-docs");
				expect(result?.plans).toBe("old-plans");
			});
		});
	});
});
