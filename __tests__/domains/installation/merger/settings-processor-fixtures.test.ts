/**
 * Fixture-based integration tests for SettingsProcessor.
 * Covers known failure modes from issues #435, #430, #465, #520, #548-549, #594.
 *
 * Issues covered:
 * - #603: settings-merge fixture suite
 * - #604: Windows path matrix
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsProcessor } from "@/domains/installation/merger/settings-processor.js";

// Stub detectClaudeCodeVersion to prevent non-determinism from running `claude --version`.
// Without this, machines with Claude Code installed inject extra team hooks non-deterministically.
spyOn(
	SettingsProcessor.prototype as unknown as Record<string, () => null>,
	"detectClaudeCodeVersion",
).mockReturnValue(null);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function writeJson(filePath: string, data: unknown): Promise<void> {
	await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(filePath, "utf-8")) as Record<string, unknown>;
}

/** Collect all hook commands from a parsed settings result */
function collectHookCommands(result: Record<string, unknown>): string[] {
	const hooks = result.hooks as Record<string, unknown[]> | undefined;
	if (!hooks) return [];
	const commands: string[] = [];
	for (const entries of Object.values(hooks)) {
		for (const entry of entries) {
			const e = entry as Record<string, unknown>;
			if (typeof e.command === "string") commands.push(e.command);
			if (Array.isArray(e.hooks)) {
				for (const h of e.hooks as Record<string, unknown>[]) {
					if (typeof h.command === "string") commands.push(h.command);
				}
			}
		}
	}
	return commands;
}

// ──────────────────────────────────────────────────────────────────────────────
// Test setup
// ──────────────────────────────────────────────────────────────────────────────

let testDir: string;
let sourceDir: string;
let destDir: string;

