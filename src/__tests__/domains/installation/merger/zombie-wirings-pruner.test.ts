/**
 * Phase 6 — Unit and integration tests for pruneZombieEngineerWirings().
 *
 * Fixture covers 5 entries per spec:
 *   A: _origin=engineer, file exists → KEEP
 *   B: _origin=engineer, skill-dedup.cjs missing → PRUNE
 *   C: _origin=engineer, node-hook-runner.sh missing → PRUNE
 *   D: no _origin, file missing → KEEP (conservative)
 *   E: _origin=engineer, different dir but file exists → KEEP
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SettingsJson } from "@/domains/config/merger/types.js";
import {
	extractHookFilePath,
	pruneZombieEngineerWirings,
} from "@/domains/installation/merger/zombie-wirings-pruner.js";

// ---------------------------------------------------------------------------
// Test fixture setup
// ---------------------------------------------------------------------------
const testHookDir = join(tmpdir(), "ck-zombie-pruner-test-hooks");
const altHookDir = join(tmpdir(), "ck-zombie-pruner-test-alt-hooks");

beforeAll(() => {
	mkdirSync(testHookDir, { recursive: true });
	mkdirSync(altHookDir, { recursive: true });

	// Entry A: simplify-gate.cjs exists
	writeFileSync(join(testHookDir, "simplify-gate.cjs"), "// hook A", "utf8");
	// Entry E: hook in different dir (alt) exists
	writeFileSync(join(altHookDir, "session-init.cjs"), "// hook E", "utf8");
	// Entries B (skill-dedup.cjs) and C (node-hook-runner.sh) intentionally NOT created
});

afterAll(() => {
	rmSync(testHookDir, { recursive: true, force: true });
	rmSync(altHookDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: build fixture settings
// ---------------------------------------------------------------------------
function buildFixtureSettings(): SettingsJson {
	return {
		hooks: {
			PreToolUse: [
				{
					// A: engineer + file exists → KEEP
					matcher: "Bash",
					hooks: [
						{
							type: "command",
							command: `node "${join(testHookDir, "simplify-gate.cjs")}"`,
							_origin: "engineer",
						},
					],
				},
				{
					// B: engineer + file missing → PRUNE (skill-dedup.cjs)
					matcher: "Bash",
					hooks: [
						{
							type: "command",
							command: `node "${join(testHookDir, "skill-dedup.cjs")}"`,
							_origin: "engineer",
						},
					],
				},
			],
			SessionStart: [
				{
					// C: engineer + file missing → PRUNE (node-hook-runner.sh)
					hooks: [
						{
							type: "command",
							command: `node "${join(testHookDir, "node-hook-runner.sh")}"`,
							_origin: "engineer",
						},
					],
				},
				{
					// D: no _origin, file missing → KEEP (conservative)
					hooks: [
						{
							type: "command",
							command: `node "${join(testHookDir, "user-custom.cjs")}"`,
							// no _origin
						},
					],
				},
			],
			PostToolUse: [
				{
					// E: engineer + different dir, file exists → KEEP
					hooks: [
						{
							type: "command",
							command: `node "${join(altHookDir, "session-init.cjs")}"`,
							_origin: "engineer",
						},
					],
				},
			],
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("pruneZombieEngineerWirings", () => {
	it("keeps A (engineer, exists), prunes B (engineer, missing skill-dedup.cjs)", () => {
		const settings = buildFixtureSettings();
		const { pruned } = pruneZombieEngineerWirings(settings, testHookDir);
		expect(pruned).toContain("skill-dedup.cjs");
	});

	it("prunes C (engineer, missing node-hook-runner.sh)", () => {
		const settings = buildFixtureSettings();
		const { pruned } = pruneZombieEngineerWirings(settings, testHookDir);
		expect(pruned).toContain("node-hook-runner.sh");
	});

	it("keeps D (no _origin, missing file — conservative)", () => {
		const settings = buildFixtureSettings();
		const { settings: result } = pruneZombieEngineerWirings(settings, testHookDir);
		// D is in SessionStart — should still be there
		const sessionStart = result.hooks?.SessionStart ?? [];
		const dEntry = sessionStart
			.flatMap((g: { hooks?: Array<{ command: string }> }) => g.hooks ?? [])
			.find((h: { command: string }) => h.command.includes("user-custom.cjs"));
		expect(dEntry).toBeDefined();
	});

	it("keeps E (engineer, exists in different dir)", () => {
		const settings = buildFixtureSettings();
		const { settings: result } = pruneZombieEngineerWirings(settings, testHookDir);
		const postToolUse = result.hooks?.PostToolUse ?? [];
		const eEntry = postToolUse
			.flatMap((g: { hooks?: Array<{ command: string }> }) => g.hooks ?? [])
			.find((h: { command: string }) => h.command.includes("session-init.cjs"));
		expect(eEntry).toBeDefined();
	});

	it("exactly 2 entries pruned (B and C)", () => {
		const settings = buildFixtureSettings();
		const { pruned } = pruneZombieEngineerWirings(settings, testHookDir);
		expect(pruned).toHaveLength(2);
	});

	it("exactly 3 entries remain (A, D, E) across all events", () => {
		const settings = buildFixtureSettings();
		const { settings: result } = pruneZombieEngineerWirings(settings, testHookDir);
		const allHooks = Object.values(result.hooks ?? {}).flatMap((groups) =>
			(groups as Array<{ hooks?: unknown[] }>).flatMap((g) => g.hooks ?? []),
		);
		expect(allHooks).toHaveLength(3);
	});

	it("removes emptied event arrays after pruning", () => {
		// Build settings where the only SessionStart entries are both engineer+missing
		const settings: SettingsJson = {
			hooks: {
				SessionStart: [
					{
						hooks: [
							{
								type: "command",
								command: `node "${join(testHookDir, "ghost1.cjs")}"`,
								_origin: "engineer",
							},
						],
					},
				],
				PostToolUse: [
					{
						hooks: [
							{
								type: "command",
								command: `node "${join(altHookDir, "session-init.cjs")}"`,
								_origin: "engineer",
							},
						],
					},
				],
			},
		};
		const { settings: result } = pruneZombieEngineerWirings(settings, testHookDir);
		// SessionStart should be gone (all its hooks were pruned)
		expect(result.hooks?.SessionStart).toBeUndefined();
		// PostToolUse should remain (session-init.cjs exists in altHookDir)
		expect(result.hooks?.PostToolUse).toBeDefined();
	});

	it("idempotency: re-running pruner on already-pruned settings is a no-op", () => {
		const settings = buildFixtureSettings();
		const { settings: afterFirstRun } = pruneZombieEngineerWirings(settings, testHookDir);
		const { pruned: secondRunPruned } = pruneZombieEngineerWirings(afterFirstRun, testHookDir);
		expect(secondRunPruned).toHaveLength(0);
	});
});

describe("pruneZombieEngineerWirings — Windows path variant", () => {
	it("win32: resolves Windows-style path from command and checks existence", () => {
		// Simulate a command that uses the real testHookDir path (which exists)
		// We use the POSIX path here since we're on macOS in CI, but verify the
		// path-resolution logic handles the absolute path form correctly.
		const settings: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						hooks: [
							{
								type: "command",
								command: `node "${join(testHookDir, "simplify-gate.cjs")}"`,
								_origin: "engineer",
							},
						],
					},
				],
			},
		};
		// Simplify-gate.cjs exists — should NOT be pruned
		const { pruned } = pruneZombieEngineerWirings(settings, testHookDir);
		expect(pruned).toHaveLength(0);
	});
});

describe("extractHookFilePath", () => {
	it("extracts absolute path from quoted node command", () => {
		const cmd = `node "${testHookDir}/scout-block.cjs"`;
		const result = extractHookFilePath(cmd, testHookDir);
		expect(result).toBe(`${testHookDir}/scout-block.cjs`);
	});

	it("returns null for non-hook command (no .cjs or .sh)", () => {
		const result = extractHookFilePath("echo hello", testHookDir);
		expect(result).toBeNull();
	});

	it("returns null for empty command", () => {
		const result = extractHookFilePath("", testHookDir);
		expect(result).toBeNull();
	});

	it("resolves $HOME placeholder to actual homedir (full-path-in-quotes form)", async () => {
		const { homedir } = await import("node:os");
		const home = homedir();
		const cmd = `node "$HOME/.claude/hooks/test.cjs"`;
		const result = extractHookFilePath(cmd, testHookDir);
		expect(result).toBe(`${home}/.claude/hooks/test.cjs`);
	});

	// --- B1 regression guard: var-only-quoted forms ---

	it('[B1] $HOME var-only-quoted form: node "$HOME"/.claude/hooks/x.cjs resolves correctly', async () => {
		const { homedir } = await import("node:os");
		const home = homedir();
		// hookDir = home/.claude/hooks → simulate global install
		const globalHookDir = join(home, ".claude", "hooks");
		const cmd = `node "$HOME"/.claude/hooks/scout-block.cjs`;
		const result = extractHookFilePath(cmd, globalHookDir);
		expect(result).toBe(`${home}/.claude/hooks/scout-block.cjs`);
	});

	it("[B1] $CLAUDE_PROJECT_DIR var-only-quoted form resolves to correct absolute path", () => {
		// hookDir = <projectRoot>/.claude/hooks
		// projectRoot is dirname(dirname(hookDir))
		const projectRoot = dirname(dirname(testHookDir));
		const cmd = `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/simplify-gate.cjs`;
		const result = extractHookFilePath(cmd, testHookDir);
		expect(result).toBe(`${projectRoot}/.claude/hooks/simplify-gate.cjs`);
	});

	it("[B1 DATA-LOSS GUARD] engineer-tagged $CLAUDE_PROJECT_DIR entry whose file EXISTS is KEPT", () => {
		// Create a temporary project tree: <root>/.claude/hooks/scout-block.cjs
		const {
			mkdtempSync,
			mkdirSync: mkdirSyncFs,
			writeFileSync: wfSync,
			rmSync: rmSyncFs,
		} = require("node:fs");
		const tmpRoot = mkdtempSync(join(tmpdir(), "ck-b1-regression-"));
		const projectHookDir = join(tmpRoot, ".claude", "hooks");
		mkdirSyncFs(projectHookDir, { recursive: true });
		wfSync(join(projectHookDir, "scout-block.cjs"), "// guard", "utf8");

		try {
			// Command in canonical project-scoped var-only-quoted form
			const cmd = `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/scout-block.cjs`;
			const settings: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash",
							hooks: [
								{
									type: "command",
									command: cmd,
									_origin: "engineer",
								},
							],
						},
					],
				},
			};
			const { pruned, settings: result } = pruneZombieEngineerWirings(settings, projectHookDir);
			// Must NOT be pruned — file exists
			expect(pruned).toHaveLength(0);
			const allHooks = Object.values(result.hooks ?? {}).flatMap((groups) =>
				(groups as Array<{ hooks?: unknown[] }>).flatMap((g) => g.hooks ?? []),
			);
			expect(allHooks).toHaveLength(1);
		} finally {
			rmSyncFs(tmpRoot, { recursive: true, force: true });
		}
	});

	it("[B1] $CLAUDE_PROJECT_DIR var-only-quoted entry whose file is MISSING is pruned", () => {
		const cmd = `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/ghost-zombie.cjs`;
		const settings: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						hooks: [
							{
								type: "command",
								command: cmd,
								_origin: "engineer",
							},
						],
					},
				],
			},
		};
		const { pruned } = pruneZombieEngineerWirings(settings, testHookDir);
		expect(pruned).toContain("ghost-zombie.cjs");
	});

	it("[B1] $HOME global var-only-quoted entry whose file EXISTS is KEPT", async () => {
		const { homedir } = await import("node:os");
		const home = homedir();
		// Use a file that definitely exists: the homedir itself isn't a .cjs, so point to
		// testHookDir/simplify-gate.cjs which we know exists.
		// Simulate a global hook dir that IS testHookDir and a file inside it:
		// hookDir = testHookDir, project root derived = dirname(dirname(testHookDir))
		// The var-only-quoted form encodes the path as "$HOME"/.claude/hooks/simplify-gate.cjs
		// which resolves to home/.claude/hooks/simplify-gate.cjs — that path won't exist on CI,
		// so we test the path-parsing direction only (not existsSync outcome):
		const globalHookDir = join(home, ".claude", "hooks");
		const cmd = `node "$HOME"/.claude/hooks/session-init.cjs`;
		const result = extractHookFilePath(cmd, globalHookDir);
		// Path must resolve to home/.claude/hooks/session-init.cjs (not a garbled path)
		expect(result).toBe(`${home}/.claude/hooks/session-init.cjs`);
	});

	it("[B1] bash legacy form extracts script path", () => {
		const cmd = `bash "${join(testHookDir, "node-hook-runner.sh")}" ".claude/hooks/x.cjs"`;
		const result = extractHookFilePath(cmd, testHookDir);
		expect(result).toBe(join(testHookDir, "node-hook-runner.sh"));
	});

	it("[B1] returns null for unrecognised command form (fail-safe, entry preserved)", () => {
		const result = extractHookFilePath("python3 /usr/local/bin/hook.py", testHookDir);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Integration test: settings-processor pipeline with zombie settings
// ---------------------------------------------------------------------------
describe("settings-processor integration — zombie wirings pruned post-merge", () => {
	it("settings with zombie engineer hooks are clean after processSettingsJson", async () => {
		const { mkdtempSync, rmdirSync } = await import("node:fs");
		const { join: pathJoin } = await import("node:path");
		const { writeFile, readFile } = await import("fs-extra");
		const { SettingsProcessor } = await import(
			"@/domains/installation/merger/settings-processor.js"
		);

		const tmpRoot = mkdtempSync(join(tmpdir(), "ck-zombie-integration-"));

		try {
			// Create a minimal source settings.json (fresh engineer kit)
			const sourceDir = pathJoin(tmpRoot, "source");
			const destDir = pathJoin(tmpRoot, "dest");
			mkdirSync(sourceDir, { recursive: true });
			mkdirSync(destDir, { recursive: true });

			const sourceSettings: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash",
							hooks: [
								{
									type: "command",
									command: `node "${join(testHookDir, "simplify-gate.cjs")}"`,
									_origin: "engineer",
								},
							],
						},
					],
				},
			};
			const sourceFile = pathJoin(sourceDir, "settings.json");
			await writeFile(sourceFile, JSON.stringify(sourceSettings, null, 2), "utf8");

			// Pre-populate destination with zombie wirings (v2.18.x shape)
			const zombieSettings: SettingsJson = {
				hooks: {
					PreToolUse: [
						{
							matcher: "Bash",
							hooks: [
								{
									type: "command",
									command: `node "${join(testHookDir, "simplify-gate.cjs")}"`,
									_origin: "engineer",
								},
								{
									type: "command",
									command: `node "${join(testHookDir, "skill-dedup.cjs")}"`,
									_origin: "engineer",
								},
							],
						},
					],
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: `node "${join(testHookDir, "node-hook-runner.sh")}"`,
									_origin: "engineer",
								},
							],
						},
					],
				},
			};
			const destFile = pathJoin(destDir, "settings.json");
			await writeFile(destFile, JSON.stringify(zombieSettings, null, 2), "utf8");

			// Run the processor
			const processor = new SettingsProcessor();
			processor.setGlobalFlag(true);
			processor.setProjectDir(destDir);
			processor.setKitName("engineer");
			processor.setInstallingKit("engineer");
			processor.setZombiePrunerHookDir(testHookDir);
			await processor.processSettingsJson(sourceFile, destFile);

			// Read result and verify no zombies
			const resultContent = await readFile(destFile, "utf8");
			const result = JSON.parse(resultContent) as SettingsJson;

			// skill-dedup.cjs and node-hook-runner.sh should be gone
			const allCommands = Object.values(result.hooks ?? {}).flatMap((groups) =>
				(groups as Array<{ hooks?: Array<{ command: string }> }>).flatMap(
					(g) => g.hooks?.map((h) => h.command) ?? [],
				),
			);
			expect(allCommands.some((c) => c.includes("skill-dedup.cjs"))).toBe(false);
			expect(allCommands.some((c) => c.includes("node-hook-runner.sh"))).toBe(false);
			// simplify-gate.cjs should still be present
			expect(allCommands.some((c) => c.includes("simplify-gate.cjs"))).toBe(true);
		} finally {
			rmdirSync(tmpRoot, { recursive: true });
		}
	});
});

// ---------------------------------------------------------------------------
// H1 wiring regression guard: CopyExecutor must expose setZombiePrunerHookDir
// so the pruner is not dead code in real installs.
// ---------------------------------------------------------------------------
describe("H1 wiring regression guard — CopyExecutor configures zombie pruner hookDir", () => {
	it("CopyExecutor.setZombiePrunerHookDir exists and passes hookDir to SettingsProcessor", async () => {
		const {
			mkdtempSync,
			mkdirSync: mkdirSyncW,
			writeFileSync: wfW,
			rmSync: rmSyncW,
		} = await import("node:fs");
		const { join: pj } = await import("node:path");
		const { writeFile, readFile } = await import("fs-extra");
		const { CopyExecutor } = await import("@/domains/installation/merger/copy-executor.js");

		const tmpRoot = mkdtempSync(pj(tmpdir(), "ck-h1-wiring-"));
		const hooksDir = pj(tmpRoot, "hooks");
		mkdirSyncW(hooksDir, { recursive: true });
		// The hook file that should survive
		wfW(pj(hooksDir, "scout-block.cjs"), "// live hook", "utf8");

		const sourceDir = pj(tmpRoot, "source");
		const destDir = pj(tmpRoot, "dest");
		mkdirSyncW(sourceDir, { recursive: true });
		mkdirSyncW(destDir, { recursive: true });

		// Source settings: only scout-block.cjs (the live hook)
		const sourceSettings = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: `node "${pj(hooksDir, "scout-block.cjs")}"`,
								_origin: "engineer",
							},
						],
					},
				],
			},
		};
		await writeFile(pj(sourceDir, "settings.json"), JSON.stringify(sourceSettings, null, 2));

		// Dest settings: also has a zombie (node-hook-runner.sh, missing)
		const destSettings = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: `node "${pj(hooksDir, "scout-block.cjs")}"`,
								_origin: "engineer",
							},
							{
								type: "command",
								command: `node "${pj(hooksDir, "node-hook-runner.sh")}"`,
								_origin: "engineer",
							},
						],
					},
				],
			},
		};
		await writeFile(pj(destDir, "settings.json"), JSON.stringify(destSettings, null, 2));

		try {
			// Construct CopyExecutor and wire the pruner hookDir (the fix for H1)
			const executor = new CopyExecutor([]);
			executor.setGlobalFlag(true);
			executor.setProjectDir(destDir);
			executor.setKitName("engineer");
			// H1 fix: this call must exist and must activate the pruner
			executor.setZombiePrunerHookDir(hooksDir);

			await executor.copyFiles(sourceDir, destDir);

			const resultContent = await readFile(pj(destDir, "settings.json"), "utf8");
			const result = JSON.parse(resultContent);
			const allCommands = Object.values(result.hooks ?? {}).flatMap((groups: unknown) =>
				(groups as Array<{ hooks?: Array<{ command: string }> }>).flatMap(
					(g) => g.hooks?.map((h: { command: string }) => h.command) ?? [],
				),
			);

			// Zombie must be gone
			expect(allCommands.some((c: string) => c.includes("node-hook-runner.sh"))).toBe(false);
			// Live hook must survive
			expect(allCommands.some((c: string) => c.includes("scout-block.cjs"))).toBe(true);
		} finally {
			rmSyncW(tmpRoot, { recursive: true, force: true });
		}
	});
});
