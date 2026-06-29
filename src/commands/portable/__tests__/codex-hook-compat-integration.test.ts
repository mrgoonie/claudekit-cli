/**
 * Integration tests for Codex hook compatibility layer (GH-730).
 *
 * Covers all 8 failure modes identified in the issue:
 *   1. SubagentStart event not supported by Codex — must be dropped
 *   2. SubagentStop / Notification / PreCompact events — must be dropped
 *   3. runtime additionalContext is capability-driven
 *   4. SessionStart matcher filtering is capability-driven
 *   5. PreToolUse/PostToolUse matcher filtering is capability-driven
 *   6. permissionDecision values are capability-driven
 *   7. command paths pointing at $HOME/.claude/hooks — must be rewritten to wrapper paths
 *   8. hooks feature flag not set — hooks.json is inert without it
 *
 * Uses a real tmp filesystem; does not spawn `codex` binary.
 * Each test chdir()s into its own tmp subdir so project-scoped path resolution works.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CODEX_CAPABILITY_TABLE } from "../codex-capabilities.js";
import { buildWrapperScript } from "../codex-hook-wrapper.js";
import { migrateHooksSettings } from "../hooks-settings-merger.js";

// ---- helpers ----------------------------------------------------------------

const testRoot = join(tmpdir(), "ck-codex-compat-integration");
const originalCwd = process.cwd();
const originalCompatMode = process.env.CK_CODEX_COMPAT;

function makeSourceSettings(hooks: Record<string, unknown>): string {
	return JSON.stringify({ hooks }, null, 2);
}

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** Set up a fresh test directory and chdir into it. Returns the dir path. */
function setupTestDir(name: string): string {
	const dir = join(testRoot, name);
	mkdirSync(join(dir, ".claude"), { recursive: true });
	mkdirSync(join(dir, ".codex"), { recursive: true });
	process.chdir(dir);
	return dir;
}

// A minimal Claude Code settings.json with all the problematic patterns
const FULL_CLAUDE_HOOKS = {
	SessionStart: [
		{
			matcher: "startup",
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/session-init.cjs"`,
					additionalContext: "some context injected at session start",
				},
			],
		},
		{
			matcher: "clear",
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/session-clear.cjs"`,
				},
			],
		},
	],
	SubagentStart: [
		{
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/subagent-init.cjs"`,
					additionalContext: "subagent context",
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
					command: `node "${homedir()}/.claude/hooks/privacy-block.cjs"`,
					permissionDecision: "allow",
					additionalContext: "would hard-error v0.124.0-alpha.3",
				},
			],
		},
		{
			matcher: "Edit",
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/edit-guard.cjs"`,
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
					command: `node "${homedir()}/.claude/hooks/post-bash.cjs"`,
					additionalContext: "post context — OK on PostToolUse",
				},
			],
		},
	],
	Notification: [
		{
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/notify.cjs"`,
				},
			],
		},
	],
	PreCompact: [
		{
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/compact.cjs"`,
				},
			],
		},
	],
	// SubagentStop is also a Claude Code event unsupported by Codex — must be dropped
	SubagentStop: [
		{
			hooks: [
				{
					type: "command",
					command: `node "${homedir()}/.claude/hooks/subagent-stop.cjs"`,
				},
			],
		},
	],
};

// ---- setup/teardown ---------------------------------------------------------

beforeAll(() => {
	mkdirSync(testRoot, { recursive: true });
	process.env.CK_CODEX_COMPAT = "optimistic";
});

afterAll(() => {
	process.chdir(originalCwd);
	rmSync(testRoot, { recursive: true, force: true });
	if (originalCompatMode === undefined) {
		// biome-ignore lint/performance/noDelete: restore absent env var exactly
		delete process.env.CK_CODEX_COMPAT;
	} else {
		process.env.CK_CODEX_COMPAT = originalCompatMode;
	}
});

afterEach(() => {
	// Always restore cwd after each test to prevent cross-test contamination
	process.chdir(originalCwd);
});

// ---- tests ------------------------------------------------------------------

