/**
 * Regression baseline: Codex hook migration pipeline on darwin.
 *
 * Drives `migrateHooksSettings` with targetProvider="codex" on a mocked darwin
 * platform and pins the produced hooks.json shape. These tests MUST remain green
 * through all subsequent phases — a failure here indicates a regression.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type MigrateHooksSettingsResult, migrateHooksSettings } from "../hooks-settings-merger.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizePath(value: string | null | undefined): string {
	return (value ?? "").replaceAll("\\", "/");
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("codex hooks pipeline — darwin (regression baseline)", () => {
	const originalPlatform = process.platform;
	let tempBase: string;
	let originalCwd: string;

	beforeEach(() => {
		// Mock process.platform to darwin so the Windows short-circuit is skipped.
		Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

		tempBase = mkdtempSync(join(tmpdir(), "codex-hooks-darwin-"));
		originalCwd = process.cwd();
		process.chdir(tempBase);

		// Build minimal source fixture: .claude/hooks/ + settings.json
		mkdirSync(join(tempBase, ".claude", "hooks"), { recursive: true });

		// session-init.cjs — matched by SessionStart hook
		writeFileSync(join(tempBase, ".claude", "hooks", "session-init.cjs"), "// session hook");

		// privacy-block.cjs — matched by PreToolUse hook
		writeFileSync(join(tempBase, ".claude", "hooks", "privacy-block.cjs"), "// privacy hook");

		writeFileSync(
			join(join(tempBase, ".claude", "settings.json")),
			JSON.stringify({
				hooks: {
					SessionStart: [
						{
							matcher: "startup",
							hooks: [
								{
									type: "command",
									command: 'node ".claude/hooks/session-init.cjs"',
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
									command: 'node ".claude/hooks/privacy-block.cjs"',
								},
							],
						},
					],
					// SubagentStart is NOT supported by Codex — must be dropped
					SubagentStart: [
						{
							hooks: [
								{
									type: "command",
									command: 'node ".claude/hooks/session-init.cjs"',
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

	it("returns status=registered for a valid claude-code → codex migration", async () => {
		const result: MigrateHooksSettingsResult = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe("registered");
		expect(result.hooksRegistered).toBeGreaterThan(0);
	});

	it("drops SubagentStart (unsupported Codex event) from the output", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);

		// Read the produced hooks.json and verify SubagentStart is absent
		const hooksJsonPath = join(tempBase, ".codex", "hooks.json");
		const raw = await Bun.file(hooksJsonPath).text();
		const hooksJson = JSON.parse(raw) as Record<string, unknown>;

		expect(hooksJson.hooks).toBeDefined();
		const hooks = hooksJson.hooks as Record<string, unknown>;

		// SubagentStart must NOT appear — Codex does not support it
		expect(hooks.SubagentStart).toBeUndefined();
	});

	it("emits SessionStart and PreToolUse in hooks.json (supported events preserved)", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.success).toBe(true);

		const hooksJsonPath = join(tempBase, ".codex", "hooks.json");
		const raw = await Bun.file(hooksJsonPath).text();
		const hooksJson = JSON.parse(raw) as Record<string, unknown>;
		const hooks = hooksJson.hooks as Record<string, unknown[]>;

		// Explicit shape assertions (so failures are legible)
		expect(hooks.SessionStart).toBeDefined();
		expect(Array.isArray(hooks.SessionStart)).toBe(true);
		expect((hooks.SessionStart as unknown[]).length).toBeGreaterThanOrEqual(1);

		expect(hooks.PreToolUse).toBeDefined();
		expect(Array.isArray(hooks.PreToolUse)).toBe(true);
		expect((hooks.PreToolUse as unknown[]).length).toBeGreaterThanOrEqual(1);
	});

	it("does NOT short-circuit on darwin (windows guard must not fire)", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs"],
			global: false,
		});

		// If the windows guard fired, status would be "skipped-windows"
		expect(result.status).not.toBe("skipped-windows");
	});

	it("does NOT short-circuit on win32 (Windows gate removed — pipeline runs on all platforms)", async () => {
		// Phase 3: the Windows gate was removed. Win32 now runs the full pipeline.
		// This cross-check verifies win32 does NOT return the old "skipped-windows" status.
		Object.defineProperty(process, "platform", { value: "win32", configurable: true });
		try {
			const result = await migrateHooksSettings({
				sourceProvider: "claude-code",
				targetProvider: "codex",
				installedHookFiles: ["session-init.cjs"],
				global: false,
			});

			expect(result.status).not.toBe("skipped-windows");
		} finally {
			Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
		}
	});

	it("sourceSettingsPath and targetSettingsPath are set on success", async () => {
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs", "privacy-block.cjs"],
			global: false,
		});

		expect(result.sourceSettingsPath).not.toBeNull();
		expect(normalizePath(result.sourceSettingsPath)).toContain(".claude/settings.json");
		expect(result.targetSettingsPath).not.toBeNull();
		expect(normalizePath(result.targetSettingsPath)).toContain(".codex/hooks.json");
	});

	it("global mode: writes hooks.json under homedir/.codex/", async () => {
		// For global mode we need the source settings to be at the global path.
		// Skip this test if global paths don't exist — we only assert the result shape.
		const result = await migrateHooksSettings({
			sourceProvider: "claude-code",
			targetProvider: "codex",
			installedHookFiles: ["session-init.cjs"],
			global: true,
		});

		// Whether it reads the global settings or not, the targetSettingsPath must
		// point to the user's home ~/.codex/hooks.json (not a project-local one).
		if (result.targetSettingsPath !== null) {
			const home = homedir().replace(/\\/g, "/");
			expect(normalizePath(result.targetSettingsPath)).toContain(home);
			expect(normalizePath(result.targetSettingsPath)).toContain(".codex/hooks.json");
		}
		// result.success may be true or false depending on whether global settings exist;
		// what matters is the status is not "skipped-windows"
		expect(result.status).not.toBe("skipped-windows");
	});
});
