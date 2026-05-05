/**
 * hook-health-checker-corpus.test.ts
 *
 * Exhaustive corpus tests proving every known stale hook command path shape
 * converges in a single `ck doctor --fix` pass (issue #776).
 *
 * Each test row: input command → repairClaudeNodeCommandPath → assert:
 *   - no FixerDidNotConvergeError
 *   - post-fix re-detection finds 0 stale entries
 *   - canonical form matches expected pattern
 *
 * Covers both $HOME (global) and $CLAUDE_PROJECT_DIR (project) roots,
 * simple and nested path forms, flat and matcher-based hook entries,
 * and the Windows env-var variants.
 *
 * @see src/shared/command-normalizer.ts
 * @see src/domains/health-checks/checkers/hook-health-checker.ts
 * @see docs/code-standards.md — "Checker/Fixer Parity for autoFixable health checks"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectFixerConvergence } from "@/__tests__/helpers/checker-fixer-parity.js";
import {
	type ClaudeSettingsFile,
	checkHookCommandPaths,
	findStaleHookCommandsInFile,
} from "@/domains/health-checks/checkers/hook-health-checker.js";
import { repairClaudeNodeCommandPath } from "@/shared/command-normalizer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestContext {
	tempDir: string;
	projectDir: string;
	originalCkTestHome: string | undefined;
}

async function setupCtx(): Promise<TestContext> {
	const tempDir = join(tmpdir(), `ck-corpus-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	const projectDir = join(tempDir, "project");
	await mkdir(projectDir, { recursive: true });
	const originalCkTestHome = process.env.CK_TEST_HOME;
	process.env.CK_TEST_HOME = tempDir;
	return { tempDir, projectDir, originalCkTestHome };
}

async function teardownCtx(ctx: TestContext): Promise<void> {
	await rm(ctx.tempDir, { recursive: true, force: true });
	if (ctx.originalCkTestHome === undefined) {
		// biome-ignore lint/performance/noDelete: process.env semantics require delete to truly unset
		delete process.env.CK_TEST_HOME;
	} else {
		process.env.CK_TEST_HOME = ctx.originalCkTestHome;
	}
}

/**
 * Write a settings.local.json fixture to a PROJECT settings path and run the
 * full detect→fix→detect convergence cycle via `checkHookCommandPaths`.
 *
 * The project settings file always gets root "$CLAUDE_PROJECT_DIR" from
 * `getClaudeSettingsFiles` — tests must align with this reality.
 */
async function assertProjectCommandConverges(
	ctx: TestContext,
	command: string,
	expectedPattern: RegExp,
): Promise<void> {
	const settingsDir = join(ctx.projectDir, ".claude");
	const settingsPath = join(settingsDir, "settings.local.json");
	await mkdir(settingsDir, { recursive: true });

	const fixture = {
		hooks: {
			PreToolUse: [{ type: "command", command }],
		},
	};
	await writeFile(settingsPath, JSON.stringify(fixture));

	// Root must match what checkHookCommandPaths assigns to project files.
	const settingsFile: ClaudeSettingsFile = {
		path: settingsPath,
		label: "project settings.local.json",
		root: "$CLAUDE_PROJECT_DIR",
	};

	await expectFixerConvergence({
		detect: async (sf) => findStaleHookCommandsInFile(sf),
		fix: async (_sf) => {
			const result = await checkHookCommandPaths(ctx.projectDir);
			expect(result.fix).toBeDefined();
			const fixResult = await result.fix?.execute();
			expect(fixResult?.success).toBe(true);
		},
		fixture: settingsFile,
	});

	// Verify canonical form in the written file.
	const repaired = JSON.parse(await Bun.file(settingsPath).text()) as {
		hooks: { PreToolUse: Array<{ command: string }> };
	};
	const fixedCommand = repaired.hooks.PreToolUse[0]?.command ?? "";
	expect(fixedCommand).toMatch(expectedPattern);
}

