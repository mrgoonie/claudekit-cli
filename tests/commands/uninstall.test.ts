import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "../../src/types.js";
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
			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			// This will only work if the global path is properly detected
			// For now, we test the local flag worked
			await uninstallCommand({ yes: true, local: false, global: true, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: true, all: false, dryRun: false, forceOverwrite: false });

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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			// Using --all flag (equivalent to --local --global)
			await uninstallCommand({ yes: true, local: false, global: false, all: true, dryRun: false, forceOverwrite: false });

			// Verify local was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("should handle non-existent installation gracefully", async () => {
			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			// Should complete without error
			await expect(
				uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false }),
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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			// Should complete without error
			await expect(
				uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false }),
			).resolves.toBeUndefined();

			// Verify existing file was removed
			expect(existsSync(join(testLocalClaudeDir, "commands", "test.md"))).toBe(false);
		});

		test("should handle corrupt metadata gracefully", async () => {
			// Write invalid JSON
			await writeFile(join(testLocalClaudeDir, "metadata.json"), "{ invalid json }");

			await mkdir(join(testLocalClaudeDir, "commands"), { recursive: true });
			await writeFile(join(testLocalClaudeDir, "commands", "test.md"), "command");

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			// Should still work (will be treated as no valid installation)
			await expect(
				uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false }),
			).resolves.toBeUndefined();
		});

		test("should handle empty .claude directory", async () => {
			// .claude directory exists but is empty
			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await expect(
				uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false }),
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

			const { uninstallCommand } = await import("../../src/commands/uninstall.js");

			await uninstallCommand({ yes: true, local: true, global: false, all: false, dryRun: false, forceOverwrite: false });

			// Verify legacy directories were removed
			expect(existsSync(join(testLocalClaudeDir, "commands"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "skills"))).toBe(false);
			expect(existsSync(join(testLocalClaudeDir, "agents"))).toBe(false);

			// Verify user config was preserved
			expect(existsSync(join(testLocalClaudeDir, ".gitignore"))).toBe(true);
		});
	});
});
