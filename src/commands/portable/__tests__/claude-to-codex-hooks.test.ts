import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CodexCapabilities } from "../codex-capabilities.js";
import { CODEX_CAPABILITY_TABLE } from "../codex-capabilities.js";
import {
	convertClaudeHooksToCodex,
	rewriteCommandPath,
} from "../converters/claude-to-codex-hooks.js";
import type { HooksSection } from "../converters/claude-to-codex-hooks.js";

// Use the newest known capabilities for default conversion behavior.
const caps: CodexCapabilities = CODEX_CAPABILITY_TABLE[0];

// Fixture: typical Claude Code hooks.json hooks section
const CLAUDE_HOOKS: HooksSection = {
	SessionStart: [
		{
			matcher: "startup",
			hooks: [
				{
					type: "command",
					command: 'node "$HOME/.claude/hooks/session-init.cjs"',
					additionalContext: "some context",
				},
			],
		},
	],
	SubagentStart: [
		{
			hooks: [
				{
					type: "command",
					command: 'node "$HOME/.claude/hooks/subagent-init.cjs"',
					additionalContext: "agent context",
				},
			],
		},
	],
	PreToolUse: [
		{
			matcher: "Bash",
			hooks: [
				{
					type: "command",
					command: 'node "$HOME/.claude/hooks/privacy-block.cjs"',
					permissionDecision: "allow",
					additionalContext: "should be stripped",
				},
			],
		},
	],
	PostToolUse: [
		{
			matcher: "Bash",
			hooks: [
				{
					type: "command",
					command: 'node "$HOME/.claude/hooks/post-tool.cjs"',
					additionalContext: "post context",
				},
			],
		},
	],
	Notification: [
		{
			hooks: [
				{
					type: "command",
					command: 'node "$HOME/.claude/hooks/notify.cjs"',
				},
			],
		},
	],
};

