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
