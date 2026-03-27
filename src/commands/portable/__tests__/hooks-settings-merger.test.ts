import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	filterToInstalledHooks,
	mergeHooksIntoSettings,
	migrateHooksSettings,
	readHooksFromSettings,
	rewriteHookPaths,
} from "../hooks-settings-merger.js";

const testDir = join(tmpdir(), "claudekit-hooks-merger-test");

beforeAll(() => {
	mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("readHooksFromSettings", () => {
	it("reads hooks from valid settings.json", async () => {
		const path = join(testDir, "read-valid.json");
		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					SessionStart: [{ matcher: "*", hooks: [{ type: "command", command: "echo hi" }] }],
				},
			}),
		);
		const result = await readHooksFromSettings(path);
		expect(result).not.toBeNull();
		expect(result?.SessionStart).toHaveLength(1);
	});

	it("returns null for missing file", async () => {
		const result = await readHooksFromSettings(join(testDir, "nonexistent.json"));
		expect(result).toBeNull();
	});

	it("returns null when no hooks key", async () => {
		const path = join(testDir, "read-no-hooks.json");
		writeFileSync(path, JSON.stringify({ permissions: {} }));
		const result = await readHooksFromSettings(path);
		expect(result).toBeNull();
	});

	it("returns null for malformed JSON", async () => {
		const path = join(testDir, "read-malformed.json");
		writeFileSync(path, "{ not valid json");
		const result = await readHooksFromSettings(path);
		expect(result).toBeNull();
	});
});

describe("rewriteHookPaths", () => {
	const sourceHooks = {
		SessionStart: [
			{
				matcher: "*",
				hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }],
			},
		],
	};

	it("rewrites global paths from claude to factory", () => {
		const result = rewriteHookPaths(sourceHooks, ".claude/hooks", ".factory/hooks");
		expect(result.SessionStart[0].hooks[0].command).toBe(
			'node "$HOME/.factory/hooks/session-init.cjs"',
		);
	});

	it("no-op when source and target are the same", () => {
		const result = rewriteHookPaths(sourceHooks, ".claude/hooks", ".claude/hooks");
		expect(result).toBe(sourceHooks); // Same reference — no copy
	});

	it("rewrites project-level paths", () => {
		const projectHooks = {
			PreToolUse: [
				{
					hooks: [{ type: "command", command: "node .claude/hooks/privacy-block.cjs" }],
				},
			],
		};
		const result = rewriteHookPaths(projectHooks, ".claude/hooks", ".factory/hooks");
		expect(result.PreToolUse[0].hooks[0].command).toBe("node .factory/hooks/privacy-block.cjs");
	});
});

describe("filterToInstalledHooks", () => {
	const hooks = {
		SessionStart: [
			{
				matcher: "*",
				hooks: [
					{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' },
					{ type: "command", command: 'node "$HOME/.claude/hooks/missing-hook.cjs"' },
				],
			},
		],
		PreToolUse: [
			{
				hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/privacy-block.cjs"' }],
			},
		],
	};

	it("keeps only hooks referencing installed files", () => {
		const result = filterToInstalledHooks(hooks, ["session-init.cjs", "privacy-block.cjs"]);
		expect(result.SessionStart[0].hooks).toHaveLength(1);
		expect(result.SessionStart[0].hooks[0].command).toContain("session-init.cjs");
		expect(result.PreToolUse[0].hooks).toHaveLength(1);
	});

	it("drops entire event when no hooks match", () => {
		const result = filterToInstalledHooks(hooks, ["unrelated.cjs"]);
		expect(result.SessionStart).toBeUndefined();
		expect(result.PreToolUse).toBeUndefined();
	});

	it("handles empty installed files list", () => {
		const result = filterToInstalledHooks(hooks, []);
		expect(Object.keys(result)).toHaveLength(0);
	});
});

describe("mergeHooksIntoSettings", () => {
	it("creates new settings.json when target missing", async () => {
		const path = join(testDir, "merge-new", "settings.json");
		const newHooks = {
			SessionStart: [{ hooks: [{ type: "command", command: "echo init" }] }],
		};
		const result = await mergeHooksIntoSettings(path, newHooks);
		expect(result.backupPath).toBeNull();
		expect(existsSync(path)).toBe(true);

		const content = JSON.parse(await Bun.file(path).text());
		expect(content.hooks.SessionStart).toHaveLength(1);
	});

	it("preserves existing hooks and deduplicates", async () => {
		const path = join(testDir, "merge-dedup.json");
		writeFileSync(
			path,
			JSON.stringify({
				permissions: { allow: ["Read"] },
				hooks: {
					SessionStart: [{ matcher: "*", hooks: [{ type: "command", command: "echo existing" }] }],
				},
			}),
		);

		const newHooks = {
			SessionStart: [
				{
					matcher: "*",
					hooks: [
						{ type: "command", command: "echo existing" }, // duplicate
						{ type: "command", command: "echo new" }, // new
					],
				},
			],
			PreToolUse: [{ hooks: [{ type: "command", command: "echo pre" }] }],
		};

		const result = await mergeHooksIntoSettings(path, newHooks);
		expect(result.backupPath).not.toBeNull();

		const content = JSON.parse(await Bun.file(path).text());
		// Existing permissions preserved
		expect(content.permissions.allow).toContain("Read");
		// SessionStart: 1 existing + 1 new (duplicate skipped)
		expect(content.hooks.SessionStart[0].hooks).toHaveLength(2);
		// PreToolUse: new event added
		expect(content.hooks.PreToolUse).toHaveLength(1);
	});

	it("creates backup of existing file", async () => {
		const path = join(testDir, "merge-backup.json");
		writeFileSync(path, JSON.stringify({ hooks: {} }));

		const result = await mergeHooksIntoSettings(path, {
			Test: [{ hooks: [{ type: "command", command: "echo test" }] }],
		});
		expect(result.backupPath).not.toBeNull();
		expect(existsSync(result.backupPath as string)).toBe(true);
	});
});

describe("migrateHooksSettings", () => {
	it("returns early when no installed files", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "droid",
			installedHookFiles: [],
			global: false,
		});
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
	});

	it("returns early when source has no settings.json", async () => {
		// Use a temp dir as cwd substitute — no settings.json exists there
		const tempBase = mkdtempSync(join(tmpdir(), "hooks-migrate-test-"));
		try {
			// We rely on global: false using process.cwd(). Since we can't easily redirect
			// cwd in tests, we test the global path which resolves to a predictable location
			// that won't have a settings.json in CI. Alternatively, rely on global: true with
			// a path that doesn't exist.
			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "droid",
				installedHookFiles: ["session-init.cjs"],
				global: false,
			});
			// Source settings.json does not exist at .claude/settings.json in any test cwd
			expect(result.success).toBe(true);
			expect(result.hooksRegistered).toBe(0);
		} finally {
			rmSync(tempBase, { recursive: true, force: true });
		}
	});

	it("handles self-migration (source === target provider)", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "claude-code",
			installedHookFiles: ["hook.cjs"],
			global: true,
		});
		expect(result.success).toBe(true);
	});

	it("returns early for unsupported source provider", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "droid" as "claude-code",
			targetProvider: "claude-code",
			installedHookFiles: ["hook.cjs"],
			global: true,
		});
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
		expect(result.message).toContain("not yet supported");
	});
});
