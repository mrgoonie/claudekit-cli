import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { readdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClaudeKitSetup } from "@/types";
import { type TestPaths, setupTestPaths } from "../../helpers/test-paths.js";

/**
 * Tests for the modular checker functions.
 * After modularization, the checker functions are standalone functions
 * imported from src/domains/health-checks/checkers/.
 */
describe("ClaudeKitChecker - Enhanced Checks", () => {
	let testPaths: TestPaths;
	let mockProjectDir: string;
	let loggerSpy: any = {};
	let mockSetup: ClaudeKitSetup;

	beforeEach(async () => {
		// Setup isolated test paths
		testPaths = setupTestPaths();
		mockProjectDir = testPaths.testHome;

		// Mock logger to suppress output
		const { logger } = await import("../../../src/shared/logger.js");
		loggerSpy = {
			verbose: spyOn(logger, "verbose").mockImplementation(() => {}),
			debug: spyOn(logger, "debug").mockImplementation(() => {}),
			info: spyOn(logger, "info").mockImplementation(() => {}),
			warning: spyOn(logger, "warning").mockImplementation(() => {}),
			error: spyOn(logger, "error").mockImplementation(() => {}),
		};

		// Mock setup data
		mockSetup = {
			global: {
				path: testPaths.claudeDir,
				metadata: {
					name: "ClaudeKit",
					version: "1.0.0",
					description: "ClaudeKit CLI tool",
				},
				components: {
					agents: 0,
					commands: 0,
					workflows: 0,
					skills: 0,
				},
			},
			project: {
				path: join(mockProjectDir, ".claude"),
				metadata: null, // Not a ClaudeKit project initially
				components: {
					agents: 0,
					commands: 0,
					workflows: 0,
					skills: 0,
				},
			},
		};

		// PathResolver will automatically use testPaths.claudeDir when CK_TEST_HOME is set
		// No need to mock it since it has built-in test support

		// Mock getClaudeKitSetup
		spyOn(
			await import("../../../src/services/file-operations/claudekit-scanner.js"),
			"getClaudeKitSetup",
		).mockResolvedValue(mockSetup);
	});

	afterEach(() => {
		// Restore all mocks
		if (loggerSpy && typeof loggerSpy === "object") {
			Object.values(loggerSpy).forEach((spy: any) => {
				if (spy && typeof spy.mockRestore === "function") {
					spy.mockRestore();
				}
			});
		}
		testPaths?.cleanup();
	});

	describe("checkGlobalDirReadable", () => {
		test("passes when metadata.json exists and is readable", async () => {
			// Create metadata.json
			const metadataPath = join(testPaths.claudeDir, "metadata.json");
			await writeFile(
				metadataPath,
				JSON.stringify({ name: "ClaudeKit", version: "1.0.0", description: "ClaudeKit CLI tool" }),
			);

			const { checkGlobalDirReadable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirReadable();

			expect(result.id).toBe("ck-global-dir-readable");
			expect(result.name).toBe("Global Dir Readable");
			expect(result.group).toBe("claudekit");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("pass");
			expect(result.message).toBe("Read access OK");
			expect(result.details).toBe(testPaths.claudeDir);
			expect(result.autoFixable).toBe(false);
		});

		test("passes when directory exists without metadata.json", async () => {
			// Create empty directory
			const items = await readdir(testPaths.claudeDir);
			expect(items.length).toBe(0);

			const { checkGlobalDirReadable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirReadable();

			expect(result.status).toBe("pass");
			expect(result.message).toBe("Read access OK");
		});

		test("passes when directory exists and is readable", async () => {
			// Directory should already exist from setupTestPaths
			expect(existsSync(testPaths.claudeDir)).toBe(true);

			const { checkGlobalDirReadable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirReadable();

			expect(result.status).toBe("pass");
			expect(result.message).toBe("Read access OK");
		});

		test("fails when directory is not readable", async () => {
			// Mock access to throw permission error
			// Import the fs/promises module first to set up spies
			const fsPromises = await import("node:fs/promises");
			const accessSpy = spyOn(fsPromises, "access").mockRejectedValue(
				new Error("EACCES: permission denied"),
			);

			// Now import the checker after mocks are set up
			const { checkGlobalDirReadable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirReadable();

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Read access denied");
			expect(result.suggestion).toBe("Check file permissions on ~/.claude/");

			// Restore mocks
			accessSpy.mockRestore();
		});
	});

	describe("checkGlobalDirWritable", () => {
		test("passes when directory is writable", async () => {
			const { checkGlobalDirWritable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirWritable();

			expect(result.id).toBe("ck-global-dir-writable");
			expect(result.name).toBe("Global Dir Writable");
			expect(result.group).toBe("claudekit");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("pass");
			expect(result.message).toBe("Write access OK");
			expect(result.details).toBe(testPaths.claudeDir);
			expect(result.autoFixable).toBe(false);
		});

		test("fails when directory is not writable", async () => {
			// Mock writeFile to throw permission error
			const mockFs = await import("node:fs/promises");
			spyOn(mockFs, "writeFile").mockRejectedValue(new Error("EACCES: permission denied"));

			const { checkGlobalDirWritable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirWritable();

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Write access denied");
			expect(result.suggestion).toBe("Check file permissions on ~/.claude/");
		});

		test("cleans up test file even if unlink fails", async () => {
			// Mock writeFile to succeed but unlink to fail
			const fsPromises = await import("node:fs/promises");
			const writeFileSpy = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
			const unlinkSpy = spyOn(fsPromises, "unlink").mockRejectedValue(
				new Error("ENOENT: no such file"),
			);

			const { checkGlobalDirWritable } = await import(
				"../../../src/domains/health-checks/checkers/permissions-checker.js"
			);
			const result = await checkGlobalDirWritable();

			// Should still pass even if cleanup fails
			expect(result.status).toBe("pass");

			// Restore mocks
			writeFileSpy.mockRestore();
			unlinkSpy.mockRestore();
		});
	});

	describe("checkHooksExist", () => {
		test("returns info when no hooks directory exists", async () => {
			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.id).toBe("ck-hooks-exist");
			expect(result.name).toBe("Hooks Directory");
			expect(result.group).toBe("claudekit");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("info");
			expect(result.message).toBe("No hooks directory");
			expect(result.autoFixable).toBe(false);
		});

		test("counts hooks in global directory", async () => {
			// Create global hooks directory with files
			const globalHooksDir = join(testPaths.claudeDir, "hooks");
			mkdirSync(globalHooksDir, { recursive: true });

			// Clean any existing files first
			const existingFiles = await readdir(globalHooksDir).catch(() => []);
			for (const file of existingFiles) {
				await unlink(join(globalHooksDir, file)).catch(() => {});
			}

			await writeFile(join(globalHooksDir, "hook1.js"), "console.log('hook1');");
			await writeFile(join(globalHooksDir, "hook2.cjs"), "console.log('hook2');");
			await writeFile(join(globalHooksDir, "hook3.sh"), "#!/bin/bash");
			await writeFile(join(globalHooksDir, "not-a-hook.txt"), "text file");
			await writeFile(join(globalHooksDir, "another.js"), "console.log('valid');");

			// Ensure project hooks directory doesn't exist (since they're the same dir in test)
			const projectHooksDir = join(mockProjectDir, ".claude", "hooks");
			if (projectHooksDir !== globalHooksDir && existsSync(projectHooksDir)) {
				const projectFiles = await readdir(projectHooksDir);
				for (const file of projectFiles) {
					await unlink(join(projectHooksDir, file)).catch(() => {});
				}
			}

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("4 hook(s) found");
			expect(result.details).toBe(globalHooksDir);
		});

		test("counts hooks in project directory", async () => {
			// Create project hooks directory
			const projectHooksDir = join(mockProjectDir, ".claude", "hooks");
			mkdirSync(projectHooksDir, { recursive: true });
			await writeFile(join(projectHooksDir, "project-hook.js"), "console.log('project');");

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("1 hook(s) found");
			expect(result.details).toBe(projectHooksDir);
		});

		test("counts hooks from both directories", async () => {
			// Create both global and project hooks
			const globalHooksDir = join(testPaths.claudeDir, "hooks");
			const projectHooksDir = join(mockProjectDir, ".claude", "hooks");
			mkdirSync(globalHooksDir, { recursive: true });
			mkdirSync(projectHooksDir, { recursive: true });
			await writeFile(join(globalHooksDir, "global.js"), "console.log('global');");
			await writeFile(join(projectHooksDir, "project.js"), "console.log('project');");

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("2 hook(s) found");
		});

		test("returns pass with 0 hooks for empty directory", async () => {
			// Create empty hooks directory
			const globalHooksDir = join(testPaths.claudeDir, "hooks");
			mkdirSync(globalHooksDir, { recursive: true });

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("0 hook(s) found");
		});

		test("filters files correctly by extension", async () => {
			const globalHooksDir = join(testPaths.claudeDir, "hooks");
			mkdirSync(globalHooksDir, { recursive: true });

			// Valid extensions (includes .ts and .mjs which are now recognized)
			await writeFile(join(globalHooksDir, "script.js"), "js");
			await writeFile(join(globalHooksDir, "script.cjs"), "cjs");
			await writeFile(join(globalHooksDir, "script.mjs"), "mjs");
			await writeFile(join(globalHooksDir, "script.ts"), "ts");
			await writeFile(join(globalHooksDir, "script.sh"), "sh");

			// Invalid extensions
			await writeFile(join(globalHooksDir, "script.py"), "py");
			await writeFile(join(globalHooksDir, "README.md"), "md");

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("5 hook(s) found");
		});
	});

	describe("checkSettingsValid", () => {
		test("passes with valid global settings.json", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			await writeFile(globalSettings, JSON.stringify({ theme: "dark", verbose: true }));

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.id).toBe("ck-settings-valid");
			expect(result.name).toBe("Settings.json");
			expect(result.group).toBe("claudekit");
			expect(result.priority).toBe("extended");
			expect(result.status).toBe("pass");
			expect(result.message).toBe("Valid JSON");
			expect(result.details).toBe(globalSettings);
			expect(result.autoFixable).toBe(false);
		});

		test("passes with valid project settings.json", async () => {
			const projectSettings = join(mockProjectDir, ".claude", "settings.json");
			await writeFile(projectSettings, JSON.stringify({ autoFix: false }));

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.details).toBe(projectSettings);
		});

		test("prefers global over project settings when both exist", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			const projectSettings = join(mockProjectDir, ".claude", "settings.json");
			await writeFile(globalSettings, JSON.stringify({ global: true }));
			await writeFile(projectSettings, JSON.stringify({ project: true }));

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.details).toBe(globalSettings);
		});

		test("returns info when no settings.json exists", async () => {
			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("info");
			expect(result.message).toBe("No settings.json found");
		});

		test("fails with invalid JSON syntax", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			await writeFile(globalSettings, '{ "theme": "dark", "verbose": true, }'); // Trailing comma

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("fail");
			expect(result.message).toBe("JSON syntax error");
			expect(result.suggestion).toBe("Fix JSON syntax in settings.json");
		});

		test("fails with malformed JSON", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			await writeFile(globalSettings, '{ "theme": "dark"'); // Missing closing brace

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("fail");
			expect(result.message).toBe("JSON syntax error");
		});

		test("passes with empty JSON object", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			await writeFile(globalSettings, "{}");

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("Valid JSON");
		});

		test("handles file read errors gracefully", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			await writeFile(globalSettings, '{"valid": "json"}');

			// Mock readFile to throw an error
			const mockFs = await import("node:fs/promises");
			const readFileSpy = spyOn(mockFs, "readFile").mockRejectedValue(
				new Error("EACCES: permission denied"),
			);

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Permission denied");

			// Restore mock
			readFileSpy.mockRestore();
		});
	});

	describe("checkPathRefsValid", () => {
		test("returns info when no CLAUDE.md exists", async () => {
			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.id).toBe("ck-path-refs-valid");
			expect(result.name).toBe("Path References");
			expect(result.group).toBe("claudekit");
			expect(result.priority).toBe("extended");
			expect(result.status).toBe("info");
			expect(result.message).toBe("No CLAUDE.md found");
		});

		test("returns info when no @path references found", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			await writeFile(claudeMd, "# Project Instructions\nNo path references here.");

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.status).toBe("info");
			expect(result.message).toBe("No @path references found");
		});

		test("passes with valid @path references", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			const workflowFile = join(testPaths.claudeDir, "workflow.md");
			const configFile = join(testPaths.claudeDir, "config.json");

			await writeFile(workflowFile, "# Workflow");
			await writeFile(configFile, "{}");
			await writeFile(
				claudeMd,
				`
				# Project Instructions

				See @workflow.md for the main workflow
				Configuration is in @config.json
			`,
			);

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("2 valid");
		});

		test("warns about broken @path references", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			const existingFile = join(testPaths.claudeDir, "existing.md");

			await writeFile(existingFile, "# Existing");
			await writeFile(
				claudeMd,
				`
				# Project Instructions

				See @existing.md and @missing.md
				Also @another-missing-file.txt
			`,
			);

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.status).toBe("warn");
			expect(result.message).toBe("2/3 broken");
			expect(result.details).toContain("missing.md");
			expect(result.details).toContain("another-missing-file.txt");
			expect(result.suggestion).toBe("Some @path references point to missing files");
		});

		test("handles relative path references", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			const subDir = join(testPaths.claudeDir, "subdir");
			const subFile = join(subDir, "file.md");

			mkdirSync(subDir, { recursive: true });
			await writeFile(subFile, "# Sub file");
			await writeFile(claudeMd, "See @./subdir/file.md for details");

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("1 valid");
		});

		test("resolves $HOME in path references", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			const homeFile = join(homedir(), ".claude", "config.json");

			// Create file in actual home directory for test
			const homeDir = join(homedir(), ".claude");
			if (!existsSync(homeDir)) {
				mkdirSync(homeDir, { recursive: true });
			}
			await writeFile(homeFile, "{}");

			await writeFile(claudeMd, "Config at @$HOME/.claude/config.json");

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("1 valid");

			// Cleanup
			await unlink(homeFile).catch(() => {});
		});

		test("handles parse errors gracefully", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			await writeFile(claudeMd, "# Instructions\n@");

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			// Should not crash, just return info
			expect(["info", "pass"]).toContain(result.status);
		});

		test("prefers global CLAUDE.md over project", async () => {
			const globalClaudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			const projectClaudeMd = join(mockProjectDir, "claude-project", ".claude", "CLAUDE.md");
			const globalFile = join(testPaths.claudeDir, "global.md");

			await writeFile(globalFile, "# Global");
			await writeFile(globalClaudeMd, "Global: @global.md");

			// Create project directory and CLAUDE.md
			mkdirSync(join(mockProjectDir, "claude-project", ".claude"), { recursive: true });
			await writeFile(projectClaudeMd, "Project: @missing.md");

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(join(mockProjectDir, "claude-project"));

			expect(result.status).toBe("pass");
			expect(result.message).toBe("1 valid");
		});
	});

	describe("checkProjectConfigCompleteness", () => {
		test("returns info when not in a project directory", async () => {
			// Mock setup where project and global are the same
			mockSetup.project.path = mockSetup.global.path;

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(mockSetup, mockProjectDir);

			expect(result.id).toBe("ck-project-config-complete");
			expect(result.name).toBe("Project Config Completeness");
			expect(result.group).toBe("claudekit");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("info");
			expect(result.message).toBe("Not in a project directory");
			expect(result.autoFixable).toBe(false);
		});

		test("passes with complete configuration", async () => {
			// Create a project directory that's different from global
			const projectDir = join(mockProjectDir, "my-project", ".claude");
			const requiredDirs = ["agents", "commands", "workflows", "skills"];

			for (const dir of requiredDirs) {
				mkdirSync(join(projectDir, dir), { recursive: true });
			}

			// Add CLAUDE.md to make it more realistic
			await writeFile(join(projectDir, "CLAUDE.md"), "# Project Instructions");

			// Update mock to indicate it's a project with different path
			mockSetup.project.path = projectDir;
			mockSetup.project.metadata = {
				name: "Test Project",
				version: "1.0.0",
				description: "Test project",
			};

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(
				mockSetup,
				join(mockProjectDir, "my-project"),
			);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("Complete configuration");
			expect(result.details).toBe(projectDir);
		});

		test("fails when only CLAUDE.md exists", async () => {
			const projectDir = join(mockProjectDir, "minimal-project", ".claude");
			mkdirSync(projectDir, { recursive: true });
			await writeFile(join(projectDir, "CLAUDE.md"), "# Minimal");

			// Update mock to indicate it's a project with different path
			mockSetup.project.path = projectDir;
			mockSetup.project.metadata = {
				name: "Minimal Project",
				version: "1.0.0",
				description: "Minimal project",
			};

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(
				mockSetup,
				join(mockProjectDir, "minimal-project"),
			);

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Incomplete configuration");
			expect(result.details).toBe(
				"Only CLAUDE.md found - missing agents, commands, workflows, skills",
			);
			expect(result.suggestion).toBe("Run 'ck init' to install complete ClaudeKit in project");
		});

		test("fails when all required directories are missing", async () => {
			// Empty .claude directory
			const projectDir = join(mockProjectDir, "empty-project", ".claude");
			mkdirSync(projectDir, { recursive: true });

			// Update mock to indicate it's a project with different path
			mockSetup.project.path = projectDir;
			mockSetup.project.metadata = {
				name: "Empty Project",
				version: "1.0.0",
				description: "Empty project",
			};

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(
				mockSetup,
				join(mockProjectDir, "empty-project"),
			);

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Incomplete configuration");
		});

		test("warns when some directories are missing", async () => {
			const projectDir = join(mockProjectDir, "partial-project", ".claude");
			// Create only some required directories
			mkdirSync(join(projectDir, "agents"), { recursive: true });
			mkdirSync(join(projectDir, "skills"), { recursive: true });
			// Missing: commands, workflows

			// Update mock to indicate it's a project with different path
			mockSetup.project.path = projectDir;
			mockSetup.project.metadata = {
				name: "Partial Project",
				version: "1.0.0",
				description: "Partial project",
			};

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(
				mockSetup,
				join(mockProjectDir, "partial-project"),
			);

			expect(result.status).toBe("warn");
			expect(result.message).toBe("Missing 2 directories");
			expect(result.details).toContain("commands");
			expect(result.details).toContain("workflows");
			expect(result.suggestion).toBe("Run 'ck init' to update project configuration");
		});

		test("warns when one directory is missing", async () => {
			const projectDir = join(mockProjectDir, "almost-complete-project", ".claude");
			// Create all but one required directory
			mkdirSync(join(projectDir, "agents"), { recursive: true });
			mkdirSync(join(projectDir, "commands"), { recursive: true });
			mkdirSync(join(projectDir, "workflows"), { recursive: true });
			// Missing: skills

			// Update mock to indicate it's a project with different path
			mockSetup.project.path = projectDir;
			mockSetup.project.metadata = {
				name: "Almost Complete Project",
				version: "1.0.0",
				description: "Almost complete project",
			};

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(
				mockSetup,
				join(mockProjectDir, "almost-complete-project"),
			);

			expect(result.status).toBe("warn");
			expect(result.message).toBe("Missing 1 directories");
			expect(result.details).toContain("skills");
		});

		test("handles readdir errors gracefully", async () => {
			// Create .claude directory
			const projectDir = join(mockProjectDir, "error-project", ".claude");
			mkdirSync(projectDir, { recursive: true });

			// Update mock to indicate it's a project with different path
			mockSetup.project.path = projectDir;
			mockSetup.project.metadata = {
				name: "Error Project",
				version: "1.0.0",
				description: "Error project",
			};

			// Mock readdir to throw error
			const mockFs = await import("node:fs/promises");
			const readdirSpy = spyOn(mockFs, "readdir").mockRejectedValue(
				new Error("EACCES: permission denied"),
			);

			const { checkProjectConfigCompleteness } = await import(
				"../../../src/domains/health-checks/checkers/config-completeness-checker.js"
			);
			const result = await checkProjectConfigCompleteness(
				mockSetup,
				join(mockProjectDir, "error-project"),
			);

			// Should handle error gracefully
			expect(result.status).toBe("fail");

			// Restore mock
			readdirSpy.mockRestore();
		});
	});

	describe("Edge Cases", () => {
		test("handles special characters in paths", async () => {
			const globalHooksDir = join(testPaths.claudeDir, "hooks");
			mkdirSync(globalHooksDir, { recursive: true });
			await writeFile(join(globalHooksDir, "special-chars@#$%.js"), "console.log('special');");

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("1 hook(s) found");
		});

		test("handles symlinks in hooks directory", async () => {
			const globalHooksDir = join(testPaths.claudeDir, "hooks");
			const targetFile = join(testPaths.claudeDir, "target.js");
			mkdirSync(globalHooksDir, { recursive: true });

			await writeFile(targetFile, "console.log('target');");

			// Create symlink (skip if not supported)
			try {
				const { symlinkSync } = await import("node:fs");
				symlinkSync(targetFile, join(globalHooksDir, "link.js"));
			} catch {
				// Skip symlink test if not supported
				return;
			}

			const { checkHooksExist } = await import(
				"../../../src/domains/health-checks/checkers/hooks-checker.js"
			);
			const result = await checkHooksExist(mockProjectDir);

			expect(result.status).toBe("pass");
		});

		test("handles very large settings files", async () => {
			const globalSettings = join(testPaths.claudeDir, "settings.json");
			const largeConfig = { data: "x".repeat(1000000) }; // 1MB string
			await writeFile(globalSettings, JSON.stringify(largeConfig));

			const { checkSettingsValid } = await import(
				"../../../src/domains/health-checks/checkers/settings-checker.js"
			);
			const result = await checkSettingsValid(mockProjectDir);

			expect(result.status).toBe("pass");
		});

		test("handles Unicode content in CLAUDE.md", async () => {
			const claudeMd = join(testPaths.claudeDir, "CLAUDE.md");
			const unicodeFile = join(testPaths.claudeDir, "unicode.md");

			await writeFile(unicodeFile, "# Contenu en francais");
			await writeFile(claudeMd, "Voir @unicode.md pour le contenu francais");

			const { checkPathRefsValid } = await import(
				"../../../src/domains/health-checks/checkers/path-refs-checker.js"
			);
			const result = await checkPathRefsValid(mockProjectDir);

			expect(result.status).toBe("pass");
			expect(result.message).toBe("1 valid");
		});
	});
});