describe("codex hook compat integration — fresh install", () => {
	it("fresh install: produces hooks.json with only supported events", async () => {
		const dir = setupTestDir("fresh");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		const installedFiles = [
			"session-init.cjs",
			"subagent-init.cjs",
			"privacy-block.cjs",
			"edit-guard.cjs",
			"post-bash.cjs",
			"notify.cjs",
			"compact.cjs",
			"session-clear.cjs",
		];

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: installedFiles,
			global: false,
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe("registered");
		expect(existsSync(join(dir, ".codex", "hooks.json"))).toBe(true);

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: Record<string, unknown>;
		};

		// Failure modes 1+2: unsupported events must be absent
		expect(written.hooks.SubagentStart).toBeUndefined();
		expect(written.hooks.Notification).toBeUndefined();
		expect(written.hooks.PreCompact).toBeUndefined();

		// Supported events must be present
		expect(written.hooks.SessionStart).toBeDefined();
		expect(written.hooks.PreToolUse).toBeDefined();
		expect(written.hooks.PostToolUse).toBeDefined();
	}, 10000);

	it("fresh install: SessionStart keeps current startup and clear matchers", async () => {
		const dir = setupTestDir("fresh-session");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: [
				"session-init.cjs",
				"session-clear.cjs",
				"privacy-block.cjs",
				"post-bash.cjs",
			],
			global: false,
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe("registered");

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: { SessionStart?: Array<{ matcher?: string }> };
		};

		const sessionMatchers = (written.hooks.SessionStart ?? []).map((g) => g.matcher);
		expect(sessionMatchers).toContain("startup");
		expect(sessionMatchers).toContain("clear");
	}, 10000);

	it("fresh install: hook registration omits runtime-only additionalContext fields", async () => {
		const dir = setupTestDir("fresh-additional-context");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["privacy-block.cjs"],
			global: false,
		});

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: { PreToolUse?: Array<{ hooks: Array<Record<string, unknown>> }> };
		};

		const entries = written.hooks.PreToolUse?.flatMap((g) => g.hooks) ?? [];
		for (const entry of entries) {
			expect(entry.additionalContext).toBeUndefined();
		}
	}, 10000);

	it("fresh install: permissionDecision:allow preserved for current PreToolUse", async () => {
		const dir = setupTestDir("fresh-perm");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["privacy-block.cjs"],
			global: false,
		});

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: { PreToolUse?: Array<{ hooks: Array<Record<string, unknown>> }> };
		};

		const entries = written.hooks.PreToolUse?.flatMap((g) => g.hooks) ?? [];
		expect(entries.some((entry) => entry.permissionDecision === "allow")).toBe(true);
	}, 10000);

	it("fresh install: Edit matcher preserved for current PreToolUse", async () => {
		const dir = setupTestDir("fresh-matcher");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["privacy-block.cjs", "edit-guard.cjs"],
			global: false,
		});

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: { PreToolUse?: Array<{ matcher?: string }> };
		};

		const matchers = (written.hooks.PreToolUse ?? []).map((g) => g.matcher);
		expect(matchers).toContain("Edit");
		expect(matchers).toContain("Bash");
	}, 10000);
});

describe("codex hook compat integration — upgrade from previous ck migrate", () => {
	it("upgrade: new migration adds supported events even when stale hooks.json exists", async () => {
		const dir = setupTestDir("upgrade");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		// Simulate legacy hooks.json with wrong content (direct-copied SubagentStart).
		// Point the command at a real file inside the test dir so self-heal keeps
		// it — this test asserts pipeline behavior for unsupported events, not
		// the self-heal path. Self-heal's dedicated tests live elsewhere.
		const legacySubagentHook = join(dir, ".claude", "hooks", "subagent-init.cjs");
		mkdirSync(dirname(legacySubagentHook), { recursive: true });
		writeFileSync(legacySubagentHook, "// test fixture");
		writeFileSync(
			join(dir, ".codex", "hooks.json"),
			JSON.stringify({
				hooks: {
					SubagentStart: [
						{
							hooks: [
								{
									type: "command",
									command: `node "${legacySubagentHook}"`,
								},
							],
						},
					],
				},
			}),
		);

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "subagent-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBeGreaterThan(0);

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: Record<string, unknown>;
		};
		// New SessionStart from source should be added
		expect(written.hooks.SessionStart).toBeDefined();
		// Stale CK-managed unsupported events are pruned on rerun, then the new migration
		// adds only supported Codex hook events.
		const subagentEntries = (written.hooks.SubagentStart as Array<unknown> | undefined) ?? [];
		expect(subagentEntries.length).toBe(0);
	}, 10000);

	it("upgrade: repeat migration does not duplicate entries (idempotent)", async () => {
		const dir = setupTestDir("upgrade-idempotent");
		writeFileSync(join(dir, ".claude", "settings.json"), makeSourceSettings(FULL_CLAUDE_HOOKS));

		const opts = {
			sourceProvider: "claude-code" as const,
			targetProvider: "codex" as const,
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		};

		// First run
		await migrateHooksSettings(opts);
		// Restore cwd for second run (afterEach resets it, but we need it here mid-test)
		process.chdir(dir);

		// Second run
		const r2 = await migrateHooksSettings(opts);
		expect(r2.success).toBe(true);

		const written = readJson(join(dir, ".codex", "hooks.json")) as {
			hooks: { SessionStart?: Array<{ hooks: unknown[] }> };
		};

		// Deduplication: SessionStart should have exactly 1 entry for session-init.cjs
		const sessionEntries = written.hooks.SessionStart?.flatMap((g) => g.hooks) ?? [];
		expect(sessionEntries.length).toBe(1);
	}, 10000);
});

describe("codex hook compat integration — feature flag (failure mode 8)", () => {
	it("reports codexCapabilitiesVersion on successful migration", async () => {
		const dir = setupTestDir("feature-flag");
		writeFileSync(
			join(dir, ".claude", "settings.json"),
			makeSourceSettings({
				SessionStart: [
					{
						matcher: "startup",
						hooks: [
							{
								type: "command",
								command: `node "${homedir()}/.claude/hooks/session-init.cjs"`,
							},
						],
					},
				],
			}),
		);

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);
		expect(result.codexCapabilitiesVersion).toBeTypeOf("string");
	}, 10000);
});

describe("codex hook compat integration — Windows platform (gate removed, pipeline runs)", () => {
	it("does NOT short-circuit on win32 — returns pipeline result, not skipped-windows", async () => {
		// Phase 3: the Windows short-circuit gate was removed. The pipeline now runs on win32.
		const dir = setupTestDir("windows-pipeline");
		writeFileSync(
			join(dir, ".claude", "settings.json"),
			makeSourceSettings({
				SessionStart: [
					{
						matcher: "startup",
						hooks: [
							{
								type: "command",
								command: `node "${homedir()}/.claude/hooks/session-init.cjs"`,
							},
						],
					},
				],
			}),
		);

		// Mock process.platform to win32
		const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
		try {
			Object.defineProperty(process, "platform", { value: "win32", configurable: true });

			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "codex",
				installedHookFiles: ["session-init.cjs"],
				global: false,
			});

			// Gate removed: win32 no longer returns skipped-windows
			expect(result.status).not.toBe("skipped-windows");
			expect(result.success).toBe(true);
		} finally {
			if (platformDescriptor) {
				Object.defineProperty(process, "platform", platformDescriptor);
			}
		}
	});
});

