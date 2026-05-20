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

// Use the real v0.124.0-alpha.3 capabilities entry for all tests
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

		it("drops SessionStart groups with clear|compact matchers", () => {
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
			// Only startup should survive
			expect(result.SessionStart).toHaveLength(1);
			expect(result.SessionStart?.[0]?.matcher).toBe("startup");
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

		it("drops non-Bash matchers on PreToolUse (Edit, Write not supported)", () => {
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
			expect(result.PreToolUse).toHaveLength(1);
			expect(result.PreToolUse?.[0]?.matcher).toBe("Bash");
		});
	});

	describe("permissionDecision scrubbing (failure mode 6)", () => {
		it("removes permissionDecision:allow from PreToolUse (only deny allowed)", () => {
			const result = convertClaudeHooksToCodex(CLAUDE_HOOKS, caps);
			const entry = result.PreToolUse?.[0]?.hooks?.[0];
			expect(entry?.permissionDecision).toBeUndefined();
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

		it("drops event when all hooks in all groups are empty", () => {
			const hooks: HooksSection = {
				PreToolUse: [
					{
						matcher: "Edit", // not allowed — whole group gets dropped
						hooks: [{ type: "command", command: "node hook.cjs" }],
					},
				],
			};
			const result = convertClaudeHooksToCodex(hooks, caps);
			expect(result.PreToolUse).toBeUndefined();
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
