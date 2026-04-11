import { describe, expect, test } from "bun:test";
import { validateSkillFrontmatter } from "../skill-frontmatter-validator.js";

describe("validateSkillFrontmatter", () => {
	test("T1: valid frontmatter passes with 0 warnings", () => {
		const result = validateSkillFrontmatter(
			{ name: "ck:cook", description: "Implement features" },
			"cook",
		);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test("T2: missing name produces warning", () => {
		const result = validateSkillFrontmatter({ description: "Some skill" }, "test-skill");
		expect(result.valid).toBe(false);
		expect(result.warnings.some((w) => w.includes("name"))).toBe(true);
	});

	test("T3: missing description produces warning", () => {
		const result = validateSkillFrontmatter({ name: "ck:x" }, "test-skill");
		expect(result.valid).toBe(false);
		expect(result.warnings.some((w) => w.includes("description"))).toBe(true);
	});

	test("T4: invalid category produces warning", () => {
		const result = validateSkillFrontmatter(
			{ name: "ck:x", description: "Test", category: "invalid-cat" },
			"test-skill",
		);
		expect(result.valid).toBe(false);
		expect(result.warnings.some((w) => w.includes("category"))).toBe(true);
	});

	test("T5: valid category accepted", () => {
		const result = validateSkillFrontmatter(
			{ name: "ck:x", description: "Test", category: "dev-tools" },
			"test-skill",
		);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test("T6: unknown fields produce no warning (permissive)", () => {
		const result = validateSkillFrontmatter(
			{
				name: "ck:x",
				description: "Test",
				customField: "hello",
				anotherOne: 42,
			},
			"test-skill",
		);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	test("T7: empty data produces 2 warnings", () => {
		const result = validateSkillFrontmatter({}, "empty-skill");
		expect(result.valid).toBe(false);
		expect(result.warnings.length).toBeGreaterThanOrEqual(2);
	});
});