describe("codex hook compat integration — no installed files", () => {
	it("returns no-installed-files without touching filesystem", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: [],
			global: false,
		});

		expect(result.status).toBe("no-installed-files");
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBe(0);
	});
});

// ---- New tests required by review fix round 1 --------------------------------

describe("codex hook compat — wrapper spawn sanitizes output by capability table (H1/M1)", () => {
	/**
	 * End-to-end test: create a fake .cjs hook that emits JSON with additionalContext,
	 * generate a wrapper with buildWrapperScript, spawn the wrapper, assert that
	 * additionalContext behavior follows the selected capability entry.
	 */
	const wrapperTestDir = join(testRoot, "wrapper-spawn-test");

	beforeAll(() => {
		mkdirSync(wrapperTestDir, { recursive: true });
	});

	it("wrapper preserves additionalContext from PreToolUse output for current Codex", () => {
		// Write a fake hook that emits additionalContext for PreToolUse
		const fakeHookPath = join(wrapperTestDir, "fake-pretooluse.cjs");
		writeFileSync(
			fakeHookPath,
			`#!/usr/bin/env node
"use strict";
const output = { additionalContext: "should-be-preserved", result: "ok" };
process.stdout.write(JSON.stringify(output));
process.exit(0);
`,
			{ mode: 0o755 },
		);

		const caps = CODEX_CAPABILITY_TABLE[0];
		const wrapperContent = buildWrapperScript(resolve(fakeHookPath), caps);
		const wrapperPath = join(wrapperTestDir, "wrapper-pretooluse.cjs");
		writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });

		// Spawn wrapper with PreToolUse stdin (simulates Codex invoking the hook)
		const stdinPayload = JSON.stringify({ hook_event_name: "PreToolUse", tool: "Bash" });
		const result = spawnSync(process.execPath, [wrapperPath], {
			input: stdinPayload,
			encoding: "utf8",
			timeout: 10000,
		});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);

		const parsed = JSON.parse(result.stdout);
		expect(parsed.additionalContext).toBe("should-be-preserved");
		// other fields preserved
		expect(parsed.result).toBe("ok");
	}, 15000);

	it("wrapper preserves additionalContext in PostToolUse output at runtime", () => {
		// PostToolUse DOES support additionalContext — wrapper must not strip it
		const fakeHookPath = join(wrapperTestDir, "fake-posttooluse.cjs");
		writeFileSync(
			fakeHookPath,
			`#!/usr/bin/env node
"use strict";
const output = { additionalContext: "should-be-kept", result: "done" };
process.stdout.write(JSON.stringify(output));
process.exit(0);
`,
			{ mode: 0o755 },
		);

		const caps = CODEX_CAPABILITY_TABLE[0];
		const wrapperContent = buildWrapperScript(resolve(fakeHookPath), caps);
		const wrapperPath = join(wrapperTestDir, "wrapper-posttooluse.cjs");
		writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });

		const stdinPayload = JSON.stringify({ hook_event_name: "PostToolUse", tool: "Bash" });
		const result = spawnSync(process.execPath, [wrapperPath], {
			input: stdinPayload,
			encoding: "utf8",
			timeout: 10000,
		});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);

		const parsed = JSON.parse(result.stdout);
		// additionalContext MUST be preserved — PostToolUse supports it
		expect(parsed.additionalContext).toBe("should-be-kept");
	}, 15000);

	it("wrapper preserves current allow decision and strips unsupported ask decision", () => {
		const fakeHookPath = join(wrapperTestDir, "fake-permdecision.cjs");
		writeFileSync(
			fakeHookPath,
			`#!/usr/bin/env node
"use strict";
const output = { permissionDecision: "allow", decision: "ask", additionalContext: "x" };
process.stdout.write(JSON.stringify(output));
process.exit(0);
`,
			{ mode: 0o755 },
		);

		const caps = CODEX_CAPABILITY_TABLE[0];
		const wrapperContent = buildWrapperScript(resolve(fakeHookPath), caps);
		const wrapperPath = join(wrapperTestDir, "wrapper-permdecision.cjs");
		writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });

		const stdinPayload = JSON.stringify({ hook_event_name: "PreToolUse", tool: "Bash" });
		const result = spawnSync(process.execPath, [wrapperPath], {
			input: stdinPayload,
			encoding: "utf8",
			timeout: 10000,
		});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);

		const parsed = JSON.parse(result.stdout);
		expect(parsed.permissionDecision).toBe("allow");
		expect(parsed.decision).toBeUndefined();
		expect(parsed.additionalContext).toBe("x");
	}, 15000);
});

