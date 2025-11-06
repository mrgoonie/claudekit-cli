import { describe, expect, test } from "bun:test";
import {
	PRESERVED_SKILLS,
	SKILL_CATEGORY_MAPPINGS,
	getAllCategories,
	getAllMigratableSkills,
	getCategoryForSkill,
	getPathMapping,
	isKnownSkill,
} from "../../src/lib/skills-mappings.js";

describe("SkillsMappings", () => {
	describe("SKILL_CATEGORY_MAPPINGS", () => {
		test("should have valid structure", () => {
			expect(SKILL_CATEGORY_MAPPINGS).toBeInstanceOf(Array);
			expect(SKILL_CATEGORY_MAPPINGS.length).toBeGreaterThan(0);

			for (const mapping of SKILL_CATEGORY_MAPPINGS) {
				expect(mapping.oldSkills).toBeInstanceOf(Array);
				expect(mapping.oldSkills.length).toBeGreaterThan(0);
				expect(typeof mapping.newCategory).toBe("string");
				expect(mapping.newCategory).not.toBe("");
			}
		});

		test("should not have duplicate old skill names", () => {
			const allSkills = SKILL_CATEGORY_MAPPINGS.flatMap((m) => m.oldSkills);
			const uniqueSkills = new Set(allSkills);

			expect(allSkills.length).toBe(uniqueSkills.size);
		});

		test("should not overlap with preserved skills", () => {
			const migratableSkills = SKILL_CATEGORY_MAPPINGS.flatMap((m) => m.oldSkills);

			for (const skill of migratableSkills) {
				expect(PRESERVED_SKILLS).not.toContain(skill);
			}
		});
	});

	describe("PRESERVED_SKILLS", () => {
		test("should be an array of strings", () => {
			expect(PRESERVED_SKILLS).toBeInstanceOf(Array);
			expect(PRESERVED_SKILLS.length).toBeGreaterThan(0);

			for (const skill of PRESERVED_SKILLS) {
				expect(typeof skill).toBe("string");
				expect(skill).not.toBe("");
			}
		});

		test("should not have duplicates", () => {
			const uniqueSkills = new Set(PRESERVED_SKILLS);
			expect(PRESERVED_SKILLS.length).toBe(uniqueSkills.size);
		});
	});

	describe("getCategoryForSkill", () => {
		test("should return correct category for AI multimodal skills", () => {
			expect(getCategoryForSkill("gemini-vision")).toBe("ai-multimodal");
			expect(getCategoryForSkill("gemini-image-gen")).toBe("ai-multimodal");
			expect(getCategoryForSkill("gemini-video")).toBe("ai-multimodal");
			expect(getCategoryForSkill("gemini-thinking")).toBe("ai-multimodal");
			expect(getCategoryForSkill("gemini-files")).toBe("ai-multimodal");
		});

		test("should return correct category for database skills", () => {
			expect(getCategoryForSkill("postgresql-psql")).toBe("databases");
			expect(getCategoryForSkill("mongodb")).toBe("databases");
		});

		test("should return correct category for DevOps skills", () => {
			expect(getCategoryForSkill("cloudflare-dns")).toBe("devops");
			expect(getCategoryForSkill("cloudflare-pages")).toBe("devops");
			expect(getCategoryForSkill("docker")).toBe("devops");
			expect(getCategoryForSkill("gcloud")).toBe("devops");
		});

		test("should return correct category for media processing skills", () => {
			expect(getCategoryForSkill("ffmpeg")).toBe("media-processing");
			expect(getCategoryForSkill("imagemagick")).toBe("media-processing");
		});

		test("should return correct category for web framework skills", () => {
			expect(getCategoryForSkill("nextjs")).toBe("web-frameworks");
			expect(getCategoryForSkill("remix-icon")).toBe("web-frameworks");
			expect(getCategoryForSkill("turborepo")).toBe("web-frameworks");
		});

		test("should return correct category for UI & styling skills", () => {
			expect(getCategoryForSkill("tailwindcss")).toBe("ui-styling");
			expect(getCategoryForSkill("shadcn-ui")).toBe("ui-styling");
			expect(getCategoryForSkill("canvas-design")).toBe("ui-styling");
		});

		test("should return null for preserved skills", () => {
			expect(getCategoryForSkill("common")).toBeNull();
			expect(getCategoryForSkill("debugging")).toBeNull();
			expect(getCategoryForSkill("claude-code")).toBeNull();
			expect(getCategoryForSkill("problem-solving")).toBeNull();
		});

		test("should return null for unknown skills", () => {
			expect(getCategoryForSkill("unknown-skill")).toBeNull();
			expect(getCategoryForSkill("non-existent")).toBeNull();
		});
	});

	describe("getAllMigratableSkills", () => {
		test("should return all migratable skill names", () => {
			const skills = getAllMigratableSkills();

			expect(skills).toBeInstanceOf(Array);
			expect(skills.length).toBeGreaterThan(0);

			// Check specific skills are included
			expect(skills).toContain("gemini-vision");
			expect(skills).toContain("postgresql-psql");
			expect(skills).toContain("docker");
			expect(skills).toContain("ffmpeg");
			expect(skills).toContain("nextjs");
			expect(skills).toContain("tailwindcss");
		});

		test("should not include preserved skills", () => {
			const skills = getAllMigratableSkills();

			for (const preservedSkill of PRESERVED_SKILLS) {
				expect(skills).not.toContain(preservedSkill);
			}
		});

		test("should match total count from mappings", () => {
			const skills = getAllMigratableSkills();
			const expectedCount = SKILL_CATEGORY_MAPPINGS.reduce(
				(sum, mapping) => sum + mapping.oldSkills.length,
				0,
			);

			expect(skills.length).toBe(expectedCount);
		});
	});

	describe("getAllCategories", () => {
		test("should return unique categories", () => {
			const categories = getAllCategories();

			expect(categories).toBeInstanceOf(Array);
			expect(categories.length).toBeGreaterThan(0);

			// Check for no duplicates
			const uniqueCategories = new Set(categories);
			expect(categories.length).toBe(uniqueCategories.size);
		});

		test("should include all expected categories", () => {
			const categories = getAllCategories();

			expect(categories).toContain("ai-multimodal");
			expect(categories).toContain("databases");
			expect(categories).toContain("devops");
			expect(categories).toContain("media-processing");
			expect(categories).toContain("web-frameworks");
			expect(categories).toContain("ui-styling");
		});

		test("should match number of unique categories in mappings", () => {
			const categories = getAllCategories();
			const uniqueCategories = new Set(SKILL_CATEGORY_MAPPINGS.map((m) => m.newCategory));

			expect(categories.length).toBe(uniqueCategories.size);
		});
	});

	describe("isKnownSkill", () => {
		test("should return true for migratable skills", () => {
			expect(isKnownSkill("gemini-vision")).toBe(true);
			expect(isKnownSkill("postgresql-psql")).toBe(true);
			expect(isKnownSkill("docker")).toBe(true);
			expect(isKnownSkill("nextjs")).toBe(true);
		});

		test("should return true for preserved skills", () => {
			expect(isKnownSkill("common")).toBe(true);
			expect(isKnownSkill("debugging")).toBe(true);
			expect(isKnownSkill("claude-code")).toBe(true);
			expect(isKnownSkill("problem-solving")).toBe(true);
		});

		test("should return false for unknown skills", () => {
			expect(isKnownSkill("unknown-skill")).toBe(false);
			expect(isKnownSkill("non-existent")).toBe(false);
			expect(isKnownSkill("")).toBe(false);
		});

		test("should check all preserved skills", () => {
			for (const skill of PRESERVED_SKILLS) {
				expect(isKnownSkill(skill)).toBe(true);
			}
		});

		test("should check all migratable skills", () => {
			const migratableSkills = getAllMigratableSkills();
			for (const skill of migratableSkills) {
				expect(isKnownSkill(skill)).toBe(true);
			}
		});
	});

	describe("getPathMapping", () => {
		test("should return mapping for migratable skills", () => {
			const mapping = getPathMapping("gemini-vision", ".claude/skills", ".claude/skills");

			expect(mapping).not.toBeNull();
			expect(mapping?.oldPath).toBe(".claude/skills/gemini-vision");
			expect(mapping?.newPath).toBe(".claude/skills/ai-multimodal/gemini-vision");
		});

		test("should return null for preserved skills", () => {
			const mapping = getPathMapping("common", ".claude/skills", ".claude/skills");

			expect(mapping).toBeNull();
		});

		test("should return null for unknown skills", () => {
			const mapping = getPathMapping("unknown-skill", ".claude/skills", ".claude/skills");

			expect(mapping).toBeNull();
		});

		test("should use correct paths for database skills", () => {
			const mapping = getPathMapping("postgresql-psql", "/old/path", "/new/path");

			expect(mapping).not.toBeNull();
			expect(mapping?.oldPath).toBe("/old/path/postgresql-psql");
			expect(mapping?.newPath).toBe("/new/path/databases/postgresql-psql");
		});

		test("should use correct paths for DevOps skills", () => {
			const mapping = getPathMapping("docker", "/old", "/new");

			expect(mapping).not.toBeNull();
			expect(mapping?.oldPath).toBe("/old/docker");
			expect(mapping?.newPath).toBe("/new/devops/docker");
		});

		test("should handle different base paths", () => {
			const mapping = getPathMapping(
				"nextjs",
				"/project/.claude/skills",
				"/release/.claude/skills",
			);

			expect(mapping).not.toBeNull();
			expect(mapping?.oldPath).toBe("/project/.claude/skills/nextjs");
			expect(mapping?.newPath).toBe("/release/.claude/skills/web-frameworks/nextjs");
		});

		test("should handle absolute paths", () => {
			const mapping = getPathMapping("tailwindcss", "/absolute/old", "/absolute/new");

			expect(mapping).not.toBeNull();
			expect(mapping?.oldPath).toBe("/absolute/old/tailwindcss");
			expect(mapping?.newPath).toBe("/absolute/new/ui-styling/tailwindcss");
		});

		test("should handle relative paths", () => {
			const mapping = getPathMapping("ffmpeg", "old/skills", "new/skills");

			expect(mapping).not.toBeNull();
			expect(mapping?.oldPath).toBe("old/skills/ffmpeg");
			expect(mapping?.newPath).toBe("new/skills/media-processing/ffmpeg");
		});
	});

	describe("integration tests", () => {
		test("all migratable skills should have valid categories", () => {
			const migratableSkills = getAllMigratableSkills();

			for (const skill of migratableSkills) {
				const category = getCategoryForSkill(skill);
				expect(category).not.toBeNull();
				expect(typeof category).toBe("string");
				expect(category).not.toBe("");
			}
		});

		test("all migratable skills should have path mappings", () => {
			const migratableSkills = getAllMigratableSkills();

			for (const skill of migratableSkills) {
				const mapping = getPathMapping(skill, "old", "new");
				expect(mapping).not.toBeNull();
				expect(mapping?.oldPath).toBe(`old/${skill}`);
				expect(mapping?.newPath).toContain(skill);
			}
		});

		test("preserved skills should not have mappings", () => {
			for (const skill of PRESERVED_SKILLS) {
				const mapping = getPathMapping(skill, "old", "new");
				expect(mapping).toBeNull();
			}
		});

		test("all categories should have at least one skill", () => {
			const categories = getAllCategories();

			for (const category of categories) {
				const skillsInCategory = SKILL_CATEGORY_MAPPINGS.find((m) => m.newCategory === category);
				expect(skillsInCategory).toBeDefined();
				expect(skillsInCategory?.oldSkills.length).toBeGreaterThan(0);
			}
		});
	});
});
