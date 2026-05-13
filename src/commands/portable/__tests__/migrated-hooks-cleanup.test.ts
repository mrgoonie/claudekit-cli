import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupMigratedHooksForProviders } from "../migrated-hooks-cleanup.js";

describe("cleanupMigratedHooksForProviders", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		originalCwd = process.cwd();
		testDir = await mkdtemp(join(tmpdir(), "ck-migrated-hooks-cleanup-"));
		process.chdir(testDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(testDir, { recursive: true, force: true });
	});

	it("removes migrated Codex generated-context hooks while preserving other hooks", async () => {
		const hooksDir = join(testDir, ".codex", "hooks");
		const hookPath = join(hooksDir, "session-init.cjs");
		const contextHookPath = join(hooksDir, "usage-context-awareness.cjs");
		const safeHookPath = join(hooksDir, "privacy-block.cjs");
		await mkdir(hooksDir, { recursive: true });
		await writeFile(hookPath, "// migrated hook");
		await writeFile(contextHookPath, "// migrated hook");
		await writeFile(safeHookPath, "// safe hook");
		await writeFile(
			join(testDir, ".codex", "hooks.json"),
			JSON.stringify(
				{
					hooks: {
						SessionStart: [
							{
								hooks: [
									{ type: "command", command: `node "${hookPath}"` },
									{ type: "command", command: `node "${contextHookPath}"` },
									{ type: "command", command: `node "${safeHookPath}"` },
									{ type: "command", command: "echo user-owned" },
								],
							},
						],
					},
				},
				null,
				2,
			),
		);

		const results = await cleanupMigratedHooksForProviders(["codex"], {
			global: false,
			pruneRegistry: false,
		});

		expect(results[0]?.hooksPruned).toBe(2);
		expect(results[0]?.filesRemoved).toBe(2);
		expect(existsSync(hookPath)).toBe(false);
		expect(existsSync(contextHookPath)).toBe(false);
		expect(existsSync(safeHookPath)).toBe(true);

		const hooksJson = JSON.parse(await readFile(join(testDir, ".codex", "hooks.json"), "utf8"));
		expect(hooksJson.hooks.SessionStart[0].hooks).toEqual([
			{ type: "command", command: `node "${safeHookPath}"` },
			{ type: "command", command: "echo user-owned" },
		]);
	});

	it("prunes Claude Code hook registrations without deleting the statusline runner", async () => {
		const hooksDir = join(testDir, ".claude", "hooks");
		const runnerPath = join(hooksDir, "node-hook-runner.sh");
		const hookPath = join(hooksDir, "session-init.cjs");
		const safeHookPath = join(hooksDir, "privacy-block.cjs");
		await mkdir(hooksDir, { recursive: true });
		await writeFile(runnerPath, "#!/bin/sh\n");
		await writeFile(hookPath, "// migrated hook");
		await writeFile(safeHookPath, "// safe hook");
		await writeFile(
			join(testDir, ".claude", "settings.json"),
			JSON.stringify(
				{
					statusLine: {
						command: "bash .claude/hooks/node-hook-runner.sh .claude/statusline.cjs",
					},
					hooks: {
						SessionStart: [
							{
								hooks: [
									{
										type: "command",
										command:
											"bash .claude/hooks/node-hook-runner.sh .claude/hooks/session-init.cjs",
									},
								],
							},
						],
						PreToolUse: [
							{
								hooks: [
									{
										type: "command",
										command:
											"bash .claude/hooks/node-hook-runner.sh .claude/hooks/privacy-block.cjs",
									},
								],
							},
						],
					},
				},
				null,
				2,
			),
		);

		const results = await cleanupMigratedHooksForProviders(["claude-code"], {
			global: false,
			pruneRegistry: false,
		});

		expect(results[0]?.hooksPruned).toBe(1);
		expect(existsSync(hookPath)).toBe(false);
		expect(existsSync(safeHookPath)).toBe(true);
		expect(existsSync(runnerPath)).toBe(true);

		const settings = JSON.parse(await readFile(join(testDir, ".claude", "settings.json"), "utf8"));
		expect(settings.hooks.SessionStart).toBeUndefined();
		expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("privacy-block.cjs");
		expect(settings.statusLine.command).toContain("node-hook-runner.sh");
	});
});
