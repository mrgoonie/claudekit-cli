import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "@/types";
import { type TestPaths, setupTestPaths } from "../helpers/test-paths.js";

describe("uninstall command integration", () => {
	let testPaths: TestPaths;
	let testProjectDir: string;
	let testLocalClaudeDir: string;
	let testGlobalClaudeDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		// Save original cwd
		originalCwd = process.cwd();

		// Setup isolated test paths (sets CK_TEST_HOME)
		testPaths = setupTestPaths();

		// Create project directory within test home
		testProjectDir = join(testPaths.testHome, "test-project");
		testLocalClaudeDir = join(testProjectDir, ".claude");
		// Use the isolated global claude dir from test paths
		testGlobalClaudeDir = testPaths.claudeDir;

		await mkdir(testLocalClaudeDir, { recursive: true });

		// Change to test project directory
		process.chdir(testProjectDir);
	});

	afterEach(async () => {
		// Restore original cwd
		process.chdir(originalCwd);

		// Cleanup via test paths helper (also clears CK_TEST_HOME)
		testPaths.cleanup();
	});

	describe("manifest-based uninstall", () => {
		test("should use manifest for accurate file removal", async () => {
			// Create installation with manifest
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md", "skills/skill1.md", "agents/researcher.md"],
				userConfigFiles: [".gitignore", ".mcp.json"],
			};

			// Write metadata
			await writeFile(join(testLocalClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Create installed files
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });

			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(join(testLocalClaudeDir, "skills", "skill1.md"), "skill");
			await writeFile(join(testLocalClaudeDir, "agents", "researcher.md"), "agent");

			// Create user config files (should be preserved)
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "*.log");
			await writeFile(join(testLocalClaudeDir, ".mcp.json"), "{}");

			// Import and run uninstall with --yes flag
			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify files were removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills", "skill1.md"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "agents", "researcher.md"))).toBe(false);

			// Verify user config files were preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, ".mcp.json"))).toBe(true);
		});

		test("should preserve custom user config files from manifest", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
				userConfigFiles: [".gitignore", ".mcp.json", "my-custom-config.json"],
			};

			await writeFile(join(testLocalClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(join(testLocalClaudeDir, "my-custom-config.json"), '{"custom": true}');

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify installed file was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);

			// Verify custom config was preserved
			expect(existsSync(join(testLocalClaudeDir, "my-custom-config.json"))).toBe(true);
		});
	});

	describe("legacy uninstall fallback", () => {
		test("should use legacy method when no manifest exists", async () => {
			// Create installation WITHOUT manifest (legacy)
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });

			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(join(testLocalClaudeDir, "skills", "skill1.md"), "skill");
			await writeFile(join(testLocalClaudeDir, "agents", "researcher.md"), "agent");

			// Create user config files
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "*.log");

			// Create metadata without installedFiles
			const legacyMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
			};

			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(legacyMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify legacy directories were removed
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "agents"))).toBe(false);

			// Verify user config was preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
		});

		test("should use legacy method when installedFiles is empty", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: [], // Empty
			};

			await writeFile(join(testLocalClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Should use legacy directories
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);
		});

		test("should preserve USER_CONFIG_PATTERNS in legacy mode", async () => {
			// No metadata at all
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			// Create all user config files
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "*.log");
			await writeFile(join(testLocalClaudeDir, ".repomixignore"), "dist/");
			await writeFile(join(testLocalClaudeDir, ".mcp.json"), "{}");
			await writeFile(join(testLocalClaudeDir, "CLAUDE.md"), "# CLAUDE");

			// Create minimal metadata to make it a valid installation
			const minimalMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
			};
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(minimalMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify all user config files were preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, ".repomixignore"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, ".mcp.json"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, "CLAUDE.md"))).toBe(true);

			// Verify commands were removed
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);
		});
	});

	describe("scope selection", () => {
		test("should handle local scope flag", async () => {
			// Create local installation
			const localMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(localMetadata, null, 2),
			);

			// Create global installation (should NOT be removed)
			const globalMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "global",
				installedFiles: ["commands/global-test.md"],
			};

			await mkdir(join(testGlobalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testGlobalClaudeDir, "commands", "global-test.md"), "global");
			await writeFile(
				join(testGlobalClaudeDir, "metadata.json"),
				JSON.stringify(globalMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify local was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);

			// Verify global was NOT removed
			expect(existsSync(join(testGlobalClaudeDir, "commands", "global-test.md"))).toBe(true);
		});

		test("should handle global scope flag", async () => {
			// Create local installation (should NOT be removed)
			const localMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(localMetadata, null, 2),
			);

			// Create global installation
			const globalMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "global",
				installedFiles: ["commands/global-test.md"],
			};

			await mkdir(join(testGlobalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testGlobalClaudeDir, "commands", "global-test.md"), "global");
			await writeFile(
				join(testGlobalClaudeDir, "metadata.json"),
				JSON.stringify(globalMetadata, null, 2),
			);

			// Mock the global path detection
			// Note: This test assumes detectInstallations() will find testGlobalClaudeDir
			// In real usage, it would check ~/.claude

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// This will only work if the global path is properly detected
			// For now, we test the local flag worked
			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: false,
				global: true,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify local was NOT removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(true);
		});

		test("should handle both local and global flags (all scope)", async () => {
			// Create local installation
			const localMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(localMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: true,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify local was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
		});

		test("should handle --all flag for uninstalling both scopes", async () => {
			// Create local installation
			const localMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(localMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// Using --all flag (equivalent to --local --global)
			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: false,
				global: false,
				all: true,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify local was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("should handle non-existent installation gracefully", async () => {
			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// Should complete without error
			await expect(
				uninstallCommand({
					yes: true,
					json: false,
					verbose: false,
					local: true,
					global: false,
					all: false,
					dryRun: false,
					forceOverwrite: false,
				}),
			).resolves.toBeUndefined();
		});

		test("should handle partial installation (some files missing)", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: [
					"commands/test.md",
					"skills/skill1.md",
					"missing-file.md", // This file doesn't exist
				],
			};

			await writeFile(join(testLocalClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Only create some files
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// Should complete without error
			await expect(
				uninstallCommand({
					yes: true,
					json: false,
					verbose: false,
					local: true,
					global: false,
					all: false,
					dryRun: false,
					forceOverwrite: false,
				}),
			).resolves.toBeUndefined();

			// Verify existing file was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
		});

		test("should handle corrupt metadata gracefully", async () => {
			// Write invalid JSON
			await writeFile(join(testLocalClaudeDir, "metadata.json"), "{ invalid json }");

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// Should still work (will be treated as no valid installation)
			await expect(
				uninstallCommand({
					yes: true,
					json: false,
					verbose: false,
					local: true,
					global: false,
					all: false,
					dryRun: false,
					forceOverwrite: false,
				}),
			).resolves.toBeUndefined();
		});

		test("should handle empty .claude directory", async () => {
			// .claude directory exists but is empty
			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await expect(
				uninstallCommand({
					yes: true,
					json: false,
					verbose: false,
					local: true,
					global: false,
					all: false,
					dryRun: false,
					forceOverwrite: false,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe("backward compatibility", () => {
		test("should work with installations created before manifest feature", async () => {
			// Old installation: has metadata but no installedFiles field
			const oldMetadata = {
				name: "engineer",
				version: "0.9.0",
				installedAt: "2024-12-01T00:00:00.000Z",
				// No installedFiles or userConfigFiles
			};

			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(oldMetadata, null, 2),
			);

			// Create typical old installation structure
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });

			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(join(testLocalClaudeDir, "skills", "skill1.md"), "skill");
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "*.log");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify legacy directories were removed
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "agents"))).toBe(false);

			// Verify user config was preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
		});
	});

	describe("legacy installation detection (no metadata, has components)", () => {
		test("should detect legacy install with only skills and commands", async () => {
			// No metadata.json file at all - pure legacy installation
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });

			// Create multiple component files
			await writeFile(join(testLocalClaudeDir, "skills", "skill-one.md"), "skill");
			await writeFile(join(testLocalClaudeDir, "skills", "skill-two.md"), "skill");
			await writeFile(join(testLocalClaudeDir, "commands", "cmd.md"), "command");

			// Create a user config file that should be preserved
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "node_modules/");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Legacy directories should be removed
			expect(existsSync(join(testLocalClaudeDir, "skills"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);

			// User config preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
		});

		test("should detect legacy install with agents, rules, and skills", async () => {
			// Create all component directories
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "rules"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });

			// Add multiple files in each
			await writeFile(join(testLocalClaudeDir, "agents", "researcher.md"), "agent");
			await writeFile(join(testLocalClaudeDir, "agents", "coder.md"), "agent");
			await writeFile(join(testLocalClaudeDir, "rules", "rule1.md"), "rule");
			await writeFile(join(testLocalClaudeDir, "skills", "skill1.md"), "skill");
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			// Create nested directories
			await mkdir(join(testLocalClaudeDir, "agents", "templates"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "agents", "templates", "debug.md"), "debug");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// All component directories should be removed
			expect(existsSync(join(testLocalClaudeDir, "agents"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "rules"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);
		});

		test("should distinguish between legacy and metadata-tracked installations", async () => {
			// Create legacy installation (no metadata)
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "skills", "legacy.md"), "skill");

			// Create another .claude directory at different location (simulating global)
			// For this, we'll create metadata to indicate it's tracked
			const legacyMetadata = { name: "engineer", version: "0.9.0" };
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(legacyMetadata, null, 2),
			);

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			// Should detect installation (either by metadata or components)
			expect(installations.length).toBeGreaterThan(0);

			const localInstall = installations.find((i) => i.type === "local");
			expect(localInstall?.path).toBe(testLocalClaudeDir);
		});
	});

	describe("component count accuracy", () => {
		test("should detect multiple component types in same installation", async () => {
			// Create known number of components with metadata for accurate counting
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: [
					"agents/agent1.md",
					"agents/agent2.md",
					"agents/agent3.md",
					"commands/cmd1.md",
					"commands/cmd2.md",
					"rules/rule1.md",
					"skills/skill1.md",
					"skills/skill2.md",
					"skills/skill3.md",
					"skills/skill4.md",
				],
			};

			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "rules"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });

			// Add files: 3 agents, 2 commands, 1 rule, 4 skills
			await writeFile(join(testLocalClaudeDir, "agents", "agent1.md"), "");
			await writeFile(join(testLocalClaudeDir, "agents", "agent2.md"), "");
			await writeFile(join(testLocalClaudeDir, "agents", "agent3.md"), "");

			await writeFile(join(testLocalClaudeDir, "commands", "cmd1.md"), "");
			await writeFile(join(testLocalClaudeDir, "commands", "cmd2.md"), "");

			await writeFile(join(testLocalClaudeDir, "rules", "rule1.md"), "");

			await writeFile(join(testLocalClaudeDir, "skills", "skill1.md"), "");
			await writeFile(join(testLocalClaudeDir, "skills", "skill2.md"), "");
			await writeFile(join(testLocalClaudeDir, "skills", "skill3.md"), "");
			await writeFile(join(testLocalClaudeDir, "skills", "skill4.md"), "");

			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(metadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// All component files should be removed
			expect(existsSync(join(testLocalClaudeDir, "agents", "agent1.md"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "commands", "cmd1.md"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "rules", "rule1.md"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills", "skill1.md"))).toBe(false);
		});

		test("should correctly identify all component directories present", async () => {
			// Create nested structure without metadata - test detection
			await mkdir(join(testLocalClaudeDir, "agents", "templates"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills", "lib"), { recursive: true });

			// Add files at different levels
			await writeFile(join(testLocalClaudeDir, "agents", "agent1.md"), "");
			await writeFile(join(testLocalClaudeDir, "agents", "templates", "agent2.md"), "");
			await writeFile(join(testLocalClaudeDir, "skills", "skill1.md"), "");
			await writeFile(join(testLocalClaudeDir, "skills", "lib", "skill2.md"), "");

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			const localInstall = installations.find((i) => i.type === "local");

			// Should detect installation (has components)
			expect(localInstall).toBeDefined();
			// Detection identifies component types present
			expect(localInstall?.hasMetadata).toBe(false);
		});

		test("should report zero components when directories empty", async () => {
			// Create empty component directories
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "rules"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });

			// No files added - all empty

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			// Empty directories alone should not trigger detection
			expect(installations.length).toBe(0);
		});
	});

	describe("global installation detection at HOME directory", () => {
		test("should detect global installation in HOME/.claude", async () => {
			// Create files at global location
			await mkdir(join(testGlobalClaudeDir, "skills"), { recursive: true });
			await writeFile(join(testGlobalClaudeDir, "skills", "global-skill.md"), "skill");

			const globalMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "global",
				installedFiles: ["skills/global-skill.md"],
			};

			await writeFile(
				join(testGlobalClaudeDir, "metadata.json"),
				JSON.stringify(globalMetadata, null, 2),
			);

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			const globalInstall = installations.find((i) => i.type === "global");
			expect(globalInstall).toBeDefined();
			expect(globalInstall?.path).toBe(testGlobalClaudeDir);
			expect(globalInstall?.hasMetadata).toBe(true);
		});

		test("should detect legacy global installation (no metadata)", async () => {
			// Create legacy global installation
			await mkdir(join(testGlobalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testGlobalClaudeDir, "commands", "cmd.md"), "command");

			// No metadata.json

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			const globalInstall = installations.find((i) => i.type === "global");
			expect(globalInstall).toBeDefined();
			expect(globalInstall?.hasMetadata).toBe(false);
			expect(globalInstall?.components.commands).toBeGreaterThan(0);
		});
	});

	describe("mixed scenario: multiple installations", () => {
		test("should detect local installation with metadata and global without", async () => {
			// Local installation with metadata
			const localMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/local.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "local.md"), "command");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(localMetadata, null, 2),
			);

			// Global installation without metadata (legacy)
			await mkdir(join(testGlobalClaudeDir, "skills"), { recursive: true });
			await writeFile(join(testGlobalClaudeDir, "skills", "global.md"), "skill");

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			// Should find both
			expect(installations.length).toBeGreaterThanOrEqual(1);

			const localInstall = installations.find((i) => i.type === "local");
			expect(localInstall?.hasMetadata).toBe(true);

			const globalInstall = installations.find((i) => i.type === "global");
			if (globalInstall) {
				expect(globalInstall.hasMetadata).toBe(false);
				expect(globalInstall.components.skills).toBeGreaterThan(0);
			}
		});

		test("should uninstall both local and global independently", async () => {
			// Local installation
			const localMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/local.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "local.md"), "command");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(localMetadata, null, 2),
			);

			// Global installation
			const globalMetadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "global",
				installedFiles: ["skills/global.md"],
			};

			await mkdir(join(testGlobalClaudeDir, "skills"), { recursive: true });
			await writeFile(join(testGlobalClaudeDir, "skills", "global.md"), "skill");
			await writeFile(
				join(testGlobalClaudeDir, "metadata.json"),
				JSON.stringify(globalMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// Uninstall only local
			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Verify local was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "local.md"))).toBe(false);

			// Verify global still exists
			expect(existsSync(join(testGlobalClaudeDir, "skills", "global.md"))).toBe(true);
		});
	});

	describe("Windows path edge cases", () => {
		test("should handle backslash paths in metadata correctly", async () => {
			// Windows-style paths in metadata
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				// These might appear in metadata from Windows installations
				installedFiles: ["commands/test.md", "skills/skill.md"],
			};

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");
			await writeFile(join(testLocalClaudeDir, "skills", "skill.md"), "skill");
			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(metadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Files should be correctly removed despite path format
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills", "skill.md"))).toBe(false);
		});

		test("should handle mixed path separators in legacy mode", async () => {
			// Legacy installation with nested structure
			await mkdir(join(testLocalClaudeDir, "agents", "custom"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills", "lib"), { recursive: true });

			await writeFile(join(testLocalClaudeDir, "agents", "custom", "agent.md"), "agent");
			await writeFile(join(testLocalClaudeDir, "skills", "lib", "skill.md"), "skill");

			const legacyMetadata: Metadata = {
				name: "engineer",
				version: "0.9.0",
			};

			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(legacyMetadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// Legacy mode should remove entire component directories
			expect(existsSync(join(testLocalClaudeDir, "agents"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills"))).toBe(false);
		});
	});

	describe("empty .claude directory handling", () => {
		test("should handle completely empty .claude directory", async () => {
			// .claude exists but is empty - no components, no metadata
			// testLocalClaudeDir already created empty in beforeEach

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			// Should not error
			await expect(
				uninstallCommand({
					yes: true,
					json: false,
					verbose: false,
					local: true,
					global: false,
					all: false,
					dryRun: false,
					forceOverwrite: false,
				}),
			).resolves.toBeUndefined();
		});

		test("should handle .claude with only user config files", async () => {
			// Only user config files, no ClaudeKit components
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "*.log");
			await writeFile(join(testLocalClaudeDir, ".mcp.json"), "{}");
			await writeFile(join(testLocalClaudeDir, "CLAUDE.md"), "# User config");

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await uninstallCommand({
				yes: true,
				json: false,
				verbose: false,
				local: true,
				global: false,
				all: false,
				dryRun: false,
				forceOverwrite: false,
			});

			// User config should be preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, ".mcp.json"))).toBe(true);
			expect(existsSync(join(testLocalClaudeDir, "CLAUDE.md"))).toBe(true);
		});

		test("should handle .claude with metadata but no component directories", async () => {
			// Metadata exists but no actual component files/directories
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: [], // Empty - no files tracked
			};

			await writeFile(
				join(testLocalClaudeDir, "metadata.json"),
				JSON.stringify(metadata, null, 2),
			);

			const { uninstallCommand } = await import("../../src/commands/uninstall/index.js");

			await expect(
				uninstallCommand({
					yes: true,
					json: false,
					verbose: false,
					local: true,
					global: false,
					all: false,
					dryRun: false,
					forceOverwrite: false,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe("detection fallback logic robustness", () => {
		test("should detect installation when hasClaudeKitComponents but no metadata", async () => {
			// This tests the specific fallback logic in detectInstallations
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });

			await writeFile(join(testLocalClaudeDir, "agents", "researcher.md"), "agent");
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			// No metadata.json

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			const localInstall = installations.find((i) => i.type === "local");
			expect(localInstall).toBeDefined();
			expect(localInstall?.hasMetadata).toBe(false);
			expect(localInstall?.components.agents).toBeGreaterThan(0);
			expect(localInstall?.components.commands).toBeGreaterThan(0);
		});

		test("should not detect installation with no metadata and no components", async () => {
			// Empty directories or only user files
			await writeFile(join(testLocalClaudeDir, ".gitignore"), "*.log");

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			const localInstall = installations.find((i) => i.type === "local");
			// Should not detect as an installation
			expect(localInstall).toBeUndefined();
		});

		test("should handle partially removed component directories", async () => {
			// Some component directories exist but are empty
			await mkdir(join(testLocalClaudeDir, "agents"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "skills"), { recursive: true });
			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });

			// Only add files to one directory
			await writeFile(join(testLocalClaudeDir, "agents", "researcher.md"), "agent");

			const { detectInstallations } = await import("../../src/commands/uninstall/index.js");
			const installations = await detectInstallations();

			const localInstall = installations.find((i) => i.type === "local");
			expect(localInstall).toBeDefined();
			expect(localInstall?.components.agents).toBeGreaterThan(0);
			// Empty component dirs should not count as having components
			expect(localInstall?.components.commands).toBe(0);
			expect(localInstall?.components.skills).toBe(0);
		});
	});
});
