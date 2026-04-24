import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	filterToInstalledHooks,
	mapHookEventsForProvider,
	mergeHooksIntoSettings,
	migrateHooksSettings,
	readHooksFromSettings,
	rewriteHookPaths,
} from "../hooks-settings-merger.js";
import type { ProviderType } from "../types.js";

const testDir = join(tmpdir(), "claudekit-hooks-merger-test");
const normalizePathForAssert = (value: string | null | undefined) =>
	(value ?? "").replaceAll("\\", "/");

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

	it("prunes stale absolute-path hooks whose target file is missing (self-heal)", async () => {
		// Paths under a fake .codex/hooks/ directory to exercise the CK-managed scope.
		const ckHooksDir = join(testDir, ".codex", "hooks");
		await Bun.write(join(ckHooksDir, ".keep"), "");
		const path = join(testDir, "merge-selfheal.json");
		const liveHook = join(ckHooksDir, "live-hook.cjs");
		const staleHook = join(ckHooksDir, "does-not-exist.cjs");
		writeFileSync(liveHook, "// live");

		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: staleHook }, // stale — file missing
								{ type: "command", command: liveHook }, // live — file present
								{ type: "command", command: "npm run lint" }, // non-path — keep
							],
						},
					],
				},
			}),
		);

		const newHooks = {
			PreToolUse: [
				{
					matcher: "*",
					hooks: [{ type: "command", command: liveHook }], // duplicate of live
				},
			],
		};
		await mergeHooksIntoSettings(path, newHooks);

		const content = JSON.parse(await Bun.file(path).text());
		const commands = content.hooks.PreToolUse[0].hooks.map((h: { command: string }) => h.command);
		// Stale removed
		expect(commands).not.toContain(staleHook);
		// Live preserved (deduped)
		expect(commands.filter((c: string) => c === liveHook)).toHaveLength(1);
		// Non-path shell command preserved
		expect(commands).toContain("npm run lint");
	});

	it("drops a group when all its hooks are stale", async () => {
		const ckHooksDir = join(testDir, ".claude", "hooks");
		await Bun.write(join(ckHooksDir, ".keep"), "");
		const path = join(testDir, "merge-drop-group.json");
		const staleHook = join(ckHooksDir, "stale-only.cjs");
		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					Stop: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: staleHook }],
						},
					],
				},
			}),
		);

		const newHooks = {
			SessionStart: [{ hooks: [{ type: "command", command: "echo ok" }] }],
		};
		await mergeHooksIntoSettings(path, newHooks);

		const content = JSON.parse(await Bun.file(path).text());
		// Stop event entirely removed (group had only stale hook)
		expect(content.hooks.Stop).toBeUndefined();
		// New event registered
		expect(content.hooks.SessionStart).toHaveLength(1);
	});

	it("preserves user-owned absolute-path hooks outside CK install locations", async () => {
		// User's own absolute-path hook — not under ~/.claude/, ~/.codex/, ~/.gemini/.
		// Even if the file is missing (e.g. network mount unavailable), it must survive.
		const path = join(testDir, "merge-user-owned.json");
		const userHook = join(testDir, "custom", "user-script.sh");
		const ckStaleHook = join(testDir, ".codex", "hooks", "stale.cjs");

		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: "*",
							hooks: [
								{ type: "command", command: userHook }, // user-owned, missing → keep
								{ type: "command", command: ckStaleHook }, // ck-owned, missing → prune
							],
						},
					],
				},
			}),
		);

		await mergeHooksIntoSettings(path, {
			SessionStart: [{ hooks: [{ type: "command", command: "echo ok" }] }],
		});

		const content = JSON.parse(await Bun.file(path).text());
		const commands = content.hooks.PreToolUse[0].hooks.map((h: { command: string }) => h.command);
		expect(commands).toContain(userHook); // user-owned preserved
		expect(commands).not.toContain(ckStaleHook); // ck-owned pruned
	});

	it('prunes Codex-format commands — node "/ck-path/hook.cjs" shape (#739 regression)', async () => {
		// Codex rewrites CK hook registrations as `node "/path"`. The first
		// whitespace-split token is "node", not an absolute path — so the
		// earlier extractor silently skipped every Codex entry. Regression
		// scenario caught live on 2026-04-24 during E2E validation.
		const ckHooksDir = join(testDir, ".codex", "hooks");
		await Bun.write(join(ckHooksDir, ".keep"), "");
		const path = join(testDir, "merge-codex-format.json");
		const liveHook = join(ckHooksDir, "codex-live.cjs");
		const staleHook = join(ckHooksDir, "codex-stale.cjs");
		writeFileSync(liveHook, "// live");

		const liveCommand = `node "${liveHook}"`;
		const staleCommand = `node "${staleHook}"`;

		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					SessionStart: [
						{
							matcher: "startup",
							hooks: [
								{ type: "command", command: staleCommand }, // stale — prune
								{ type: "command", command: liveCommand }, // live — keep
							],
						},
					],
				},
			}),
		);

		await mergeHooksIntoSettings(path, {});

		const content = JSON.parse(await Bun.file(path).text());
		const commands = content.hooks.SessionStart[0].hooks.map((h: { command: string }) => h.command);
		expect(commands).not.toContain(staleCommand);
		expect(commands).toContain(liveCommand);
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
		expect(result.status).toBe("no-installed-files");
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
	});

	it("returns early when source has no settings.json", async () => {
		// Use a temp dir with no settings.json to verify early return
		const tempBase = mkdtempSync(join(tmpdir(), "hooks-migrate-test-"));
		const originalCwd = process.cwd();
		try {
			// Change cwd to temp dir that has no .claude/settings.json
			process.chdir(tempBase);
			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "droid",
				installedHookFiles: ["session-init.cjs"],
				global: false,
			});
			expect(result.status).toBe("source-settings-missing");
			expect(result.success).toBe(true);
			expect(result.hooksRegistered).toBe(0);
		} finally {
			process.chdir(originalCwd);
			rmSync(tempBase, { recursive: true, force: true });
		}
	});

	it("handles self-migration (source === target provider)", async () => {
		const tempBase = mkdtempSync(join(tmpdir(), "hooks-self-migrate-"));
		const originalCwd = process.cwd();
		try {
			process.chdir(tempBase);
			mkdirSync(join(tempBase, ".claude"), { recursive: true });
			writeFileSync(
				join(tempBase, ".claude", "settings.json"),
				JSON.stringify({
					hooks: {
						SessionStart: [
							{
								matcher: "*",
								hooks: [{ type: "command", command: 'node ".claude/hooks/hook.cjs"' }],
							},
						],
					},
				}),
			);

			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "claude-code",
				installedHookFiles: ["hook.cjs"],
				global: false,
			});
			expect(result.status).toBe("registered");
			expect(result.success).toBe(true);
			expect(result.hooksRegistered).toBe(1);
		} finally {
			process.chdir(originalCwd);
			rmSync(tempBase, { recursive: true, force: true });
		}
	});

	it("returns early for provider without hooks configuration", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "cursor" as "claude-code",
			targetProvider: "claude-code",
			installedHookFiles: ["hook.cjs"],
			global: true,
		});
		expect(result.status).toBe("unsupported-source");
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
		expect(result.message).toContain("not supported");
	});

	it("fails when source settings.json is malformed", async () => {
		const tempBase = mkdtempSync(join(tmpdir(), "hooks-migrate-invalid-"));
		const originalCwd = process.cwd();
		try {
			process.chdir(tempBase);
			mkdirSync(join(tempBase, ".claude"), { recursive: true });
			writeFileSync(join(tempBase, ".claude", "settings.json"), "{ not valid json");

			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "codex",
				installedHookFiles: ["session-init.cjs"],
				global: false,
			});

			expect(result.status).toBe("source-settings-invalid");
			expect(result.success).toBe(false);
			expect(result.hooksRegistered).toBe(0);
			expect(normalizePathForAssert(result.error)).toContain(".claude/settings.json");
			expect(normalizePathForAssert(result.targetSettingsPath)).toContain(".codex/hooks.json");
		} finally {
			process.chdir(originalCwd);
			rmSync(tempBase, { recursive: true, force: true });
		}
	});

	it("returns a warning outcome when installed hooks do not match source registrations", async () => {
		const tempBase = mkdtempSync(join(tmpdir(), "hooks-migrate-no-match-"));
		const originalCwd = process.cwd();
		try {
			process.chdir(tempBase);
			mkdirSync(join(tempBase, ".claude"), { recursive: true });
			writeFileSync(
				join(tempBase, ".claude", "settings.json"),
				JSON.stringify({
					hooks: {
						SessionStart: [
							{
								matcher: "*",
								hooks: [{ type: "command", command: 'node ".claude/hooks/other-hook.cjs"' }],
							},
						],
					},
				}),
			);

			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "codex",
				installedHookFiles: ["session-init.cjs"],
				global: false,
			});

			expect(result.status).toBe("no-matching-hooks");
			expect(result.success).toBe(true);
			expect(result.hooksRegistered).toBe(0);
			expect(normalizePathForAssert(result.message)).toContain(".codex/hooks.json");
		} finally {
			process.chdir(originalCwd);
			rmSync(tempBase, { recursive: true, force: true });
		}
	});

	it("full pipeline: claude-code → gemini-cli with event and matcher mapping", async () => {
		const tempBase = mkdtempSync(join(tmpdir(), "hooks-migrate-gemini-"));
		const originalCwd = process.cwd();
		try {
			process.chdir(tempBase);

			// Set up Claude Code source with hooks
			mkdirSync(join(tempBase, ".claude", "hooks"), { recursive: true });
			writeFileSync(join(tempBase, ".claude", "hooks", "block-secrets.cjs"), "// hook");
			writeFileSync(
				join(tempBase, ".claude", "settings.json"),
				JSON.stringify({
					hooks: {
						PreToolUse: [
							{
								matcher: "Edit|Write",
								hooks: [
									{
										type: "command",
										command: 'node ".claude/hooks/block-secrets.cjs"',
										timeout: 5000,
									},
								],
							},
						],
						Stop: [
							{
								hooks: [{ type: "command", command: 'node ".claude/hooks/block-secrets.cjs"' }],
							},
						],
					},
				}),
			);

			// Set up Gemini CLI target directory
			mkdirSync(join(tempBase, ".gemini", "hooks"), { recursive: true });
			writeFileSync(join(tempBase, ".gemini", "hooks", "block-secrets.cjs"), "// hook");

			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "gemini-cli",
				installedHookFiles: ["block-secrets.cjs"],
				global: false,
			});

			expect(result.status).toBe("registered");
			expect(result.success).toBe(true);
			expect(result.hooksRegistered).toBeGreaterThan(0);

			// Verify the target settings.json was created with mapped events
			const targetPath = join(tempBase, ".gemini", "settings.json");
			expect(existsSync(targetPath)).toBe(true);
			const settings = JSON.parse(
				await import("node:fs").then((fs) => fs.readFileSync(targetPath, "utf8")),
			);

			// Events should be mapped: PreToolUse → BeforeTool, Stop → SessionEnd
			expect(settings.hooks.BeforeTool).toBeDefined();
			expect(settings.hooks.SessionEnd).toBeDefined();
			expect(settings.hooks.PreToolUse).toBeUndefined();
			expect(settings.hooks.Stop).toBeUndefined();

			// Matchers should be mapped: Edit|Write → replace|write_file
			expect(settings.hooks.BeforeTool[0].matcher).toBe("replace|write_file");

			// Paths should be rewritten to .gemini/hooks/
			expect(settings.hooks.BeforeTool[0].hooks[0].command).toContain(".gemini/hooks/");
		} finally {
			process.chdir(originalCwd);
			rmSync(tempBase, { recursive: true, force: true });
		}
	});
});

