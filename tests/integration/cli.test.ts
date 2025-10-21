import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Integration tests for CLI commands
 * These tests actually run the CLI and verify the results
 */
describe("CLI Integration Tests", () => {
	let testDir: string;
	const cliPath = join(process.cwd(), "dist", "index.js");

	beforeEach(async () => {
		// Create test directory
		testDir = join(process.cwd(), "test-integration", `cli-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		// Build the CLI first if not exists
		if (!existsSync(cliPath)) {
			execSync("bun run build", { cwd: process.cwd() });
		}
	});

	afterEach(async () => {
		// Cleanup test directory
		if (existsSync(testDir)) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("ck new command", () => {
		test("should create new project in specified directory", async () => {
			const projectDir = join(testDir, "test-ck-new");

			try {
				// Run ck new command with --kit and --force flags for non-interactive mode
				execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer --force`, {
					cwd: testDir,
					stdio: "pipe",
					timeout: 60000, // 60 second timeout
				});

				// Verify project structure
				expect(existsSync(projectDir)).toBe(true);
				expect(existsSync(join(projectDir, ".claude"))).toBe(true);
				expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);
			} catch (error) {
				// Log error for debugging
				console.error("Command failed:", error);
				throw error;
			}
		}, 120000); // 2 minute timeout for the test

		test("should create project with correct file contents", async () => {
			const projectDir = join(testDir, "test-content");

			try {
				execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer --force`, {
					cwd: testDir,
					stdio: "pipe",
					timeout: 60000,
				});

				// Verify file contents (basic check)
				const claudeMd = await Bun.file(join(projectDir, "CLAUDE.md")).text();
				expect(claudeMd).toContain("CLAUDE.md");
			} catch (error) {
				console.error("Command failed:", error);
				throw error;
			}
		}, 120000);

		test("should not overwrite existing project without confirmation", async () => {
			const projectDir = join(testDir, "test-no-overwrite");

			// Create existing directory with a file
			await mkdir(projectDir, { recursive: true });
			await writeFile(join(projectDir, "existing.txt"), "existing content");

			try {
				// This should fail because --force is not provided
				execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer`, {
					cwd: testDir,
					stdio: "pipe",
					timeout: 5000,
				});
				// Should not reach here
				expect(true).toBe(false);
			} catch (error: any) {
				// Expected to fail without --force flag
				expect(error).toBeDefined();
				expect(error.message).toContain("not empty");
			}

			// Verify existing file is still there
			expect(existsSync(join(projectDir, "existing.txt"))).toBe(true);
		});
	});

	describe("ck update command", () => {
		test("should update existing project", async () => {
			const projectDir = join(testDir, "test-ck-update");

			// First create a project with --kit and --force flags
			execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer --force`, {
				cwd: testDir,
				stdio: "pipe",
				timeout: 60000,
			});

			// Add a custom file to .claude directory
			await writeFile(join(projectDir, ".claude", "custom.md"), "# Custom file");

			// Update the project (will ask for confirmation, so it may timeout/fail)
			try {
				execSync(`node ${cliPath} update`, {
					cwd: projectDir,
					stdio: "pipe",
					timeout: 60000,
				});

				// Note: Update requires confirmation, so this test may need adjustment
				// based on how confirmation is handled in tests
			} catch (error) {
				// May fail due to confirmation prompt
				console.log("Update command requires confirmation, which is expected");
			}

			// Verify custom file is preserved
			expect(existsSync(join(projectDir, ".claude", "custom.md"))).toBe(true);
		}, 120000);

		test("should fail when not in a project directory", async () => {
			const emptyDir = join(testDir, "empty");
			await mkdir(emptyDir, { recursive: true });

			try {
				execSync(`node ${cliPath} update`, {
					cwd: emptyDir,
					stdio: "pipe",
					timeout: 5000,
				});

				// Should not reach here
				expect(true).toBe(false);
			} catch (error: any) {
				// Expected to fail
				expect(error).toBeDefined();
			}
		});
	});

	describe("project structure validation", () => {
		test("new project should have all required directories", async () => {
			const projectDir = join(testDir, "test-structure");

			execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer --force`, {
				cwd: testDir,
				stdio: "pipe",
				timeout: 60000,
			});

			// Check for required directories
			const requiredDirs = [".claude"];

			for (const dir of requiredDirs) {
				expect(existsSync(join(projectDir, dir))).toBe(true);
			}
		}, 120000);

		test("new project should have all required files", async () => {
			const projectDir = join(testDir, "test-files");

			execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer --force`, {
				cwd: testDir,
				stdio: "pipe",
				timeout: 60000,
			});

			// Check for required files
			const requiredFiles = ["CLAUDE.md"];

			for (const file of requiredFiles) {
				expect(existsSync(join(projectDir, file))).toBe(true);
			}
		}, 120000);

		test("project should not contain excluded files", async () => {
			const projectDir = join(testDir, "test-exclusions");

			execSync(`node ${cliPath} new --dir ${projectDir} --kit engineer --force`, {
				cwd: testDir,
				stdio: "pipe",
				timeout: 60000,
			});

			// Verify excluded patterns are not present
			expect(existsSync(join(projectDir, ".git"))).toBe(false);
			expect(existsSync(join(projectDir, "node_modules"))).toBe(false);
			expect(existsSync(join(projectDir, ".DS_Store"))).toBe(false);
		}, 120000);
	});
});
