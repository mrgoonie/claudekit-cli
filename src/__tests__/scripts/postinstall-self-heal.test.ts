import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const scriptPath = resolve(import.meta.dir, "../../../bin/postinstall-self-heal.cjs");

function makeLegacyPromptSettings() {
	return {
		hooks: {
			PreToolUse: [
				{
					matcher: "Write",
					hooks: [
						{
							type: "prompt",
							prompt:
								"Legacy descriptive-name hook: Use kebab-case for all filenames, including Python .py files.",
						},
					],
				},
			],
		},
	};
}

describe("postinstall self-heal", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-postinstall-self-heal-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("prunes legacy prompt hooks from invoking project and .ccs profile settings", async () => {
		const projectDir = join(tempDir, "project");
		const projectClaudeDir = join(projectDir, ".claude");
		const ccsDir = join(tempDir, ".ccs");
		await mkdir(projectClaudeDir, { recursive: true });
		await mkdir(ccsDir, { recursive: true });

		const projectSettingsPath = join(projectClaudeDir, "settings.json");
		const ccsSettingsPath = join(ccsDir, "znguyen.settings.json");
		await writeFile(projectSettingsPath, JSON.stringify(makeLegacyPromptSettings(), null, 2));
		await writeFile(ccsSettingsPath, JSON.stringify(makeLegacyPromptSettings(), null, 2));

		execFileSync(process.execPath, [scriptPath], {
			env: {
				...process.env,
				INIT_CWD: projectDir,
				CK_TEST_HOME: tempDir,
				CK_TEST_CCS_DIR: ccsDir,
			},
			stdio: "pipe",
		});

		const projectSettings = JSON.parse(await readFile(projectSettingsPath, "utf8"));
		const ccsSettings = JSON.parse(await readFile(ccsSettingsPath, "utf8"));
		expect(projectSettings.hooks).toBeUndefined();
		expect(ccsSettings.hooks).toBeUndefined();
	});

	test("restores sparse global CK hook registrations during npm postinstall", async () => {
		const globalClaudeDir = join(tempDir, ".claude");
		await mkdir(globalClaudeDir, { recursive: true });

		const settingsPath = join(globalClaudeDir, "settings.json");
		await writeFile(
			settingsPath,
			`\uFEFF${JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: 'node "$HOME/.claude/hooks/simplify-gate.cjs"',
									},
								],
							},
						],
					},
				},
				null,
				2,
			)}`,
		);
		await writeFile(
			join(globalClaudeDir, ".ck.json"),
			JSON.stringify(
				{
					hooks: {},
					kits: {
						"ClaudeKit Engineer": {
							installedSettings: {
								hooks: [
									"node $HOME/.claude/hooks/simplify-gate.cjs",
									"node $HOME/.claude/hooks/session-state.cjs",
								],
							},
						},
					},
				},
				null,
				2,
			),
		);
		await writeFile(
			join(globalClaudeDir, "metadata.json"),
			JSON.stringify({
				scope: "global",
				kits: { engineer: { version: "v2.19.2-beta.1" } },
			}),
		);

		const stubPath = join(tempDir, "ck-stub.cjs");
		const stubOutputPath = join(tempDir, "ck-stub-output.json");
		await writeFile(
			stubPath,
			`#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.env.CK_POSTINSTALL_STUB_OUTPUT, JSON.stringify(process.argv.slice(2)));
`,
		);
		await chmod(stubPath, 0o755);

		execFileSync(process.execPath, [scriptPath], {
			env: {
				...process.env,
				CK_POSTINSTALL_CK_BIN: stubPath,
				CK_POSTINSTALL_STUB_OUTPUT: stubOutputPath,
				CK_TEST_HOME: tempDir,
			},
			stdio: "pipe",
		});

		const args = JSON.parse(await readFile(stubOutputPath, "utf8"));
		expect(args).toEqual([
			"init",
			"-g",
			"--kit",
			"engineer",
			"--yes",
			"--restore-ck-hooks",
			"--install-skills",
			"--beta",
		]);
	});
});
