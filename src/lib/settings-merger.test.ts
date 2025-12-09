import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type SettingsJson, SettingsMerger } from "./settings-merger.js";

describe("SettingsMerger", () => {
	describe("merge", () => {
		it("should preserve user hooks while adding CK hooks", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/ck-session-start.cjs" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "my-custom-hook.sh" }],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.hooks?.SessionStart).toHaveLength(2);
			expect(result.hooksPreserved).toBe(1);
			expect(result.hooksAdded).toBe(1);
		});

		it("should deduplicate hooks by command string", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Should only have 1 hook (the duplicate was detected)
			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
			expect(result.conflictsDetected).toHaveLength(1);
		});

		it("should preserve user PreToolUse hooks not in source", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "my-custom-hook.sh" }],
					PreToolUse: [{ type: "command", command: "my-validator.js" }],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.hooks?.PreToolUse).toBeDefined();
			expect(result.merged.hooks?.PreToolUse).toHaveLength(1);
		});

		it("should preserve user MCP servers", () => {
			const source: SettingsJson = {
				mcp: {
					servers: {
						"ck-server": { command: "node", args: ["server.js"] },
					},
				},
			};

			const destination: SettingsJson = {
				mcp: {
					servers: {
						"my-server": { url: "http://localhost:3000" },
					},
				},
			};

			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.mcp?.servers?.["my-server"]).toBeDefined();
			expect(result.merged.mcp?.servers?.["ck-server"]).toBeDefined();
			expect(result.mcpServersPreserved).toBe(0); // No conflict, just added
		});

		it("should not overwrite existing MCP server with same name", () => {
			const source: SettingsJson = {
				mcp: {
					servers: {
						"shared-server": { command: "new-server.js" },
					},
				},
			};

			const destination: SettingsJson = {
				mcp: {
					servers: {
						"shared-server": { command: "my-custom-server.js" },
					},
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// User's server should be preserved
			expect(result.merged.mcp?.servers?.["shared-server"]?.command).toBe("my-custom-server.js");
			expect(result.mcpServersPreserved).toBe(1);
		});

		it("should handle nested hook configs with matcher", () => {
			const source: SettingsJson = {
				hooks: {
					SubagentStart: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: "node .claude/hooks/subagent-init.cjs" }],
						},
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SubagentStart: [
						{
							matcher: "tester",
							hooks: [{ type: "command", command: "my-tester-hook.sh" }],
						},
					],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Both should be present (different hooks)
			expect(result.merged.hooks?.SubagentStart).toHaveLength(2);
		});

		it("should preserve user-only keys not present in source", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "ck-hook.js" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "user-hook.sh" }],
				},
				customUserKey: "should-be-preserved",
			};

			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.customUserKey).toBe("should-be-preserved");
		});

		it("should group multiple duplicate commands in single conflict message", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: "duplicate1.js" },
								{ type: "command", command: "duplicate2.js" },
							],
						},
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: "duplicate1.js" },
								{ type: "command", command: "duplicate2.js" },
							],
						},
					],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Should have only ONE conflict message mentioning "2 commands"
			expect(result.conflictsDetected).toHaveLength(1);
			expect(result.conflictsDetected[0]).toContain("2 commands");
		});

		it("should add new CK-managed keys not present in destination", () => {
			const source: SettingsJson = {
				hooks: {},
				newCkFeature: { enabled: true },
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.newCkFeature).toEqual({ enabled: true });
		});

		it("should handle empty source hooks", () => {
			const source: SettingsJson = {
				hooks: {},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "user-hook.sh" }],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// User hooks are preserved in the merged result
			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
			// hooksPreserved counts per-event, and since source has no SessionStart event,
			// we don't iterate it, so preserved count is 0 (but hooks ARE in the result)
			expect(result.hooksPreserved).toBe(0);
			expect(result.hooksAdded).toBe(0);
		});

		it("should handle empty destination hooks", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "ck-hook.js" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
			expect(result.hooksAdded).toBe(1);
		});
	});

	describe("file operations", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "settings-merger-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should read and parse settings file", async () => {
			const settingsPath = join(tempDir, "settings.json");
			await writeFile(settingsPath, JSON.stringify({ hooks: { SessionStart: [] } }));

			const settings = await SettingsMerger.readSettingsFile(settingsPath);

			expect(settings).toBeDefined();
			expect(settings?.hooks?.SessionStart).toEqual([]);
		});

		it("should return null for non-existent file", async () => {
			const settings = await SettingsMerger.readSettingsFile(join(tempDir, "nonexistent.json"));

			expect(settings).toBeNull();
		});

		it("should return null for invalid JSON", async () => {
			const settingsPath = join(tempDir, "invalid.json");
			await writeFile(settingsPath, "not valid json {");

			const settings = await SettingsMerger.readSettingsFile(settingsPath);

			expect(settings).toBeNull();
		});

		it("should return null for JSON array (invalid settings format)", async () => {
			const settingsPath = join(tempDir, "array.json");
			await writeFile(settingsPath, '["not", "an", "object"]');

			const settings = await SettingsMerger.readSettingsFile(settingsPath);

			expect(settings).toBeNull();
		});

		it("should return null for JSON primitive (invalid settings format)", async () => {
			const settingsPath = join(tempDir, "primitive.json");
			await writeFile(settingsPath, '"just a string"');

			const settings = await SettingsMerger.readSettingsFile(settingsPath);

			expect(settings).toBeNull();
		});

		it("should write settings file with proper formatting", async () => {
			const settingsPath = join(tempDir, "output.json");
			const settings: SettingsJson = {
				hooks: { SessionStart: [{ type: "command", command: "test.sh" }] },
			};

			await SettingsMerger.writeSettingsFile(settingsPath, settings);
			const content = await SettingsMerger.readSettingsFile(settingsPath);

			expect(content).toEqual(settings);
		});

		it("should create backup of existing file", async () => {
			const settingsPath = join(tempDir, "settings.json");
			const originalContent: SettingsJson = {
				hooks: { SessionStart: [{ type: "command", command: "original.sh" }] },
			};
			await writeFile(settingsPath, JSON.stringify(originalContent));

			const backupPath = await SettingsMerger.createBackup(settingsPath);

			expect(backupPath).toBe(`${settingsPath}.backup`);
			const backupContent = await SettingsMerger.readSettingsFile(backupPath as string);
			expect(backupContent).toEqual(originalContent);
		});

		it("should return null when backup file does not exist", async () => {
			const backupPath = await SettingsMerger.createBackup(join(tempDir, "nonexistent.json"));

			expect(backupPath).toBeNull();
		});
	});

	describe("complex merge scenarios", () => {
		it("should handle real-world settings merge", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: 'node "$HOME"/.claude/hooks/session-start.cjs' }],
						},
					],
					UserPromptSubmit: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: 'node "$HOME"/.claude/hooks/user-prompt-submit.cjs' },
							],
						},
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: "my-custom-hook.sh" }],
						},
					],
					PreToolUse: [
						{
							matcher: "Bash",
							hooks: [{ type: "command", command: "my-bash-validator.js" }],
						},
					],
				},
				mcp: {
					servers: {
						"my-server": { url: "http://localhost:3000" },
					},
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// SessionStart should have both user and CK hooks
			expect(result.merged.hooks?.SessionStart).toHaveLength(2);

			// UserPromptSubmit should be added from source
			expect(result.merged.hooks?.UserPromptSubmit).toBeDefined();

			// PreToolUse should be preserved from destination
			expect(result.merged.hooks?.PreToolUse).toBeDefined();

			// MCP servers should be preserved
			expect(result.merged.mcp?.servers?.["my-server"]).toBeDefined();
		});

		it("should handle the exact scenario from the issue", () => {
			// Source - ClaudeKit template
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};

			// Destination - User's existing
			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "my-custom-hook.sh" }],
					PreToolUse: [{ type: "command", command: "my-validator.js" }],
				},
				mcp: {
					servers: { "my-server": { url: "..." } },
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Expected merged result
			expect(result.merged.hooks?.SessionStart).toHaveLength(2);
			expect(result.merged.hooks?.PreToolUse).toHaveLength(1);
			expect(result.merged.mcp?.servers?.["my-server"]).toBeDefined();
		});
	});
});
