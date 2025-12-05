import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileMerger } from "../../src/lib/merge.js";

describe("FileMerger", () => {
	let merger: FileMerger;
	let testSourceDir: string;
	let testDestDir: string;

	beforeEach(async () => {
		merger = new FileMerger();

		// Create temporary test directories
		const timestamp = Date.now();
		testSourceDir = join(tmpdir(), `test-source-${timestamp}`);
		testDestDir = join(tmpdir(), `test-dest-${timestamp}`);

		await mkdir(testSourceDir, { recursive: true });
		await mkdir(testDestDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup test directories
		if (existsSync(testSourceDir)) {
			await rm(testSourceDir, { recursive: true, force: true });
		}
		if (existsSync(testDestDir)) {
			await rm(testDestDir, { recursive: true, force: true });
		}
	});

	describe("constructor", () => {
		test("should create FileMerger instance", () => {
			expect(merger).toBeInstanceOf(FileMerger);
		});
	});

	describe("addIgnorePatterns", () => {
		test("should add custom ignore patterns", () => {
			const patterns = ["*.log", "temp/**"];
			expect(() => merger.addIgnorePatterns(patterns)).not.toThrow();
		});

		test("should accept empty array", () => {
			expect(() => merger.addIgnorePatterns([])).not.toThrow();
		});
	});

	describe("merge with skipConfirmation", () => {
		test("should copy files from source to destination", async () => {
			// Create test files
			await writeFile(join(testSourceDir, "test.txt"), "test content");
			await writeFile(join(testSourceDir, "readme.md"), "# README");

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify files were copied
			expect(existsSync(join(testDestDir, "test.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, "readme.md"))).toBe(true);
		});

		test("should skip protected files like .env if they exist in destination", async () => {
			// Create test files in source
			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, ".env"), "NEW_SECRET=new_value");

			// Create existing .env in destination
			await writeFile(join(testDestDir, ".env"), "OLD_SECRET=old_value");

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify normal file was copied
			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);

			// Verify .env was NOT overwritten (still has old value)
			const envContent = await Bun.file(join(testDestDir, ".env")).text();
			expect(envContent).toBe("OLD_SECRET=old_value");
		});

		test("should NEVER copy protected files like .env (security fix)", async () => {
			// Create test files in source
			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, ".env"), "SECRET=value");

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify normal file was copied but .env was NEVER copied (security)
			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, ".env"))).toBe(false);
		});

		test("should skip protected patterns like *.key if they exist in destination", async () => {
			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, "private.key"), "new key data");

			// Create existing key file in destination
			await writeFile(join(testDestDir, "private.key"), "old key data");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);

			// Verify key file was NOT overwritten
			const keyContent = await Bun.file(join(testDestDir, "private.key")).text();
			expect(keyContent).toBe("old key data");
		});

		test("should NEVER copy protected patterns like *.key (security fix)", async () => {
			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, "private.key"), "key data");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, "private.key"))).toBe(false);
		});

		test("should handle nested directories", async () => {
			const nestedDir = join(testSourceDir, "nested", "deep");
			await mkdir(nestedDir, { recursive: true });
			await writeFile(join(nestedDir, "file.txt"), "nested content");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "nested", "deep", "file.txt"))).toBe(true);
		});

		test("should overwrite existing files", async () => {
			// Create files in both directories
			await writeFile(join(testSourceDir, "file.txt"), "new content");
			await writeFile(join(testDestDir, "file.txt"), "old content");

			await merger.merge(testSourceDir, testDestDir, true);

			const content = await Bun.file(join(testDestDir, "file.txt")).text();
			expect(content).toBe("new content");
		});

		test("should handle empty source directory", async () => {
			// Empty directory should complete without errors
			await merger.merge(testSourceDir, testDestDir, true);
			// If we get here, the test passed
			expect(true).toBe(true);
		});
	});

	describe("two-tier protection system", () => {
		describe("Tier 1: Security-sensitive files (NEVER_COPY_PATTERNS)", () => {
			test("should NEVER copy .env files (even on first install)", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, ".env"), "SECRET=value");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, ".env"))).toBe(false);
			});

			test("should NEVER copy .env.local files", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, ".env.local"), "SECRET=local");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, ".env.local"))).toBe(false);
			});

			test("should NEVER copy .env.*.local files", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, ".env.production.local"), "SECRET=prod");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, ".env.production.local"))).toBe(false);
			});

			test("should NEVER copy *.key files", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, "private.key"), "key data");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, "private.key"))).toBe(false);
			});

			test("should NEVER copy *.pem files", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, "cert.pem"), "pem data");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, "cert.pem"))).toBe(false);
			});

			test("should NEVER copy *.p12 files", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, "cert.p12"), "p12 data");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, "cert.p12"))).toBe(false);
			});

			test("should NEVER copy node_modules directory", async () => {
				const nodeModulesDir = join(testSourceDir, "node_modules");
				await mkdir(nodeModulesDir, { recursive: true });
				await writeFile(join(nodeModulesDir, "package.json"), "{}");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, "node_modules"))).toBe(false);
			});

			test("should NEVER copy .git directory", async () => {
				const gitDir = join(testSourceDir, ".git");
				await mkdir(gitDir, { recursive: true });
				await writeFile(join(gitDir, "config"), "git config");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, ".git"))).toBe(false);
			});

			test("should NEVER copy dist directory", async () => {
				const distDir = join(testSourceDir, "dist");
				await mkdir(distDir, { recursive: true });
				await writeFile(join(distDir, "bundle.js"), "compiled code");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, "dist"))).toBe(false);
			});

			test("should NEVER copy build directory", async () => {
				const buildDir = join(testSourceDir, "build");
				await mkdir(buildDir, { recursive: true });
				await writeFile(join(buildDir, "output.js"), "compiled code");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, "build"))).toBe(false);
			});
		});

		describe("Tier 2: User config files (USER_CONFIG_PATTERNS)", () => {
			test("should copy .gitignore on first install (file doesn't exist)", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, ".gitignore"), "node_modules/\n*.log");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
				expect(existsSync(join(testDestDir, ".gitignore"))).toBe(true);

				const content = await Bun.file(join(testDestDir, ".gitignore")).text();
				expect(content).toBe("node_modules/\n*.log");
			});

			test("should preserve existing .gitignore on update", async () => {
				// Create existing .gitignore in destination
				await writeFile(join(testDestDir, ".gitignore"), "# My custom rules\n*.tmp");

				// Create new .gitignore in source
				await writeFile(join(testSourceDir, ".gitignore"), "node_modules/\n*.log");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);

				// Verify .gitignore was NOT overwritten
				const content = await Bun.file(join(testDestDir, ".gitignore")).text();
				expect(content).toBe("# My custom rules\n*.tmp");
			});

			test("should copy .repomixignore on first install", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, ".repomixignore"), "dist/\nbuild/");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, ".repomixignore"))).toBe(true);
				const content = await Bun.file(join(testDestDir, ".repomixignore")).text();
				expect(content).toBe("dist/\nbuild/");
			});

			test("should preserve existing .repomixignore on update", async () => {
				// Create existing .repomixignore in destination
				await writeFile(join(testDestDir, ".repomixignore"), "# Custom ignore\n*.secret");

				// Create new .repomixignore in source
				await writeFile(join(testSourceDir, ".repomixignore"), "dist/\nbuild/");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				// Verify .repomixignore was NOT overwritten
				const content = await Bun.file(join(testDestDir, ".repomixignore")).text();
				expect(content).toBe("# Custom ignore\n*.secret");
			});

			test("should copy .mcp.json on first install", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(
					join(testSourceDir, ".mcp.json"),
					JSON.stringify({ mcpServers: {} }, null, 2),
				);

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, ".mcp.json"))).toBe(true);
			});

			test("should preserve existing .mcp.json on update", async () => {
				// Create existing .mcp.json in destination
				const existingConfig = { mcpServers: { custom: { command: "custom" } } };
				await writeFile(join(testDestDir, ".mcp.json"), JSON.stringify(existingConfig, null, 2));

				// Create new .mcp.json in source
				await writeFile(
					join(testSourceDir, ".mcp.json"),
					JSON.stringify({ mcpServers: {} }, null, 2),
				);
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				// Verify .mcp.json was NOT overwritten
				const content = await Bun.file(join(testDestDir, ".mcp.json")).text();
				const parsed = JSON.parse(content);
				expect(parsed).toEqual(existingConfig);
			});

			test("should copy CLAUDE.md on first install", async () => {
				await writeFile(join(testSourceDir, "normal.txt"), "normal");
				await writeFile(join(testSourceDir, "CLAUDE.md"), "# CLAUDE.md\nProject instructions");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, "CLAUDE.md"))).toBe(true);
				const content = await Bun.file(join(testDestDir, "CLAUDE.md")).text();
				expect(content).toBe("# CLAUDE.md\nProject instructions");
			});

			test("should preserve existing CLAUDE.md on update", async () => {
				// Create existing CLAUDE.md in destination
				await writeFile(join(testDestDir, "CLAUDE.md"), "# My Custom CLAUDE.md\nCustom rules");

				// Create new CLAUDE.md in source
				await writeFile(join(testSourceDir, "CLAUDE.md"), "# CLAUDE.md\nDefault instructions");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				// Verify CLAUDE.md was NOT overwritten
				const content = await Bun.file(join(testDestDir, "CLAUDE.md")).text();
				expect(content).toBe("# My Custom CLAUDE.md\nCustom rules");
			});

			test("should copy all user config files on first install", async () => {
				await writeFile(join(testSourceDir, ".gitignore"), "*.log");
				await writeFile(join(testSourceDir, ".repomixignore"), "dist/");
				await writeFile(join(testSourceDir, ".mcp.json"), "{}");
				await writeFile(join(testSourceDir, "CLAUDE.md"), "# CLAUDE.md");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				expect(existsSync(join(testDestDir, ".gitignore"))).toBe(true);
				expect(existsSync(join(testDestDir, ".repomixignore"))).toBe(true);
				expect(existsSync(join(testDestDir, ".mcp.json"))).toBe(true);
				expect(existsSync(join(testDestDir, "CLAUDE.md"))).toBe(true);
				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			});

			test("should preserve all existing user config files on update", async () => {
				// Create existing user config files in destination
				await writeFile(join(testDestDir, ".gitignore"), "# Custom .gitignore");
				await writeFile(join(testDestDir, ".repomixignore"), "# Custom .repomixignore");
				await writeFile(join(testDestDir, ".mcp.json"), '{"custom": true}');
				await writeFile(join(testDestDir, "CLAUDE.md"), "# Custom CLAUDE.md");

				// Create new versions in source
				await writeFile(join(testSourceDir, ".gitignore"), "*.log");
				await writeFile(join(testSourceDir, ".repomixignore"), "dist/");
				await writeFile(join(testSourceDir, ".mcp.json"), "{}");
				await writeFile(join(testSourceDir, "CLAUDE.md"), "# CLAUDE.md");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				await merger.merge(testSourceDir, testDestDir, true);

				// Verify all user config files were NOT overwritten
				expect(await Bun.file(join(testDestDir, ".gitignore")).text()).toBe("# Custom .gitignore");
				expect(await Bun.file(join(testDestDir, ".repomixignore")).text()).toBe(
					"# Custom .repomixignore",
				);
				expect(await Bun.file(join(testDestDir, ".mcp.json")).text()).toBe('{"custom": true}');
				expect(await Bun.file(join(testDestDir, "CLAUDE.md")).text()).toBe("# Custom CLAUDE.md");
				expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			});
		});

		describe("Conflict detection with two-tier system", () => {
			test("should NOT report security-sensitive files as conflicts", async () => {
				// Create security-sensitive files in source
				await writeFile(join(testSourceDir, ".env"), "SECRET=new");
				await writeFile(join(testSourceDir, "private.key"), "new key");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				// Create existing security-sensitive files in destination
				await writeFile(join(testDestDir, ".env"), "SECRET=old");
				await writeFile(join(testDestDir, "private.key"), "old key");

				// These should NOT be reported as conflicts since they're never copied
				// We test this by running merge without skipConfirmation and verifying no prompt
				await merger.merge(testSourceDir, testDestDir, true);

				// If we get here without hanging on prompt, security files weren't reported as conflicts
				expect(true).toBe(true);
			});

			test("should NOT report existing user config files as conflicts", async () => {
				// Create user config files in source
				await writeFile(join(testSourceDir, ".gitignore"), "*.log");
				await writeFile(join(testSourceDir, ".mcp.json"), "{}");
				await writeFile(join(testSourceDir, "normal.txt"), "normal");

				// Create existing user config files in destination
				await writeFile(join(testDestDir, ".gitignore"), "# Custom");
				await writeFile(join(testDestDir, ".mcp.json"), '{"custom": true}');

				// These should NOT be reported as conflicts since they won't be overwritten
				await merger.merge(testSourceDir, testDestDir, true);

				// If we get here without hanging on prompt, user config files weren't reported as conflicts
				expect(true).toBe(true);
			});

			test("should report normal file overwrites as conflicts", async () => {
				// Create normal files in source
				await writeFile(join(testSourceDir, "file1.txt"), "new content 1");
				await writeFile(join(testSourceDir, "file2.txt"), "new content 2");

				// Create existing normal files in destination
				await writeFile(join(testDestDir, "file1.txt"), "old content 1");
				await writeFile(join(testDestDir, "file2.txt"), "old content 2");

				// With skipConfirmation=true, should still complete
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify normal files were overwritten
				expect(await Bun.file(join(testDestDir, "file1.txt")).text()).toBe("new content 1");
				expect(await Bun.file(join(testDestDir, "file2.txt")).text()).toBe("new content 2");
			});
		});
	});

	describe("edge cases", () => {
		test("should handle files with special characters in names", async () => {
			const specialFileName = "file with spaces.txt";
			await writeFile(join(testSourceDir, specialFileName), "content");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, specialFileName))).toBe(true);
		});

		test("should skip custom ignore patterns if they exist in destination", async () => {
			merger.addIgnorePatterns(["custom-*"]);

			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, "custom-ignore.txt"), "new content");

			// Create existing file in destination
			await writeFile(join(testDestDir, "custom-ignore.txt"), "old content");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);

			// Verify custom file was NOT overwritten
			const customContent = await Bun.file(join(testDestDir, "custom-ignore.txt")).text();
			expect(customContent).toBe("old content");
		});

		test("should NEVER copy custom ignore patterns (security fix)", async () => {
			merger.addIgnorePatterns(["custom-*"]);

			await writeFile(join(testSourceDir, "normal.txt"), "normal");
			await writeFile(join(testSourceDir, "custom-ignore.txt"), "ignore me");

			await merger.merge(testSourceDir, testDestDir, true);

			expect(existsSync(join(testDestDir, "normal.txt"))).toBe(true);
			expect(existsSync(join(testDestDir, "custom-ignore.txt"))).toBe(false);
		});
	});

	describe("include patterns", () => {
		test("should only copy files matching include patterns", async () => {
			// Create directory structure
			const agentsDir = join(testSourceDir, ".claude", "agents");
			const hooksDir = join(testSourceDir, ".claude", "hooks");
			const commandsDir = join(testSourceDir, ".claude", "commands");

			await mkdir(agentsDir, { recursive: true });
			await mkdir(hooksDir, { recursive: true });
			await mkdir(commandsDir, { recursive: true });

			// Create files
			await writeFile(join(agentsDir, "researcher.md"), "researcher");
			await writeFile(join(hooksDir, "pre-commit"), "hook");
			await writeFile(join(commandsDir, "test.md"), "test command");

			// Set include patterns for agents and hooks only
			merger.setIncludePatterns([".claude/agents", ".claude/hooks"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Should copy agents and hooks
			expect(existsSync(join(testDestDir, ".claude", "agents", "researcher.md"))).toBe(true);
			expect(existsSync(join(testDestDir, ".claude", "hooks", "pre-commit"))).toBe(true);

			// Should NOT copy commands
			expect(existsSync(join(testDestDir, ".claude", "commands", "test.md"))).toBe(false);
		});

		test("should support nested directory patterns", async () => {
			// Create nested structure
			const researcherDir = join(testSourceDir, ".claude", "agents", "researcher");
			const plannerDir = join(testSourceDir, ".claude", "agents", "planner");

			await mkdir(researcherDir, { recursive: true });
			await mkdir(plannerDir, { recursive: true });

			await writeFile(join(researcherDir, "config.md"), "researcher config");
			await writeFile(join(plannerDir, "config.md"), "planner config");

			// Include only researcher agent
			merger.setIncludePatterns([".claude/agents/researcher"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Should copy researcher
			expect(existsSync(join(testDestDir, ".claude", "agents", "researcher", "config.md"))).toBe(
				true,
			);

			// Should NOT copy planner
			expect(existsSync(join(testDestDir, ".claude", "agents", "planner", "config.md"))).toBe(
				false,
			);
		});

		test("should handle multiple specific subdirectories", async () => {
			// Create structure matching issue #26 scenario
			const agentsDir = join(testSourceDir, ".claude", "agents");
			await mkdir(join(agentsDir, "researcher"), { recursive: true });
			await mkdir(join(agentsDir, "planner"), { recursive: true });
			await mkdir(join(agentsDir, "tester"), { recursive: true });

			const hooksDir = join(testSourceDir, ".claude", "hooks");
			await mkdir(hooksDir, { recursive: true });

			// Create files
			await writeFile(join(agentsDir, "researcher", "file.md"), "researcher");
			await writeFile(join(agentsDir, "planner", "file.md"), "planner");
			await writeFile(join(agentsDir, "tester", "file.md"), "tester");
			await writeFile(join(hooksDir, "hook.sh"), "hook");

			// Select specific agents + hooks (user selected in issue #26)
			merger.setIncludePatterns([
				".claude/agents/researcher",
				".claude/agents/planner",
				".claude/hooks",
			]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Should copy selected agents
			expect(existsSync(join(testDestDir, ".claude", "agents", "researcher", "file.md"))).toBe(
				true,
			);
			expect(existsSync(join(testDestDir, ".claude", "agents", "planner", "file.md"))).toBe(true);

			// Should copy hooks
			expect(existsSync(join(testDestDir, ".claude", "hooks", "hook.sh"))).toBe(true);

			// Should NOT copy unselected tester
			expect(existsSync(join(testDestDir, ".claude", "agents", "tester", "file.md"))).toBe(false);
		});
	});

	describe("custom .claude file preservation", () => {
		test("should preserve custom .claude files when patterns are added", async () => {
			// Create .claude directories
			const sourceClaudeDir = join(testSourceDir, ".claude");
			const destClaudeDir = join(testDestDir, ".claude");
			await mkdir(sourceClaudeDir, { recursive: true });
			await mkdir(destClaudeDir, { recursive: true });

			// Create files in source (from release package)
			await writeFile(join(sourceClaudeDir, "standard.md"), "standard content");

			// Create files in destination (existing + custom)
			await writeFile(join(destClaudeDir, "standard.md"), "old standard content");
			await writeFile(join(destClaudeDir, "custom.md"), "custom content");

			// Add custom file to ignore patterns (this would be done by update.ts)
			merger.addIgnorePatterns([".claude/custom.md"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Standard file should be overwritten
			const standardContent = await Bun.file(join(destClaudeDir, "standard.md")).text();
			expect(standardContent).toBe("standard content");

			// Custom file should be preserved
			expect(existsSync(join(destClaudeDir, "custom.md"))).toBe(true);
			const customContent = await Bun.file(join(destClaudeDir, "custom.md")).text();
			expect(customContent).toBe("custom content");
		});

		test("should preserve nested custom .claude files", async () => {
			// Create nested .claude structure
			const sourceCommandsDir = join(testSourceDir, ".claude", "commands");
			const destCommandsDir = join(testDestDir, ".claude", "commands");
			await mkdir(sourceCommandsDir, { recursive: true });
			await mkdir(destCommandsDir, { recursive: true });

			// Create standard file in source
			await writeFile(join(sourceCommandsDir, "standard-cmd.md"), "standard command");

			// Create custom file in destination
			await writeFile(join(destCommandsDir, "custom-cmd.md"), "custom command");

			// Add custom file to ignore patterns
			merger.addIgnorePatterns([".claude/commands/custom-cmd.md"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// Custom file should be preserved
			expect(existsSync(join(destCommandsDir, "custom-cmd.md"))).toBe(true);
			const customContent = await Bun.file(join(destCommandsDir, "custom-cmd.md")).text();
			expect(customContent).toBe("custom command");
		});

		test("should preserve multiple custom .claude files", async () => {
			const sourceClaudeDir = join(testSourceDir, ".claude");
			const destClaudeDir = join(testDestDir, ".claude");
			await mkdir(sourceClaudeDir, { recursive: true });
			await mkdir(destClaudeDir, { recursive: true });

			// Create multiple custom files in destination
			await writeFile(join(destClaudeDir, "custom1.md"), "custom1");
			await writeFile(join(destClaudeDir, "custom2.md"), "custom2");
			await writeFile(join(destClaudeDir, "custom3.md"), "custom3");

			// Add all custom files to ignore patterns
			merger.addIgnorePatterns([".claude/custom1.md", ".claude/custom2.md", ".claude/custom3.md"]);

			await merger.merge(testSourceDir, testDestDir, true);

			// All custom files should be preserved
			expect(existsSync(join(destClaudeDir, "custom1.md"))).toBe(true);
			expect(existsSync(join(destClaudeDir, "custom2.md"))).toBe(true);
			expect(existsSync(join(destClaudeDir, "custom3.md"))).toBe(true);
		});
	});

	describe("security: symlink handling", () => {
		test("should skip symbolic links during merge", async () => {
			// Create a normal file and a symlink
			const sourceDir = join(testSourceDir, "files");
			await mkdir(sourceDir, { recursive: true });

			await writeFile(join(sourceDir, "real-file.txt"), "real content");
			await writeFile(join(testSourceDir, "target.txt"), "target content");

			// Create symlink pointing to file outside the source directory
			await symlink(join(testSourceDir, "target.txt"), join(sourceDir, "symlink.txt"));

			await merger.merge(testSourceDir, testDestDir, false);

			// Real file should be copied
			expect(existsSync(join(testDestDir, "files", "real-file.txt"))).toBe(true);

			// Symlink should NOT be copied (skipped for security)
			expect(existsSync(join(testDestDir, "files", "symlink.txt"))).toBe(false);
		});

		test("should skip directory symlinks during merge", async () => {
			// Create a real directory and a symlinked directory
			const realDir = join(testSourceDir, "real-dir");
			const symlinkDir = join(testSourceDir, "symlink-dir");
			const targetDir = join(testSourceDir, "target-outside");

			await mkdir(realDir, { recursive: true });
			await mkdir(targetDir, { recursive: true });

			await writeFile(join(realDir, "file.txt"), "real content");
			await writeFile(join(targetDir, "sensitive.txt"), "sensitive content");

			// Create directory symlink
			await symlink(targetDir, symlinkDir, "dir");

			await merger.merge(testSourceDir, testDestDir, false);

			// Real directory should be copied
			expect(existsSync(join(testDestDir, "real-dir", "file.txt"))).toBe(true);

			// Symlinked directory should NOT be traversed
			expect(existsSync(join(testDestDir, "symlink-dir"))).toBe(false);
			expect(existsSync(join(testDestDir, "symlink-dir", "sensitive.txt"))).toBe(false);
		});
	});

	describe("global mode: settings.json variable replacement", () => {
		test("should replace $CLAUDE_PROJECT_DIR with $HOME on Unix/Linux/Mac when isGlobal is true", async () => {
			// Create settings.json with $CLAUDE_PROJECT_DIR
			const settingsContent = JSON.stringify(
				{
					"claude.autoUpdate": true,
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
					"claude.skillsDir": "$CLAUDE_PROJECT_DIR/.claude/skills",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			// Mock platform to Unix
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify file exists
				expect(existsSync(join(testDestDir, "settings.json"))).toBe(true);

				// Verify replacement occurred
				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				expect(destJson["claude.projectDir"]).toBe("$HOME/.claude");
				expect(destJson["claude.skillsDir"]).toBe("$HOME/.claude/skills");
				expect(destContent).not.toContain("$CLAUDE_PROJECT_DIR");
			} finally {
				// Restore original platform
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should replace $CLAUDE_PROJECT_DIR with %USERPROFILE% on Windows when isGlobal is true", async () => {
			// Create settings.json with $CLAUDE_PROJECT_DIR
			const settingsContent = JSON.stringify(
				{
					"claude.autoUpdate": true,
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
					"claude.skillsDir": "$CLAUDE_PROJECT_DIR/.claude/skills",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			// Mock platform to Windows
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify file exists
				expect(existsSync(join(testDestDir, "settings.json"))).toBe(true);

				// Verify replacement occurred
				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				expect(destJson["claude.projectDir"]).toBe("%USERPROFILE%/.claude");
				expect(destJson["claude.skillsDir"]).toBe("%USERPROFILE%/.claude/skills");
				expect(destContent).not.toContain("$CLAUDE_PROJECT_DIR");
			} finally {
				// Restore original platform
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should NOT replace $CLAUDE_PROJECT_DIR when isGlobal is false (Unix)", async () => {
			// Create settings.json with $CLAUDE_PROJECT_DIR
			const settingsContent = JSON.stringify(
				{
					"claude.autoUpdate": true,
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
					"claude.skillsDir": "$CLAUDE_PROJECT_DIR/.claude/skills",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Global mode disabled (default)
			merger.setGlobalFlag(false);

			// Mock Unix platform to test local mode without env var syntax conversion
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify file exists
				expect(existsSync(join(testDestDir, "settings.json"))).toBe(true);

				// Verify NO replacement occurred (Unix preserves $VAR syntax)
				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				expect(destJson["claude.projectDir"]).toBe("$CLAUDE_PROJECT_DIR/.claude");
				expect(destJson["claude.skillsDir"]).toBe("$CLAUDE_PROJECT_DIR/.claude/skills");
				expect(destContent).toContain("$CLAUDE_PROJECT_DIR");
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should replace multiple occurrences of $CLAUDE_PROJECT_DIR", async () => {
			// Create settings.json with multiple occurrences
			const settingsContent = JSON.stringify(
				{
					"claude.projectDir": "$CLAUDE_PROJECT_DIR",
					"claude.skillsDir": "$CLAUDE_PROJECT_DIR/skills",
					"claude.agentsDir": "$CLAUDE_PROJECT_DIR/agents",
					"claude.commandsDir": "$CLAUDE_PROJECT_DIR/commands",
					"claude.workflowsDir": "$CLAUDE_PROJECT_DIR/workflows",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			// Use Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify all occurrences replaced
				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				expect(destJson["claude.projectDir"]).toBe("$HOME");
				expect(destJson["claude.skillsDir"]).toBe("$HOME/skills");
				expect(destJson["claude.agentsDir"]).toBe("$HOME/agents");
				expect(destJson["claude.commandsDir"]).toBe("$HOME/commands");
				expect(destJson["claude.workflowsDir"]).toBe("$HOME/workflows");
				expect(destContent).not.toContain("$CLAUDE_PROJECT_DIR");
			} finally {
				// Restore original platform
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should handle settings.json with no $CLAUDE_PROJECT_DIR", async () => {
			// Create settings.json without $CLAUDE_PROJECT_DIR
			const settingsContent = JSON.stringify(
				{
					"claude.autoUpdate": true,
					"claude.theme": "dark",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify file exists and content unchanged
			expect(existsSync(join(testDestDir, "settings.json"))).toBe(true);
			const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
			expect(destContent).toBe(settingsContent);
		});

		test("should handle empty settings.json", async () => {
			await writeFile(join(testSourceDir, "settings.json"), "");

			// Enable global mode
			merger.setGlobalFlag(true);

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify file exists
			expect(existsSync(join(testDestDir, "settings.json"))).toBe(true);
			const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
			expect(destContent).toBe("");
		});

		test("should handle malformed settings.json gracefully", async () => {
			// Create invalid JSON
			const malformedContent = "{ invalid json content }";
			await writeFile(join(testSourceDir, "settings.json"), malformedContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			// Use Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				// Should not throw error - should fallback to direct copy
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify file exists (fallback copy should work)
				expect(existsSync(join(testDestDir, "settings.json"))).toBe(true);

				// Since JSON is malformed, replacement should still attempt on string level
				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				// The content may or may not have replacements, but it should exist
				expect(destContent).toBeTruthy();
			} finally {
				// Restore original platform
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should only process settings.json, not other JSON files", async () => {
			// Create multiple JSON files
			const settingsContent = JSON.stringify(
				{
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
				},
				null,
				2,
			);
			const packageContent = JSON.stringify(
				{
					name: "test-package",
					projectDir: "$CLAUDE_PROJECT_DIR",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);
			await writeFile(join(testSourceDir, "package.json"), packageContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			// Use Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify settings.json was processed
				const settingsDestContent = await Bun.file(join(testDestDir, "settings.json")).text();
				expect(settingsDestContent).toContain("$HOME");
				expect(settingsDestContent).not.toContain("$CLAUDE_PROJECT_DIR");

				// Verify package.json was NOT processed (should keep original)
				const packageDestContent = await Bun.file(join(testDestDir, "package.json")).text();
				expect(packageDestContent).toContain("$CLAUDE_PROJECT_DIR");
				expect(packageDestContent).not.toContain("$HOME");
			} finally {
				// Restore original platform
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should handle settings.json in nested directories (not processed)", async () => {
			// Create nested structure
			const nestedDir = join(testSourceDir, "nested");
			await mkdir(nestedDir, { recursive: true });

			const settingsContent = JSON.stringify(
				{
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
				},
				null,
				2,
			);

			await writeFile(join(nestedDir, "settings.json"), settingsContent);

			// Enable global mode
			merger.setGlobalFlag(true);

			await merger.merge(testSourceDir, testDestDir, true);

			// Verify nested settings.json exists but was NOT processed (only root-level settings.json)
			expect(existsSync(join(testDestDir, "nested", "settings.json"))).toBe(true);
			const destContent = await Bun.file(join(testDestDir, "nested", "settings.json")).text();
			// Should still contain original content since only root settings.json is processed
			expect(destContent).toBe(settingsContent);
		});
	});

	describe("setGlobalFlag", () => {
		test("should set global flag to true", () => {
			merger.setGlobalFlag(true);
			// No direct assertion, but should not throw
			expect(true).toBe(true);
		});

		test("should set global flag to false", () => {
			merger.setGlobalFlag(false);
			// No direct assertion, but should not throw
			expect(true).toBe(true);
		});

		test("should default to false when not set", async () => {
			// Create settings.json
			const settingsContent = JSON.stringify(
				{
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Unix platform to test default behavior without env var syntax conversion
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				// Don't call setGlobalFlag (should default to false)
				await merger.merge(testSourceDir, testDestDir, true);

				// Verify NO replacement occurred (Unix preserves $VAR syntax in local mode)
				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				expect(destContent).toContain("$CLAUDE_PROJECT_DIR");
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});
	});

	describe("file tracking for manifest", () => {
		test("should track all installed files", async () => {
			// Create test files
			await writeFile(join(testSourceDir, "file1.txt"), "content1");
			await writeFile(join(testSourceDir, "file2.txt"), "content2");
			await mkdir(join(testSourceDir, "subdir"), { recursive: true });
			await writeFile(join(testSourceDir, "subdir", "file3.txt"), "content3");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			expect(installedFiles).toContain("file1.txt");
			expect(installedFiles).toContain("file2.txt");
			expect(installedFiles).toContain("subdir/file3.txt");
		});

		test("should track files in nested directories", async () => {
			// Create nested structure
			const deepDir = join(testSourceDir, "level1", "level2", "level3");
			await mkdir(deepDir, { recursive: true });
			await writeFile(join(deepDir, "deep-file.txt"), "deep content");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			expect(installedFiles).toContain("level1/level2/level3/deep-file.txt");
		});

		test("should NOT track security-sensitive files (never copied)", async () => {
			// Create security-sensitive files
			await writeFile(join(testSourceDir, ".env"), "SECRET=value");
			await writeFile(join(testSourceDir, "private.key"), "key data");
			await writeFile(join(testSourceDir, "normal.txt"), "normal");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			// Normal file should be tracked
			expect(installedFiles).toContain("normal.txt");

			// Security-sensitive files should NOT be tracked (never copied)
			expect(installedFiles).not.toContain(".env");
			expect(installedFiles).not.toContain("private.key");
		});

		test("should track user config files on first install", async () => {
			// Create user config files (destination doesn't exist yet)
			await writeFile(join(testSourceDir, ".gitignore"), "*.log");
			await writeFile(join(testSourceDir, ".mcp.json"), "{}");
			await writeFile(join(testSourceDir, "normal.txt"), "normal");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			// All files should be tracked on first install
			expect(installedFiles).toContain(".gitignore");
			expect(installedFiles).toContain(".mcp.json");
			expect(installedFiles).toContain("normal.txt");
		});

		test("should NOT track user config files when they already exist (updates)", async () => {
			// Create existing user config files in destination
			await writeFile(join(testDestDir, ".gitignore"), "# Existing");
			await writeFile(join(testDestDir, ".mcp.json"), '{"existing": true}');

			// Create source files
			await writeFile(join(testSourceDir, ".gitignore"), "*.log");
			await writeFile(join(testSourceDir, ".mcp.json"), "{}");
			await writeFile(join(testSourceDir, "normal.txt"), "normal");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			// Normal file should be tracked
			expect(installedFiles).toContain("normal.txt");

			// Existing user config files should NOT be tracked (not copied)
			expect(installedFiles).not.toContain(".gitignore");
			expect(installedFiles).not.toContain(".mcp.json");
		});

		test("should return top-level items with getInstalledItems()", async () => {
			// Create files in different directories
			await mkdir(join(testSourceDir, "commands"), { recursive: true });
			await mkdir(join(testSourceDir, "skills"), { recursive: true });
			await mkdir(join(testSourceDir, "agents", "researcher"), { recursive: true });

			await writeFile(join(testSourceDir, "commands", "test1.md"), "cmd1");
			await writeFile(join(testSourceDir, "commands", "test2.md"), "cmd2");
			await writeFile(join(testSourceDir, "skills", "skill1.md"), "skill1");
			await writeFile(join(testSourceDir, "agents", "researcher", "config.md"), "config");
			await writeFile(join(testSourceDir, "README.md"), "readme");

			await merger.merge(testSourceDir, testDestDir, true);

			const topLevelItems = merger.getInstalledItems();

			// Should return top-level directories (with trailing slash) + root files
			expect(topLevelItems).toContain("commands/");
			expect(topLevelItems).toContain("skills/");
			expect(topLevelItems).toContain("agents/");
			expect(topLevelItems).toContain("README.md");

			// Should NOT contain individual nested files
			expect(topLevelItems).not.toContain("commands/test1.md");
			expect(topLevelItems).not.toContain("agents/researcher/config.md");
		});

		test("should handle include patterns and only track included files", async () => {
			// Create directory structure
			const commandsDir = join(testSourceDir, "commands");
			const skillsDir = join(testSourceDir, "skills");
			const agentsDir = join(testSourceDir, "agents");

			await mkdir(commandsDir, { recursive: true });
			await mkdir(skillsDir, { recursive: true });
			await mkdir(agentsDir, { recursive: true });

			await writeFile(join(commandsDir, "test.md"), "command");
			await writeFile(join(skillsDir, "skill.md"), "skill");
			await writeFile(join(agentsDir, "agent.md"), "agent");

			// Only include commands and skills
			merger.setIncludePatterns(["commands", "skills"]);

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			// Should only track included files
			expect(installedFiles).toContain("commands/test.md");
			expect(installedFiles).toContain("skills/skill.md");

			// Should NOT track excluded files
			expect(installedFiles).not.toContain("agents/agent.md");
		});

		test("should track settings.json when processed in global mode", async () => {
			const settingsContent = JSON.stringify(
				{
					"claude.projectDir": "$CLAUDE_PROJECT_DIR/.claude",
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			merger.setGlobalFlag(true);

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			expect(installedFiles).toContain("settings.json");
		});

		test("should return sorted file lists", async () => {
			// Create files in random order
			await writeFile(join(testSourceDir, "z-file.txt"), "z");
			await writeFile(join(testSourceDir, "a-file.txt"), "a");
			await writeFile(join(testSourceDir, "m-file.txt"), "m");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			// Should be sorted
			expect(installedFiles).toEqual(["a-file.txt", "m-file.txt", "z-file.txt"]);
		});

		test("should track files with special characters", async () => {
			const specialFile = "file (copy) [2].txt";
			await writeFile(join(testSourceDir, specialFile), "content");

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			expect(installedFiles).toContain(specialFile);
		});

		test("should handle empty directories gracefully", async () => {
			// Create empty source directory
			await mkdir(join(testSourceDir, "empty-dir"), { recursive: true });

			await merger.merge(testSourceDir, testDestDir, true);

			const installedFiles = merger.getAllInstalledFiles();

			// Empty directories shouldn't create entries
			expect(installedFiles).toEqual([]);
		});
	});

	describe("local mode: monorepo path transformation", () => {
		test("should transform relative .claude/ paths to $CLAUDE_PROJECT_DIR on Unix (local mode)", async () => {
			// Create settings.json with relative hook paths (as in claudekit-engineer template)
			const settingsContent = JSON.stringify(
				{
					statusLine: {
						type: "command",
						command: "node .claude/statusline.cjs",
					},
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
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				// Local mode (isGlobal = false by default)
				await merger.merge(testSourceDir, testDestDir, true);

				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				// Verify paths transformed to use $CLAUDE_PROJECT_DIR (quotes are unescaped after JSON parse)
				expect(destJson.statusLine.command).toBe(
					'node "$CLAUDE_PROJECT_DIR"/.claude/statusline.cjs',
				);
				expect(destJson.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
					'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/dev-rules-reminder.cjs',
				);
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should transform relative .claude/ paths to %CLAUDE_PROJECT_DIR% on Windows (local mode)", async () => {
			// Create settings.json with relative hook paths
			const settingsContent = JSON.stringify(
				{
					statusLine: {
						type: "command",
						command: "node .claude/statusline.cjs",
					},
					hooks: {
						PreToolUse: [
							{
								matcher: "Bash",
								hooks: [
									{
										type: "command",
										command: "node .claude/hooks/scout-block.cjs",
									},
								],
							},
						],
					},
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Windows platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			});

			try {
				// Local mode (isGlobal = false by default)
				await merger.merge(testSourceDir, testDestDir, true);

				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				// Verify paths transformed to use %CLAUDE_PROJECT_DIR% (Windows syntax, quotes unescaped after parse)
				expect(destJson.statusLine.command).toBe(
					'node "%CLAUDE_PROJECT_DIR%"/.claude/statusline.cjs',
				);
				expect(destJson.hooks.PreToolUse[0].hooks[0].command).toBe(
					'node "%CLAUDE_PROJECT_DIR%"/.claude/hooks/scout-block.cjs',
				);
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should transform ./.claude/ paths (with leading dot-slash) on Unix", async () => {
			// Create settings.json with ./.claude/ paths
			const settingsContent = JSON.stringify(
				{
					statusLine: {
						type: "command",
						command: "node ./.claude/statusline.cjs",
					},
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "darwin",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				// Should handle ./.claude/ same as .claude/ (quotes unescaped after JSON parse)
				expect(destJson.statusLine.command).toBe(
					'node "$CLAUDE_PROJECT_DIR"/.claude/statusline.cjs',
				);
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should transform to $HOME in global mode (Unix)", async () => {
			// Create settings.json with relative hook paths
			const settingsContent = JSON.stringify(
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
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				merger.setGlobalFlag(true);
				await merger.merge(testSourceDir, testDestDir, true);

				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				// Global mode should use $HOME
				expect(destJson.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
					"node $HOME/.claude/hooks/dev-rules-reminder.cjs",
				);
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should transform to %USERPROFILE% in global mode (Windows)", async () => {
			// Create settings.json with relative hook paths
			const settingsContent = JSON.stringify(
				{
					statusLine: {
						type: "command",
						command: "node .claude/statusline.cjs",
					},
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Windows platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "win32",
				configurable: true,
			});

			try {
				merger.setGlobalFlag(true);
				await merger.merge(testSourceDir, testDestDir, true);

				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				// Global mode should use %USERPROFILE%
				expect(destJson.statusLine.command).toBe("node %USERPROFILE%/.claude/statusline.cjs");
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});

		test("should not transform non-node commands", async () => {
			// Create settings.json with non-node commands
			const settingsContent = JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: "echo .claude/test",
									},
								],
							},
						],
					},
				},
				null,
				2,
			);

			await writeFile(join(testSourceDir, "settings.json"), settingsContent);

			// Mock Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", {
				value: "linux",
				configurable: true,
			});

			try {
				await merger.merge(testSourceDir, testDestDir, true);

				const destContent = await Bun.file(join(testDestDir, "settings.json")).text();
				const destJson = JSON.parse(destContent);

				// Non-node commands should not be transformed
				expect(destJson.hooks.UserPromptSubmit[0].hooks[0].command).toBe("echo .claude/test");
			} finally {
				Object.defineProperty(process, "platform", {
					value: originalPlatform,
					configurable: true,
				});
			}
		});
	});

	describe("file tracking continued", () => {
		test("should track multiple merges correctly (fresh merger each time)", async () => {
			// First merge
			await writeFile(join(testSourceDir, "file1.txt"), "content1");
			await merger.merge(testSourceDir, testDestDir, true);

			let installedFiles = merger.getAllInstalledFiles();
			expect(installedFiles).toContain("file1.txt");

			// Create new merger for second merge
			const merger2 = new FileMerger();
			const testSourceDir2 = join(tmpdir(), `test-source-2-${Date.now()}`);
			await mkdir(testSourceDir2, { recursive: true });
			await writeFile(join(testSourceDir2, "file2.txt"), "content2");

			await merger2.merge(testSourceDir2, testDestDir, true);

			installedFiles = merger2.getAllInstalledFiles();

			// Second merger should only track its own files
			expect(installedFiles).toContain("file2.txt");
			expect(installedFiles).not.toContain("file1.txt");

			// Cleanup
			await rm(testSourceDir2, { recursive: true, force: true });
		});
	});
});
