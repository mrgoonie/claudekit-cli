/**
 * Tests for skill discovery
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills, findSkillByName } from "../skill-discovery.js";

describe("skill-discovery", () => {
	const testDir = join(tmpdir(), "claudekit-skill-test");

	beforeAll(() => {
		// Create test skill structure
		mkdirSync(join(testDir, "test-skill"), { recursive: true });
		writeFileSync(
			join(testDir, "test-skill", "SKILL.md"),
			`---
name: test-skill
description: A test skill for unit testing
version: 1.0.0
---

# Test Skill

This is a test skill.
`,
		);

		// Create skill without required fields (should be skipped)
		mkdirSync(join(testDir, "invalid-skill"), { recursive: true });
		writeFileSync(
			join(testDir, "invalid-skill", "SKILL.md"),
			`---
name: invalid-skill
---

# Invalid Skill

Missing description.
`,
		);
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("discoverSkills", () => {
		it("should discover valid skills with name and description", async () => {
			const skills = await discoverSkills(testDir);
			expect(skills.length).toBe(1);
			expect(skills[0].name).toBe("test-skill");
			expect(skills[0].description).toBe("A test skill for unit testing");
		});

		it("should skip skills without required frontmatter", async () => {
			const skills = await discoverSkills(testDir);
			const invalidSkill = skills.find((s) => s.name === "invalid-skill");
			expect(invalidSkill).toBeUndefined();
		});

		it("should return empty array for non-existent path", async () => {
			const skills = await discoverSkills("/non/existent/path");
			expect(skills).toEqual([]);
		});
	});

	describe("findSkillByName", () => {
		it("should find skill by exact name", async () => {
			const skill = await findSkillByName("test-skill", testDir);
			expect(skill).not.toBeNull();
			expect(skill?.name).toBe("test-skill");
		});

		it("should find skill by case-insensitive name", async () => {
			const skill = await findSkillByName("TEST-SKILL", testDir);
			expect(skill).not.toBeNull();
			expect(skill?.name).toBe("test-skill");
		});

		it("should return null for non-existent skill", async () => {
			const skill = await findSkillByName("non-existent", testDir);
			expect(skill).toBeNull();
		});
	});
});
