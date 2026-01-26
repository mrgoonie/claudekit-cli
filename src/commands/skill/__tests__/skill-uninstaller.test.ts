/**
 * Tests for skill uninstaller
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { addInstallation, writeRegistry } from "../skill-registry.js";
import {
	forceUninstallSkill,
	getInstalledSkills,
	uninstallSkillFromAgent,
} from "../skill-uninstaller.js";

describe("skill-uninstaller", () => {
	const home = homedir();
	const testBase = join(home, ".claudekit", "uninstaller-test");
	const claudeSkillsPath = join(home, ".claude/skills");

	beforeAll(async () => {
		mkdirSync(testBase, { recursive: true });
		// Start with clean registry
		await writeRegistry({ version: "1.0", installations: [] });
	});

	afterAll(async () => {
		rmSync(testBase, { recursive: true, force: true });
		// Cleanup any test skills
		rmSync(join(claudeSkillsPath, "uninstall-test"), { recursive: true, force: true });
		rmSync(join(claudeSkillsPath, "force-uninstall-test"), { recursive: true, force: true });
		rmSync(join(claudeSkillsPath, "orphan-test"), { recursive: true, force: true });
		await writeRegistry({ version: "1.0", installations: [] });
	});

	describe("uninstallSkillFromAgent", () => {
		it("should uninstall skill registered in registry", async () => {
			// Setup: create skill directory and register
			const skillPath = join(claudeSkillsPath, "uninstall-test");
			mkdirSync(skillPath, { recursive: true });
			writeFileSync(join(skillPath, "SKILL.md"), "# Test");
			await addInstallation("uninstall-test", "claude-code", true, skillPath, "/src");

			// Execute
			const result = await uninstallSkillFromAgent("uninstall-test", "claude-code", true);

			expect(result.success).toBe(true);
			expect(result.skill).toBe("uninstall-test");
			expect(result.agent).toBe("claude-code");
			expect(result.agentDisplayName).toBe("Claude Code");
			expect(existsSync(skillPath)).toBe(false);
		});

		it("should return error for skill not in registry", async () => {
			const result = await uninstallSkillFromAgent("not-registered", "cursor", false);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not found in registry");
		});

		it("should handle already-deleted file (orphaned registry entry)", async () => {
			// Register without creating actual file
			await addInstallation(
				"orphan-test",
				"claude-code",
				true,
				join(claudeSkillsPath, "orphan-test"),
				"/src",
			);

			const result = await uninstallSkillFromAgent("orphan-test", "claude-code", true);

			expect(result.success).toBe(true);
			expect(result.wasOrphaned).toBe(true);
		});
	});

	describe("forceUninstallSkill", () => {
		it("should remove skill directory without registry check", async () => {
			// Create directory but don't register
			const skillPath = join(claudeSkillsPath, "force-uninstall-test");
			mkdirSync(skillPath, { recursive: true });
			writeFileSync(join(skillPath, "SKILL.md"), "# Force test");

			const result = await forceUninstallSkill("force-uninstall-test", "claude-code", true);

			expect(result.success).toBe(true);
			expect(existsSync(skillPath)).toBe(false);
		});

		it("should return error if directory does not exist", async () => {
			const result = await forceUninstallSkill("non-existent-force", "cursor", true);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});

		it("should also remove from registry if entry exists", async () => {
			// Create and register
			const skillPath = join(claudeSkillsPath, "force-with-registry");
			mkdirSync(skillPath, { recursive: true });
			await addInstallation("force-with-registry", "claude-code", true, skillPath, "/src");

			const result = await forceUninstallSkill("force-with-registry", "claude-code", true);

			// Cleanup happens via the uninstall
			expect(result.success).toBe(true);

			// Verify registry was also cleaned
			const installed = await getInstalledSkills("claude-code", true);
			expect(installed.find((i) => i.skill === "force-with-registry")).toBeUndefined();
		});
	});

	describe("getInstalledSkills", () => {
		beforeAll(async () => {
			// Setup test installations
			await writeRegistry({
				version: "1.0",
				installations: [
					{
						skill: "skill-a",
						agent: "claude-code",
						global: true,
						path: "/path/a",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "skill-b",
						agent: "claude-code",
						global: false,
						path: "/path/b",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "skill-c",
						agent: "cursor",
						global: true,
						path: "/path/c",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			});
		});

		it("should return all installed skills", async () => {
			const skills = await getInstalledSkills();
			expect(skills.length).toBe(3);
		});

		it("should filter by agent", async () => {
			const skills = await getInstalledSkills("claude-code");
			expect(skills.length).toBe(2);
			expect(skills.every((s) => s.agent === "claude-code")).toBe(true);
		});

		it("should filter by global flag", async () => {
			const skills = await getInstalledSkills(undefined, true);
			expect(skills.length).toBe(2);
			expect(skills.every((s) => s.global === true)).toBe(true);
		});

		it("should filter by both agent and global", async () => {
			const skills = await getInstalledSkills("claude-code", true);
			expect(skills.length).toBe(1);
			expect(skills[0].skill).toBe("skill-a");
		});

		it("should return empty array when no matches", async () => {
			const skills = await getInstalledSkills("codex");
			expect(skills).toEqual([]);
		});
	});
});
