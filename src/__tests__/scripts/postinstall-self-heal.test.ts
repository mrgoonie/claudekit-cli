import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
});