beforeEach(async () => {
	testDir = join(tmpdir(), `sp-fixtures-${Date.now()}`);
	sourceDir = join(testDir, "source");
	destDir = join(testDir, "dest");
	await mkdir(sourceDir, { recursive: true });
	await mkdir(destDir, { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 1: Clean install — no existing settings.json
// ──────────────────────────────────────────────────────────────────────────────

describe("Fixture: clean install (no existing settings.json)", () => {
	it("writes kit defaults when dest does not exist (global)", async () => {
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
			},
			mcp: {
				servers: {
					"ck-server": { command: "node", args: [".claude/mcp/ck.js"] },
				},
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;

		// Hook should exist and use $HOME (bare relative .claude/ is expanded)
		expect(hooks.SessionStart).toBeDefined();
		const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
		expect(cmd).toContain("$HOME");
		// Must be in canonical quoted form: "$HOME/.claude/..."
		expect(cmd).toMatch(/"\$HOME\/.claude\//);
		// Must NOT be bare relative (no leading "node .claude/" without a path var)
		expect(cmd).not.toMatch(/node\s+\.claude\//);
		expect(cmd).not.toMatch(/node\s+\.\//);

		// MCP server should be preserved
		const mcp = result.mcp as Record<string, unknown>;
		const servers = mcp.servers as Record<string, unknown>;
		expect(servers["ck-server"]).toBeDefined();
	});

	it("writes kit defaults when dest does not exist (local)", async () => {
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(false);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;

		// Hook should use $CLAUDE_PROJECT_DIR for local installs
		expect(hooks.SessionStart).toBeDefined();
		const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
		expect(cmd).toContain("$CLAUDE_PROJECT_DIR");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 2: Legacy hooks — deprecated matcher migration (#430)
// ──────────────────────────────────────────────────────────────────────────────

describe("Fixture: legacy deprecated matchers (#430)", () => {
	it("migrates wildcard '*' matcher to narrowed matcher from source", async () => {
		const source = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash|Edit|Write",
						hooks: [
							{
								type: "command",
								command: 'node "$HOME/.claude/hooks/usage-context.cjs"',
								timeout: 15,
							},
						],
					},
				],
			},
		};
		const dest = {
			hooks: {
				PostToolUse: [
					{
						matcher: "*",
						hooks: [
							{
								type: "command",
								command: 'node "$HOME/.claude/hooks/usage-context.cjs"',
							},
						],
					},
				],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const entries = (result.hooks as Record<string, unknown[]>).PostToolUse;

		// Should have exactly 1 entry with the new narrowed matcher
		expect(entries).toHaveLength(1);
		const entry = entries[0] as Record<string, unknown>;
		expect(entry.matcher).toBe("Bash|Edit|Write");
		// Timeout should be synced from source
		const hookEntry = (entry.hooks as Record<string, unknown>[])[0];
		expect(hookEntry.timeout).toBe(15);
	});

	it("preserves '*' matcher when commands don't match source (user-owned hook)", async () => {
		const source = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash|Edit",
						hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/ck-hook.cjs"' }],
					},
				],
			},
		};
		const dest = {
			hooks: {
				PostToolUse: [
					{
						matcher: "*",
						hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/user-hook.cjs"' }],
					},
				],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const entries = (result.hooks as Record<string, unknown[]>).PostToolUse as Record<
			string,
			unknown
		>[];

		// User hook with "*" matcher must be preserved unchanged
		const userEntry = entries.find((e) => e.matcher === "*");
		expect(userEntry).toBeDefined();
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 3: Paths with spaces (#435, #594)
// ──────────────────────────────────────────────────────────────────────────────

describe("Fixture: paths with spaces (#435, #594)", () => {
	it("preserves hook commands with spaces in path (global $HOME)", async () => {
		// Simulate source with a bare .claude/ that will be transformed to $HOME path
		// The $HOME itself may contain spaces — verify the command is still valid JSON
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;
		expect(hooks.SessionStart).toHaveLength(1);
		const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
		// Command must be properly quoted so space-containing $HOME expands safely
		// Canonical global form: node "$HOME/.claude/hooks/session-start.cjs"
		expect(cmd).toMatch(/"\$HOME\/.claude\/hooks\/session-start\.cjs"/);
	});

	it("handles existing hook with spaces in path during merge (no double-quote)", async () => {
		// Pre-existing settings.json that already has properly quoted paths
		const spaceHookCommand = 'node "$HOME/.claude/hooks/my hook.cjs"';
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
			},
		};
		const dest = {
			hooks: {
				SessionStart: [{ type: "command", command: spaceHookCommand }],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const commands = collectHookCommands(result);

		// User hook with space should be preserved
		expect(commands).toContain(spaceHookCommand);
	});

	it("fixHookCommandPaths: fixes tilde path (no path-with-space regression)", async () => {
		// Tilde path: node ~/.claude/hooks/init.cjs — should become node "$HOME/.claude/hooks/init.cjs"
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node ~/.claude/hooks/init.cjs" }],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;
		const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
		// Tilde must be expanded to $HOME and properly quoted
		expect(cmd).not.toContain("~");
		expect(cmd).toContain("$HOME");
		// Must be quoted for space safety
		expect(cmd).toMatch(/"\$HOME\/.+"/);
	});

	it("fixHookCommandPaths: fixes unquoted $HOME path", async () => {
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node $HOME/.claude/hooks/init.cjs" }],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;
		const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
		// Must be quoted to support spaces in $HOME
		expect(cmd).toMatch(/"\$HOME\/.+"/);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 4: Multi-provider merge — no false conflicts (#520)
// ──────────────────────────────────────────────────────────────────────────────

describe("Fixture: multi-provider merge, no false conflicts (#520)", () => {
	it("preserves all provider hooks from dest during CK merge", async () => {
		// dest has hooks from multiple providers; source adds only CK hooks
		const source = {
			hooks: {
				SessionStart: [{ type: "command", command: "node .claude/hooks/ck-session-start.cjs" }],
			},
		};
		const dest = {
			hooks: {
				SessionStart: [
					// Pre-existing Windsurf hook
					{ type: "command", command: 'node "$HOME/.windsurf/hooks/session-start.cjs"' },
					// Pre-existing Copilot hook
					{ type: "command", command: 'node "$HOME/.copilot/hooks/session-start.cjs"' },
				],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;

		// All three hooks should be present after merge
		expect(hooks.SessionStart).toHaveLength(3);

		const commands = collectHookCommands(result);
		expect(commands.some((c) => c.includes("windsurf"))).toBe(true);
		expect(commands.some((c) => c.includes("copilot"))).toBe(true);
		expect(commands.some((c) => c.includes("ck-session-start"))).toBe(true);
	});

	it("deduplicates CK hooks across providers but does not remove user hooks", async () => {
		// Source has a CK hook that's also already in dest — should not duplicate
		const ckHookCommand = 'node "$HOME/.claude/hooks/usage-context.cjs"';
		const source = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash|Edit",
						hooks: [{ type: "command", command: "node .claude/hooks/usage-context.cjs" }],
					},
				],
			},
		};
		const dest = {
			hooks: {
				PostToolUse: [
					// CK hook already present (canonical global form)
					{
						matcher: "Bash|Edit",
						hooks: [{ type: "command", command: ckHookCommand }],
					},
					// User hook from another provider — must survive
					{ type: "command", command: 'node "$HOME/.other-provider/hooks/lint.cjs"' },
				],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const commands = collectHookCommands(result);

		// Other provider hook preserved
		expect(commands.some((c) => c.includes("other-provider"))).toBe(true);

		// CK hook not duplicated — at most one occurrence
		const ckCount = commands.filter((c) => c.includes("usage-context")).length;
		expect(ckCount).toBe(1);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 5: Stale hook pruning (#465)
// ──────────────────────────────────────────────────────────────────────────────

describe("Fixture: stale hook pruning — metadata.json deletions (#465)", () => {
	it("removes hooks for deleted files, keeps surviving hooks", async () => {
		const source = {
			hooks: {
				SessionStart: [
					{ hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }] },
				],
			},
		};
		const dest = {
			hooks: {
				SessionStart: [
					{ hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }] },
				],
				// Stale — will be in deletions
				SessionEnd: [
					{
						hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/old-session-end.cjs"' }],
					},
				],
				// Also stale
				PreCompact: [
					{
						hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/compact-marker.cjs"' }],
					},
				],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		processor.setDeletions([
			"hooks/old-session-end.cjs",
			"hooks/compact-marker.cjs",
			// Non-hook deletion should be silently ignored
			"commands/archived-command.md",
		]);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const hooks = result.hooks as Record<string, unknown[]>;

		// SessionStart survives
		expect(hooks.SessionStart).toBeDefined();
		// Pruned events are gone
		expect(hooks.SessionEnd).toBeUndefined();
		expect(hooks.PreCompact).toBeUndefined();
	});

	it("prunes only the stale individual hook within a HookConfig, keeps others", async () => {
		const source = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash|Edit",
						hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/surviving-hook.cjs"' }],
					},
				],
			},
		};
		const dest = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash|Edit",
						hooks: [
							{ type: "command", command: 'node "$HOME/.claude/hooks/surviving-hook.cjs"' },
							// This one is stale
							{ type: "command", command: 'node "$HOME/.claude/hooks/stale-hook.cjs"' },
						],
					},
				],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, source);
		await writeJson(destFile, dest);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		processor.setDeletions(["hooks/stale-hook.cjs"]);
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		const entries = (result.hooks as Record<string, unknown[]>).PostToolUse as Record<
			string,
			unknown
		>[];

		// HookConfig entry is kept (still has 1 surviving hook)
		expect(entries).toHaveLength(1);
		const remainingHooks = entries[0].hooks as Record<string, string>[];
		expect(remainingHooks).toHaveLength(1);
		expect(remainingHooks[0].command).toContain("surviving-hook.cjs");
	});

	it("does not prune when setDeletions is never called", async () => {
		const hookCommand = 'node "$HOME/.claude/hooks/session-end.cjs"';
		const settings = {
			hooks: {
				SessionEnd: [{ hooks: [{ type: "command", command: hookCommand }] }],
			},
		};
		const sourceFile = join(sourceDir, "settings.json");
		const destFile = join(destDir, "settings.json");
		await writeJson(sourceFile, settings);
		await writeJson(destFile, settings);

		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(destDir);
		// Intentionally NO setDeletions()
		await processor.processSettingsJson(sourceFile, destFile);

		const result = await readJson(destFile);
		expect((result.hooks as Record<string, unknown>).SessionEnd).toBeDefined();
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Windows path matrix tests (#604)
// ──────────────────────────────────────────────────────────────────────────────

describe("Windows path edge cases (#604)", () => {
	describe("fixHookCommandPaths — Windows backslash separators", () => {
		it("normalizes Windows backslash path in merge output (global %USERPROFILE%)", async () => {
			// Simulate existing settings.json written by a Windows install
			const windowsCommand = 'node "%USERPROFILE%\\.claude\\hooks\\session-start.cjs"';
			const source = {
				hooks: {
					SessionStart: [{ type: "command", command: "node .claude/hooks/session-start.cjs" }],
				},
			};
			const dest = {
				hooks: {
					SessionStart: [{ type: "command", command: windowsCommand }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);
			await writeJson(destFile, dest);

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			// %USERPROFILE% must be canonicalized to $HOME; backslashes must become forward slashes
			const commands = collectHookCommands(result);
			for (const cmd of commands) {
				if (cmd.includes(".claude")) {
					expect(cmd).not.toContain("%USERPROFILE%");
					expect(cmd).not.toContain("\\");
					expect(cmd).toContain("$HOME");
				}
			}
		});

		it("pruneDeletedHooks matches Windows backslash hook commands", async () => {
			const windowsCommand = 'node "%USERPROFILE%\\.claude\\hooks\\stale.cjs"';
			const source = {
				hooks: {
					SessionStart: [
						{
							hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }],
						},
					],
				},
			};
			const dest = {
				hooks: {
					SessionStart: [
						{
							hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }],
						},
					],
					SessionEnd: [{ hooks: [{ type: "command", command: windowsCommand }] }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);
			await writeJson(destFile, dest);

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			processor.setDeletions(["hooks/stale.cjs"]);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			// Stale hook with Windows path should be pruned
			expect((result.hooks as Record<string, unknown>).SessionEnd).toBeUndefined();
		});
	});

	describe("fixHookCommandPaths — paths with spaces (Windows and Unix)", () => {
		it("normalizes Windows path with spaces: variable-only quoting → full-path quoting", async () => {
			// e.g. node "%USERPROFILE%"/.claude/hooks/init.cjs  (broken format from old installer)
			// expected canonical: node "$HOME/.claude/hooks/init.cjs"
			const brokenCommand = 'node "%USERPROFILE%"/.claude/hooks/init.cjs';
			const source = {
				hooks: {
					SessionStart: [{ type: "command", command: brokenCommand }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			const hooks = result.hooks as Record<string, unknown[]>;
			const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
			// Should be canonical: node "$HOME/.claude/hooks/init.cjs"
			expect(cmd).toBe('node "$HOME/.claude/hooks/init.cjs"');
		});

		it("normalizes local Windows path with spaces: embedded quoting → correct local format", async () => {
			// Broken: node "$CLAUDE_PROJECT_DIR/.claude/hooks/init.cjs" (Windows expansion bug #594)
			// Expected: node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.cjs
			const brokenCommand = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/init.cjs"';
			const source = {
				hooks: {
					SessionStart: [{ type: "command", command: brokenCommand }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(false); // local install
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			const hooks = result.hooks as Record<string, unknown[]>;
			const cmd = (hooks.SessionStart[0] as Record<string, string>).command;
			// Local canonical: node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.cjs
			expect(cmd).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/init.cjs');
		});
	});

	describe("fixHookCommandPaths — mixed separators", () => {
		it("normalizes C:\\.../.claude/ mixed separator path in merge output", async () => {
			// A hook command that somehow ended up with mixed separators
			const mixedCommand = 'node "$HOME/.claude\\hooks/init.cjs"';
			const source = {
				hooks: {
					SessionStart: [{ type: "command", command: mixedCommand }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			const commands = collectHookCommands(result);
			// All .claude/ paths must use forward slashes
			for (const cmd of commands) {
				if (cmd.includes(".claude")) {
					expect(cmd).not.toContain("\\");
				}
			}
		});
	});

	describe("extractHookRelativePath — Windows path extraction", () => {
		it("pruneDeletedHooks extracts relative path from Windows backslash command", async () => {
			// %USERPROFILE% with backslash path — extractHookRelativePath must still match
			const windowsBackslashCmd = 'node "%USERPROFILE%\\.claude\\hooks\\obsolete.cjs"';
			const source = {
				hooks: {
					SessionStart: [
						{
							hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }],
						},
					],
				},
			};
			const dest = {
				hooks: {
					SessionStart: [
						{
							hooks: [{ type: "command", command: 'node "$HOME/.claude/hooks/session-init.cjs"' }],
						},
					],
					SessionEnd: [
						{
							hooks: [{ type: "command", command: windowsBackslashCmd }],
						},
					],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);
			await writeJson(destFile, dest);

			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			processor.setDeletions(["hooks/obsolete.cjs"]);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			// The backslash Windows hook should be pruned
			expect((result.hooks as Record<string, unknown>).SessionEnd).toBeUndefined();
			// SessionStart still intact
			expect((result.hooks as Record<string, unknown>).SessionStart).toBeDefined();
		});
	});

	describe("long paths (>260 chars, Windows MAX_PATH boundary)", () => {
		it("handles hook command with path exceeding Windows MAX_PATH (260 chars)", async () => {
			// Generate a long directory segment (simulate deeply nested Windows project path)
			// node "$HOME/.claude/hooks/" prefix = 27 chars + ".cjs" suffix + 1 quote = 32 chars
			// So segment needs to be > 260 - 32 = 228 chars
			const deepSegment = "a".repeat(240);
			const longCommand = `node "$HOME/.claude/hooks/${deepSegment}/session-start.cjs"`;
			expect(longCommand.length).toBeGreaterThan(260);

			const source = {
				hooks: {
					SessionStart: [{ type: "command", command: longCommand }],
				},
			};
			const dest = {
				hooks: {
					SessionStart: [{ type: "command", command: longCommand }],
				},
			};
			const sourceFile = join(sourceDir, "settings.json");
			const destFile = join(destDir, "settings.json");
			await writeJson(sourceFile, source);
			await writeJson(destFile, dest);

			// Should not throw; should write a valid JSON result
			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			await processor.processSettingsJson(sourceFile, destFile);

			const result = await readJson(destFile);
			// Hook should survive merge without corruption
			const hooks = result.hooks as Record<string, unknown[]>;
			expect(hooks.SessionStart).toBeDefined();
			// Whether it's in nested hooks or flat entry, command must contain the long segment
			const commands = collectHookCommands(result);
			expect(commands.some((c) => c.includes(deepSegment))).toBe(true);
		});
	});
});
