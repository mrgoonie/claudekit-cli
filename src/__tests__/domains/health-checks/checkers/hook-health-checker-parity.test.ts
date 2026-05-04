/**
 * hook-health-checker-parity.test.ts
 *
 * Checker/fixer parity tests for the hook command path checker.
 *
 * Validates that `ck doctor --fix` fully resolves everything that
 * `ck doctor` flags — the root cause of issue #767 (anhhoangpham report:
 * 16 stale entries remain after --fix).
 *
 * Uses `expectFixerConvergence` from the shared helper to enforce the
 * detect→fix→detect convergence contract.
 *
 * @see src/__tests__/helpers/checker-fixer-parity.ts
 * @see docs/code-standards.md — "Checker/Fixer Parity for autoFixable health checks"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectFixerConvergence } from "@/__tests__/helpers/checker-fixer-parity.js";
import {
	type ClaudeSettingsFile,
	checkHookCommandPaths,
	findStaleHookCommandsInFile,
} from "@/domains/health-checks/checkers/hook-health-checker.js";

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

interface TestContext {
	tempDir: string;
	projectDir: string;
	originalCkTestHome: string | undefined;
}

async function setupTestContext(): Promise<TestContext> {
	const tempDir = join(
		tmpdir(),
		`hook-parity-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	const projectDir = join(tempDir, "project");
	await mkdir(projectDir, { recursive: true });
	const originalCkTestHome = process.env.CK_TEST_HOME;
	process.env.CK_TEST_HOME = tempDir;
	return { tempDir, projectDir, originalCkTestHome };
}

async function teardownTestContext(ctx: TestContext): Promise<void> {
	await rm(ctx.tempDir, { recursive: true, force: true });
	if (ctx.originalCkTestHome === undefined) {
		// Must use `delete` — assigning `undefined` to process.env coerces it to
		// the string "undefined", causing test pollution (PathResolver would see
		// CK_TEST_HOME as a non-empty string instead of unset).
		// biome-ignore lint/performance/noDelete: process.env semantics require delete to truly unset
		delete process.env.CK_TEST_HOME;
	} else {
		process.env.CK_TEST_HOME = ctx.originalCkTestHome;
	}
}

/**
 * Build a settings.local.json fixture with 16 stale hook command paths,
 * mirroring the exact user report (anhhoangpham — issue #767).
 *
 * Mixes:
 * - 8 PreToolUse nested hooks (raw-relative)
 * - 4 PostToolUse nested hooks (raw-relative)
 * - 2 UserPromptSubmit flat commands (raw-relative)
 * - 2 PreToolUse flat commands (raw-relative)
 * Total: 16 stale entries
 */
function buildSixteenStaleHooksFixture(): object {
	const makeNestedHook = (script: string) => ({
		type: "command",
		command: `node .claude/hooks/${script}`,
	});
	const makeFlatCommand = (script: string) => ({
		type: "command",
		command: `node .claude/hooks/${script}`,
	});

	return {
		hooks: {
			PreToolUse: [
				{
					matcher: "Read",
					hooks: [makeNestedHook("scout-block.cjs"), makeNestedHook("privacy-block.cjs")],
				},
				{
					matcher: "Write",
					hooks: [makeNestedHook("write-guard.cjs"), makeNestedHook("path-validator.cjs")],
				},
				{
					matcher: "Bash",
					hooks: [makeNestedHook("bash-guard.cjs"), makeNestedHook("command-filter.cjs")],
				},
				{
					matcher: "Edit",
					hooks: [makeNestedHook("edit-guard.cjs"), makeNestedHook("ownership-check.cjs")],
				},
				// flat commands
				makeFlatCommand("pre-tool-logger.cjs"),
				makeFlatCommand("pre-tool-audit.cjs"),
			],
			PostToolUse: [
				{
					matcher: "Read",
					hooks: [makeNestedHook("post-read-tracker.cjs")],
				},
				{
					matcher: "Write",
					hooks: [makeNestedHook("post-write-tracker.cjs")],
				},
				{
					matcher: "Bash",
					hooks: [makeNestedHook("post-bash-tracker.cjs")],
				},
				{
					matcher: "Edit",
					hooks: [makeNestedHook("post-edit-tracker.cjs")],
				},
			],
			UserPromptSubmit: [
				makeFlatCommand("session-state.cjs"),
				makeFlatCommand("token-counter.cjs"),
			],
		},
	};
}

// ---------------------------------------------------------------------------
// Parity tests
// ---------------------------------------------------------------------------

