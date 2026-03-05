import { describe, expect, it } from "bun:test";
import { mergeHooks, mergeMcp, mergeSettings } from "@/domains/config/merger/merge-engine.js";
import type { HookEntry, MergeResult, SettingsJson } from "@/domains/config/merger/types.js";

function createMergeResult(): MergeResult {
	return {
		merged: {},
		hooksAdded: 0,
		hooksPreserved: 0,
		hooksSkipped: 0,
		hooksRemoved: 0,
		mcpServersPreserved: 0,
		mcpServersSkipped: 0,
		mcpServersRemoved: 0,
		conflictsDetected: [],
		newlyInstalledHooks: [],
		newlyInstalledServers: [],
		hooksByOrigin: new Map(),
	};
}

describe("merge-engine deprecation removal", () => {
	describe("mergeHooks removes deprecated hooks", () => {
		it("should remove hook in installed but not in source", () => {
			const sourceHooks: Record<string, HookEntry[]> = {
				SessionStart: [{ type: "command", command: "node new-hook.js" }],
			};
			const destHooks: Record<string, HookEntry[]> = {
				SessionStart: [
					{ type: "command", command: "node new-hook.js" },
					{ type: "command", command: "node deprecated-hook.js" },
				],
			};
			const result = createMergeResult();

			const merged = mergeHooks(sourceHooks, destHooks, result, {
				installedSettings: {
					hooks: ["node deprecated-hook.js"],
				},
			});

			// deprecated-hook.js should be removed
			expect(merged.SessionStart).toHaveLength(1);
			expect(result.hooksRemoved).toBe(1);
			expect(result.removedHooks).toContain("node deprecated-hook.js");
		});

		it("should preserve user-added hook not in installed", () => {
			const sourceHooks: Record<string, HookEntry[]> = {
				SessionStart: [{ type: "command", command: "node ck-hook.js" }],
			};
			const destHooks: Record<string, HookEntry[]> = {
				SessionStart: [
					{ type: "command", command: "node ck-hook.js" },
					{ type: "command", command: "node user-hook.js" },
				],
			};
			const result = createMergeResult();

			const merged = mergeHooks(sourceHooks, destHooks, result, {
				installedSettings: {
					hooks: ["node ck-hook.js"], // user-hook.js not in installed = user added it
				},
			});

			// user-hook.js should be preserved
			expect(merged.SessionStart).toHaveLength(2);
			expect(result.hooksRemoved).toBe(0);
		});

		it("should not remove anything with empty installedSettings", () => {
			const sourceHooks: Record<string, HookEntry[]> = {
				SessionStart: [{ type: "command", command: "node new-hook.js" }],
			};
			const destHooks: Record<string, HookEntry[]> = {
				SessionStart: [{ type: "command", command: "node old-hook.js" }],
			};
			const result = createMergeResult();

			const merged = mergeHooks(sourceHooks, destHooks, result, {
				installedSettings: { hooks: [] },
			});

			// old-hook.js preserved (fresh install scenario)
			expect(merged.SessionStart).toHaveLength(2);
			expect(result.hooksRemoved).toBe(0);
		});
	});

	describe("mergeMcp removes deprecated servers", () => {
		it("should remove server in installed but not in source", () => {
			const sourceMcp: SettingsJson["mcp"] = {
				servers: { "new-server": { command: "npx new" } },
			};
			const destMcp: SettingsJson["mcp"] = {
				servers: {
					"new-server": { command: "npx new" },
					"deprecated-server": { command: "npx old" },
				},
			};
			const result = createMergeResult();

			const merged = mergeMcp(sourceMcp, destMcp, result, {
				installedSettings: {
					mcpServers: ["deprecated-server"],
				},
			});

			expect(merged?.servers).not.toHaveProperty("deprecated-server");
			expect(merged?.servers).toHaveProperty("new-server");
			expect(result.mcpServersRemoved).toBe(1);
			expect(result.removedMcpServers).toContain("deprecated-server");
		});

		it("should preserve user-added server not in installed", () => {
			const sourceMcp: SettingsJson["mcp"] = {
				servers: { "ck-server": { command: "npx ck" } },
			};
			const destMcp: SettingsJson["mcp"] = {
				servers: {
					"ck-server": { command: "npx ck" },
					"user-server": { command: "npx user" },
				},
			};
			const result = createMergeResult();

			const merged = mergeMcp(sourceMcp, destMcp, result, {
				installedSettings: {
					mcpServers: ["ck-server"], // user-server not in installed
				},
			});

			expect(merged?.servers).toHaveProperty("ck-server");
			expect(merged?.servers).toHaveProperty("user-server");
			expect(result.mcpServersRemoved).toBe(0);
		});
	});

	describe("mergeSettings initializes removal counters", () => {
		it("should initialize hooksRemoved and mcpServersRemoved to 0", () => {
			const source: SettingsJson = {};
			const dest: SettingsJson = {};

			const result = mergeSettings(source, dest);

			expect(result.hooksRemoved).toBe(0);
			expect(result.mcpServersRemoved).toBe(0);
		});
	});
});
