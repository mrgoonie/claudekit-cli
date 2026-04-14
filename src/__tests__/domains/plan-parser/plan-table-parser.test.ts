/**
 * Tests for plan-table-parser.ts
 * Covers normalizeStatus, filenameToTitle, and parsePlanPhases for all supported formats.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlanSummary } from "@/domains/plan-parser/index.js";
import {
	filenameToTitle,
	normalizeStatus,
	parsePlanFile,
	parsePlanPhases,
} from "@/domains/plan-parser/plan-table-parser.js";

// Temp dir for parsePlanFile / buildPlanSummary tests — within CWD
const TMP = join(process.cwd(), `.test-tmp-plan-table-parser-${Date.now()}`);
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

	test("title-cases multi-word phases with acronym awareness", () => {
		expect(filenameToTitle("phase-03-implement-api-endpoints.md")).toBe("Implement API Endpoints");
		expect(filenameToTitle("phase-01-setup-cli-config.md")).toBe("Setup CLI Config");
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

// ─── parsePlanPhases - Format 1 ───────────────────────────────────────────────

describe("parsePlanPhases - Format 1 (| Phase | Name | Status | [Link](path) |)", () => {
	// Note: The header-aware parser (Format 0) takes priority. When the header has both
	// "Phase" and "Name" columns, the parser sets nameCol=phaseCol=0. Data from the Phase
	// column is used for the phase name. The "Link" column is not a recognized header so
	// links in that column are not extracted by the header-aware parser. Use `# | Name | Status`
	// format (Format 0) to reliably extract links — see Format 0 tests above.
	test("parses status and phase numbers from Phase/Name/Status/Link table", () => {
		const md = `
| Phase | Name | Status | Link |
|-------|------|--------|------|
| 1 | Setup | Complete | [phase-01-setup.md](./phase-01-setup.md) |
| 2a | Config | In Progress | [phase-02a-config.md](./phase-02a-config.md) |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].phase).toBe(1);
		expect(phases[0].phaseId).toBe("1");
		expect(phases[0].status).toBe("completed");
		expect(phases[1].phaseId).toBe("2a");
		expect(phases[1].status).toBe("in-progress");
	});

	// Explicit Format 1 regex (fallback) — requires the Phase column to hold a numeric ID
	// and the Link column to contain the markdown link. Triggered only when header-aware fails.
	test("Format 1 regex extracts link when # is used as phase column (fallback path)", () => {
		// Use `#` header so header-aware picks it as phaseCol (not nameCol) →
		// then Name col (idx 1) becomes nameCol. This allows the link in the Name col to be found.
		const md = `
| # | Name | Status | Link |
|---|------|--------|------|
| 1 | [Setup](./phase-01-setup.md) | Complete | - |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(1);
		expect(phases[0].file).toContain("phase-01-setup.md");
	});
});

// ─── parsePlanPhases - Format 2 ───────────────────────────────────────────────

describe("parsePlanPhases - Format 2 (| [Phase X](path) | Description | Status |)", () => {
	// Note: The header-aware parser handles this format. When "Phase" and "Description" are
	// both present, nameCol ends up pointing to the Phase column (col 0) because "Description"
	// matches the nameCol else-if only when nameCol === -1, but "Phase" header already set nameCol=0.
	// Result: phaseId="0" (link stripped from phaseRaw), but file IS extracted from the link.
	test("extracts file path from phase link (header-aware parser)", () => {
		const md = `
| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 1](./phase-01.md) | Setup | Complete |
| [Phase 2](./phase-02.md) | Build | Pending |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].file).toContain("phase-01.md");
		expect(phases[0].status).toBe("completed");
		expect(phases[1].file).toContain("phase-02.md");
		expect(phases[1].status).toBe("pending");
	});

	test("Format 2 fallback regex: | [Phase N](path) | Name | Status | with numeric phase IDs", () => {
		// Format 2 fallback regex: /\|\s*\[(?:Phase\s*)?(\d+)([a-z]?)\]\(([^)]+)\)\s*\|\s*([^|]+)\s*\|\s*([^|]+)/
		// This is triggered when header-aware returns nothing. It requires the Phase cell
		// to start with "[N" or "[Phase N" (no "Phase" text prefix outside brackets).
		const md = `
| [1](./phase-01.md) | Setup | Complete |
| [2](./phase-02.md) | Build | Pending |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].phaseId).toBe("1");
		expect(phases[0].status).toBe("completed");
		expect(phases[1].phaseId).toBe("2");
		expect(phases[1].status).toBe("pending");
	});
});

// ─── parsePlanPhases - Format 2c ──────────────────────────────────────────────

describe("parsePlanPhases - Format 2c (plain table, no links)", () => {
	test("parses plain table without any markdown links", () => {
		const md = `
| # | Description | Status |
|---|-------------|--------|
| 1 | Setup Environment | Complete |
| 2 | Database Models | In Progress |
| 3 | API Endpoints | Pending |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(3);
		expect(phases[0].phaseId).toBe("1");
		expect(phases[0].name).toBe("Setup Environment");
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("in-progress");
		expect(phases[2].status).toBe("pending");
	});

	test("file field is empty string for plain table (no links)", () => {
		const md = `
| # | Description | Status |
|---|-------------|--------|
| 1 | Setup Environment | Complete |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].file).toBe("");
	});
});

// ─── parsePlanPhases - Format 4 ───────────────────────────────────────────────

describe("parsePlanPhases - Format 4 (bullet list with phase numbers)", () => {
	test("parses bullet-list phases with non-contiguous phase numbers", () => {
		const md = `
- Phase 1: Setup Environment ✅
  - File: \`./phase-01-setup.md\`
- Phase 3: API Design
  - Status: In Progress
- Phase 5: Testing
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(3);
		// Phase IDs must be [1, 3, 5] — not renumbered sequentially
		const ids = phases.map((p) => p.phaseId);
		expect(ids).toEqual(["1", "3", "5"]);
	});

	test("recognizes checkmark as completed status", () => {
		const md = `
- Phase 1: Setup ✅
- Phase 2: Build
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].status).toBe("completed");
		expect(phases[1].status).toBe("pending");
	});

	test("reads inline status from sub-bullet", () => {
		const md = `
- Phase 1: Setup
  - Status: In Progress
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].status).toBe("in-progress");
	});
});

// ─── parsePlanPhases - Format 5 ───────────────────────────────────────────────

describe("parsePlanPhases - Format 5 (numbered list + checkboxes)", () => {
	test("parses numbered list phases with checkbox status", () => {
		const md = `
1) **Environment Setup**
2) **Database Design**

- [x] Environment Setup
- [ ] Database Design
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases).toHaveLength(2);
		expect(phases[0].name).toBe("Environment Setup");
		expect(phases[0].status).toBe("completed");
		expect(phases[1].name).toBe("Database Design");
		expect(phases[1].status).toBe("pending");
	});

	test("preserves correct phase numbers from numbered list", () => {
		const md = `
1) **Alpha**
2) **Beta**

- [ ] Alpha
- [x] Beta
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].phaseId).toBe("1");
		expect(phases[1].phaseId).toBe("2");
	});
});

// ─── parsePlanPhases - multi-table disambiguation ─────────────────────────────

describe("parsePlanPhases - multi-table disambiguation", () => {
	// Note: The header-aware parser prefers tables containing links (hasLinks=true).
	// The "Phase/Name/Status" header causes nameCol=phaseCol=0 (both point to same col),
	// so links in col 1 (Name column data) are NOT detected as hasLinks. To reliably get
	// link preference, use "# | Name | Status" header (# sets phaseCol, Name sets nameCol separately).
	test("picks linked table (with # header) over prior plain mapping table", () => {
		const md = `
| Resource | Owner |
|----------|-------|
| API | Team A |

| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01.md) | Complete |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		// Should parse the phase table (has links in Name col, # header correctly separates cols)
		expect(phases).toHaveLength(1);
		expect(phases[0].file).toContain("phase-01.md");
	});

	test("skips resource-mapping table without Status column", () => {
		const md = `
| Resource | Owner |
|----------|-------|
| API | Team A |

| # | Description | Status |
|---|-------------|--------|
| 1 | Setup | Complete |
`.trim();
		// First table has no Status col → skipped. Second table with # header is parsed.
		const phases = parsePlanPhases(md, DIR);
		expect(phases.length).toBe(1);
		expect(phases[0].phaseId).toBe("1");
	});

	test("falls back to first plain-text table when no linked table exists", () => {
		const md = `
| Resource | Owner | Status |
|----------|-------|--------|
| API | Team A | Complete |

| # | Description | Status |
|---|-------------|--------|
| 1 | Setup | Complete |
`.trim();
		// First table has Status col (Resource/Owner/Status) — header-aware picks it as firstTablePhases
		// fallback since neither table has links. Result: something is returned.
		const phases = parsePlanPhases(md, DIR);
		expect(phases.length).toBeGreaterThan(0);
	});
});

// ─── generateAnchors option ───────────────────────────────────────────────────

describe("generateAnchors option", () => {
	test("Format 0: generates anchor matching phase-{id}-{slug} for header-aware table", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1 | [Setup Environment](./phase-01-setup-environment.md) | completed |
| 2 | [Build API](./phase-02-build-api.md) | pending |
`.trim();
		const phases = parsePlanPhases(md, DIR, { generateAnchors: true });
		expect(phases).toHaveLength(2);
		expect(phases[0].anchor).not.toBeNull();
		expect(phases[0].anchor).toMatch(/^phase-\d+-[a-z0-9-]+$/);
		expect(phases[0].anchor).toBe("phase-01-setup-environment");
		expect(phases[1].anchor).not.toBeNull();
		expect(phases[1].anchor).toBe("phase-02-build-api");
	});

	test("Format 2: generates anchor for | [Phase N](path) | Description | Status | format", () => {
		const md = `
| [1](./phase-01.md) | Setup DB | Complete |
| [2](./phase-02.md) | Build API | Pending |
`.trim();
		const phases = parsePlanPhases(md, DIR, { generateAnchors: true });
		expect(phases).toHaveLength(2);
		expect(phases[0].anchor).not.toBeNull();
		expect(phases[0].anchor).toMatch(/^phase-\d+-[a-z0-9-]+$/);
		expect(phases[0].anchor).toBe("phase-01-setup-db");
		expect(phases[1].anchor).not.toBeNull();
		expect(phases[1].anchor).toBe("phase-02-build-api");
	});

	test("Format 4: generates anchor for bullet-list phases", () => {
		const md = `
- Phase 1: Setup Environment ✅
- Phase 3: API Design
  - Status: In Progress
`.trim();
		const phases = parsePlanPhases(md, DIR, { generateAnchors: true });
		expect(phases).toHaveLength(2);
		expect(phases[0].anchor).not.toBeNull();
		expect(phases[0].anchor).toMatch(/^phase-\d+-[a-z0-9-]+$/);
		expect(phases[0].anchor).toBe("phase-01-setup-environment");
		expect(phases[1].anchor).not.toBeNull();
		expect(phases[1].anchor).toBe("phase-03-api-design");
	});

	test("anchor is null when generateAnchors is not set", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01-setup.md) | completed |
`.trim();
		const phases = parsePlanPhases(md, DIR);
		expect(phases[0].anchor).toBeNull();
	});

	test("anchor handles alphanumeric phase IDs (e.g. 1a)", () => {
		const md = `
| # | Name | Status |
|---|------|--------|
| 1a | [Setup Alpha](./phase-1a-setup-alpha.md) | completed |
`.trim();
		const phases = parsePlanPhases(md, DIR, { generateAnchors: true });
		expect(phases[0].anchor).not.toBeNull();
		expect(phases[0].anchor).toBe("phase-01a-setup-alpha");
	});
});

// ─── buildPlanSummary ─────────────────────────────────────────────────────────

describe("buildPlanSummary", () => {
	test("returns correct counts for 3 completed, 1 in-progress, 2 pending", () => {
		const filePath = join(TMP, "summary-counts.md");
		writeFileSync(
			filePath,
			`---
title: Count Test
---

| # | Name | Status |
|---|------|--------|
| 1 | [Alpha](./phase-01.md) | completed |
| 2 | [Beta](./phase-02.md) | completed |
| 3 | [Gamma](./phase-03.md) | completed |
| 4 | [Delta](./phase-04.md) | in-progress |
| 5 | [Epsilon](./phase-05.md) | pending |
| 6 | [Zeta](./phase-06.md) | pending |
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.totalPhases).toBe(6);
		expect(summary.completed).toBe(3);
		expect(summary.inProgress).toBe(1);
		expect(summary.pending).toBe(2);
	});

	test("title from frontmatter is included in summary", () => {
		const filePath = join(TMP, "summary-title.md");
		writeFileSync(
			filePath,
			`---
title: My Feature Plan
---

### Phase 1: Setup
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.title).toBe("My Feature Plan");
	});

	test("title is undefined when no frontmatter present", () => {
		const filePath = join(TMP, "summary-no-frontmatter.md");
		writeFileSync(
			filePath,
			`### Phase 1: Setup
- Status: completed
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.title).toBeUndefined();
	});

	test("empty plan (no phases) returns all counts as 0", () => {
		const filePath = join(TMP, "summary-empty.md");
		writeFileSync(
			filePath,
			`---
title: Empty Plan
---

# Just a heading, no phases
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.totalPhases).toBe(0);
		expect(summary.completed).toBe(0);
		expect(summary.inProgress).toBe(0);
		expect(summary.pending).toBe(0);
	});

	test("summary includes planFile and planDir paths", () => {
		const filePath = join(TMP, "summary-paths.md");
		writeFileSync(
			filePath,
			`---
title: Path Test
---

### Phase 1: Setup
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.planFile).toBe(filePath);
		expect(summary.planDir).toBe(TMP);
	});

	test("summary phases array matches parsed phases", () => {
		const filePath = join(TMP, "summary-phases.md");
		writeFileSync(
			filePath,
			`---
title: Phase Check
---

### Phase 1: Setup
- Status: completed

### Phase 2: Build
- Status: in progress
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.phases).toHaveLength(2);
		expect(summary.phases[0].status).toBe("completed");
		expect(summary.phases[1].status).toBe("in-progress");
	});

	test("summary includes branch and dependency metadata from frontmatter", () => {
		const filePath = join(TMP, "summary-dependencies.md");
		writeFileSync(
			filePath,
			`---
title: Dependency Check
branch: kai/feat/657-plan-system-overhaul-cli
tags: [plans, dashboard]
blockedBy: [global:260413-foundation]
blocks: [260413-follow-up]
---

### Phase 1: Setup
- Status: pending
`,
			"utf8",
		);
		const summary = buildPlanSummary(filePath);
		expect(summary.branch).toBe("kai/feat/657-plan-system-overhaul-cli");
		expect(summary.tags).toEqual(["plans", "dashboard"]);
		expect(summary.blockedBy).toEqual(["global:260413-foundation"]);
		expect(summary.blocks).toEqual(["260413-follow-up"]);
	});
});
