import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repairLegacyHookPromptsAfterInit } from "@/commands/init/init-command.js";
import type { InitContext } from "@/commands/init/types.js";

const originalCwd = process.cwd();
const originalCkTestHome = process.env.CK_TEST_HOME;

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

describe("init self-heal", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-init-self-heal-"));
		process.env.CK_TEST_HOME = join(tempDir, "home");
		await mkdir(join(process.env.CK_TEST_HOME, ".claude"), { recursive: true });
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		if (originalCkTestHome === undefined) {
			process.env.CK_TEST_HOME = undefined;
		} else {
			process.env.CK_TEST_HOME = originalCkTestHome;
		}
		await rm(tempDir, { recursive: true, force: true });
	});

	test("global init prunes legacy prompt hooks from the current project settings", async () => {
		const projectDir = join(tempDir, "project");
		const projectClaudeDir = join(projectDir, ".claude");
		await mkdir(projectClaudeDir, { recursive: true });
		await writeFile(
			join(projectClaudeDir, "settings.json"),
			JSON.stringify(makeLegacyPromptSettings(), null, 2),
		);

		process.chdir(projectDir);

		await repairLegacyHookPromptsAfterInit({
			resolvedDir: process.env.CK_TEST_HOME,
			options: { global: true },
		} as unknown as InitContext);

		const settings = JSON.parse(await readFile(join(projectClaudeDir, "settings.json"), "utf8"));
		expect(JSON.stringify(settings)).not.toContain("kebab-case");
		expect(settings.hooks).toBeUndefined();
	});
});