describe("Codex hooks migration", () => {
	it("rewrites paths from claude-code to codex hooks dir", () => {
		const sourceHooks = {
			SessionStart: [
				{
					matcher: "startup",
					hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }],
				},
			],
			PreToolUse: [
				{
					matcher: ".*",
					hooks: [{ type: "command", command: "node .claude/hooks/validate-tool.cjs" }],
				},
			],
		};
		const result = rewriteHookPaths(sourceHooks, ".claude/hooks", ".codex/hooks");
		expect(result.SessionStart[0].hooks[0].command).toBe(
			'node "$HOME/.codex/hooks/session-init.cjs"',
		);
		expect(result.PreToolUse[0].hooks[0].command).toBe("node .codex/hooks/validate-tool.cjs");
	});

	it("rewrites paths from codex to claude-code hooks dir", () => {
		const codexHooks = {
			PostToolUse: [
				{
					matcher: ".*",
					hooks: [{ type: "command", command: 'node "$HOME/.codex/hooks/log-result.cjs"' }],
				},
			],
		};
		const result = rewriteHookPaths(codexHooks, ".codex/hooks", ".claude/hooks");
		expect(result.PostToolUse[0].hooks[0].command).toBe(
			'node "$HOME/.claude/hooks/log-result.cjs"',
		);
	});

	it("reads hooks from standalone hooks.json (Codex format)", async () => {
		const path = join(testDir, "codex-hooks.json");
		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					SessionStart: [
						{
							matcher: "startup",
							hooks: [{ type: "command", command: "node /opt/hooks/init.cjs", timeout: 10 }],
						},
					],
					PreToolUse: [
						{
							matcher: ".*",
							hooks: [{ type: "command", command: "node /opt/hooks/validate.cjs", timeout: 2 }],
						},
					],
					PostToolUse: [
						{
							matcher: ".*",
							hooks: [{ type: "command", command: "node /opt/hooks/log.cjs" }],
						},
					],
					UserPromptSubmit: [
						{ hooks: [{ type: "command", command: "node /opt/hooks/prompt-check.cjs" }] },
					],
					Stop: [{ hooks: [{ type: "command", command: "node /opt/hooks/cleanup.cjs" }] }],
				},
			}),
		);
		const result = await readHooksFromSettings(path);
		expect(result).not.toBeNull();
		// All 5 Codex events present
		const hooks = result as Record<string, unknown[]>;
		expect(Object.keys(hooks)).toHaveLength(5);
		expect(hooks.SessionStart).toHaveLength(1);
		expect(hooks.PreToolUse).toHaveLength(1);
		expect(hooks.PostToolUse).toHaveLength(1);
		expect(hooks.UserPromptSubmit).toHaveLength(1);
		expect(hooks.Stop).toHaveLength(1);
	});

	it("merges hooks into standalone hooks.json (creates file)", async () => {
		const path = join(testDir, "codex-merge-new", "hooks.json");
		const newHooks = {
			SessionStart: [
				{
					matcher: "startup",
					hooks: [{ type: "command", command: 'node "$HOME/.codex/hooks/init.cjs"' }],
				},
			],
		};
		const result = await mergeHooksIntoSettings(path, newHooks);
		expect(result.backupPath).toBeNull(); // No backup for new file
		expect(existsSync(path)).toBe(true);

		const content = JSON.parse(await Bun.file(path).text());
		// Standalone hooks.json only contains the hooks key
		expect(content.hooks.SessionStart).toHaveLength(1);
		expect(content.hooks.SessionStart[0].matcher).toBe("startup");
	});

	it("merges hooks into existing standalone hooks.json with dedup", async () => {
		const path = join(testDir, "codex-merge-existing.json");
		writeFileSync(
			path,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: ".*",
							hooks: [{ type: "command", command: 'node "$HOME/.codex/hooks/existing.cjs"' }],
						},
					],
				},
			}),
		);

		const newHooks = {
			PreToolUse: [
				{
					matcher: ".*",
					hooks: [
						{ type: "command", command: 'node "$HOME/.codex/hooks/existing.cjs"' }, // dup
						{ type: "command", command: 'node "$HOME/.codex/hooks/new-hook.cjs"' }, // new
					],
				},
			],
			SessionStart: [
				{
					matcher: "startup",
					hooks: [{ type: "command", command: 'node "$HOME/.codex/hooks/init.cjs"' }],
				},
			],
		};

		await mergeHooksIntoSettings(path, newHooks);
		const content = JSON.parse(await Bun.file(path).text());
		// PreToolUse: 1 existing + 1 new (dup skipped)
		expect(content.hooks.PreToolUse[0].hooks).toHaveLength(2);
		// SessionStart: new event added
		expect(content.hooks.SessionStart).toHaveLength(1);
	});

	it("handles malformed hooks.json gracefully (Codex format)", async () => {
		const path = join(testDir, "codex-malformed.json");
		writeFileSync(path, "{ not valid json at all");
		const result = await readHooksFromSettings(path);
		expect(result).toBeNull();
	});

	it("handles hooks.json with missing hooks key (Codex format)", async () => {
		const path = join(testDir, "codex-no-hooks-key.json");
		writeFileSync(path, JSON.stringify({ version: "1.0", metadata: {} }));
		const result = await readHooksFromSettings(path);
		expect(result).toBeNull();
	});

	it("allows Codex as source provider via dynamic settingsJsonPath check", async () => {
		// Codex has settingsJsonPath, so the merger should NOT return early with "not supported"
		const result = await migrateHooksSettings({
			sourceProvider: "codex",
			targetProvider: "claude-code",
			installedHookFiles: ["session-init.cjs"],
			global: false,
		});
		// Source hooks.json won't exist at .codex/hooks.json in test cwd, so 0 hooks registered
		// but critically: no "not supported" message — the guard passed
		expect(result.status).toBe("source-settings-missing");
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
		expect(normalizePathForAssert(result.message)).toContain(".codex/hooks.json");
	});

	it("blocks provider without settingsJsonPath as source", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "cursor" as ProviderType,
			targetProvider: "codex",
			installedHookFiles: ["hook.cjs"],
			global: false,
		});
		expect(result.status).toBe("unsupported-source");
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
		expect(result.message).toContain("not supported");
	});
});

