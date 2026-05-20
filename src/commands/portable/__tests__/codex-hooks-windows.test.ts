/**
 * Phase 3 — Windows integration test for Codex hook migration pipeline.
 *
 * Verifies that with the Windows short-circuit gate removed, the full
 * migrateHooksSettings pipeline runs successfully on win32, producing
 * hooks.json, config.toml [features] block, and wrapper .cjs files.
 *
 * Platform is stubbed via process.platform override; filesystem uses a
 * real tmp dir so all I/O assertions are against actual written files.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { type MigrateHooksSettingsResult, migrateHooksSettings } from "../hooks-settings-merger.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizePath(value: string | null | undefined): string {
	return (value ?? "").replaceAll("\\", "/");
}

function readJson<T = Record<string, unknown>>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T;
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("codex hooks pipeline — win32 (Phase 3: gate removed)", () => {
	const originalPlatform = process.platform;
	let tempBase: string;
	let originalCwd: string;

	beforeEach(() => {
		// Stub process.platform to win32 so Windows-specific code paths are exercised
		Object.defineProperty(process, "platform", { value: "win32", configurable: true });

		tempBase = mkdtempSync(join(tmpdir(), "codex-hooks-win32-"));
		originalCwd = process.cwd();
		process.chdir(tempBase);

		// Build source fixture: .claude/hooks/ + settings.json with 3 hooks across
		// PreToolUse, UserPromptSubmit (mapped → PostToolUse fallback), SessionStart
		mkdirSync(join(tempBase, ".claude", "hooks"), { recursive: true });

		writeFileSync(join(tempBase, ".claude", "hooks", "session-init.cjs"), "// session hook");
		writeFileSync(join(tempBase, ".claude", "hooks", "privacy-block.cjs"), "// privacy hook");
		writeFileSync(join(tempBase, ".claude", "hooks", "subagent-init.cjs"), "// subagent hook");

		const homeDir = homedir();
		writeFileSync(
			join(tempBase, ".claude", "settings.json"),
			JSON.stringify({
				hooks: {
					SessionStart: [
						{
							matcher: "startup",
							hooks: [
								{
									type: "command",
									command: `node "${homeDir}/.claude/hooks/session-init.cjs"`,
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
									command: `node "${homeDir}/.claude/hooks/privacy-block.cjs"`,
								},
							],
						},
					],
					// SubagentStart is unsupported in Codex — must be dropped by pipeline
					SubagentStart: [
						{
							hooks: [
								{
									type: "command",
									command: `node "${homeDir}/.claude/hooks/subagent-init.cjs"`,
								},
							],
						},
					],
				},
			}),
		);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tempBase, { recursive: true, force: true });
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
			configurable: true,
		});
	});

	it("returns success with status != skipped-windows (gate removed)", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		// Gate removed: win32 must NOT return the old short-circuit status
		expect(result.status).not.toBe("skipped-windows");
		expect(result.success).toBe(true);
		expect(result.hooksRegistered).toBeGreaterThanOrEqual(1);
	});

	it("writes hooks.json under .codex/", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);

		const hooksJsonPath = join(tempBase, ".codex", "hooks.json");
		expect(existsSync(hooksJsonPath)).toBe(true);

		const hooksJson = readJson(hooksJsonPath);
		expect(hooksJson.hooks).toBeDefined();
	});

	it("writes [features] hooks = true in .codex/config.toml", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);

		const tomlPath = join(tempBase, ".codex", "config.toml");
		expect(existsSync(tomlPath)).toBe(true);

		const tomlContent = readFileSync(tomlPath, "utf8");
		// Must contain the [features] section with hooks = true
		expect(tomlContent).toContain("[features]");
		expect(tomlContent).toContain("hooks = true");
	});

	it("hook commands in hooks.json start with node (Phase 2 wrapper contract)", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);

		const hooksJsonPath = join(tempBase, ".codex", "hooks.json");
		const hooksJson = readJson(hooksJsonPath) as {
			hooks: Record<string, Array<{ matcher?: string; hooks?: Array<{ command?: string }> }>>;
		};
		const hooks = hooksJson.hooks;

		// Gather all command fields — hooks.json structure is:
		//   { hooks: { EventName: [ { matcher, hooks: [ { command, ... } ] } ] } }
		const allCommands: string[] = [];
		for (const groups of Object.values(hooks)) {
			for (const group of groups) {
				for (const entry of group.hooks ?? []) {
					if (entry.command) {
						allCommands.push(entry.command);
					}
				}
			}
		}

		expect(allCommands.length).toBeGreaterThanOrEqual(1);
		// Phase 2 contract: all commands start with `node "`
		for (const cmd of allCommands) {
			expect(cmd).toMatch(/^node "/);
		}
	});

	it("drops SubagentStart (unsupported Codex event) on Windows too", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);

		const hooksJsonPath = join(tempBase, ".codex", "hooks.json");
		const hooksJson = readJson<{ hooks: Record<string, unknown> }>(hooksJsonPath);
		// SubagentStart must not appear — Codex does not support it
		expect(hooksJson.hooks.SubagentStart).toBeUndefined();
	});

	it("targetSettingsPath points into .codex/hooks.json", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);
		expect(result.targetSettingsPath).not.toBeNull();
		expect(normalizePath(result.targetSettingsPath)).toContain(".codex/hooks.json");
	});
});
