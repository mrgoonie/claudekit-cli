/**
 * Tests for skill installer
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	getInstallPreview,
	installSkillForAgent,
	installSkillToAgents,
} from "../skills-installer.js";
import { readRegistry, writeRegistry } from "../skills-registry.js";
import type { SkillInfo } from "../types.js";

describe("skill-installer", () => {
	const home = homedir();
	const testDir = join(home, ".claudekit", "installer-test");
	const testSkillPath = join(testDir, "test-skill");
	const installBase = join(home, ".claude/skills");

	const testSkill: SkillInfo = {
		name: "installer-test-skill",
		description: "A skill for testing installation",
		version: "1.0.0",
		path: testSkillPath,
	};

	beforeAll(async () => {
		// Create test skill directory with SKILL.md
		mkdirSync(testSkillPath, { recursive: true });
		writeFileSync(
			join(testSkillPath, "SKILL.md"),
			`---
name: installer-test-skill
description: A skill for testing installation
version: 1.0.0
---

# Test Skill

This is a test skill for installation tests.
`,
		);
		writeFileSync(join(testSkillPath, "helper.js"), "// Helper file");

		// Clear registry for clean tests
		await writeRegistry({ version: "1.0", installations: [] });
	});

	afterAll(async () => {
		// Cleanup test directories
		rmSync(testDir, { recursive: true, force: true });
		rmSync(join(installBase, "installer-test-skill"), { recursive: true, force: true });
		rmSync(join(installBase, "preview-test-skill"), { recursive: true, force: true });

		// Clear registry entries we created
		await writeRegistry({ version: "1.0", installations: [] });
	});

	describe("installSkillForAgent", () => {
		it("should install skill to agent directory", async () => {
			const result = await installSkillForAgent(testSkill, "claude-code", { global: true });

			expect(result.success).toBe(true);
			expect(result.agent).toBe("claude-code");
			expect(result.agentDisplayName).toBe("Claude Code");
			expect(existsSync(result.path)).toBe(true);
			expect(existsSync(join(result.path, "SKILL.md"))).toBe(true);
			expect(existsSync(join(result.path, "helper.js"))).toBe(true);
		});

		it("should register installation in registry", async () => {
			const registry = await readRegistry();
			const found = registry.installations.find(
				(i) => i.skill === "installer-test-skill" && i.agent === "claude-code",
			);
			expect(found).toBeDefined();
			expect(found?.global).toBe(true);
		});

		it("should set overwritten flag when reinstalling", async () => {
			// Install again (already exists from previous test)
			const result = await installSkillForAgent(testSkill, "claude-code", { global: true });

			expect(result.success).toBe(true);
			expect(result.overwritten).toBe(true);
		});

		it("should skip installation when source and target are the same path", async () => {
			// Create a skill that's already at its target location (simulates Claude Code source skills)
			const samePathSkillDir = join(home, ".claude/skills/same-path-test-skill");
			mkdirSync(samePathSkillDir, { recursive: true });
			writeFileSync(
				join(samePathSkillDir, "SKILL.md"),
				`---
name: same-path-test-skill
description: Test skill at source location
---
# Same Path Skill
`,
			);

			const samePathSkill: SkillInfo = {
				name: "same-path-test-skill",
				description: "Test skill at source location",
				path: samePathSkillDir, // Source IS the target
			};

			try {
				const result = await installSkillForAgent(samePathSkill, "claude-code", { global: true });

				expect(result.success).toBe(true);
				expect(result.skipped).toBe(true);
				expect(result.skipReason).toContain("already exists at source");
			} finally {
				rmSync(samePathSkillDir, { recursive: true, force: true });
			}
		});

		it("should not skip when source and target are different paths", async () => {
			// Skill source is in test directory, target is in .claude/skills
			const result = await installSkillForAgent(testSkill, "claude-code", { global: true });

			// testSkill.path is in testDir, target is ~/.claude/skills/installer-test-skill
			// These are different, so should NOT be skipped
			expect(result.success).toBe(true);
			expect(result.skipped).toBeFalsy();
		});

		it("should create parent directory if not exists", async () => {
			// Use cursor agent which may not have skills dir
			const cursorSkillsPath = join(home, ".cursor/skills");
			const cursorSkillPath = join(cursorSkillsPath, "installer-test-skill");

			// Ensure clean state
			rmSync(cursorSkillPath, { recursive: true, force: true });

			const result = await installSkillForAgent(testSkill, "cursor", { global: true });

			// Cleanup after test
			rmSync(cursorSkillPath, { recursive: true, force: true });

			expect(result.success).toBe(true);
		});

		it("should return error for file at target path", async () => {
			// Create a file where directory should be
			const blockingPath = join(installBase, "blocking-skill");
			mkdirSync(installBase, { recursive: true });
			writeFileSync(blockingPath, "I am a file not a directory");

			const blockingSkill: SkillInfo = {
				name: "blocking-skill",
				description: "Test",
				path: testSkillPath,
			};

			try {
				const result = await installSkillForAgent(blockingSkill, "claude-code", { global: true });

				expect(result.success).toBe(false);
				expect(result.error).toContain("exists as a file");
			} finally {
				rmSync(blockingPath, { force: true });
			}
		});
	});

	describe("installSkillToAgents", () => {
		it("should install to multiple agents", async () => {
			const multiSkill: SkillInfo = {
				name: "multi-agent-skill",
				description: "Test",
				path: testSkillPath,
			};

			const results = await installSkillToAgents(multiSkill, ["claude-code", "cursor"], {
				global: true,
			});

			// Cleanup
			rmSync(join(home, ".claude/skills/multi-agent-skill"), { recursive: true, force: true });
			rmSync(join(home, ".cursor/skills/multi-agent-skill"), { recursive: true, force: true });

			expect(results.length).toBe(2);
			expect(results.filter((r) => r.success).length).toBe(2);
		});

		it("should skip only the agent where source equals target", async () => {
			// Create skill in Claude Code's skills directory (it's the source)
			const claudeSkillDir = join(home, ".claude/skills/mixed-skip-skill");
			mkdirSync(claudeSkillDir, { recursive: true });
			writeFileSync(
				join(claudeSkillDir, "SKILL.md"),
				`---
name: mixed-skip-skill
description: Test mixed skip scenario
---
# Mixed Skip Skill
`,
			);

			const mixedSkill: SkillInfo = {
				name: "mixed-skip-skill",
				description: "Test mixed skip scenario",
				path: claudeSkillDir, // Source is Claude Code's skills dir
			};

			try {
				const results = await installSkillToAgents(mixedSkill, ["claude-code", "cursor"], {
					global: true,
				});

				expect(results.length).toBe(2);

				// Claude Code should be skipped (source === target)
				const claudeResult = results.find((r) => r.agent === "claude-code");
				expect(claudeResult?.success).toBe(true);
				expect(claudeResult?.skipped).toBe(true);

				// Cursor should be installed (different path)
				const cursorResult = results.find((r) => r.agent === "cursor");
				expect(cursorResult?.success).toBe(true);
				expect(cursorResult?.skipped).toBeFalsy();
			} finally {
				rmSync(claudeSkillDir, { recursive: true, force: true });
				rmSync(join(home, ".cursor/skills/mixed-skip-skill"), { recursive: true, force: true });
			}
		});

		it("should continue on individual failures", async () => {
			// Create blocking file for one agent
			const blockingPath = join(home, ".claude/skills/partial-fail-skill");
			mkdirSync(join(home, ".claude/skills"), { recursive: true });
			writeFileSync(blockingPath, "blocking");

			const partialSkill: SkillInfo = {
				name: "partial-fail-skill",
				description: "Test",
				path: testSkillPath,
			};

			try {
				const results = await installSkillToAgents(partialSkill, ["claude-code", "cursor"], {
					global: true,
				});

				// One should fail (claude-code - blocked), one should succeed (cursor)
				expect(results.length).toBe(2);
				const failed = results.find((r) => !r.success);
				const succeeded = results.find((r) => r.success);
				expect(failed?.agent).toBe("claude-code");
				expect(succeeded?.agent).toBe("cursor");
			} finally {
				rmSync(blockingPath, { force: true });
				rmSync(join(home, ".cursor/skills/partial-fail-skill"), {
					recursive: true,
					force: true,
				});
			}
		});
	});

	describe("getInstallPreview", () => {
		it("should return preview info for all agents", () => {
			const previewSkill: SkillInfo = {
				name: "preview-test-skill",
				description: "Test",
				path: testSkillPath,
			};

			const preview = getInstallPreview(previewSkill, ["claude-code", "cursor", "codex"], {
				global: true,
			});

			expect(preview.length).toBe(3);
			expect(preview[0].agent).toBe("claude-code");
			expect(preview[0].displayName).toBe("Claude Code");
			expect(preview[0].path).toContain("preview-test-skill");
		});

		it("should indicate if skill already exists", async () => {
			// Install first
			await installSkillForAgent(
				{ name: "exists-check", description: "Test", path: testSkillPath },
				"claude-code",
				{ global: true },
			);

			const preview = getInstallPreview(
				{ name: "exists-check", description: "Test", path: testSkillPath },
				["claude-code"],
				{ global: true },
			);

			// Cleanup
			rmSync(join(home, ".claude/skills/exists-check"), { recursive: true, force: true });

			expect(preview[0].exists).toBe(true);
		});

		it("should show project paths when global is false", () => {
			const preview = getInstallPreview(
				{ name: "project-skill", description: "Test", path: testSkillPath },
				["claude-code"],
				{ global: false },
			);

			expect(preview[0].path).toBe(join(".claude/skills", "project-skill"));
			expect(preview[0].path).not.toContain(home);
		});
	});
});