describe("mapHookEventsForProvider (Gemini CLI)", () => {
	it("maps Claude Code event names to Gemini CLI equivalents", () => {
		const hooks = {
			PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "echo hi" }] }],
			PostToolUse: [{ hooks: [{ type: "command", command: "echo done" }] }],
		};
		const result = mapHookEventsForProvider(hooks, "gemini-cli");
		expect(result.BeforeTool).toBeDefined();
		expect(result.AfterTool).toBeDefined();
		expect(result.PreToolUse).toBeUndefined();
		expect(result.PostToolUse).toBeUndefined();
	});

	it("rewrites tool names in matchers", () => {
		const hooks = {
			PreToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "echo check" }] }],
		};
		const result = mapHookEventsForProvider(hooks, "gemini-cli");
		expect(result.BeforeTool?.[0].matcher).toBe("replace|write_file");
	});

	it("deduplicates matcher tool names", () => {
		const hooks = {
			PreToolUse: [
				{
					matcher: "Edit|MultiEdit",
					hooks: [{ type: "command", command: "echo check" }],
				},
			],
		};
		const result = mapHookEventsForProvider(hooks, "gemini-cli");
		// Both Edit and MultiEdit map to "replace" — should deduplicate
		expect(result.BeforeTool?.[0].matcher).toBe("replace");
	});

	it("is a no-op for non-Gemini providers", () => {
		const hooks = {
			PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "echo hi" }] }],
		};
		const result = mapHookEventsForProvider(hooks, "codex");
		expect(result.PreToolUse).toBeDefined();
		expect(result.BeforeTool).toBeUndefined();
	});

	it("merges groups when multiple source events map to same target", () => {
		// Both SubagentStart maps to BeforeAgent; test two separate events don't collide
		const hooks = {
			SubagentStart: [{ hooks: [{ type: "command", command: "echo agent-start" }] }],
			Stop: [{ hooks: [{ type: "command", command: "echo session-end" }] }],
		};
		const result = mapHookEventsForProvider(hooks, "gemini-cli");
		expect(result.BeforeAgent).toHaveLength(1);
		expect(result.SessionEnd).toHaveLength(1);
	});

	it("maps PreCompact to PreCompress", () => {
		const hooks = {
			PreCompact: [{ hooks: [{ type: "command", command: "echo compact" }] }],
		};
		const result = mapHookEventsForProvider(hooks, "gemini-cli");
		expect(result.PreCompress).toBeDefined();
		expect(result.PreCompact).toBeUndefined();
	});

	it("preserves hook entries unchanged (only event+matcher are mapped)", () => {
		const hooks = {
			PreToolUse: [
				{
					matcher: "Bash",
					hooks: [{ type: "command", command: 'node ".gemini/hooks/block.cjs"', timeout: 5000 }],
				},
			],
		};
		const result = mapHookEventsForProvider(hooks, "gemini-cli");
		const entry = result.BeforeTool?.[0].hooks[0];
		expect(entry?.command).toBe('node ".gemini/hooks/block.cjs"');
		expect(entry?.timeout).toBe(5000);
	});
});