describe("convertClaudeHooksToCodex", () => {
	describe("event filtering (failure mode 1 + 2)", () => {
		it("drops SubagentStart (unsupported event)", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.SubagentStart).toBeUndefined();
		});

		it("drops Notification (unsupported event)", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.Notification).toBeUndefined();
		});

		it("preserves SessionStart (supported event)", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.SessionStart).toBeDefined();
			expect(result.SessionStart.length).toBeGreaterThan(0);
		});

		it("preserves PreToolUse (supported event)", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.PreToolUse).toBeDefined();
		});

		it("preserves PostToolUse (supported event)", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.PostToolUse).toBeDefined();
		});
	});

	describe("additionalContext stripping (failure mode 3)", () => {
		it("removes additionalContext from PreToolUse hook entries", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			const entry = result.PreToolUse?.[0]?.hooks?.[0];
			expect(entry).toBeDefined();
			expect(entry?.additionalContext).toBeUndefined();
		});

		it("removes additionalContext from SessionStart hook entries", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			const entry = result.SessionStart?.[0]?.hooks?.[0];
			expect(entry).toBeDefined();
			expect(entry?.additionalContext).toBeUndefined();
		});

		it("removes additionalContext from PostToolUse hook entries", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			const entry = result.PostToolUse?.[0]?.hooks?.[0];
			expect(entry?.additionalContext).toBeUndefined();
		});
	});

	describe("SessionStart matcher filtering (failure mode 4)", () => {
		it("preserves startup matcher on SessionStart", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.SessionStart?.[0]?.matcher).toBe("startup");
		});

		it("preserves current SessionStart matchers and drops unsupported compact matcher", () => {
			const hooks: HooksSection = {
				SessionStart: [
					{
						matcher: "clear",
						hooks: [{ type: "command", command: "node hook.cjs" }],
					},
					{
						matcher: "startup",
						hooks: [{ type: "command", command: "node startup.cjs" }],
					},
					{
						matcher: "compact",
						hooks: [{ type: "command", command: "node compact.cjs" }],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.SessionStart).toHaveLength(2);
			expect(result.SessionStart?.map((group) => group.matcher)).toEqual(["clear", "startup"]);
		});

		it("preserves resume matcher on SessionStart", () => {
			const hooks: HooksSection = {
				SessionStart: [
					{
						matcher: "resume",
						hooks: [{ type: "command", command: "node resume.cjs" }],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.SessionStart?.[0]?.matcher).toBe("resume");
		});
	});

	describe("PreToolUse matcher filtering (failure mode 5)", () => {
		it("keeps Bash matcher on PreToolUse", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			expect(result.PreToolUse?.[0]?.matcher).toBe("Bash");
		});

		it("preserves non-Bash matchers on current Codex PreToolUse", () => {
			const hooks: HooksSection = {
				PreToolUse: [
					{
						matcher: "Edit",
						hooks: [{ type: "command", command: "node edit-hook.cjs" }],
					},
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "node bash-hook.cjs" }],
					},
					{
						matcher: "Write",
						hooks: [{ type: "command", command: "node write-hook.cjs" }],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.PreToolUse).toHaveLength(3);
			expect(result.PreToolUse?.map((group) => group.matcher)).toEqual(["Edit", "Bash", "Write"]);
		});
	});

	describe("permissionDecision scrubbing (failure mode 6)", () => {
		it("preserves permissionDecision:allow from PreToolUse on current Codex", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			const entry = result.PreToolUse?.[0]?.hooks?.[0];
			expect(entry?.permissionDecision).toBe("allow");
		});

		it("preserves permissionDecision:deny on PreToolUse", () => {
			const hooks: HooksSection = {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: "node hook.cjs",
								permissionDecision: "deny",
							},
						],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.PreToolUse?.[0]?.hooks?.[0]?.permissionDecision).toBe("deny");
		});
	});

	describe("path rewriting (failure mode 7)", () => {
		it("rewrites source dir to target dir in command paths", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps, {
				sourceDir: "$HOME/.claude/hooks",
				targetDir: "$HOME/.codex/hooks",
			});
			const cmd = result.SessionStart?.[0]?.hooks?.[0]?.command;
			expect(cmd).toContain("$HOME/.codex/hooks");
			expect(cmd).not.toContain("$HOME/.claude/hooks");
		});

		it("is no-op when sourceDir === targetDir", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps, {
				sourceDir: "$HOME/.claude/hooks",
				targetDir: "$HOME/.claude/hooks",
			});
			const cmd = result.SessionStart?.[0]?.hooks?.[0]?.command;
			expect(cmd).toContain("$HOME/.claude/hooks");
		});

		it("does not rewrite when pathRewrite not provided", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			const cmd = result.SessionStart?.[0]?.hooks?.[0]?.command;
			expect(cmd).toContain("$HOME/.claude/hooks");
		});
	});

	describe("empty-after-filter handling", () => {
		it("drops event entirely when all groups are filtered out", () => {
			const hooks: HooksSection = {
				SubagentStart: [
					{
						hooks: [{ type: "command", command: "node hook.cjs" }],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("drops event when all groups are filtered out by current capabilities", () => {
			const hooks: HooksSection = {
				SessionStart: [
					{
						matcher: "compact", // not allowed — whole group gets dropped
						hooks: [{ type: "command", command: "node hook.cjs" }],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.SessionStart).toBeUndefined();
		});
	});

	describe("PreCompact / SubagentStop (failure mode 8 — extra unsupported events)", () => {
		it("drops PreCompact", () => {
			const hooks: HooksSection = {
				PreCompact: [{ hooks: [{ type: "command", command: "node hook.cjs" }] }],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.PreCompact).toBeUndefined();
		});

		it("drops SubagentStop", () => {
			const hooks: HooksSection = {
				SubagentStop: [{ hooks: [{ type: "command", command: "node hook.cjs" }] }],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.SubagentStop).toBeUndefined();
		});
	});
});

/**
 * H3 — Capability table is single source of truth regression suite.
 *
 * Previously a static set was checked first, which meant a future Codex version
 * supporting SubagentStart would still be silently dropped until a human updated it.
 * H3 removes the static set so the capability
 * table drives filtering — if a future entry adds SubagentStart with supported=true,
 * it will flow through automatically.
 */
describe("H3 — capability table as single source of truth for event filtering", () => {
	it("event absent from capability table is dropped (SubagentStart)", () => {
		// SubagentStart is NOT in CODEX_CAPABILITY_TABLE[0].events → unsupported
		const hooks: HooksSection = {
			SubagentStart: [{ hooks: [{ type: "command", command: "node hook.cjs" }] }],
		};
		expect(convertClaudeHooksToCodex(hooks, caps).SubagentStart).toBeUndefined();
	});

	it("event absent from capability table is dropped (SubagentStop)", () => {
		const hooks: HooksSection = {
			SubagentStop: [{ hooks: [{ type: "command", command: "node hook.cjs" }] }],
		};
		expect(convertClaudeHooksToCodex(hooks, caps).SubagentStop).toBeUndefined();
	});

	it("event in capability table with supported=true is preserved", () => {
		const hooks: HooksSection = {
			PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node hook.cjs" }] }],
		};
		expect(convertClaudeHooksToCodex(hooks, caps).PostToolUse).toBeDefined();
	});

	it("hypothetical future event with supported=true in table would be preserved", () => {
		// Simulate a future Codex version adding SubagentStart support
		const futureCaps: CodexCapabilities = {
			...caps,
			events: {
				...caps.events,
				SubagentStart: { supported: true, supportsAdditionalContext: false },
			},
		};
		const hooks: HooksSection = {
			SubagentStart: [{ hooks: [{ type: "command", command: "node hook.cjs" }] }],
		};
		// With a future capability entry, it should pass through (not be statically blocked)
		expect(convertClaudeHooksToCodex(hooks, futureCaps).SubagentStart).toBeDefined();
	});
});

describe("rewriteCommandPath", () => {
	it("rewrites source to target with trailing slash guard", () => {
		const result = rewriteCommandPath('node "$HOME/.claude/hooks/session.cjs"', {
			sourceDir: "$HOME/.claude/hooks",
			targetDir: "$HOME/.codex/hooks",
		});
		expect(result).toBe('node "$HOME/.codex/hooks/session.cjs"');
	});

	it("rewrites occurrences followed by / (path entries) but not bare dir references", () => {
		// rewriteCommandPath appends a trailing slash to the match pattern so that
		// "HOOKS=..." (bare dir without slash) is left alone while file paths are rewritten.
		// This is the documented behavior: only rewrite paths that reference files inside the dir.
		const result = rewriteCommandPath(
			'HOOKS="$HOME/.claude/hooks" node "$HOME/.claude/hooks/hook.cjs"',
			{ sourceDir: "$HOME/.claude/hooks", targetDir: "$HOME/.codex/hooks" },
		);
		// The file path (with trailing slash before filename) IS rewritten
		expect(result).toContain("$HOME/.codex/hooks/hook.cjs");
		// The bare dir ref (no trailing slash) is NOT rewritten — intentional guard
		expect(result).toContain('HOOKS="$HOME/.claude/hooks"');
	});

	it("does not match partial directory names (hooks-extra not affected)", () => {
		const result = rewriteCommandPath('node "$HOME/.claude/hooks-extra/hook.cjs"', {
			sourceDir: "$HOME/.claude/hooks",
			targetDir: "$HOME/.codex/hooks",
		});
		// hooks-extra has a different segment — the trailing slash prevents partial match
		expect(result).toBe('node "$HOME/.claude/hooks-extra/hook.cjs"');
	});
});

// ---- N1 unit tests: per-file substitution via commandSubstitutions map ----------

describe("rewriteCommandPath — commandSubstitutions (GH-730 N1 fix)", () => {
	it("per-file substitution map wins over sourceDir→targetDir directory rewrite", () => {
		const home = homedir();
		const originalPath = join(home, ".claude", "hooks", "session-init.cjs");
		const wrapperPath = join(home, ".codex", "hooks", "deadbeef-session-init.cjs");
		const subs = new Map([[originalPath, wrapperPath]]);

		const cmd = `node "${originalPath}"`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: join(home, ".claude", "hooks"),
			targetDir: join(home, ".codex", "hooks"),
			commandSubstitutions: subs,
		});

		// Must reference the hash-prefixed wrapper, NOT the plain-copied original
		expect(result).toBe(`node "${wrapperPath}"`);
		expect(result).toContain("deadbeef-session-init.cjs");
		// Must NOT end with the plain non-prefixed basename
		expect(result).not.toMatch(/\/session-init\.cjs"$/);
	});

	it("falls back to directory rewrite for hooks absent from commandSubstitutions", () => {
		const home = homedir();
		const originalPath = join(home, ".claude", "hooks", "session-init.cjs");
		const wrapperPath = join(home, ".codex", "hooks", "deadbeef-session-init.cjs");
		// notify.cjs is NOT in the substitution map — must get directory rewrite
		const subs = new Map([[originalPath, wrapperPath]]);

		const notifyCmd = `node "${join(home, ".claude", "hooks", "notify.cjs")}"`;
		const result = rewriteCommandPath(notifyCmd, {
			sourceDir: join(home, ".claude", "hooks"),
			targetDir: join(home, ".codex", "hooks"),
			commandSubstitutions: subs,
		});

		// Falls back to directory-level rewrite: ~/.claude/hooks/ → ~/.codex/hooks/
		expect(result).toContain(join(home, ".codex", "hooks", "notify.cjs"));
	});

	it("resolves $HOME prefix in command to match absolute key in substitution map", () => {
		const home = homedir();
		const originalPath = join(home, ".claude", "hooks", "session-init.cjs");
		const wrapperPath = join(home, ".codex", "hooks", "deadbeef-session-init.cjs");
		const subs = new Map([[originalPath, wrapperPath]]);

		// Command uses $HOME prefix (common form written by ClaudeKit settings.json)
		const cmdDollarHome = `node "$HOME/.claude/hooks/session-init.cjs"`;
		const result = rewriteCommandPath(cmdDollarHome, {
			sourceDir: "$HOME/.claude/hooks",
			targetDir: "$HOME/.codex/hooks",
			commandSubstitutions: subs,
		});

		// $HOME is expanded to the real home dir before lookup, so the wrapper path matches
		expect(result).toBe(`node "${wrapperPath}"`);
	});

	it("resolves ~ prefix in command to match absolute key in substitution map", () => {
		const home = homedir();
		const originalPath = join(home, ".claude", "hooks", "session-init.cjs");
		const wrapperPath = join(home, ".codex", "hooks", "deadbeef-session-init.cjs");
		const subs = new Map([[originalPath, wrapperPath]]);

		// Command uses tilde prefix
		const cmdTilde = `node "~/.claude/hooks/session-init.cjs"`;
		const result = rewriteCommandPath(cmdTilde, {
			sourceDir: "~/.claude/hooks",
			targetDir: "~/.codex/hooks",
			commandSubstitutions: subs,
		});

		// ~ is expanded to the real home dir before lookup
		expect(result).toBe(`node "${wrapperPath}"`);
	});
});

// ---- GH-883 unit tests: $CLAUDE_PROJECT_DIR variable forms ----------

const PROJECT_DIR = "/Users/testuser/my-project";
const PROJECT_DIR_WITH_SPACE = "/Users/test user/proj";

describe("rewriteCommandPath — Phase 1 substitution: $CLAUDE_PROJECT_DIR forms", () => {
	// Shared setup: hook at .claude/hooks/simplify-gate.cjs, wrapper at .codex/hooks/abc-simplify-gate.cjs
	const relHook = ".claude/hooks/simplify-gate.cjs";
	const originalAbsPath = `${PROJECT_DIR}/${relHook}`;
	const wrapperAbsPath = `${PROJECT_DIR}/.codex/hooks/abc123-simplify-gate.cjs`;

	function makeSubs() {
		return new Map([[originalAbsPath, wrapperAbsPath]]);
	}

	it("form 1 — fully quoted $CLAUDE_PROJECT_DIR/<rel> → wrapper (quoted)", () => {
		const cmd = `node "$CLAUDE_PROJECT_DIR/${relHook}"`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`node "${wrapperAbsPath}"`);
		expect(result).not.toContain("$CLAUDE_PROJECT_DIR");
	});

	it("form 2 — var-only quoted $CLAUDE_PROJECT_DIR/<rel> (Claude Code standard) → wrapper (quoted)", () => {
		const cmd = `node "$CLAUDE_PROJECT_DIR"/${relHook}`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`node "${wrapperAbsPath}"`);
		expect(result).not.toContain("$CLAUDE_PROJECT_DIR");
	});

	it("form 3a — braced quoted ${CLAUDE_PROJECT_DIR}/<rel> → wrapper (quoted)", () => {
		const cmd = `node "\${CLAUDE_PROJECT_DIR}"/${relHook}`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`node "${wrapperAbsPath}"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("form 3b — bare braced ${CLAUDE_PROJECT_DIR}/<rel> → wrapper (unquoted)", () => {
		const cmd = `node \${CLAUDE_PROJECT_DIR}/${relHook}`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`node ${wrapperAbsPath}`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("form 4 — bare $CLAUDE_PROJECT_DIR/<rel> → wrapper (unquoted)", () => {
		const cmd = `node $CLAUDE_PROJECT_DIR/${relHook}`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`node ${wrapperAbsPath}`);
		expect(result).not.toContain("$CLAUDE_PROJECT_DIR");
	});

	it("form 5 — Windows %CLAUDE_PROJECT_DIR%/<rel> bare → wrapper (quoted)", () => {
		const cmd = `node %CLAUDE_PROJECT_DIR%/${relHook}`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`node "${wrapperAbsPath}"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("form 2 end-to-end: balanced quotes, no doubling", () => {
		// Claude Code's standard emission: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`
		const cmd = `node "$CLAUDE_PROJECT_DIR"/${relHook}`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			commandSubstitutions: makeSubs(),
			projectDir: PROJECT_DIR,
		});
		// Must be exactly `node "<wrapperAbsPath>"` — one opening, one closing quote
		expect(result).toBe(`node "${wrapperAbsPath}"`);
		// No doubled quotes
		expect(result).not.toContain('""');
	});
});

describe("rewriteCommandPath — Phase 2 fallback: residual $CLAUDE_PROJECT_DIR token resolution", () => {
	// Non-wrappable hook: no substitution map entry, falls through to fallback.
	const srcDir = `${PROJECT_DIR}/.claude/hooks`;
	const tgtDir = `${PROJECT_DIR}/.codex/hooks`;

	it('form 1 fallback — bash "$CLAUDE_PROJECT_DIR/.codex/hooks/runner.sh" → absolute path, no residual token', () => {
		// After dir rewrite, command still has $CLAUDE_PROJECT_DIR — must be resolved.
		const cmd = `bash "$CLAUDE_PROJECT_DIR/.codex/hooks/runner.sh"`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`bash "${PROJECT_DIR}/.codex/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("form 1 fallback — closing quote consumed, no doubled quote (H1 trap)", () => {
		const cmd = `bash "$CLAUDE_PROJECT_DIR/.codex/hooks/runner.sh"`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		// Must not have doubled closing quote
		expect(result).not.toContain('""');
		// Must end with exactly one closing quote after the path
		expect(result).toMatch(/runner\.sh"$/);
	});

	it('form 2 fallback — bash "$CLAUDE_PROJECT_DIR"/.codex/hooks/runner.sh → absolute path', () => {
		const cmd = `bash "$CLAUDE_PROJECT_DIR"/.codex/hooks/runner.sh`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`bash "${PROJECT_DIR}/.codex/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it('form 3a fallback — bash "${CLAUDE_PROJECT_DIR}"/.codex/hooks/runner.sh → absolute path', () => {
		const cmd = `bash "\${CLAUDE_PROJECT_DIR}"/.codex/hooks/runner.sh`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`bash "${PROJECT_DIR}/.codex/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("form 3b fallback — bash ${CLAUDE_PROJECT_DIR}/.codex/hooks/runner.sh → absolute path (quoted output)", () => {
		const cmd = "bash ${CLAUDE_PROJECT_DIR}/.codex/hooks/runner.sh";
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`bash "${PROJECT_DIR}/.codex/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("Windows bare fallback — bash %CLAUDE_PROJECT_DIR%/.codex/hooks/runner.sh → absolute path (quoted)", () => {
		const cmd = "bash %CLAUDE_PROJECT_DIR%/.codex/hooks/runner.sh";
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`bash "${PROJECT_DIR}/.codex/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it('Windows quoted bare fallback — bash "%CLAUDE_PROJECT_DIR%/.codex/hooks/runner.sh" → absolute path', () => {
		const cmd = `bash "%CLAUDE_PROJECT_DIR%/.codex/hooks/runner.sh"`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`bash "${PROJECT_DIR}/.codex/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it('bare-var no-suffix form 6 — cd "$CLAUDE_PROJECT_DIR" && node x.cjs → absolute path', () => {
		const cmd = `cd "$CLAUDE_PROJECT_DIR" && node x.cjs`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe(`cd "${PROJECT_DIR}" && node x.cjs`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("negative — echo $CLAUDE_PROJECT_DIRS is NOT rewritten (superset var name)", () => {
		const cmd = "echo $CLAUDE_PROJECT_DIRS";
		const result = rewriteCommandPath(cmd, {
			sourceDir: srcDir,
			targetDir: tgtDir,
			projectDir: PROJECT_DIR,
		});
		expect(result).toBe("echo $CLAUDE_PROJECT_DIRS");
		expect(result).toContain("$CLAUDE_PROJECT_DIRS");
	});

	it("path with spaces — quotes preserved and balanced", () => {
		const cmd = `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/runner.sh`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR_WITH_SPACE}/.claude/hooks`,
			targetDir: `${PROJECT_DIR_WITH_SPACE}/.codex/hooks`,
			projectDir: PROJECT_DIR_WITH_SPACE,
		});
		expect(result).toBe(`bash "${PROJECT_DIR_WITH_SPACE}/.claude/hooks/runner.sh"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
		expect(result).not.toContain('""');
	});

	it("combined $HOME and $CLAUDE_PROJECT_DIR — both rewritten", () => {
		// A runner command that references the global node-hook-runner (home) AND a project hook
		const cmd = `bash "$HOME/.claude/hooks/node-hook-runner.sh" "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			projectDir: PROJECT_DIR,
		});
		// $HOME form stays as-is (no home substitution map, dir rewrite covers it only if src matches)
		// $CLAUDE_PROJECT_DIR form must be resolved
		expect(result).not.toContain("$CLAUDE_PROJECT_DIR");
	});

	it("projectDir undefined — output identical to pre-change behavior (global-scope regression)", () => {
		const cmd = `node "$HOME/.claude/hooks/session-init.cjs"`;
		const result = rewriteCommandPath(cmd, {
			sourceDir: "$HOME/.claude/hooks",
			targetDir: "$HOME/.codex/hooks",
		});
		// No projectDir — existing dir-rewrite behavior unchanged
		expect(result).toBe(`node "$HOME/.codex/hooks/session-init.cjs"`);
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});

	it("shell metacharacter after path — semicolon is NOT swallowed into quoted path", () => {
		// Probe: `node $CLAUDE_PROJECT_DIR/x.cjs;echo hi` must not produce
		// `node "/proj/x.cjs;echo" hi`. The `;` must remain outside the quoted token.
		const cmd = "node $CLAUDE_PROJECT_DIR/.claude/hooks/x.cjs;echo hi";
		const result = rewriteCommandPath(cmd, {
			sourceDir: `${PROJECT_DIR}/.claude/hooks`,
			targetDir: `${PROJECT_DIR}/.codex/hooks`,
			projectDir: PROJECT_DIR,
		});
		// The path token must be resolved to the quoted absolute path WITHOUT the `;echo hi` suffix
		expect(result).toBe(`node "${PROJECT_DIR}/.claude/hooks/x.cjs";echo hi`);
		// The resolved path must not contain the semicolon
		expect(result).not.toContain('x.cjs;echo"');
		// The original env var token must be gone
		expect(result).not.toContain("CLAUDE_PROJECT_DIR");
	});
});
