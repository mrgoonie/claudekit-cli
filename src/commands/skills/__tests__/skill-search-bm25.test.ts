/**
 * Unit tests for BM25 skill search index
 */
import { describe, expect, test } from "bun:test";
import { buildIndex, search } from "../../../domains/skills/skill-search-index.js";
import type { CatalogSkillEntry } from "../types.js";

function makeSkill(
	name: string,
	description: string,
	keywords?: string[],
	category?: string,
): CatalogSkillEntry {
	return {
		name,
		displayName: name,
		description,
		keywords,
		category,
		path: `${name}/SKILL.md`,
		hasScripts: false,
		hasReferences: false,
	};
}

const SKILLS: CatalogSkillEntry[] = [
	makeSkill("sequential-thinking", "Sequential reasoning and planning for complex tasks", [
		"reasoning",
		"planning",
		"thinking",
	]),
	makeSkill("debug", "Debugging and error analysis", ["debugging", "errors", "troubleshoot"]),
	makeSkill("code-reviewer", "Review code quality and suggest improvements", [
		"review",
		"quality",
		"code",
	]),
	makeSkill("docs-seeker", "Search documentation and references", ["docs", "search", "reference"]),
	makeSkill("deploy", "Deploy applications to cloud providers", ["deploy", "cloud", "CI/CD"]),
];

describe("buildIndex", () => {
	test("creates index with correct doc count", () => {
		const idx = buildIndex(SKILLS);
		expect(idx.totalDocs).toBe(SKILLS.length);
		expect(idx.docs).toHaveLength(SKILLS.length);
	});

	test("computes avgDL > 0 for non-empty skills", () => {
		const idx = buildIndex(SKILLS);
		expect(idx.avgDL).toBeGreaterThan(0);
	});

	test("returns empty index for empty skills list", () => {
		const idx = buildIndex([]);
		expect(idx.totalDocs).toBe(0);
		expect(idx.avgDL).toBe(1); // guard against divide-by-zero
	});
});

describe("search", () => {
	test("returns empty results for empty index", () => {
		const idx = buildIndex([]);
		const results = search(idx, "anything");
		expect(results).toHaveLength(0);
	});

	test("returns empty results for stop-word-only query", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "the is a"); // all stop words
		expect(results).toHaveLength(0);
	});

	test("finds debug skill for 'debugging errors' query", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "debugging errors");
		expect(results.length).toBeGreaterThan(0);
		const topDoc = SKILLS[results[0].docIndex];
		expect(topDoc.name).toBe("debug");
	});

	test("finds code-reviewer for 'code review quality' query", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "code review quality");
		expect(results.length).toBeGreaterThan(0);
		const topDoc = SKILLS[results[0].docIndex];
		expect(topDoc.name).toBe("code-reviewer");
	});

	test("respects limit parameter", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "code", 2);
		expect(results.length).toBeLessThanOrEqual(2);
	});

	test("returns results sorted by score descending", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "deploy cloud");
		expect(results.length).toBeGreaterThan(0);
		for (let i = 1; i < results.length; i++) {
			expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
		}
	});

	test("scores are positive numbers", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "planning reasoning");
		for (const r of results) {
			expect(r.score).toBeGreaterThan(0);
		}
	});

	test("exact name match ranks highly", () => {
		const idx = buildIndex(SKILLS);
		const results = search(idx, "sequential-thinking");
		expect(results.length).toBeGreaterThan(0);
		// First result should be sequential-thinking (name repeated 3x = high boost)
		expect(SKILLS[results[0].docIndex].name).toBe("sequential-thinking");
	});
});
