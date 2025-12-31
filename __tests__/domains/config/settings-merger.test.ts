import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type SettingsJson, SettingsMerger } from "../../../src/domains/config/settings-merger.js";

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

			// Both should be present (different matchers)
			expect(result.merged.hooks?.SubagentStart).toHaveLength(2);
		});

		it("should merge hooks into existing matcher instead of creating duplicate (issue #219)", () => {
			// User's existing settings with scout-block.cjs
			const destination: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash|Glob|Grep|Read|Edit|Write",
							hooks: [
								{
									type: "command",
									command: "node $HOME/.claude/hooks/scout-block.cjs",
								},
							],
						},
					],
				},
			};

			// Template wants to add privacy-block.cjs to the SAME matcher
			const source: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash|Glob|Grep|Read|Edit|Write",
							hooks: [
								{
									type: "command",
									command: "node $HOME/.claude/hooks/privacy-block.cjs",
								},
							],
						},
					],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Should have ONE entry with merged hooks, NOT two duplicate matcher entries
			expect(result.merged.hooks?.PreToolUse).toHaveLength(1);

			const entry = result.merged.hooks?.PreToolUse?.[0] as {
				matcher: string;
				hooks: Array<{ command: string }>;
			};
			expect(entry.matcher).toBe("Bash|Glob|Grep|Read|Edit|Write");
			expect(entry.hooks).toHaveLength(2);
			expect(entry.hooks[0].command).toBe("node $HOME/.claude/hooks/scout-block.cjs");
			expect(entry.hooks[1].command).toBe("node $HOME/.claude/hooks/privacy-block.cjs");
		});

		it("should not duplicate hooks when merging same matcher with same commands", () => {
			const destination: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash|Glob|Grep|Read|Edit|Write",
							hooks: [
								{ type: "command", command: "node $HOME/.claude/hooks/scout-block.cjs" },
								{ type: "command", command: "node $HOME/.claude/hooks/privacy-block.cjs" },
							],
						},
					],
				},
			};

			// Source has same matcher with already-existing commands
			const source: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash|Glob|Grep|Read|Edit|Write",
							hooks: [{ type: "command", command: "node $HOME/.claude/hooks/scout-block.cjs" }],
						},
					],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Should still have ONE entry, hooks should NOT be duplicated
			expect(result.merged.hooks?.PreToolUse).toHaveLength(1);
			const entry = result.merged.hooks?.PreToolUse?.[0] as {
				matcher: string;
				hooks: Array<{ command: string }>;
			};
			expect(entry.hooks).toHaveLength(2); // No duplicates added
			expect(result.conflictsDetected).toHaveLength(1); // Duplicate detected
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

		it("should atomically write settings file (no leftover temp files)", async () => {
			const settingsPath = join(tempDir, "settings.json");
			const settings: SettingsJson = {
				hooks: { SessionStart: [{ type: "command", command: "test.sh" }] },
			};

			await SettingsMerger.writeSettingsFile(settingsPath, settings);

			// Verify file was written correctly
			const content = await SettingsMerger.readSettingsFile(settingsPath);
			expect(content).toEqual(settings);

			// Verify no temp files left behind
			const { readdir } = await import("node:fs/promises");
			const files = await readdir(tempDir);
			const tempFiles = files.filter((f) => f.includes(".tmp") || f.includes(".settings-"));
			expect(tempFiles).toHaveLength(0);
		});

		it("should overwrite existing file atomically", async () => {
			const settingsPath = join(tempDir, "settings.json");

			// Write initial content
			const initial: SettingsJson = { hooks: { v1: [] } };
			await SettingsMerger.writeSettingsFile(settingsPath, initial);

			// Write updated content
			const updated: SettingsJson = { hooks: { v2: [] } };
			await SettingsMerger.writeSettingsFile(settingsPath, updated);

			// Verify updated content
			const content = await SettingsMerger.readSettingsFile(settingsPath);
			expect(content?.hooks?.v2).toEqual([]);
			expect(content?.hooks?.v1).toBeUndefined();

			// Verify no backup file created
			const { readdir } = await import("node:fs/promises");
			const files = await readdir(tempDir);
			expect(files).not.toContain("settings.json.backup");
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

			// SessionStart should have ONE entry with merged hooks (same matcher "*")
			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
			const sessionStart = result.merged.hooks?.SessionStart?.[0] as {
				hooks: Array<{ command: string }>;
			};
			expect(sessionStart.hooks).toHaveLength(2); // Both commands merged
			expect(sessionStart.hooks[0].command).toBe("my-custom-hook.sh"); // User hook first
			expect(sessionStart.hooks[1].command).toBe('node "$HOME"/.claude/hooks/session-start.cjs');

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

		it("should add entry with partial duplicate commands (atomic entries)", () => {
			// CK entry has 2 commands: 1 duplicate + 1 new
			const source: SettingsJson = {
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: "duplicate-cmd.js" },
								{ type: "command", command: "new-cmd.js" },
							],
						},
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "duplicate-cmd.js" }],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// Entry should be added because it has at least one new command
			// (entries are atomic - can't split)
			expect(result.merged.hooks?.SessionStart).toHaveLength(2);
			expect(result.hooksAdded).toBe(1);
			expect(result.conflictsDetected).toHaveLength(1);
			expect(result.conflictsDetected[0]).toContain("duplicate-cmd.js");
		});
	});

	describe("malformed hook entries", () => {
		it("should handle hook entry without command field", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command" } as unknown as { type: string; command: string }],
				},
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			// Should not throw - gracefully handle missing command
			const result = SettingsMerger.merge(source, destination);
			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
		});

		it("should handle nested hook config with empty hooks array", () => {
			const source: SettingsJson = {
				hooks: {
					SubagentStart: [
						{
							matcher: "*",
							hooks: [],
						},
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			const result = SettingsMerger.merge(source, destination);
			expect(result.merged.hooks?.SubagentStart).toHaveLength(1);
		});

		it("should handle hook entry with null command", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [
						{ type: "command", command: null as unknown as string },
						{ type: "command", command: "valid-cmd.js" },
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			const result = SettingsMerger.merge(source, destination);
			// Should process entries (null command is ignored in extraction)
			expect(result.merged.hooks?.SessionStart).toHaveLength(2);
		});
	});

	describe("hook execution order", () => {
		it("should place user hooks before CK hooks (user priority)", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "ck-hook.js" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "user-hook.sh" }],
				},
			};

			const result = SettingsMerger.merge(source, destination);

			// User hook should be first in the array
			const hooks = result.merged.hooks?.SessionStart as Array<{ command: string }>;
			expect(hooks[0].command).toBe("user-hook.sh");
			expect(hooks[1].command).toBe("ck-hook.js");
		});
	});

	describe("respect user deletions", () => {
		it("should skip hooks that user previously had but removed", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [
						{ type: "command", command: "node .claude/hooks/privacy-hook.cjs" },
						{ type: "command", command: "node .claude/hooks/session-start.cjs" },
					],
				},
			};

			// User has session-start but removed privacy-hook
			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};

			// Privacy hook was installed before
			const result = SettingsMerger.merge(source, destination, {
				installedSettings: {
					hooks: ["node .claude/hooks/privacy-hook.cjs"],
				},
			});

			// Should NOT re-add privacy-hook since user removed it
			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
			expect(result.hooksSkipped).toBe(1);
		});

		it("should add hooks that user never had", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [
						{ type: "command", command: "node .claude/hooks/new-hook.cjs" },
						{ type: "command", command: "node .claude/hooks/session-start.cjs" },
					],
				},
			};

			const destination: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};

			// new-hook was never installed
			const result = SettingsMerger.merge(source, destination, {
				installedSettings: {
					hooks: ["node .claude/hooks/session-start.cjs"], // Only this was installed
				},
			});

			// Should add new-hook since user never had it
			expect(result.merged.hooks?.SessionStart).toHaveLength(2);
			expect(result.newlyInstalledHooks).toContain("node .claude/hooks/new-hook.cjs");
		});

		it("should skip MCP servers that user previously had but removed", () => {
			const source: SettingsJson = {
				mcp: {
					servers: {
						"ck-server": { command: "node", args: ["server.js"] },
						"new-server": { command: "node", args: ["new.js"] },
					},
				},
			};

			// User removed ck-server
			const destination: SettingsJson = {
				mcp: {
					servers: {},
				},
			};

			const result = SettingsMerger.merge(source, destination, {
				installedSettings: {
					mcpServers: ["ck-server"], // ck-server was installed before
				},
			});

			// Should NOT re-add ck-server, but should add new-server
			expect(result.merged.mcp?.servers?.["ck-server"]).toBeUndefined();
			expect(result.merged.mcp?.servers?.["new-server"]).toBeDefined();
			expect(result.mcpServersSkipped).toBe(1);
			expect(result.newlyInstalledServers).toContain("new-server");
		});

		it("should track newly installed hooks", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/brand-new.cjs" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			const result = SettingsMerger.merge(source, destination, {
				installedSettings: { hooks: [], mcpServers: [] },
			});

			expect(result.newlyInstalledHooks).toContain("node .claude/hooks/brand-new.cjs");
		});

		it("should work without installedSettings (backward compatible)", () => {
			const source: SettingsJson = {
				hooks: {
					SessionStart: [{ type: "command", command: "ck-hook.js" }],
				},
			};

			const destination: SettingsJson = {
				hooks: {},
			};

			// No options passed - should behave like before
			const result = SettingsMerger.merge(source, destination);

			expect(result.merged.hooks?.SessionStart).toHaveLength(1);
			expect(result.hooksSkipped).toBe(0);
		});
	});
});