/**
 * Test that a stale command in a global settings file (root="$HOME") converges
 * after `repairClaudeNodeCommandPath` is applied via the detect→fix→detect cycle.
 *
 * Note: We cannot use `checkHookCommandPaths` for global settings in tests because
 * `CK_TEST_HOME` changes `PathResolver.getGlobalKitDir()` to a temp path, which
 * makes `getCanonicalGlobalCommandRoot()` return an absolute temp path instead of
 * "$HOME". This test therefore exercises the detect/repair functions directly with
 * an explicit "$HOME" root, matching the real production path.
 */
async function assertGlobalCommandConverges(
	ctx: TestContext,
	command: string,
	expectedPattern: RegExp,
): Promise<void> {
	// Write to a temp location (not the CK_TEST_HOME global dir to avoid root confusion).
	const settingsDir = join(ctx.tempDir, "global-test", ".claude");
	const settingsPath = join(settingsDir, "settings.local.json");
	await mkdir(settingsDir, { recursive: true });

	const fixture = {
		hooks: {
			PreToolUse: [{ type: "command", command }],
		},
	};
	await writeFile(settingsPath, JSON.stringify(fixture));

	// Explicitly use "$HOME" root — this is what production assigns to global files.
	const settingsFile: ClaudeSettingsFile = {
		path: settingsPath,
		label: "global settings.local.json",
		root: "$HOME",
	};

	// Use expectFixerConvergence with direct findStaleHookCommandsInFile calls.
	// We simulate the fixer by manually calling repairClaudeNodeCommandPath on the fixture.
	await expectFixerConvergence({
		detect: async (sf) => findStaleHookCommandsInFile(sf),
		fix: async (sf) => {
			// Read → repair → write (mirrors what repairHookCommandsInSettingsFile does).
			const { SettingsMerger } = await import("@/domains/config/settings-merger.js");
			const settings = await SettingsMerger.readSettingsFile(sf.path);
			if (!settings?.hooks) return;
			for (const entries of Object.values(settings.hooks)) {
				for (const entry of entries as Array<{
					command?: string;
					hooks?: Array<{ command?: string }>;
				}>) {
					if (typeof entry.command === "string") {
						const r = repairClaudeNodeCommandPath(entry.command, sf.root);
						if (r.changed) entry.command = r.command;
					}
					if (Array.isArray(entry.hooks)) {
						for (const h of entry.hooks) {
							if (typeof h.command === "string") {
								const r = repairClaudeNodeCommandPath(h.command, sf.root);
								if (r.changed) h.command = r.command;
							}
						}
					}
				}
			}
			await SettingsMerger.writeSettingsFile(sf.path, settings);
		},
		fixture: settingsFile,
	});

	// Verify canonical form in the written file.
	const repaired = JSON.parse(await Bun.file(settingsPath).text()) as {
		hooks: { PreToolUse: Array<{ command: string }> };
	};
	const fixedCommand = repaired.hooks.PreToolUse[0]?.command ?? "";
	expect(fixedCommand).toMatch(expectedPattern);
}

/**
 * Assert that a command is NOT flagged as stale (no-op pass).
 */