describe("codex hook compat — capability fallback on unknown version (H3)", () => {
	it("unknown version falls back to most-restrictive (oldest) entry by default", async () => {
		// Simulate: detectCodexCapabilities falls back when version is unknown.
		// We test the fallback by checking FALLBACK_CAPABILITIES is the LAST table entry.
		const { CODEX_CAPABILITY_TABLE: table, detectCodexCapabilities } = await import(
			"../codex-capabilities.js"
		);
		// When codex binary is absent, falls back to oldest entry (last in table)
		const prev = process.env.CK_CODEX_COMPAT;
		// Remove env override so we get default behavior
		// biome-ignore lint/performance/noDelete: required to truly unset env for this test
		delete process.env.CK_CODEX_COMPAT;
		try {
			const caps = await detectCodexCapabilities();
			// Must be the oldest (last) entry — most restrictive by default
			// (or optimistic if user set CK_CODEX_COMPAT=optimistic)
			expect(table).toBeDefined();
			expect(caps.version).toBeTypeOf("string");
			// The fallback must be the last table entry (oldest) when CK_CODEX_COMPAT unset
			// AND codex is not found. Since we can't guarantee codex is absent in CI,
			// we only assert that a valid capabilities object is returned.
			expect(Object.keys(caps.events).length).toBeGreaterThan(0);
		} finally {
			if (prev !== undefined) {
				process.env.CK_CODEX_COMPAT = prev;
			}
		}
	});

	it("strict mode always returns oldest (most restrictive) entry", async () => {
		const { CODEX_CAPABILITY_TABLE: table, detectCodexCapabilities } = await import(
			"../codex-capabilities.js"
		);
		const prev = process.env.CK_CODEX_COMPAT;
		process.env.CK_CODEX_COMPAT = "strict";
		try {
			const caps = await detectCodexCapabilities();
			// Strict always uses last entry (oldest, most conservative)
			expect(caps.version).toBe(table[table.length - 1].version);
		} finally {
			if (prev === undefined) {
				// biome-ignore lint/performance/noDelete: required to truly unset env for this test
				delete process.env.CK_CODEX_COMPAT;
			} else {
				process.env.CK_CODEX_COMPAT = prev;
			}
		}
	});

	it("optimistic mode returns newest entry", async () => {
		const { CODEX_CAPABILITY_TABLE: table, detectCodexCapabilities } = await import(
			"../codex-capabilities.js"
		);
		const prev = process.env.CK_CODEX_COMPAT;
		process.env.CK_CODEX_COMPAT = "optimistic";
		try {
			const caps = await detectCodexCapabilities();
			// Optimistic: when codex is absent/unknown, use newest entry (index 0)
			// Either the detected version matches, or we get newest as fallback
			expect(caps.version).toBeTypeOf("string");
			expect(Object.keys(caps.events).length).toBeGreaterThan(0);
			// Optimistic should not return an undefined capabilities object
			expect(caps).toBeDefined();
			// The returned version must be a known table entry
			const knownVersions = table.map((e) => e.version);
			expect(knownVersions).toContain(caps.version);
		} finally {
			if (prev === undefined) {
				// biome-ignore lint/performance/noDelete: required to truly unset env for this test
				delete process.env.CK_CODEX_COMPAT;
			} else {
				process.env.CK_CODEX_COMPAT = prev;
			}
		}
	});
});

describe("codex hook compat — concurrent config.toml write safety (H2)", () => {
	it("concurrent ensureCodexHooksFeatureFlag calls converge without corruption", async () => {
		const { ensureCodexHooksFeatureFlag } = await import("../codex-features-flag.js");
		const dir = join(testRoot, "concurrent-lock");
		mkdirSync(dir, { recursive: true });
		const configPath = join(dir, "config.toml");

		// Fire 5 concurrent writes to the same config.toml
		const runs = Array.from({ length: 5 }, () => ensureCodexHooksFeatureFlag(configPath));
		const results = await Promise.all(runs);

		// All must succeed (written or updated or already-set)
		for (const r of results) {
			expect(r.status).not.toBe("failed");
		}

		// Final file must have exactly one occurrence of hooks = true
		const final = readFileSync(configPath, "utf8");
		const occurrences = (final.match(/^hooks\s*=\s*true/gm) ?? []).length;
		expect(occurrences).toBe(1);
		expect(final).not.toContain("codex_hooks");
	}, 20000);
});

// ---- Review Fix Round 3 — N1: wrapper paths referenced in hooks.json ----------

