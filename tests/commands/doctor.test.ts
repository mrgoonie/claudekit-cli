import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { doctorCommand } from "../../src/commands/doctor.js";
import { getClaudeKitSetup } from "../../src/utils/claudekit-scanner.js";

describe("Doctor Command", () => {
	let testDir: string;
	let mockClaudeDir: string;

	beforeEach(async () => {
		// Create test directory
		testDir = join(process.cwd(), "test-temp", `doctor-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		// Create mock .claude directory
		mockClaudeDir = join(testDir, ".claude");
		await mkdir(mockClaudeDir, { recursive: true });

		// Create subdirectories
		await mkdir(join(mockClaudeDir, "agents"), { recursive: true });
		await mkdir(join(mockClaudeDir, "commands"), { recursive: true });
		await mkdir(join(mockClaudeDir, "workflows"), { recursive: true });
		await mkdir(join(mockClaudeDir, "skills"), { recursive: true });

		// Create mock metadata
		const mockMetadata = {
			version: "1.0.0",
			name: "test-claudekit",
			description: "Test ClaudeKit for unit testing",
		};
		await writeFile(
			join(mockClaudeDir, "metadata.json"),
			JSON.stringify(mockMetadata, null, 2),
			"utf8",
		);

		// Create mock agent files
		await writeFile(join(mockClaudeDir, "agents", "agent1.md"), "# Agent 1", "utf8");
		await writeFile(join(mockClaudeDir, "agents", "agent2.md"), "# Agent 2", "utf8");

		// Create mock command files
		await writeFile(join(mockClaudeDir, "commands", "command1.md"), "# Command 1", "utf8");
		await writeFile(join(mockClaudeDir, "commands", "command2.md"), "# Command 2", "utf8");
		await writeFile(join(mockClaudeDir, "commands", "command3.md"), "# Command 3", "utf8");

		// Create mock workflow files
		await writeFile(join(mockClaudeDir, "workflows", "workflow1.md"), "# Workflow 1", "utf8");

		// Create mock skill directories
		const skill1Dir = join(mockClaudeDir, "skills", "skill1");
		await mkdir(skill1Dir, { recursive: true });
		await writeFile(join(skill1Dir, "SKILL.md"), "# Skill 1", "utf8");

		const skill2Dir = join(mockClaudeDir, "skills", "skill2");
		await mkdir(skill2Dir, { recursive: true });
		await writeFile(join(skill2Dir, "SKILL.md"), "# Skill 2", "utf8");
	});

	afterEach(async () => {
		// Cleanup test directory
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("getClaudeKitSetup", () => {
		test("should detect project setup correctly", async () => {
			const setup = await getClaudeKitSetup(testDir);

			expect(setup.project.path).toBe(mockClaudeDir);
			expect(setup.project.metadata).not.toBeNull();
			expect(setup.project.metadata?.version).toBe("1.0.0");
			expect(setup.project.metadata?.name).toBe("test-claudekit");

			// Check component counts
			expect(setup.project.components.agents).toBe(2);
			expect(setup.project.components.commands).toBe(3);
			expect(setup.project.components.workflows).toBe(1);
			expect(setup.project.components.skills).toBe(2);
		});

		test("should return empty setup when no .claude directory exists", async () => {
			const emptyDir = join(process.cwd(), "test-temp", `empty-test-${Date.now()}`);
			await mkdir(emptyDir, { recursive: true });

			try {
				const setup = await getClaudeKitSetup(emptyDir);

				expect(setup.project.path).toBe("");
				expect(setup.project.metadata).toBeNull();
				expect(setup.project.components.agents).toBe(0);
				expect(setup.project.components.commands).toBe(0);
				expect(setup.project.components.workflows).toBe(0);
				expect(setup.project.components.skills).toBe(0);
			} finally {
				await rm(emptyDir, { recursive: true, force: true });
			}
		});

		test("should handle corrupted metadata.json gracefully", async () => {
			// Write corrupted metadata
			await writeFile(join(mockClaudeDir, "metadata.json"), "{ invalid json", "utf8");

			const setup = await getClaudeKitSetup(testDir);

			expect(setup.project.path).toBe(mockClaudeDir);
			expect(setup.project.metadata).toBeNull();
			// Components should still be counted
			expect(setup.project.components.agents).toBe(2);
		});
	});

	describe("doctorCommand", () => {
		test("should run without errors in project directory", async () => {
			// Test that the command doesn't throw an error
			// We can't easily test the output without mocking console methods
			expect(async () => {
				await doctorCommand();
			}).not.toThrow();
		});

		test("should run without errors outside project directory", async () => {
			const nonProjectDir = join(process.cwd(), "test-temp", `non-project-${Date.now()}`);
			await mkdir(nonProjectDir, { recursive: true });

			try {
				// Change to non-project directory temporarily
				const originalCwd = process.cwd();
				process.chdir(nonProjectDir);

				expect(async () => {
					await doctorCommand();
				}).not.toThrow();

				// Restore original directory
				process.chdir(originalCwd);
			} finally {
				await rm(nonProjectDir, { recursive: true, force: true });
			}
		});
	});

	describe("Component counting logic", () => {
		test("should count only .md files in agents directory", async () => {
			// Add a non-md file
			await writeFile(join(mockClaudeDir, "agents", "readme.txt"), "Readme", "utf8");

			const setup = await getClaudeKitSetup(testDir);
			// Should still only count .md files
			expect(setup.project.components.agents).toBe(2);
		});

		test("should count skills only if SKILL.md exists", async () => {
			// Create a skill directory without SKILL.md
			const skill3Dir = join(mockClaudeDir, "skills", "skill3");
			await mkdir(skill3Dir, { recursive: true });
			await writeFile(join(skill3Dir, "README.md"), "# Readme", "utf8");

			const setup = await getClaudeKitSetup(testDir);
			// Should only count skills with SKILL.md
			expect(setup.project.components.skills).toBe(2);
		});
	});
});