async function assertNotFlagged(
	ctx: TestContext,
	command: string,
	root: "$HOME" | "$CLAUDE_PROJECT_DIR",
): Promise<void> {
	const settingsDir = join(ctx.projectDir, ".claude");
	const settingsPath = join(settingsDir, "settings.local.json");
	await mkdir(settingsDir, { recursive: true });

	const fixture = {
		hooks: {
			PreToolUse: [{ type: "command", command }],
		},
	};
	await writeFile(settingsPath, JSON.stringify(fixture));

	const settingsFile: ClaudeSettingsFile = {
		path: settingsPath,
		label: "project settings.local.json",
		root,
	};

	const findings = await findStaleHookCommandsInFile(settingsFile);
	expect(findings).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Unit-level shape tests (repairClaudeNodeCommandPath directly)
// ---------------------------------------------------------------------------

describe("repairClaudeNodeCommandPath: per-shape unit corpus", () => {
	const HOME = homedir().replace(/\\/g, "/").replace(/\/+$/, "");

	test("bare relative — node .claude/hooks/foo.cjs → $CLAUDE_PROJECT_DIR form", () => {
		const result = repairClaudeNodeCommandPath("node .claude/hooks/foo.cjs", "$CLAUDE_PROJECT_DIR");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("raw-relative");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs');
	});

	test("bare relative — node .claude/hooks/foo.cjs → $HOME form", () => {
		const result = repairClaudeNodeCommandPath("node .claude/hooks/foo.cjs", "$HOME");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("raw-relative");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test("dotted relative — node ./.claude/hooks/foo.cjs", () => {
		const result = repairClaudeNodeCommandPath(
			"node ./.claude/hooks/foo.cjs",
			"$CLAUDE_PROJECT_DIR",
		);
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("raw-relative");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs');
	});

	test("nested path — node .claude/hooks/notifications/discord.cjs", () => {
		const result = repairClaudeNodeCommandPath(
			"node .claude/hooks/notifications/discord.cjs",
			"$CLAUDE_PROJECT_DIR",
		);
		expect(result.changed).toBe(true);
		expect(result.command).toBe(
			'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/notifications/discord.cjs',
		);
	});

	test("already canonical $HOME form — must be no-op (not flagged)", () => {
		const result = repairClaudeNodeCommandPath('node "$HOME/.claude/hooks/foo.cjs"', "$HOME");
		expect(result.changed).toBe(false);
		expect(result.issue).toBeNull();
	});

	test("already canonical $CLAUDE_PROJECT_DIR form — must be no-op (not flagged)", () => {
		const result = repairClaudeNodeCommandPath(
			'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs',
			"$CLAUDE_PROJECT_DIR",
		);
		expect(result.changed).toBe(false);
		expect(result.issue).toBeNull();
	});

	test('var-only quoted $HOME — node "$HOME"/.claude/hooks/foo.cjs (stale: $HOME uses full-path quoting)', () => {
		// node "$HOME"/.claude/... is NOT canonical for $HOME root.
		// Canonical $HOME form is: node "$HOME/.claude/..."  (full path inside quotes).
		const result = repairClaudeNodeCommandPath('node "$HOME"/.claude/hooks/foo.cjs', "$HOME");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test("var-only quoted $CLAUDE_PROJECT_DIR with $HOME root — repairClaudeNodeCommandPath re-roots (SettingsProcessor behavior)", () => {
		// repairClaudeNodeCommandPath itself DOES re-root $CLAUDE_PROJECT_DIR → $HOME
		// when root=$HOME (same-scope canonical guard only fires for $HOME→$HOME).
		// This is intentional: SettingsProcessor uses this for cross-scope normalization.
		// The health-checker suppresses this via isAlreadyCanonical() in collectHookCommandFindings
		// — so ck doctor --fix does NOT re-root canonical cross-scope commands.
		const result = repairClaudeNodeCommandPath(
			'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs',
			"$HOME",
		);
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test("unquoted $HOME var — node $HOME/.claude/hooks/foo.cjs", () => {
		const result = repairClaudeNodeCommandPath("node $HOME/.claude/hooks/foo.cjs", "$HOME");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test("tilde form — node ~/.claude/hooks/foo.cjs → $HOME", () => {
		const result = repairClaudeNodeCommandPath("node ~/.claude/hooks/foo.cjs", "$HOME");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test('absolute quoted POSIX under home — node "/home/x/.claude/hooks/foo.cjs"', () => {
		// Construct a path under homedir to trigger $HOME resolution
		const absoluteCmd = `node "${HOME}/.claude/hooks/foo.cjs"`;
		const result = repairClaudeNodeCommandPath(absoluteCmd, "$CLAUDE_PROJECT_DIR");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		// Under home → resolves to $HOME regardless of settingsFile root
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test("absolute unquoted POSIX under home — node /home/x/.claude/hooks/foo.cjs", () => {
		const absoluteCmd = `node ${HOME}/.claude/hooks/foo.cjs`;
		const result = repairClaudeNodeCommandPath(absoluteCmd, "$CLAUDE_PROJECT_DIR");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test("Windows %USERPROFILE% unquoted — node %USERPROFILE%/.claude/hooks/foo.cjs", () => {
		const result = repairClaudeNodeCommandPath("node %USERPROFILE%/.claude/hooks/foo.cjs", "$HOME");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test('Windows %USERPROFILE% quoted — node "%USERPROFILE%/.claude/hooks/foo.cjs"', () => {
		const result = repairClaudeNodeCommandPath(
			'node "%USERPROFILE%/.claude/hooks/foo.cjs"',
			"$HOME",
		);
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$HOME/.claude/hooks/foo.cjs"');
	});

	test('Windows %CLAUDE_PROJECT_DIR% quoted — node "%CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs"', () => {
		const result = repairClaudeNodeCommandPath(
			'node "%CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs"',
			"$CLAUDE_PROJECT_DIR",
		);
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs');
	});

	test("Windows %CLAUDE_PROJECT_DIR% unquoted — node %CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs", () => {
		const result = repairClaudeNodeCommandPath(
			"node %CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs",
			"$CLAUDE_PROJECT_DIR",
		);
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		expect(result.command).toBe('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs');
	});

	test("project-scoped absolute path (cook-after-plan-reminder.cjs shape, regex branch 6)", () => {
		// This is the user-reported shape: absolute path NOT under home → project root
		// Use a fake absolute path that is not under homedir.
		const fakeProjectRoot = "/workspace/myproject";
		const absoluteCmd = `node "${fakeProjectRoot}/.claude/hooks/cook-after-plan-reminder.cjs"`;
		const result = repairClaudeNodeCommandPath(absoluteCmd, "$CLAUDE_PROJECT_DIR");
		expect(result.changed).toBe(true);
		expect(result.issue).toBe("invalid-format");
		// Not under home → uses supplied root ($CLAUDE_PROJECT_DIR)
		expect(result.command).toBe(
			'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/cook-after-plan-reminder.cjs',
		);
	});

	test("non-node command — passthrough unchanged", () => {
		const result = repairClaudeNodeCommandPath("python .claude/hooks/foo.py", "$HOME");
		expect(result.changed).toBe(false);
		expect(result.issue).toBeNull();
	});

	test("null command — passthrough unchanged", () => {
		const result = repairClaudeNodeCommandPath(null, "$HOME");
		expect(result.changed).toBe(false);
		expect(result.issue).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Integration convergence tests (full detect→fix→detect cycle via disk)
// ---------------------------------------------------------------------------

describe("hook-health-checker corpus: full convergence cycle per stale shape", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await setupCtx();
	});

	afterEach(async () => {
		await teardownCtx(ctx);
	});

	// --- No-op shapes (must NOT be flagged) ---

	test("no-op: already canonical $HOME form is not flagged", async () => {
		await assertNotFlagged(ctx, 'node "$HOME/.claude/hooks/foo.cjs"', "$HOME");
	});

	test("no-op: already canonical $CLAUDE_PROJECT_DIR form is not flagged", async () => {
		await assertNotFlagged(
			ctx,
			'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs',
			"$CLAUDE_PROJECT_DIR",
		);
	});

	// --- Stale shapes: bare relative (project settings → $CLAUDE_PROJECT_DIR) ---

	test("converges: node .claude/hooks/foo.cjs (bare relative, project settings)", async () => {
		await assertProjectCommandConverges(ctx, "node .claude/hooks/foo.cjs", /\$CLAUDE_PROJECT_DIR/);
	});

	test("converges: node .claude/hooks/foo.cjs (bare relative, global settings)", async () => {
		await assertGlobalCommandConverges(ctx, "node .claude/hooks/foo.cjs", /\$HOME/);
	});

	test("converges: node ./.claude/hooks/foo.cjs (dotted relative, project settings)", async () => {
		await assertProjectCommandConverges(
			ctx,
			"node ./.claude/hooks/foo.cjs",
			/\$CLAUDE_PROJECT_DIR/,
		);
	});

	test("converges: nested path node .claude/hooks/notifications/discord.cjs", async () => {
		await assertProjectCommandConverges(
			ctx,
			"node .claude/hooks/notifications/discord.cjs",
			/notifications\/discord\.cjs/,
		);
	});

	// --- Stale shapes: var-only quoted ---

	test('converges: node "$HOME"/.claude/hooks/foo.cjs (var-only quoted, global settings)', async () => {
		await assertGlobalCommandConverges(ctx, 'node "$HOME"/.claude/hooks/foo.cjs', /\$HOME/);
	});

	test('no-op: node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs in global settings — canonical form, not flagged', async () => {
		// node "$CLAUDE_PROJECT_DIR"/.claude/... is in the canonical var-only-quoted form.
		// isAlreadyCanonical() returns true → collectHookCommandFindings skips it → 0 findings.
		// The health-checker does NOT re-root cross-scope canonical commands; only SettingsProcessor
		// does intentional cross-scope normalization (during install with root=$HOME).
		const settingsDir = join(ctx.tempDir, "global-test2", ".claude");
		const settingsPath = join(settingsDir, "settings.local.json");
		await mkdir(settingsDir, { recursive: true });
		const fixture = {
			hooks: {
				PreToolUse: [
					{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.cjs' },
				],
			},
		};
		await writeFile(settingsPath, JSON.stringify(fixture));
		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "global settings.local.json",
			root: "$HOME",
		};
		const findings = await findStaleHookCommandsInFile(settingsFile);
		expect(findings).toHaveLength(0); // isAlreadyCanonical gate prevents flagging
	});

	// --- Stale shapes: unquoted var ---

	test("converges: node $HOME/.claude/hooks/foo.cjs (unquoted var, global settings)", async () => {
		await assertGlobalCommandConverges(ctx, "node $HOME/.claude/hooks/foo.cjs", /\$HOME/);
	});

	test("converges: node $CLAUDE_PROJECT_DIR/.claude/hooks/foo.cjs (unquoted var, project settings)", async () => {
		await assertProjectCommandConverges(
			ctx,
			"node $CLAUDE_PROJECT_DIR/.claude/hooks/foo.cjs",
			/\$CLAUDE_PROJECT_DIR/,
		);
	});

	// --- Stale shapes: tilde ---

	test("converges: node ~/.claude/hooks/foo.cjs (tilde, global settings)", async () => {
		await assertGlobalCommandConverges(ctx, "node ~/.claude/hooks/foo.cjs", /\$HOME/);
	});

	test("converges: node ~/.claude/hooks/foo.cjs (tilde, project settings)", async () => {
		// Tilde in project settings → normalized to project root
		await assertProjectCommandConverges(
			ctx,
			"node ~/.claude/hooks/foo.cjs",
			/\$CLAUDE_PROJECT_DIR/,
		);
	});

	// --- Stale shapes: absolute POSIX ---

	test("converges: absolute quoted POSIX under home (in project settings)", async () => {
		const HOME = homedir().replace(/\\/g, "/").replace(/\/+$/, "");
		const cmd = `node "${HOME}/.claude/hooks/foo.cjs"`;
		// Absolute path under homedir → resolved to $HOME regardless of settingsFile root
		await assertProjectCommandConverges(ctx, cmd, /\$HOME/);
	});

	test("converges: absolute unquoted POSIX under home (in project settings)", async () => {
		const HOME = homedir().replace(/\\/g, "/").replace(/\/+$/, "");
		const cmd = `node ${HOME}/.claude/hooks/foo.cjs`;
		await assertProjectCommandConverges(ctx, cmd, /\$HOME/);
	});

	test("converges: absolute quoted POSIX NOT under home (cook-after-plan-reminder shape)", async () => {
		// Only POSIX: path that is not under homedir → uses supplied root ($CLAUDE_PROJECT_DIR)
		if (process.platform === "win32") return;
		const cmd = 'node "/workspace/myproject/.claude/hooks/cook-after-plan-reminder.cjs"';
		await assertProjectCommandConverges(ctx, cmd, /\$CLAUDE_PROJECT_DIR/);
	});

	// --- Stale shapes: Windows env var ---

	test("converges: node %USERPROFILE%/.claude/hooks/foo.cjs (Windows unquoted, global settings)", async () => {
		await assertGlobalCommandConverges(ctx, "node %USERPROFILE%/.claude/hooks/foo.cjs", /\$HOME/);
	});

	test('converges: node "%USERPROFILE%/.claude/hooks/foo.cjs" (Windows quoted, global settings)', async () => {
		await assertGlobalCommandConverges(ctx, 'node "%USERPROFILE%/.claude/hooks/foo.cjs"', /\$HOME/);
	});

	test("converges: node %CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs (Windows project unquoted)", async () => {
		await assertProjectCommandConverges(
			ctx,
			"node %CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs",
			/\$CLAUDE_PROJECT_DIR/,
		);
	});

	test('converges: node "%CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs" (Windows project quoted)', async () => {
		await assertProjectCommandConverges(
			ctx,
			'node "%CLAUDE_PROJECT_DIR%/.claude/hooks/foo.cjs"',
			/\$CLAUDE_PROJECT_DIR/,
		);
	});
});

// ---------------------------------------------------------------------------
// Nested matcher hook entries — convergence
// ---------------------------------------------------------------------------

describe("hook-health-checker corpus: nested matcher hook entries", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await setupCtx();
	});

	afterEach(async () => {
		await teardownCtx(ctx);
	});

	test("converges: PostToolUse flat command entry (bare relative)", async () => {
		const settingsDir = join(ctx.projectDir, ".claude");
		const settingsPath = join(settingsDir, "settings.local.json");
		await mkdir(settingsDir, { recursive: true });

		const fixture = {
			hooks: {
				PostToolUse: [{ type: "command", command: "node .claude/hooks/post-track.cjs" }],
			},
		};
		await writeFile(settingsPath, JSON.stringify(fixture));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		await expectFixerConvergence({
			detect: async (sf) => findStaleHookCommandsInFile(sf),
			fix: async (_sf) => {
				const result = await checkHookCommandPaths(ctx.projectDir);
				await result.fix?.execute();
			},
			fixture: settingsFile,
		});
	});

	test("converges: PostToolUse nested matcher hooks entry (bare relative)", async () => {
		const settingsDir = join(ctx.projectDir, ".claude");
		const settingsPath = join(settingsDir, "settings.local.json");
		await mkdir(settingsDir, { recursive: true });

		const fixture = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Write",
						hooks: [
							{ type: "command", command: "node .claude/hooks/post-write.cjs" },
							{ type: "command", command: "node .claude/hooks/post-audit.cjs" },
						],
					},
				],
			},
		};
		await writeFile(settingsPath, JSON.stringify(fixture));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		await expectFixerConvergence({
			detect: async (sf) => findStaleHookCommandsInFile(sf),
			fix: async (_sf) => {
				const result = await checkHookCommandPaths(ctx.projectDir);
				const fixResult = await result.fix?.execute();
				expect(fixResult?.success).toBe(true);
			},
			fixture: settingsFile,
		});

		// Verify both nested hooks were canonicalized
		const repaired = JSON.parse(await Bun.file(settingsPath).text()) as {
			hooks: {
				PostToolUse: Array<{
					hooks?: Array<{ command: string }>;
				}>;
			};
		};
		const nestedHooks = repaired.hooks.PostToolUse[0]?.hooks ?? [];
		expect(nestedHooks).toHaveLength(2);
		for (const hook of nestedHooks) {
			expect(hook.command).toMatch(/\$CLAUDE_PROJECT_DIR/);
		}
	});

	test("converges: mixed flat + nested matcher in same event", async () => {
		const settingsDir = join(ctx.projectDir, ".claude");
		const settingsPath = join(settingsDir, "settings.local.json");
		await mkdir(settingsDir, { recursive: true });

		const fixture = {
			hooks: {
				PreToolUse: [
					// flat command
					{ type: "command", command: "node .claude/hooks/flat-guard.cjs" },
					// matcher entry with nested hooks
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "node .claude/hooks/bash-guard.cjs" }],
					},
				],
			},
		};
		await writeFile(settingsPath, JSON.stringify(fixture));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		// Confirm 2 findings before fix
		const before = await findStaleHookCommandsInFile(settingsFile);
		expect(before).toHaveLength(2);

		await expectFixerConvergence({
			detect: async (sf) => findStaleHookCommandsInFile(sf),
			fix: async (_sf) => {
				const result = await checkHookCommandPaths(ctx.projectDir);
				await result.fix?.execute();
			},
			fixture: settingsFile,
		});
	});

	test("converges: UserPromptSubmit flat commands", async () => {
		const settingsDir = join(ctx.projectDir, ".claude");
		const settingsPath = join(settingsDir, "settings.local.json");
		await mkdir(settingsDir, { recursive: true });

		const fixture = {
			hooks: {
				UserPromptSubmit: [
					{ type: "command", command: "node .claude/hooks/session-state.cjs" },
					{ type: "command", command: "node .claude/hooks/token-counter.cjs" },
				],
			},
		};
		await writeFile(settingsPath, JSON.stringify(fixture));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		const before = await findStaleHookCommandsInFile(settingsFile);
		expect(before).toHaveLength(2);

		await expectFixerConvergence({
			detect: async (sf) => findStaleHookCommandsInFile(sf),
			fix: async (_sf) => {
				const result = await checkHookCommandPaths(ctx.projectDir);
				await result.fix?.execute();
			},
			fixture: settingsFile,
		});
	});
});

// ---------------------------------------------------------------------------
// Multi-finding file: 16 stale entries (regression guard — issue #775/#776)
// ---------------------------------------------------------------------------

describe("hook-health-checker corpus: 16-entry multi-finding regression", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await setupCtx();
	});

	afterEach(async () => {
		await teardownCtx(ctx);
	});

	function buildMixedShapesFixture(): object {
		// 16 stale entries across different shapes and event types
		return {
			hooks: {
				PreToolUse: [
					// 4 matcher entries × 2 nested hooks = 8 stale
					{
						matcher: "Read",
						hooks: [
							{ type: "command", command: "node .claude/hooks/scout-block.cjs" },
							{ type: "command", command: "node .claude/hooks/privacy-block.cjs" },
						],
					},
					{
						matcher: "Write",
						hooks: [
							{ type: "command", command: "node .claude/hooks/write-guard.cjs" },
							{ type: "command", command: "node $HOME/.claude/hooks/path-validator.cjs" },
						],
					},
					{
						matcher: "Bash",
						hooks: [
							{ type: "command", command: 'node "$HOME"/.claude/hooks/bash-guard.cjs' },
							{
								type: "command",
								command: "node ./.claude/hooks/command-filter.cjs",
							},
						],
					},
					{
						matcher: "Edit",
						hooks: [
							{ type: "command", command: "node ~/.claude/hooks/edit-guard.cjs" },
							{ type: "command", command: "node .claude/hooks/ownership-check.cjs" },
						],
					},
					// 2 flat stale commands
					{ type: "command", command: "node .claude/hooks/pre-tool-logger.cjs" },
					{ type: "command", command: "node %USERPROFILE%/.claude/hooks/pre-tool-audit.cjs" },
				],
				PostToolUse: [
					// 4 matcher entries × 1 nested hook each = 4 stale
					{
						matcher: "Read",
						hooks: [{ type: "command", command: "node .claude/hooks/post-read-tracker.cjs" }],
					},
					{
						matcher: "Write",
						hooks: [{ type: "command", command: "node .claude/hooks/post-write-tracker.cjs" }],
					},
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "node .claude/hooks/post-bash-tracker.cjs" }],
					},
					{
						matcher: "Edit",
						hooks: [{ type: "command", command: "node .claude/hooks/post-edit-tracker.cjs" }],
					},
				],
				UserPromptSubmit: [
					// 2 flat stale commands
					{ type: "command", command: "node .claude/hooks/session-state.cjs" },
					{ type: "command", command: "node .claude/hooks/token-counter.cjs" },
				],
			},
		};
	}

	test("single fix pass clears all 16 stale entries (mixed shapes)", async () => {
		const settingsDir = join(ctx.projectDir, ".claude");
		const settingsPath = join(settingsDir, "settings.local.json");
		await mkdir(settingsDir, { recursive: true });
		await writeFile(settingsPath, JSON.stringify(buildMixedShapesFixture()));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		// The fixture mixes bare-relative, var-only-quoted, unquoted-var, tilde,
		// dotted-relative, and Windows-env-var forms — all stale.
		const before = await findStaleHookCommandsInFile(settingsFile);
		expect(before).toHaveLength(16);

		await expectFixerConvergence({
			detect: async (sf) => findStaleHookCommandsInFile(sf),
			fix: async (_sf) => {
				const result = await checkHookCommandPaths(ctx.projectDir);
				const fixResult = await result.fix?.execute();
				expect(fixResult?.success).toBe(true);
			},
			fixture: settingsFile,
		});
	});
});