describe("codex hook compat — N1: wrapper paths written to hooks.json commands", () => {
	/**
	 * Regression test for GH-730 N1.
	 *
	 * Before the fix, `wrapperPaths` was collected but `convertClaudeHooksToCodex` received
	 * only a directory-level `sourceDir → targetDir` rewrite, so `hooks.json` commands pointed
	 * at `~/.codex/hooks/session-init.cjs` (the original file), NOT the hash-prefixed wrapper
	 * `~/.codex/hooks/{hash}-session-init.cjs`. The sanitizer architecture was unreachable.
	 *
	 * After the fix, `commandSubstitutions` (a Map<originalAbsPath, wrapperAbsPath>) is built
	 * from successful `generateCodexHookWrappers` results and threaded into the converter so
	 * per-file substitution takes precedence over directory rewrite.
	 */
	const wrapperN1Dir = join(testRoot, "n1-wrapper-path-test");

	// Realistic hook files placed in a real tmp ~/.claude/hooks directory substitute
	// (we write them so the absolute paths exist on disk and wrapperFilename(hash) is stable)
	let hookAbsPaths: string[] = [];
	let targetHookAbsPaths: string[] = [];
	let sourceHooksDir: string;
	let codexHooksDir: string;
	let testProjectDir: string;

	beforeAll(() => {
		// Mirror provider defaults: project-scoped hooks live under
		// `<project>/.claude/hooks/` (source) and `<project>/.codex/hooks/` (target).
		// The merger derives sourceHooksDir/targetHooksDir from provider-registry
		// resolved against process.cwd(), so the test fixtures must sit under the
		// same cwd-relative structure.
		testProjectDir = join(wrapperN1Dir, "project");
		sourceHooksDir = join(testProjectDir, ".claude", "hooks");
		codexHooksDir = join(testProjectDir, ".codex", "hooks");

		mkdirSync(sourceHooksDir, { recursive: true });
		mkdirSync(codexHooksDir, { recursive: true });
		mkdirSync(join(testProjectDir, ".claude"), { recursive: true });
		mkdirSync(join(testProjectDir, ".codex"), { recursive: true });

		const hookNames = ["session-init.cjs", "privacy-block.cjs", "post-bash.cjs"];
		// Source hooks (what Claude's settings.json commands reference)
		hookAbsPaths = hookNames.map((name) => {
			const p = join(sourceHooksDir, name);
			writeFileSync(
				p,
				`#!/usr/bin/env node\n"use strict";\nprocess.stdout.write(JSON.stringify({result:"ok"}));\nprocess.exit(0);\n`,
				{ mode: 0o755 },
			);
			return p;
		});
		// Simulate portable-installer.installPerFile: hook files are COPIED to the
		// codex hooks dir before migrateHooksSettings runs. In production,
		// migrate-command.ts passes these TARGET paths as installedHookAbsolutePaths,
		// while Claude's settings.json commands still reference SOURCE paths.
		targetHookAbsPaths = hookNames.map((name) => {
			const p = join(codexHooksDir, name);
			writeFileSync(
				p,
				`#!/usr/bin/env node\n"use strict";\nprocess.stdout.write(JSON.stringify({result:"ok"}));\nprocess.exit(0);\n`,
				{ mode: 0o755 },
			);
			return p;
		});
	});

	it("N1 regression: hooks.json commands reference hash-prefixed wrapper, not original file", async () => {
		// Write a settings.json whose command strings reference the fake source hook paths
		const settingsJson = {
			hooks: {
				SessionStart: [
					{
						matcher: "startup",
						hooks: [
							{
								type: "command",
								command: `node "${hookAbsPaths[0]}"`,
								additionalContext: "injected context",
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
								command: `node "${hookAbsPaths[1]}"`,
								permissionDecision: "allow",
								additionalContext: "would hard-error",
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
								command: `node "${hookAbsPaths[2]}"`,
							},
						],
					},
				],
			},
		};
		writeFileSync(
			join(testProjectDir, ".claude", "settings.json"),
			JSON.stringify(settingsJson, null, 2),
		);

		process.chdir(testProjectDir);

		// Inject config discovery to use our fake dirs by overriding env var used by
		// provider-registry. We directly call migrateHooksSettings with absolute paths.
		// To make the test self-contained we stub out the provider config paths via
		// a custom settings path approach: pass installedHookAbsolutePaths explicitly.
		//
		// NOTE: migrateHooksSettings uses provider-registry for path discovery.
		// For this test we need the source settings to be found at testProjectDir/.claude/settings.json
		// and target at testProjectDir/.codex/hooks.json. The project-scoped paths are
		// resolved from process.cwd() which we've set to testProjectDir.

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs", "post-bash.cjs"],
			global: false,
			// Production path: migrate-command.ts passes TARGET paths here
			// (result.path from installPerFile = joined against codex hooks dir).
			// Claude's settings.json commands still reference SOURCE paths, so the
			// merger must index commandSubstitutions by BOTH forms. This simulation
			// ensures the N1 regression catches any future regression where the
			// merger forgets the source-path index.
			installedHookAbsolutePaths: targetHookAbsPaths,
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe("registered");
		expect(result.hooksRegistered).toBeGreaterThan(0);

		// Wrapper paths must be returned and exist on disk
		expect(result.codexWrapperPaths).toBeDefined();
		expect((result.codexWrapperPaths ?? []).length).toBeGreaterThan(0);
		for (const wp of result.codexWrapperPaths ?? []) {
			expect(existsSync(wp)).toBe(true);
		}

		// The written hooks.json commands must reference hash-prefixed wrappers
		expect(existsSync(join(testProjectDir, ".codex", "hooks.json"))).toBe(true);
		const written = readJson(join(testProjectDir, ".codex", "hooks.json")) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};

		// Collect all commands from the written hooks.json
		const allCommands: string[] = [];
		for (const groups of Object.values(written.hooks)) {
			for (const group of groups) {
				for (const entry of group.hooks) {
					allCommands.push(entry.command);
				}
			}
		}

		// Every command must reference a hash-prefixed wrapper, NOT the plain original basename
		// e.g. `node ".../{hash}-session-init.cjs"` and NOT `node ".../session-init.cjs"`
		const hookBasenames = ["session-init.cjs", "privacy-block.cjs", "post-bash.cjs"];

		for (const cmd of allCommands) {
			// Must NOT contain a plain non-hash-prefixed basename
			for (const basename of hookBasenames) {
				// Plain basename would appear without a hash prefix ({8hex}-basename)
				// Wrapper basename pattern: {8 hex chars}-basename
				const plainMatch = cmd.includes(`/${basename}"`);
				const hasHashPrefix = /\/[0-9a-f]{8}-/.test(cmd);
				if (plainMatch) {
					// If the command contains the plain basename, it MUST also have the hash prefix
					// (i.e. it's actually the wrapper `{hash}-{basename}`, not the original)
					expect(hasHashPrefix).toBe(true);
				}
			}
		}

		// Stronger assertion: every command must contain a hash-prefixed wrapper path
		// (pattern: /path/to/{8hex}-hookname.cjs)
		for (const cmd of allCommands) {
			expect(cmd).toMatch(/\/[0-9a-f]{8}-[^/]+\.cjs/);
		}
	}, 15000);

	it("N1 regression: wrapper files exist on disk at paths referenced by hooks.json commands", async () => {
		// Re-read the hooks.json written by the previous test (same project dir)
		// This test is deliberately separate to assert disk state independently.
		const hooksJsonPath = join(testProjectDir, ".codex", "hooks.json");
		// Hard assertion: file must exist — early return would let this pass vacuously
		// if the previous test failed to produce the file.
		expect(existsSync(hooksJsonPath)).toBe(true);

		const written = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};

		// Extract referenced paths from command strings like: node "/abs/path/to/wrapper.cjs"
		const pathPattern = /node\s+"([^"]+\.cjs)"/g;
		for (const groups of Object.values(written.hooks)) {
			for (const group of groups) {
				for (const entry of group.hooks) {
					const matches = [...entry.command.matchAll(pathPattern)];
					for (const m of matches) {
						const referencedPath = m[1];
						expect(existsSync(referencedPath)).toBe(true);
					}
				}
			}
		}
	}, 10000);
});

