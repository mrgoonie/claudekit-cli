import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsProcessor } from "@/domains/installation/merger/settings-processor.js";

function toPosix(path: string): string {
	return path.replace(/\\/g, "/");
}

describe("SettingsProcessor custom global dir support", () => {
	const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
	const originalCkTestHome = process.env.CK_TEST_HOME;
	let testDir: string;
	let customClaudeDir: string;
	let sourceFile: string;
	let destFile: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "settings-processor-"));
		customClaudeDir = join(testDir, "persisted-claude-config");
		sourceFile = join(testDir, "source-settings.json");
		destFile = join(customClaudeDir, "settings.json");
		await mkdir(customClaudeDir, { recursive: true });
		// CK_TEST_HOME takes priority over CLAUDE_CONFIG_DIR in PathResolver.getGlobalKitDir(),
		// so clear it to prevent env leakage from other tests running in the same Bun process.
		// Must use delete — Node.js coerces `= undefined` to the string "undefined".
		// biome-ignore lint/performance/noDelete: process.env requires delete to actually unset
		delete process.env.CK_TEST_HOME;
		process.env.CLAUDE_CONFIG_DIR = customClaudeDir;
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		if (originalClaudeConfigDir !== undefined) {
			process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
		} else {
			// biome-ignore lint/performance/noDelete: process.env requires delete to actually unset
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		if (originalCkTestHome !== undefined) {
			process.env.CK_TEST_HOME = originalCkTestHome;
		} else {
			// biome-ignore lint/performance/noDelete: process.env requires delete to actually unset
			delete process.env.CK_TEST_HOME;
		}
	});

	function createProcessor(): SettingsProcessor {
		const processor = new SettingsProcessor();
		processor.setGlobalFlag(true);
		processor.setProjectDir(customClaudeDir);
		processor.setKitName("engineer");
		return processor;
	}

	async function writeHookSourceSettings(): Promise<void> {
		await writeFile(
			sourceFile,
			JSON.stringify(
				{
					hooks: {
						SessionStart: [
							{
								matcher: "startup|resume|clear|compact",
								hooks: [
									{ type: "command", command: "node .claude/hooks/session-init.cjs" },
									{
										type: "command",
										command: "node .claude/hooks/usage-quota-cache-refresh.cjs",
									},
								],
							},
						],
						Stop: [
							{
								hooks: [{ type: "command", command: "node .claude/hooks/session-state.cjs" }],
							},
						],
					},
				},
				null,
				2,
			),
		);
	}

	function collectCommands(settings: {
		hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
	}): string[] {
		return Object.values(settings.hooks ?? {}).flatMap((groups) =>
			groups.flatMap((group) => group.hooks?.map((hook) => hook.command ?? "") ?? []),
		);
	}

	it("writes fresh global hook commands to the active CLAUDE_CONFIG_DIR path", async () => {
		await writeFile(
			sourceFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/task-completed-handler.cjs",
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

		const processor = createProcessor();
		await processor.processSettingsJson(sourceFile, destFile);

		const writtenSettings = JSON.parse(await readFile(destFile, "utf-8")) as {
			hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> };
		};

		expect(writtenSettings.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
			`node "${toPosix(customClaudeDir)}/hooks/task-completed-handler.cjs"`,
		);
	});

	it("restore mode re-adds CK hooks that installed-settings history would otherwise treat as user-deleted", async () => {
		await writeHookSourceSettings();
		await writeFile(destFile, JSON.stringify({ hooks: {} }, null, 2));
		await writeFile(
			join(customClaudeDir, ".ck.json"),
			JSON.stringify(
				{
					kits: {
						engineer: {
							installedSettings: {
								hooks: [
									"node $HOME/.claude/hooks/session-init.cjs",
									"node $HOME/.claude/hooks/usage-quota-cache-refresh.cjs",
									"node $HOME/.claude/hooks/session-state.cjs",
								],
								mcpServers: [],
							},
						},
					},
				},
				null,
				2,
			),
		);

		const processor = createProcessor();
		processor.setRestoreCkHooks(true);
		await processor.processSettingsJson(sourceFile, destFile);

		const merged = JSON.parse(await readFile(destFile, "utf-8"));
		const commands = collectCommands(merged);

		expect(commands.some((command) => command.includes("session-init.cjs"))).toBe(true);
		expect(commands.some((command) => command.includes("usage-quota-cache-refresh.cjs"))).toBe(
			true,
		);
		expect(commands.some((command) => command.includes("session-state.cjs"))).toBe(true);
	});

	it("restore mode does not re-add hooks explicitly disabled in .ck.json", async () => {
		await writeHookSourceSettings();
		await writeFile(destFile, JSON.stringify({ hooks: {} }, null, 2));
		await writeFile(
			join(customClaudeDir, ".ck.json"),
			JSON.stringify(
				{
					hooks: {
						"session-state": false,
					},
					kits: {
						engineer: {
							installedSettings: {
								hooks: [
									"node $HOME/.claude/hooks/session-init.cjs",
									"node $HOME/.claude/hooks/session-state.cjs",
								],
								mcpServers: [],
							},
						},
					},
				},
				null,
				2,
			),
		);

		const processor = createProcessor();
		processor.setRestoreCkHooks(true);
		await processor.processSettingsJson(sourceFile, destFile);

		const merged = JSON.parse(await readFile(destFile, "utf-8"));
		const commands = collectCommands(merged);

		expect(commands.some((command) => command.includes("session-init.cjs"))).toBe(true);
		expect(commands.some((command) => command.includes("session-state.cjs"))).toBe(false);
	});

	it("local restore mode does not re-add hooks explicitly disabled in project .claude/.ck.json", async () => {
		await writeHookSourceSettings();
		const projectDir = join(testDir, "project");
		const localClaudeDir = join(projectDir, ".claude");
		const localDestFile = join(localClaudeDir, "settings.json");
		await mkdir(localClaudeDir, { recursive: true });
		await writeFile(localDestFile, JSON.stringify({ hooks: {} }, null, 2));
		await writeFile(
			join(localClaudeDir, ".ck.json"),
			`\uFEFF${JSON.stringify(
				{
					hooks: {
						"session-state": false,
					},
					kits: {
						engineer: {
							installedSettings: {
								hooks: [
									"node $HOME/.claude/hooks/session-init.cjs",
									"node $HOME/.claude/hooks/session-state.cjs",
								],
								mcpServers: [],
							},
						},
					},
				},
				null,
				2,
			)}`,
		);

		const processor = new SettingsProcessor();
		processor.setProjectDir(projectDir);
		processor.setKitName("engineer");
		processor.setRestoreCkHooks(true);
		await processor.processSettingsJson(sourceFile, localDestFile);

		const merged = JSON.parse(await readFile(localDestFile, "utf-8"));
		const commands = collectCommands(merged);

		expect(commands.some((command) => command.includes("session-init.cjs"))).toBe(true);
		expect(commands.some((command) => command.includes("session-state.cjs"))).toBe(false);
	});

	it("deduplicates legacy $HOME hooks against the custom global path on merge", async () => {
		await writeFile(
			sourceFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/task-completed-handler.cjs",
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
		await writeFile(
			destFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: 'node "$HOME/.claude/hooks/task-completed-handler.cjs"',
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

		const processor = createProcessor();
		await processor.processSettingsJson(sourceFile, destFile);

		const mergedSettings = JSON.parse(await readFile(destFile, "utf-8")) as {
			hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> };
		};

		expect(mergedSettings.hooks.UserPromptSubmit).toHaveLength(1);
		expect(mergedSettings.hooks.UserPromptSubmit[0].hooks).toHaveLength(1);
		expect(mergedSettings.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
			`node "${toPosix(customClaudeDir)}/hooks/task-completed-handler.cjs"`,
		);
	});

	it("repairs an absolute hook path in existing destination settings to canonical form", async () => {
		await writeFile(
			sourceFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/task-completed-handler.cjs",
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
		// Simulate a destination settings.json that already contains an absolute path
		// (written by Claude Code on a previous save or an older ck version).
		await writeFile(
			destFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command:
											'node "D:\\Admin\\Documents\\PROJECTS\\foo\\.claude\\hooks\\task-completed-handler.cjs"',
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

		const processor = createProcessor();
		await processor.processSettingsJson(sourceFile, destFile);

		const merged = JSON.parse(await readFile(destFile, "utf-8")) as {
			hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> };
		};

		// Deduplication collapses the two entries; the surviving command must be canonical.
		expect(merged.hooks.UserPromptSubmit).toHaveLength(1);
		expect(merged.hooks.UserPromptSubmit[0].hooks).toHaveLength(1);
		// The custom CLAUDE_CONFIG_DIR path is used as the global root in this test setup.
		expect(merged.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
			`node "${toPosix(customClaudeDir)}/hooks/task-completed-handler.cjs"`,
		);
	});

	it("repairs an absolute hook path with no source counterpart (validates branch output, not dedup)", async () => {
		// Source has only `task-completed-handler`. Dest has only `session-state` (absolute path).
		// No dedup overlap → the surviving session-state command is the literal output of the
		// 6th branch in repairClaudeNodeCommandPath, not a side-effect of source canonicalization.
		await writeFile(
			sourceFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/task-completed-handler.cjs",
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
		await writeFile(
			destFile,
			JSON.stringify(
				{
					hooks: {
						Stop: [
							{
								hooks: [
									{
										type: "command",
										command:
											'node "D:\\Admin\\Documents\\PROJECTS\\foo\\.claude\\hooks\\session-state.cjs"',
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

		const processor = createProcessor();
		await processor.processSettingsJson(sourceFile, destFile);

		const merged = JSON.parse(await readFile(destFile, "utf-8")) as {
			hooks: {
				UserPromptSubmit?: Array<{ hooks: Array<{ command: string }> }>;
				Stop?: Array<{ hooks: Array<{ command: string }> }>;
			};
		};

		expect(merged.hooks.Stop).toBeDefined();
		// The 6th branch repaired the absolute Windows path in dest. The merger is in global
		// mode here, so root canonicalizes to customClaudeDir (not $CLAUDE_PROJECT_DIR). What
		// matters is the original `D:\Admin\...` is gone — replaced by the canonical form.
		expect(merged.hooks.Stop?.[0]?.hooks?.[0]?.command).toBe(
			`node "${toPosix(customClaudeDir)}/hooks/session-state.cjs"`,
		);
	});

	it("repairs stale sibling settings.local.json hook paths without touching non-node commands", async () => {
		await writeFile(
			sourceFile,
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/task-completed-handler.cjs",
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
		await writeFile(destFile, JSON.stringify({ hooks: {} }, null, 2));
		const settingsLocalPath = join(customClaudeDir, "settings.local.json");
		await writeFile(
			settingsLocalPath,
			JSON.stringify(
				{
					hooks: {
						PreToolUse: [
							{
								matcher: "Read",
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/scout-block.cjs",
									},
									{
										type: "command",
										command: "bash .claude/hooks/scout-block.cjs",
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

		const processor = createProcessor();
		await processor.processSettingsJson(sourceFile, destFile);

		const settingsLocal = JSON.parse(await readFile(settingsLocalPath, "utf-8")) as {
			hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
		};

		expect(settingsLocal.hooks.PreToolUse[0].hooks[0].command).toBe(
			`node "${toPosix(customClaudeDir)}/hooks/scout-block.cjs"`,
		);
		expect(settingsLocal.hooks.PreToolUse[0].hooks[1].command).toBe(
			"bash .claude/hooks/scout-block.cjs",
		);
	});
});
