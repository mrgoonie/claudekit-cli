/**
 * Tests for plan-validator.ts
 * Covers all validation checks: filename-as-link-text, missing-frontmatter,
 * no-phases-found, missing-phase-file, and clean plan (no issues).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validatePlanFile } from "@/domains/plan-parser/plan-validator.js";

// ─── Temp fixture setup ───────────────────────────────────────────────────────

const TMP_DIR = join(import.meta.dir, "__tmp_plan_validator__");

beforeAll(() => {
	mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
	rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeFixture(name: string, content: string): string {
	const filePath = join(TMP_DIR, name);
	writeFileSync(filePath, content, "utf8");
	return filePath;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validatePlanFile", () => {
	test("clean plan with frontmatter and phases passes with no issues", () => {
		const phaseFile = join(TMP_DIR, "phase-01-setup.md");
		writeFileSync(phaseFile, "# Setup", "utf8");

		const planFile = writeFixture(
			"clean-plan.md",
			`---
title: Clean Plan
status: in-progress
---

| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01-setup.md) | completed |
`,
		);

		const result = validatePlanFile(planFile);
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.phases).toHaveLength(1);
	});

	test("warns when link text is a filename (filename-as-link-text)", () => {
		const planFile = writeFixture(
			"filename-link.md",
			`---
title: Test
---

| # | Name | Status |
|---|------|--------|
| 1 | [phase-01-setup.md](./phase-01-setup.md) | pending |
`,
		);

		const result = validatePlanFile(planFile);
		const issue = result.issues.find((i) => i.code === "filename-as-link-text");
		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("warning");
	});

	test("warns on missing frontmatter (default non-strict)", () => {
		const planFile = writeFixture(
			"no-frontmatter.md",
			`| # | Name | Status |
|---|------|--------|
| 1 | Setup | pending |
`,
		);

		const result = validatePlanFile(planFile, false);
		const issue = result.issues.find((i) => i.code === "missing-frontmatter");
		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("warning");
	});

	test("errors on missing frontmatter in strict mode", () => {
		const planFile = writeFixture(
			"no-frontmatter-strict.md",
			`| # | Name | Status |
|---|------|--------|
| 1 | Setup | pending |
`,
		);

		const result = validatePlanFile(planFile, true);
		const issue = result.issues.find((i) => i.code === "missing-frontmatter");
		expect(issue?.severity).toBe("error");
		expect(result.valid).toBe(false);
	});

	test("warns when no phases are found", () => {
		const planFile = writeFixture(
			"no-phases.md",
			`---
title: Empty Plan
---

# Just a heading with no phase table
`,
		);

		const result = validatePlanFile(planFile);
		const issue = result.issues.find((i) => i.code === "no-phases-found");
		expect(issue).toBeDefined();
		expect(issue?.severity).toBe("warning");
	});

	test("warns when referenced phase file is missing on disk", () => {
		const planFile = writeFixture(
			"missing-files.md",
			`---
title: Missing Files
---

| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./does-not-exist.md) | pending |
`,
		);

		const result = validatePlanFile(planFile);
		const issue = result.issues.find((i) => i.code === "missing-phase-file");
		expect(issue).toBeDefined();
	});

	test("result includes phases array even when issues exist", () => {
		// No frontmatter — triggers missing-frontmatter warning
		// But phases should still be parsed from the table with links
		const planFile = writeFixture(
			"issues-with-phases.md",
			`| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01.md) | pending |
| 2 | [Build](./phase-02.md) | completed |
`,
		);

		const result = validatePlanFile(planFile);
		expect(result.phases.length).toBeGreaterThan(0);
		expect(result.file).toBe(planFile);
	});
});