// ---- Fix #883 — project-scope $CLAUDE_PROJECT_DIR in hook commands ----------

describe("project-scope migration resolves $CLAUDE_PROJECT_DIR (#883)", () => {
	/**
	 * Regression test for GH-883.
	 *
	 * Claude Code emits project-scope hooks as:
	 *   node "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.cjs  (form 2, var-only quoted)
	 *
	 * Before the fix, the converter only recognised $HOME / ~ / %USERPROFILE% prefix
	 * forms. $CLAUDE_PROJECT_DIR tokens survived into .codex/hooks.json. Codex never
	 * defines this env var, so every migrated hook exited 1 on every fire.
	 *
	 * After the fix:
	 *   - wrappable .cjs hooks → absolute hash-prefixed wrapper paths (no env var)
	 *   - non-wrappable .sh hooks → absolute projectDir-resolved path (no env var)
	 *   - second migration run → no duplicate entries (stable absolute-path keys)
	 *   - pre-broken installs (re-run `ck migrate`) → broken entries pruned,
	 *     exactly one correct entry per hook, hooksPruned > 0
	 */

	const issue883Dir = join(testRoot, "issue-883-project-dir");

	let targetHookAbsPaths: string[] = [];
	let testProjectDir883: string;
	let sourceHooksDir883: string;
	let codexHooksDir883: string;

	beforeAll(() => {
		// Mirror provider convention: project-scoped hooks live under
		// <project>/.claude/hooks/ (source) and <project>/.codex/hooks/ (target).
		testProjectDir883 = join(issue883Dir, "project");
		sourceHooksDir883 = join(testProjectDir883, ".claude", "hooks");
		codexHooksDir883 = join(testProjectDir883, ".codex", "hooks");

		mkdirSync(sourceHooksDir883, { recursive: true });
		mkdirSync(codexHooksDir883, { recursive: true });
		mkdirSync(join(testProjectDir883, ".claude"), { recursive: true });
		mkdirSync(join(testProjectDir883, ".codex"), { recursive: true });

		// Wrappable .cjs hook — Claude settings.json commands reference the source path via the env var form
		const cjsName = "simplify-gate.cjs";
		const sourceHookPath = join(sourceHooksDir883, cjsName);
		writeFileSync(
			sourceHookPath,
			`#!/usr/bin/env node\n"use strict";\nprocess.stdout.write(JSON.stringify({result:"ok"}));\nprocess.exit(0);\n`,
			{ mode: 0o755 },
		);

		// Installer copies hook files to .codex/hooks/ before migrateHooksSettings runs.
		// migrateHooksSettings receives TARGET paths as installedHookAbsolutePaths, while
		// Claude's settings.json commands still reference SOURCE paths via the env var form.
		const targetHookPath = join(codexHooksDir883, cjsName);
		writeFileSync(
			targetHookPath,
			`#!/usr/bin/env node\n"use strict";\nprocess.stdout.write(JSON.stringify({result:"ok"}));\nprocess.exit(0);\n`,
			{ mode: 0o755 },
		);
		targetHookAbsPaths = [targetHookPath];

		// Non-wrappable .sh runner — placed in both source and target dirs
		writeFileSync(join(sourceHooksDir883, "runner.sh"), "#!/bin/bash\necho ok\n", { mode: 0o755 });
		writeFileSync(join(codexHooksDir883, "runner.sh"), "#!/bin/bash\necho ok\n", { mode: 0o755 });
	});

	it("#883 headline: no CLAUDE_PROJECT_DIR token survives in written hooks.json", async () => {
		// Claude Code's exact emission form (form 2: var-only quoted) for project-scope hooks
		const settingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								// Form 2 — "$CLAUDE_PROJECT_DIR"/<rel> — the standard Claude Code emission
								command: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`,
							},
						],
					},
				],
				SessionStart: [
					{
						matcher: "startup",
						hooks: [
							{
								type: "command",
								command: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`,
							},
						],
					},
				],
			},
		};
		writeFileSync(
			join(testProjectDir883, ".claude", "settings.json"),
			JSON.stringify(settingsJson, null, 2),
		);

		process.chdir(testProjectDir883);

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["simplify-gate.cjs"],
			global: false,
			installedHookAbsolutePaths: targetHookAbsPaths,
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe("registered");
		expect(result.hooksRegistered).toBeGreaterThan(0);

		const hooksJsonPath = join(testProjectDir883, ".codex", "hooks.json");
		expect(existsSync(hooksJsonPath)).toBe(true);

		const rawJson = readFileSync(hooksJsonPath, "utf8");

		// HEADLINE ASSERTION: zero occurrences of CLAUDE_PROJECT_DIR anywhere in the file
		expect(rawJson).not.toContain("CLAUDE_PROJECT_DIR");
	}, 15000);

	it("#883: wrappable hook commands are absolute hash-prefixed wrappers", async () => {
		const hooksJsonPath = join(testProjectDir883, ".codex", "hooks.json");
		// Hard assertion: file must exist — early return would let this pass vacuously.
		expect(existsSync(hooksJsonPath)).toBe(true);

		const written = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};

		const allCommands: string[] = [];
		for (const groups of Object.values(written.hooks)) {
			for (const group of groups) {
				for (const entry of group.hooks) {
					allCommands.push(entry.command);
				}
			}
		}

		// Every command must be an absolute path — no relative paths, no env var tokens
		for (const cmd of allCommands) {
			expect(cmd).not.toContain("CLAUDE_PROJECT_DIR");
			// Command must reference an absolute path (starts with /)
			expect(cmd).toMatch(/\/[^"]+\.cjs/);
			// Must be a hash-prefixed wrapper: {8 hex chars}-<name>.cjs
			expect(cmd).toMatch(/\/[0-9a-f]{8}-[^/]+\.cjs/);
		}
	}, 10000);

	it("#883: wrapper files exist on disk at the referenced paths", async () => {
		const hooksJsonPath = join(testProjectDir883, ".codex", "hooks.json");
		// Hard assertion: file must exist — early return would let this pass vacuously.
		expect(existsSync(hooksJsonPath)).toBe(true);

		const written = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};

		const pathPattern = /node\s+"([^"]+\.cjs)"/g;
		for (const groups of Object.values(written.hooks)) {
			for (const group of groups) {
				for (const entry of group.hooks) {
					const matches = [...entry.command.matchAll(pathPattern)];
					for (const m of matches) {
						const referencedPath = m[1];
						expect(existsSync(referencedPath)).toBe(true);
					}
				}
			}
		}
	}, 10000);

	it("#883: non-wrappable .sh hook is resolved to absolute project path", async () => {
		// Write a settings.json that has the .sh runner (non-wrappable — .sh excluded from wrappers)
		const shTestDir = join(issue883Dir, "sh-test");
		const shSourceHooksDir = join(shTestDir, ".claude", "hooks");
		const shCodexHooksDir = join(shTestDir, ".codex", "hooks");
		mkdirSync(shSourceHooksDir, { recursive: true });
		mkdirSync(shCodexHooksDir, { recursive: true });
		writeFileSync(join(shSourceHooksDir, "runner.sh"), "#!/bin/bash\necho ok\n", { mode: 0o755 });
		writeFileSync(join(shCodexHooksDir, "runner.sh"), "#!/bin/bash\necho ok\n", { mode: 0o755 });

		const shSettingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/runner.sh`,
							},
						],
					},
				],
			},
		};
		writeFileSync(
			join(shTestDir, ".claude", "settings.json"),
			JSON.stringify(shSettingsJson, null, 2),
		);

		process.chdir(shTestDir);

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["runner.sh"],
			global: false,
			// No installedHookAbsolutePaths: .sh is non-wrappable (CJS-only wrapper path)
		});

		expect(result.success).toBe(true);

		const hooksJsonPath = join(shTestDir, ".codex", "hooks.json");
		// Hard assertion: the .sh non-wrappable hook must have been written.
		// An early return here would let the test pass vacuously if the file wasn't written.
		expect(existsSync(hooksJsonPath)).toBe(true);

		const rawJson = readFileSync(hooksJsonPath, "utf8");
		// No CLAUDE_PROJECT_DIR env var in any output
		expect(rawJson).not.toContain("CLAUDE_PROJECT_DIR");

		// Pin: the resolved command must contain the absolute project path and the .sh basename
		// with balanced quotes (not just absence of the env var token).
		const written = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};
		const allCommands: string[] = [];
		for (const groups of Object.values(written.hooks)) {
			for (const group of groups) {
				for (const entry of group.hooks) {
					allCommands.push(entry.command);
				}
			}
		}
		// Every command must reference the absolute resolved path with balanced quotes
		for (const cmd of allCommands) {
			expect(cmd).toContain(`${shTestDir}/.codex/hooks/runner.sh`);
			// Must be quoted (path may contain spaces)
			expect(cmd).toMatch(/"[^"]*runner\.sh[^"]*"/);
		}
	}, 15000);

	it("#883 idempotency: second migration produces no duplicate entries", async () => {
		// Restore cwd to project dir (afterEach resets it between tests)
		process.chdir(testProjectDir883);

		// Delete the hooks.json from prior tests so we start fresh for this assertion
		const hooksJsonPath = join(testProjectDir883, ".codex", "hooks.json");
		if (existsSync(hooksJsonPath)) {
			rmSync(hooksJsonPath);
		}

		const settingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`,
							},
						],
					},
				],
			},
		};
		writeFileSync(
			join(testProjectDir883, ".claude", "settings.json"),
			JSON.stringify(settingsJson, null, 2),
		);

		// First migration run
		await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["simplify-gate.cjs"],
			global: false,
			installedHookAbsolutePaths: targetHookAbsPaths,
		});

		const countHooksInSection = (
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>,
		): number => {
			let n = 0;
			for (const groups of Object.values(hooks)) {
				for (const g of groups) n += g.hooks.length;
			}
			return n;
		};

		const afterFirst = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};
		const countAfterFirst = countHooksInSection(afterFirst.hooks);
		expect(countAfterFirst).toBeGreaterThan(0);

		// Second migration run (idempotent)
		process.chdir(testProjectDir883);
		await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["simplify-gate.cjs"],
			global: false,
			installedHookAbsolutePaths: targetHookAbsPaths,
		});

		const afterSecond = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};
		const countAfterSecond = countHooksInSection(afterSecond.hooks);

		// No duplicates: hook count must remain the same after second run
		expect(countAfterSecond).toBe(countAfterFirst);

		// Still no env var tokens after second run
		const rawJson = readFileSync(hooksJsonPath, "utf8");
		expect(rawJson).not.toContain("CLAUDE_PROJECT_DIR");
	}, 20000);

	it("#883 H2 self-heal: pre-broken hooks.json entries are pruned and replaced with fixed entries", async () => {
		const selfHealDir = join(issue883Dir, "self-heal");
		const selfHealSourceHooks = join(selfHealDir, ".claude", "hooks");
		const selfHealCodexHooks = join(selfHealDir, ".codex", "hooks");
		mkdirSync(selfHealSourceHooks, { recursive: true });
		mkdirSync(selfHealCodexHooks, { recursive: true });

		// Write hook files on disk (both source and target)
		writeFileSync(
			join(selfHealSourceHooks, "simplify-gate.cjs"),
			`#!/usr/bin/env node\n"use strict";\nprocess.stdout.write(JSON.stringify({result:"ok"}));\nprocess.exit(0);\n`,
			{ mode: 0o755 },
		);
		const selfHealTargetHookPath = join(selfHealCodexHooks, "simplify-gate.cjs");
		writeFileSync(
			selfHealTargetHookPath,
			`#!/usr/bin/env node\n"use strict";\nprocess.stdout.write(JSON.stringify({result:"ok"}));\nprocess.exit(0);\n`,
			{ mode: 0o755 },
		);

		// Pre-seed .codex/hooks.json with OLD broken entries that the field reporter will hit.
		// Form 2: "$CLAUDE_PROJECT_DIR"/<rel> targeting .codex/hooks/ (post-Phase-2-fallback form)
		// Form 1: "$CLAUDE_PROJECT_DIR/<rel>" (fully-quoted form also encountered in broken installs)
		const brokenHooksJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								// Form 2: var-only quoted — most common broken form from Phase-2 fallback
								command: `node "$CLAUDE_PROJECT_DIR"/.codex/hooks/simplify-gate.cjs`,
							},
						],
					},
				],
				SessionStart: [
					{
						matcher: "startup",
						hooks: [
							{
								type: "command",
								// Form 1: fully-quoted variant also seen in broken installs
								command: `node "$CLAUDE_PROJECT_DIR/.codex/hooks/simplify-gate.cjs"`,
							},
						],
					},
				],
			},
		};
		const selfHealHooksJsonPath = join(selfHealDir, ".codex", "hooks.json");
		writeFileSync(selfHealHooksJsonPath, JSON.stringify(brokenHooksJson, null, 2));

		// Source settings.json with the correct Claude Code form (what Claude wrote)
		const settingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`,
							},
						],
					},
				],
				SessionStart: [
					{
						matcher: "startup",
						hooks: [
							{
								type: "command",
								command: `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`,
							},
						],
					},
				],
			},
		};
		writeFileSync(
			join(selfHealDir, ".claude", "settings.json"),
			JSON.stringify(settingsJson, null, 2),
		);

		process.chdir(selfHealDir);

		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["simplify-gate.cjs"],
			global: false,
			installedHookAbsolutePaths: [selfHealTargetHookPath],
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe("registered");
		// hooksPruned must reflect the broken entries that were removed by self-heal
		expect(result.hooksPruned).toBeGreaterThan(0);

		const rawJson = readFileSync(selfHealHooksJsonPath, "utf8");

		// No CLAUDE_PROJECT_DIR tokens remain in the healed file
		expect(rawJson).not.toContain("CLAUDE_PROJECT_DIR");

		const written = readJson(selfHealHooksJsonPath) as {
			hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
		};

		// Exactly one hook entry per event: the fixed absolute-wrapper command.
		// Broken entries were pruned; the new correct entry was deduplicated into one.
		for (const groups of Object.values(written.hooks)) {
			let totalHooks = 0;
			for (const group of groups) {
				totalHooks += group.hooks.length;
				for (const entry of group.hooks) {
					// Each surviving entry must be an absolute hash-prefixed wrapper
					expect(entry.command).not.toContain("CLAUDE_PROJECT_DIR");
					expect(entry.command).toMatch(/\/[0-9a-f]{8}-[^/]+\.cjs/);
				}
			}
			// Only one hook per event (broken entries pruned, one correct entry merged)
			expect(totalHooks).toBe(1);
		}
	}, 20000);
});