describe("hook-health-checker parity: checkHookCommandPaths detect→fix→detect convergence", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await setupTestContext();
	});

	afterEach(async () => {
		await teardownTestContext(ctx);
	});

	test("fixer converges: 16 stale entries all resolved after --fix (issue #767 regression)", async () => {
		const settingsPath = join(ctx.projectDir, ".claude", "settings.local.json");
		await mkdir(join(ctx.projectDir, ".claude"), { recursive: true });
		await writeFile(settingsPath, JSON.stringify(buildSixteenStaleHooksFixture()));

		// Build the settingsFile descriptor the same way the checker does.
		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		await expectFixerConvergence({
			// detect: read file from disk via the exported canonical function
			detect: async (sf) => findStaleHookCommandsInFile(sf),
			// fix: invoke the --fix path via the public checkHookCommandPaths API
			fix: async (sf) => {
				const result = await checkHookCommandPaths(ctx.projectDir);
				expect(result.fix).toBeDefined();
				const fixResult = await result.fix?.execute();
				expect(fixResult?.success).toBe(true);
				// Suppress "sf unused" — the fixture IS the settingsFile descriptor used by detect.
				void sf;
			},
			fixture: settingsFile,
		});
	});

	test("initial detection finds exactly 16 stale entries before fix", async () => {
		const settingsPath = join(ctx.projectDir, ".claude", "settings.local.json");
		await mkdir(join(ctx.projectDir, ".claude"), { recursive: true });
		await writeFile(settingsPath, JSON.stringify(buildSixteenStaleHooksFixture()));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		const findings = await findStaleHookCommandsInFile(settingsFile);
		expect(findings).toHaveLength(16);
	});

	test("all 16 findings are raw-relative issues", async () => {
		const settingsPath = join(ctx.projectDir, ".claude", "settings.local.json");
		await mkdir(join(ctx.projectDir, ".claude"), { recursive: true });
		await writeFile(settingsPath, JSON.stringify(buildSixteenStaleHooksFixture()));

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		const findings = await findStaleHookCommandsInFile(settingsFile);
		for (const finding of findings) {
			expect(finding.issue).toBe("raw-relative");
		}
	});

	test("repaired commands all use canonical $CLAUDE_PROJECT_DIR form", async () => {
		const settingsPath = join(ctx.projectDir, ".claude", "settings.local.json");
		await mkdir(join(ctx.projectDir, ".claude"), { recursive: true });
		await writeFile(settingsPath, JSON.stringify(buildSixteenStaleHooksFixture()));

		const result = await checkHookCommandPaths(ctx.projectDir);
		await result.fix?.execute();

		// After fix, all expected values should be in canonical form
		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};
		const remaining = await findStaleHookCommandsInFile(settingsFile);
		expect(remaining).toHaveLength(0);

		// Verify the file contains canonical paths
		const repaired = JSON.parse(await Bun.file(settingsPath).text()) as {
			hooks: {
				PreToolUse: Array<{ hooks?: Array<{ command: string }>; command?: string }>;
			};
		};
		// Check first nested hook has canonical form
		const firstNestedHook = repaired.hooks.PreToolUse[0]?.hooks?.[0];
		expect(firstNestedHook?.command).toMatch(/\$CLAUDE_PROJECT_DIR/);
	});
});

describe("hook-health-checker parity: expectFixerConvergence helper catches divergence", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await setupTestContext();
	});

	afterEach(async () => {
		await teardownTestContext(ctx);
	});

	test("helper throws when fixer is a no-op (divergence proof)", async () => {
		const settingsPath = join(ctx.projectDir, ".claude", "settings.local.json");
		await mkdir(join(ctx.projectDir, ".claude"), { recursive: true });
		await writeFile(
			settingsPath,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: "Read",
							hooks: [{ type: "command", command: "node .claude/hooks/scout-block.cjs" }],
						},
					],
				},
			}),
		);

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		// A no-op fixer should cause expectFixerConvergence to fail
		await expect(
			expectFixerConvergence({
				detect: async (sf) => findStaleHookCommandsInFile(sf),
				fix: async (_sf) => {
					// Intentionally does nothing — simulates a broken fixer
				},
				fixture: settingsFile,
			}),
		).rejects.toThrow();
	});

	test("helper throws when fixture has no stale entries (vacuous fixture guard)", async () => {
		const settingsPath = join(ctx.projectDir, ".claude", "settings.local.json");
		await mkdir(join(ctx.projectDir, ".claude"), { recursive: true });
		await writeFile(
			settingsPath,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: "Read",
							hooks: [
								{
									type: "command",
									// Already canonical — no stale entries
									command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/scout-block.cjs',
								},
							],
						},
					],
				},
			}),
		);

		const settingsFile: ClaudeSettingsFile = {
			path: settingsPath,
			label: "project settings.local.json",
			root: "$CLAUDE_PROJECT_DIR",
		};

		// expectFixerConvergence should throw because before.length === 0
		await expect(
			expectFixerConvergence({
				detect: async (sf) => findStaleHookCommandsInFile(sf),
				fix: async (_sf) => {
					// no-op
				},
				fixture: settingsFile,
			}),
		).rejects.toThrow();
	});
});
