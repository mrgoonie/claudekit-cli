import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Import the functions we want to test
import {
	HOME_PREFIX,
	getHomeDirPrefix,
	transformContent,
	transformFile,
	transformPathsForGlobalInstall,
} from "@/services/transformers/global-path-transformer.js";

describe("global-path-transformer", () => {
	describe("getHomeDirPrefix", () => {
		it("returns cached HOME_PREFIX value", () => {
			// The function should return the cached value
			expect(getHomeDirPrefix()).toBe(HOME_PREFIX);
		});

		it("returns correct platform-specific prefix", () => {
			// Platform detection happens at module load time
			// Verify the correct value based on current platform
			if (process.platform === "win32") {
				expect(getHomeDirPrefix()).toBe("%USERPROFILE%");
				expect(HOME_PREFIX).toBe("%USERPROFILE%");
			} else {
				expect(getHomeDirPrefix()).toBe("$HOME");
				expect(HOME_PREFIX).toBe("$HOME");
			}
		});
	});

	describe("transformContent", () => {
		const expectedPrefix = HOME_PREFIX;

		it("transforms ./.claude/ paths", () => {
			const input = 'command: "node ./.claude/hooks/test.js"';
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`command: "node ${expectedPrefix}/.claude/hooks/test.js"`);
			expect(changes).toBe(1);
		});

		it("transforms @./.claude/ paths (@ with relative)", () => {
			const input = "workflow: @./.claude/rules/main.md";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`workflow: @${expectedPrefix}/.claude/rules/main.md`);
			expect(changes).toBe(1);
		});

		it("transforms @.claude/ paths", () => {
			const input = "reference: @.claude/agents/planner.md";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`reference: @${expectedPrefix}/.claude/agents/planner.md`);
			expect(changes).toBe(1);
		});

		it("transforms double-quoted .claude/ paths", () => {
			const input = '"node .claude/hooks/dev-rules-reminder.js"';
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`"node ${expectedPrefix}/.claude/hooks/dev-rules-reminder.js"`);
			expect(changes).toBe(1);
		});

		it("transforms single-quoted .claude/ paths", () => {
			const input = "'node .claude/hooks/test.js'";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`'node ${expectedPrefix}/.claude/hooks/test.js'`);
			expect(changes).toBe(1);
		});

		it("transforms backtick-quoted .claude/ paths", () => {
			const input = "`node .claude/scripts/run.js`";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`\`node ${expectedPrefix}/.claude/scripts/run.js\``);
			expect(changes).toBe(1);
		});

		it("transforms parentheses (.claude/ paths (markdown links)", () => {
			const input = "See [rules](.claude/rules/main.md)";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`See [rules](${expectedPrefix}/.claude/rules/main.md)`);
			expect(changes).toBe(1);
		});

		it("transforms space-prefixed .claude/ paths", () => {
			const input = "Run the command: node .claude/hooks/test.js";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`Run the command: node ${expectedPrefix}/.claude/hooks/test.js`);
			expect(changes).toBe(1);
		});

		it("transforms start-of-line .claude/ paths", () => {
			const input = ".claude/hooks/test.js is the file";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`${expectedPrefix}/.claude/hooks/test.js is the file`);
			expect(changes).toBe(1);
		});

		it("transforms YAML colon-space .claude/ paths", () => {
			const input = "path: .claude/hooks/test.js";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`path: ${expectedPrefix}/.claude/hooks/test.js`);
			expect(changes).toBe(1);
		});

		it("transforms YAML colon .claude/ paths (no space)", () => {
			const input = "path:.claude/hooks/test.js";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(`path:${expectedPrefix}/.claude/hooks/test.js`);
			expect(changes).toBe(1);
		});

		it("transforms multiple occurrences", () => {
			const input = `
{
  "hooks": {
    "command": "node .claude/hooks/a.js",
    "other": "python .claude/scripts/b.py"
  }
}`;
			const { transformed, changes } = transformContent(input);

			expect(transformed).toContain(`${expectedPrefix}/.claude/hooks/a.js`);
			expect(transformed).toContain(`${expectedPrefix}/.claude/scripts/b.py`);
			expect(changes).toBe(2);
		});

		it("returns 0 changes when no .claude/ paths found", () => {
			const input = "This is just regular text without any paths";
			const { transformed, changes } = transformContent(input);

			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("does not transform already-transformed paths", () => {
			// If someone already has $HOME or %USERPROFILE% in their content
			const input = `command: "node ${expectedPrefix}/.claude/hooks/test.js"`;
			const { transformed, changes } = transformContent(input);

			// Should not double-transform
			expect(transformed).toBe(input);
			expect(changes).toBe(0);
		});

		it("handles real-world settings.json content", () => {
			const input = JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/dev-rules-reminder.js",
									},
								],
							},
						],
						PreToolUse: [
							{
								matcher: "Bash|Glob|Grep|Read|Edit|Write",
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/scout-block.js",
									},
								],
							},
						],
					},
				},
				null,
				2,
			);

			const { transformed, changes } = transformContent(input);

			expect(transformed).toContain(`${expectedPrefix}/.claude/hooks/dev-rules-reminder.js`);
			expect(transformed).toContain(`${expectedPrefix}/.claude/hooks/scout-block.js`);
			expect(changes).toBe(2);
		});
	});

	describe("transformFile", () => {
		const testDir = "/tmp/transformer-test-file";
		const testFile = join(testDir, "test.json");

		beforeEach(async () => {
			await mkdir(testDir, { recursive: true });
		});

		afterEach(async () => {
			await rm(testDir, { recursive: true, force: true });
		});

		it("transforms file content and writes back", async () => {
			await writeFile(
				testFile,
				JSON.stringify({
					command: "node .claude/hooks/test.js",
				}),
			);

			const result = await transformFile(testFile);

			expect(result.success).toBe(true);
			expect(result.changes).toBe(1);

			const content = await readFile(testFile, "utf-8");
			expect(content).toContain(`${HOME_PREFIX}/.claude/hooks/test.js`);
		});

		it("returns success with 0 changes when no transformation needed", async () => {
			await writeFile(testFile, '{"name": "test"}');

			const result = await transformFile(testFile);

			expect(result.success).toBe(true);
			expect(result.changes).toBe(0);
		});

		it("returns failure when file does not exist", async () => {
			const result = await transformFile("/nonexistent/path/file.json");

			expect(result.success).toBe(false);
			expect(result.changes).toBe(0);
		});
	});

	describe("transformPathsForGlobalInstall", () => {
		const testDir = "/tmp/transformer-test-global";

		beforeEach(async () => {
			await rm(testDir, { recursive: true, force: true });
			await mkdir(join(testDir, ".claude", "hooks"), { recursive: true });
		});

		afterEach(async () => {
			await rm(testDir, { recursive: true, force: true });
		});

		it("transforms all eligible files in directory", async () => {
			// Create test files
			await writeFile(
				join(testDir, ".claude", "settings.json"),
				JSON.stringify({
					command: "node .claude/hooks/test.js",
				}),
			);
			await writeFile(join(testDir, ".claude", "CLAUDE.md"), "Reference: @.claude/rules/main.md");

			const result = await transformPathsForGlobalInstall(testDir);

			expect(result.filesTransformed).toBe(2);
			expect(result.totalChanges).toBe(2);
			expect(result.filesSkipped).toBe(0);

			// Verify files were transformed
			const settingsContent = await readFile(join(testDir, ".claude", "settings.json"), "utf-8");
			expect(settingsContent).toContain(`${HOME_PREFIX}/.claude/hooks/test.js`);

			const claudeContent = await readFile(join(testDir, ".claude", "CLAUDE.md"), "utf-8");
			expect(claudeContent).toContain(`@${HOME_PREFIX}/.claude/rules/main.md`);
		});

		it("skips node_modules directory", async () => {
			await mkdir(join(testDir, "node_modules", "some-package"), { recursive: true });
			await writeFile(
				join(testDir, "node_modules", "some-package", "index.js"),
				'require(".claude/test")',
			);

			const result = await transformPathsForGlobalInstall(testDir);

			expect(result.filesTransformed).toBe(0);
		});

		it("skips hidden directories except .claude", async () => {
			await mkdir(join(testDir, ".git"), { recursive: true });
			await writeFile(join(testDir, ".git", "config"), "path: .claude/test");

			const result = await transformPathsForGlobalInstall(testDir);

			expect(result.filesTransformed).toBe(0);
		});

		it("only transforms files with eligible extensions", async () => {
			// Eligible: .json, .md, .js, .ts, .sh, .ps1, .yaml, .yml, .toml
			await writeFile(join(testDir, ".claude", "test.json"), '"path": ".claude/test"');
			await writeFile(join(testDir, ".claude", "test.txt"), "path: .claude/test"); // Not eligible

			const result = await transformPathsForGlobalInstall(testDir);

			expect(result.filesTransformed).toBe(1);

			// Verify txt file was not transformed
			const txtContent = await readFile(join(testDir, ".claude", "test.txt"), "utf-8");
			expect(txtContent).toBe("path: .claude/test");
		});

		it("returns statistics about transformation", async () => {
			await writeFile(
				join(testDir, ".claude", "hooks", "test.js"),
				'const path = ".claude/hooks/helper.js";',
			);

			const result = await transformPathsForGlobalInstall(testDir, { verbose: true });

			expect(result).toHaveProperty("filesTransformed");
			expect(result).toHaveProperty("totalChanges");
			expect(result).toHaveProperty("filesSkipped");
			expect(result).toHaveProperty("skippedFiles");
			expect(Array.isArray(result.skippedFiles)).toBe(true);
		});
	});
});
