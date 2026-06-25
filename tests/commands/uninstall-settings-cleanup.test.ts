import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cleanupUninstalledSettings } from "@/commands/uninstall/settings-cleanup.js";
import type { SettingsJson } from "@/domains/config/settings-merger.js";
import { type TestPaths, setupTestPaths } from "../helpers/test-paths.js";

/**
 * Unit tests for the uninstall settings-cleanup module (issue #898).
 * Verifies that uninstall reverses the hook/MCP registrations install wrote into
 * settings.json and clears .ck.json tracking, while preserving user-authored and
 * shared remaining-kit entries.
 */
describe("cleanupUninstalledSettings", () => {
	let testPaths: TestPaths;
	let claudeDir: string;

	beforeEach(async () => {
		testPaths = setupTestPaths();
		// Use a dedicated install dir so the helper's pre-seeded global .claude stays clean
		claudeDir = join(testPaths.testHome, "install", ".claude");
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(() => {
		testPaths.cleanup();
	});

	const settingsPath = () => join(claudeDir, "settings.json");
	const ckJsonPath = () => join(claudeDir, ".ck.json");

	async function writeSettings(settings: SettingsJson): Promise<void> {
		await writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf-8");
	}

	async function writeCkJson(data: unknown): Promise<void> {
		await writeFile(ckJsonPath(), JSON.stringify(data, null, 2), "utf-8");
	}

	function readSettings(): SettingsJson {
		return JSON.parse(readFileSync(settingsPath(), "utf-8")) as SettingsJson;
	}

	/** Flatten all hook command strings for an event, across HookConfig and HookEntry shapes. */
	function hookCommands(event: string): string[] {
		const entries = (readSettings().hooks?.[event] ?? []) as Array<Record<string, unknown>>;
		return entries.flatMap((entry) => {
			if (Array.isArray(entry.hooks)) {
				return (entry.hooks as Array<{ command?: string }>).map((h) => h.command ?? "");
			}
			return [entry.command as string];
		});
	}

	test("removes CK-installed hooks while preserving user hooks", async () => {
		await writeSettings({
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{ type: "command", command: 'node "$HOME/.claude/hooks/ck-guard.cjs"' },
							{ type: "command", command: 'node "$HOME/.claude/hooks/user-guard.cjs"' },
						],
					},
				],
			},
		});
		await writeCkJson({
			kits: {
				engineer: {
					installedSettings: {
						hooks: ['node "$HOME/.claude/hooks/ck-guard.cjs"'],
						mcpServers: [],
					},
				},
			},
		});

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [] });

		expect(result.hooksRemoved).toBe(1);
		expect(hookCommands("PreToolUse")).toEqual(['node "$HOME/.claude/hooks/user-guard.cjs"']);
	});

	test("matches tracked hooks across path-format differences (tilde vs $HOME)", async () => {
		await writeSettings({
			hooks: {
				SessionStart: [
					{ hooks: [{ type: "command", command: "node ~/.claude/hooks/session.cjs" }] },
				],
			},
		});
		await writeCkJson({
			kits: {
				engineer: {
					installedSettings: {
						hooks: ['node "$HOME/.claude/hooks/session.cjs"'],
						mcpServers: [],
					},
				},
			},
		});

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [] });

		expect(result.hooksRemoved).toBe(1);
		// The only hook was removed -> settings became empty -> file deleted
		expect(result.settingsFileRemoved).toBe(true);
		expect(existsSync(settingsPath())).toBe(false);
	});

	test("removes CK MCP servers while preserving user servers", async () => {
		await writeSettings({
			mcp: {
				servers: {
					qdrant: { command: "qdrant" },
					"user-server": { command: "custom" },
				},
			},
		});
		await writeCkJson({
			kits: {
				engineer: { installedSettings: { hooks: [], mcpServers: ["qdrant"] } },
			},
		});

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [] });

		expect(result.mcpServersRemoved).toBe(1);
		const settings = readSettings();
		expect(settings.mcp?.servers).toEqual({ "user-server": { command: "custom" } });
	});

	test("kit-scoped uninstall preserves hooks shared with a remaining kit", async () => {
		const sharedHook = 'node "$HOME/.claude/hooks/shared.cjs"';
		const engineerHook = 'node "$HOME/.claude/hooks/engineer-only.cjs"';
		await writeSettings({
			hooks: {
				PreToolUse: [
					{
						hooks: [
							{ type: "command", command: sharedHook },
							{ type: "command", command: engineerHook },
						],
					},
				],
			},
		});
		await writeCkJson({
			kits: {
				engineer: { installedSettings: { hooks: [sharedHook, engineerHook], mcpServers: [] } },
				marketing: { installedSettings: { hooks: [sharedHook], mcpServers: [] } },
			},
		});

		const result = await cleanupUninstalledSettings(claudeDir, {
			kit: "engineer",
			remainingKits: ["marketing"],
		});

		expect(result.hooksRemoved).toBe(1);
		expect(hookCommands("PreToolUse")).toEqual([sharedHook]);

		// .ck.json keeps the marketing entry, drops engineer
		const ckJson = JSON.parse(readFileSync(ckJsonPath(), "utf-8"));
		expect(ckJson.kits.engineer).toBeUndefined();
		expect(ckJson.kits.marketing).toBeDefined();
		expect(result.ckJsonRemoved).toBe(false);
	});

	test("deletes .ck.json on full uninstall when no kits remain", async () => {
		await writeSettings({
			hooks: {
				SessionStart: [{ hooks: [{ type: "command", command: "node ~/.claude/hooks/a.cjs" }] }],
			},
		});
		await writeCkJson({
			kits: {
				engineer: { installedSettings: { hooks: ["node ~/.claude/hooks/a.cjs"], mcpServers: [] } },
			},
		});

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [] });

		expect(result.ckJsonRemoved).toBe(true);
		expect(existsSync(ckJsonPath())).toBe(false);
		// settings.json had only the CK hook -> file removed once empty
		expect(result.settingsFileRemoved).toBe(true);
		expect(existsSync(settingsPath())).toBe(false);
	});

	test("preserves top-level hook-disable prefs in .ck.json after full uninstall", async () => {
		await writeSettings({ hooks: {} });
		await writeCkJson({
			hooks: { "some-hook": false },
			kits: { engineer: { installedSettings: { hooks: [], mcpServers: [] } } },
		});

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [] });

		expect(result.ckJsonRemoved).toBe(false);
		const ckJson = JSON.parse(readFileSync(ckJsonPath(), "utf-8"));
		expect(ckJson.hooks).toEqual({ "some-hook": false });
		expect(ckJson.kits).toBeUndefined();
	});

	test("no-op (zero result) when .ck.json is absent", async () => {
		await writeSettings({
			hooks: {
				SessionStart: [{ hooks: [{ type: "command", command: "node ~/.claude/hooks/a.cjs" }] }],
			},
		});

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [] });

		expect(result).toEqual({
			hooksRemoved: 0,
			mcpServersRemoved: 0,
			settingsFileRemoved: false,
			ckJsonRemoved: false,
		});
		// settings.json untouched
		expect(existsSync(settingsPath())).toBe(true);
	});

	test("dry-run computes counts without mutating files", async () => {
		await writeSettings({
			hooks: {
				SessionStart: [{ hooks: [{ type: "command", command: "node ~/.claude/hooks/a.cjs" }] }],
			},
			mcp: { servers: { qdrant: { command: "qdrant" } } },
		});
		await writeCkJson({
			kits: {
				engineer: {
					installedSettings: { hooks: ["node ~/.claude/hooks/a.cjs"], mcpServers: ["qdrant"] },
				},
			},
		});
		const settingsBefore = readFileSync(settingsPath(), "utf-8");
		const ckJsonBefore = readFileSync(ckJsonPath(), "utf-8");

		const result = await cleanupUninstalledSettings(claudeDir, { remainingKits: [], dryRun: true });

		expect(result.hooksRemoved).toBe(1);
		expect(result.mcpServersRemoved).toBe(1);
		expect(readFileSync(settingsPath(), "utf-8")).toBe(settingsBefore);
		expect(readFileSync(ckJsonPath(), "utf-8")).toBe(ckJsonBefore);
	});
});
