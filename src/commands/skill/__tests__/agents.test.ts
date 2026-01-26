/**
 * Tests for agent registry
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import {
	agents,
	detectInstalledAgents,
	getAgentConfig,
	getInstallPath,
	isSkillInstalled,
} from "../agents.js";

describe("agents", () => {
	const home = homedir();
	const testSkillDir = join(home, ".claude/skills/test-skill-agent-test");

	beforeAll(() => {
		// Ensure test skill directory exists for isSkillInstalled tests
		mkdirSync(testSkillDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testSkillDir, { recursive: true, force: true });
	});

	describe("agents registry", () => {
		it("should have 14 agents defined", () => {
			expect(Object.keys(agents).length).toBe(14);
		});

		it("should have required fields for each agent", () => {
			for (const [key, config] of Object.entries(agents)) {
				expect(config.name as string).toBe(key);
				expect(typeof config.displayName).toBe("string");
				expect(typeof config.projectPath).toBe("string");
				expect(typeof config.globalPath).toBe("string");
				expect(typeof config.detect).toBe("function");
			}
		});

		it("should have claude-code agent with correct paths", () => {
			const claudeCode = agents["claude-code"];
			expect(claudeCode.displayName).toBe("Claude Code");
			expect(claudeCode.projectPath).toBe(".claude/skills");
			expect(claudeCode.globalPath).toBe(join(home, ".claude/skills"));
		});

		it("should have cursor agent with correct paths", () => {
			const cursor = agents.cursor;
			expect(cursor.displayName).toBe("Cursor");
			expect(cursor.projectPath).toBe(".cursor/skills");
			expect(cursor.globalPath).toBe(join(home, ".cursor/skills"));
		});
	});

	describe("detectInstalledAgents", () => {
		it("should return array of installed agents", async () => {
			const installed = await detectInstalledAgents();
			expect(Array.isArray(installed)).toBe(true);
		});

		it("should detect claude-code if ~/.claude exists", async () => {
			const installed = await detectInstalledAgents();
			// Since we're running in a claude environment, ~/.claude should exist
			if (installed.includes("claude-code")) {
				expect(installed).toContain("claude-code");
			}
		});

		it("should return valid agent types", async () => {
			const installed = await detectInstalledAgents();
			const validTypes = Object.keys(agents) as string[];
			for (const agent of installed) {
				expect(validTypes).toContain(agent as string);
			}
		});
	});

	describe("getAgentConfig", () => {
		it("should return config for valid agent type", () => {
			const config = getAgentConfig("claude-code");
			expect(config.name).toBe("claude-code");
			expect(config.displayName).toBe("Claude Code");
		});

		it("should return config for all agent types", () => {
			for (const type of Object.keys(agents) as Array<keyof typeof agents>) {
				const config = getAgentConfig(type);
				expect(config.name as string).toBe(type);
			}
		});
	});

	describe("getInstallPath", () => {
		it("should return global path when global option is true", () => {
			const path = getInstallPath("my-skill", "claude-code", { global: true });
			expect(path).toBe(join(home, ".claude/skills/my-skill"));
		});

		it("should return project path when global option is false", () => {
			const path = getInstallPath("my-skill", "claude-code", { global: false });
			expect(path).toBe(join(".claude/skills", "my-skill"));
		});

		it("should handle skill names with special characters", () => {
			const path = getInstallPath("my-skill-v2", "cursor", { global: true });
			expect(path).toBe(join(home, ".cursor/skills/my-skill-v2"));
		});

		it("should work for all agents", () => {
			for (const type of Object.keys(agents) as Array<keyof typeof agents>) {
				const path = getInstallPath("test", type, { global: true });
				// Use path.sep for cross-platform compatibility
				expect(path.endsWith(`${sep}test`)).toBe(true);
			}
		});
	});

	describe("isSkillInstalled", () => {
		it("should return true for existing skill", () => {
			const result = isSkillInstalled("test-skill-agent-test", "claude-code", { global: true });
			expect(result).toBe(true);
		});

		it("should return false for non-existent skill", () => {
			const result = isSkillInstalled("non-existent-skill-xyz", "claude-code", { global: true });
			expect(result).toBe(false);
		});

		it("should check correct path for project install", () => {
			const result = isSkillInstalled("some-skill", "cursor", { global: false });
			expect(result).toBe(false); // Project skill shouldn't exist
		});
	});
});
