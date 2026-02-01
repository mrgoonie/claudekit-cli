/**
 * Tests for skill discovery
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills, findSkillByName } from "../skills-discovery.js";

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

		// Create skill with frontmatter name different from directory name (duplicate bug scenario)
		mkdirSync(join(testDir, "react-best-practices"), { recursive: true });
		writeFileSync(
			join(testDir, "react-best-practices", "SKILL.md"),
			`---
name: vercel-react-best-practices
description: React best practices from Vercel
version: 1.0.0
---

# React Best Practices

Vercel's recommended patterns.
`,
		);
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("discoverSkills", () => {
		it("should discover valid skills with name and description", async () => {
			const skills = await discoverSkills(testDir);
			const testSkill = skills.find((s) => s.name === "test-skill");
			expect(testSkill).toBeDefined();
			expect(testSkill?.description).toBe("A test skill for unit testing");
			// Verify directory name is used as canonical ID
			expect(testSkill?.name).toBe("test-skill");
			// Verify frontmatter name is stored separately
			expect(testSkill?.displayName).toBe("test-skill");
		});

		it("should discover skills without description (defaults to empty string)", async () => {
			const skills = await discoverSkills(testDir);
			const invalidSkill = skills.find((s) => s.name === "invalid-skill");
			expect(invalidSkill).toBeDefined();
			expect(invalidSkill?.description).toBe("");
			// Verify directory name is always used, even with frontmatter name
			expect(invalidSkill?.name).toBe("invalid-skill");
			expect(invalidSkill?.displayName).toBe("invalid-skill");
		});

		it("should return empty array for non-existent path", async () => {
			const skills = await discoverSkills("/non/existent/path");
			expect(skills).toEqual([]);
		});

		it("should use directory name when frontmatter name differs (prevents duplicate install bug)", async () => {
			const skills = await discoverSkills(testDir);
			const reactSkill = skills.find((s) => s.name === "react-best-practices");
			expect(reactSkill).toBeDefined();
			// Critical: name MUST be directory name, not frontmatter name
			expect(reactSkill?.name).toBe("react-best-practices");
			// Frontmatter name should be in displayName field
			expect(reactSkill?.displayName).toBe("vercel-react-best-practices");
			expect(reactSkill?.description).toBe("React best practices from Vercel");
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
