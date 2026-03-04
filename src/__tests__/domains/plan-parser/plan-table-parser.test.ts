/**
 * Tests for plan-table-parser.ts
 * Covers normalizeStatus, filenameToTitle, and parsePlanPhases for all supported formats.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	filenameToTitle,
	normalizeStatus,
	parsePlanFile,
	parsePlanPhases,
} from "@/domains/plan-parser/plan-table-parser.js";

// Temp dir for parsePlanFile tests
const TMP = join(tmpdir(), `ck-parser-test-${Date.now()}`);
beforeAll(() => mkdirSync(TMP, { recursive: true }));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const DIR = "/tmp/plans/test-plan";

// ─── normalizeStatus ──────────────────────────────────────────────────────────

describe("normalizeStatus", () => {
	test("recognizes 'completed'", () => {
		expect(normalizeStatus("completed")).toBe("completed");
	});

	test("recognizes 'done'", () => {
		expect(normalizeStatus("Done")).toBe("completed");
	});

	test("recognizes checkmark emoji ✅", () => {
		expect(normalizeStatus("✅")).toBe("completed");
	});

	test("recognizes unicode checkmark ✓", () => {
		expect(normalizeStatus("✓")).toBe("completed");
	});

	test("recognizes 'in progress'", () => {
		expect(normalizeStatus("in progress")).toBe("in-progress");
	});

	test("recognizes 'active'", () => {
		expect(normalizeStatus("Active")).toBe("in-progress");
	});

	test("recognizes 'wip'", () => {
		expect(normalizeStatus("WIP")).toBe("in-progress");
	});

	test("recognizes 🔄 emoji", () => {
		expect(normalizeStatus("🔄")).toBe("in-progress");
	});

	test("defaults to pending for unknown", () => {
		expect(normalizeStatus("not started")).toBe("pending");
	});

	test("handles empty string", () => {
		expect(normalizeStatus("")).toBe("pending");
	});
});

// ─── filenameToTitle ──────────────────────────────────────────────────────────

describe("filenameToTitle", () => {
	test("converts standard phase filename to title", () => {
		expect(filenameToTitle("phase-01-setup-environment.md")).toBe("Setup Environment");
	});

	test("handles alphanumeric phase IDs", () => {
		expect(filenameToTitle("phase-1a-setup.md")).toBe("Setup");
	});

	test("returns non-phase filename unchanged", () => {
		expect(filenameToTitle("README.md")).toBe("README.md");
	});

	test("returns plain text unchanged", () => {
		expect(filenameToTitle("My Plan Phase")).toBe("My Plan Phase");
	});

	test("title-cases multi-word phases", () => {
		expect(filenameToTitle("phase-03-implement-api-endpoints.md")).toBe("Implement Api Endpoints");
	});
});

// ─── parsePlanPhases ──────────────────────────────────────────────────────────

describe("parsePlanPhases - Format 0 (header-aware table)", () => {
	test("parses table with # | Name | Status columns", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01-setup.md) | completed |
| 2 | [Build](./phase-02-build.md) | in progress |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("in-progress");
	});

	test("prefers linked table over plain table when both present", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01.md) | completed |
| 2 | [Build](./phase-02.md) | pending |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].file).toContain("phase-01.md");
	});

	test("skips tables without Status column", () => {
		const md = `
| # | Name |
|---|------|
| 1 | Setup |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(0);
	});
});

describe("parsePlanPhases - Format 2b (# | [Name](path) | Status)", () => {
	test("parses numbered rows with inline links", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1 | [Phase One](./phase-01.md) | done |
| 2 | [Phase Two](./phase-02.md) | pending |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("pending");
	});
});

describe("parsePlanPhases - Format 3 (### heading)", () => {
	test("parses heading-based phases", () => {
		const md = `
### Phase 1: Setup
- Status: completed

### Phase 2: Build
- Status: in progress
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("in-progress");
	});
});

describe("parsePlanPhases - Format 6 (checkbox bold links)", () => {
	test("parses checkbox list with bold phase links", () => {
		const md = `
- [x] **[Phase 1: Setup](./phase-01.md)**
- [ ] **[Phase 2: Build](./phase-02.md)**
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("pending");
	});
});

describe("parsePlanPhases - edge cases", () => {
	test("returns empty array for empty content", () => {
		expect(parsePlanPhases("", DIR)).toHaveLength(0);
	});

	test("returns empty array for content with no tables or lists", () => {
		const md = "# Just a heading\n\nSome paragraph text.";
		expect(parsePlanPhases(md, DIR)).toHaveLength(0);
	});

	test("parses alphanumeric phase IDs (e.g. 1a, 2b)", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1a | [Phase 1a](./phase-1a.md) | completed |
| 1b | [Phase 1b](./phase-1b.md) | pending |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].phaseId).toBe("1a");
		expect(phases[1].phaseId).toBe("1b");
	});

	test("strips frontmatter before parsing", () => {
		const md = `---
title: My Plan
---

### Phase 1: Setup
- Status: completed
`;
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(1);
		expect(phases[0].name).toBe("Setup");
	});
});

// ─── parsePlanFile ────────────────────────────────────────────────────────────

describe("parsePlanFile", () => {
	test("reads file and returns frontmatter + phases", () => {
		const filePath = join(TMP, "plan-fm.md");
		writeFileSync(
			filePath,
			`---
title: File Plan
status: active
---

### Phase 1: Setup
- Status: completed

### Phase 2: Build
`,
			"utf8",
		);
		const { frontmatter, phases } = parsePlanFile(filePath);
		expect(frontmatter.title).toBe("File Plan");
		expect(frontmatter.status).toBe("active");
		expect(phases).toHaveLength(2);
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("pending");
	});

	test("works with table-format plan file", () => {
		const filePath = join(TMP, "plan-table.md");
		writeFileSync(
			filePath,
			`---
title: Table Plan
---

| # | Name | Status |
|---|------|--------|
| 1 | [Alpha](./phase-01-alpha.md) | completed |
| 2 | [Beta](./phase-02-beta.md) | in-progress |
`,
			"utf8",
		);
		const { frontmatter, phases } = parsePlanFile(filePath);
		expect(frontmatter.title).toBe("Table Plan");
		expect(phases).toHaveLength(2);
		expect(phases[0].phaseId).toBe("1");
		expect(phases[1].status).toBe("in-progress");
	});
});
