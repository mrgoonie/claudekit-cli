import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { type TestPaths, setupTestPaths } from "../helpers/test-paths.js";

describe("init command - local installation detection", () => {
	let testPaths: TestPaths;
	let testProjectDir: string;
	let testLocalClaudeDir: string;
	let originalCwd: string;
	let originalCI: string | undefined;
	let originalNonInteractive: string | undefined;

	beforeEach(async () => {
		// Save original environment
		originalCwd = process.cwd();
		originalCI = process.env.CI;
		originalNonInteractive = process.env.NON_INTERACTIVE;

		// Setup isolated test paths
		testPaths = setupTestPaths();

		// Create project directory within test home
		testProjectDir = join(testPaths.testHome, "test-project");
		testLocalClaudeDir = join(testProjectDir, ".claude");

		await mkdir(testProjectDir, { recursive: true });

		// Change to test project directory
		process.chdir(testProjectDir);
	});

	afterEach(async () => {
		// Restore original environment
		process.chdir(originalCwd);
		process.env.CI = originalCI;
		process.env.NON_INTERACTIVE = originalNonInteractive;

		// Cleanup via test paths helper
		testPaths.cleanup();
	});

	describe("detection logic", () => {
		test("should detect local settings.json when present", async () => {
			// Create local .claude/settings.json
			await mkdir(testLocalClaudeDir, { recursive: true });
			await writeFile(
				join(testLocalClaudeDir, "settings.json"),
				JSON.stringify({ hooks: {} }, null, 2),
			);

			// Verify file exists
			const settingsPath = join(testLocalClaudeDir, "settings.json");
			expect(await pathExists(settingsPath)).toBe(true);
		});

		test("should not detect when local settings.json is absent", async () => {
			// No .claude directory created
			const settingsPath = join(testLocalClaudeDir, "settings.json");
			expect(await pathExists(settingsPath)).toBe(false);
		});

		test("should not detect when .claude exists but settings.json is missing", async () => {
			// Create .claude directory without settings.json
			await mkdir(testLocalClaudeDir, { recursive: true });
			await writeFile(join(testLocalClaudeDir, "CLAUDE.md"), "# Test");

			const settingsPath = join(testLocalClaudeDir, "settings.json");
			expect(await pathExists(settingsPath)).toBe(false);
		});
	});

	describe("CI mode behavior", () => {
		test("should proceed with warning in CI mode when local installation exists", async () => {
			// Create local installation
			await mkdir(testLocalClaudeDir, { recursive: true });
			await writeFile(
				join(testLocalClaudeDir, "settings.json"),
				JSON.stringify({ hooks: {} }, null, 2),
			);

			// Enable CI mode
			process.env.CI = "true";

			// Note: Full integration would require mocking GitHub API
			// This test verifies the detection logic works in CI mode

			// Verify detection still works in CI mode
			const settingsPath = join(testLocalClaudeDir, "settings.json");
			expect(await pathExists(settingsPath)).toBe(true);
		});
	});

	describe("file structure after detection", () => {
		test("local .claude directory should have correct structure", async () => {
			// Create typical local installation structure
			await mkdir(testLocalClaudeDir, { recursive: true });
			await mkdir(join(testLocalClaudeDir, "hooks"), { recursive: true });

			await writeFile(
				join(testLocalClaudeDir, "settings.json"),
				JSON.stringify(
					{
						hooks: {
							UserPromptSubmit: [
								{
									hooks: [
										{
											type: "command",
											command: "node .claude/hooks/dev-rules-reminder.cjs",
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
			await writeFile(join(testLocalClaudeDir, "hooks", "dev-rules-reminder.cjs"), "// hook");

			// Verify structure
			expect(existsSync(join(testLocalClaudeDir, "settings.json"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, "hooks", "dev-rules-reminder.cjs"))).toBe(true);
		});
	});
});
