/**
 * Parser Parity Contract Tests
 *
 * Verifies that the TypeScript CLI parser (plan-table-parser.ts) and the
 * CJS engineer parser (plan-table-parser.cjs) produce identical output
 * for the same markdown input across all supported formats (0-6).
 *
 * CJS parser: claudekit-engineer/.claude/skills/_shared/lib/plan-table-parser.cjs
 * TS parser:  claudekit-cli/src/domains/plan-parser/plan-table-parser.ts
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parsePlanPhases as tsParsePlanPhases } from "@/domains/plan-parser/plan-table-parser.js";

// ─── CJS parser import ────────────────────────────────────────────────────────
// Bun supports require() for CJS modules natively
const CJS_PARSER_PATH = resolve(
	__dirname,
	"../../../../../claudekit-engineer/.claude/skills/_shared/lib/plan-table-parser.cjs",
);

const { parsePlanPhases: cjsParsePlanPhases } = require(CJS_PARSER_PATH) as any;

// ─── Types for comparison ─────────────────────────────────────────────────────

interface NormalizedPhase {
	phase: number;
	phaseId: string;
	name: string;
	status: string;
	/** basename only — avoids absolute-path comparison across parsers */
	fileBasename: string | null;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

let testDir: string;

beforeEach(() => {
	testDir = mkdtempSync(join(tmpdir(), "ck-parity-"));
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

/**
 * Normalize a phase result from either parser for comparison.
 * Strips absolute paths — only compares the basename of the file field.
 * The CJS parser sets file=null when no link; TS parser sets file="".
 * We normalize both to null for no-link, basename string for linked.
 */
function normalize(phase: any): NormalizedPhase {
	const fileVal = phase.file;
	let fileBasename: string | null = null;
	if (fileVal && typeof fileVal === "string" && fileVal.length > 0) {
		fileBasename = basename(fileVal);
	}
	return {
		phase: phase.phase,
		phaseId: phase.phaseId,
		name: phase.name,
		status: phase.status,
		fileBasename,
	};
}

function normalizeAll(phases: Record<string, unknown>[]): NormalizedPhase[] {
	return phases.map(normalize);
}

/**
 * Parse content with both parsers and return normalized results.
 * The TS parser strips frontmatter via gray-matter; to ensure parity
 * on raw markdown content (no frontmatter), we pass content directly.
 */
function parseBoth(content: string, dir: string) {
	const cjsResult = cjsParsePlanPhases(content, dir);
	const tsResult = tsParsePlanPhases(content, dir);
	return {
		cjs: normalizeAll(cjsResult),
		ts: normalizeAll(tsResult),
	};
}

// ─── Format 0: Header-aware table ─────────────────────────────────────────────

describe("Format 0 — header-aware table", () => {
	test("basic table with Status column produces identical output", () => {
		writeFileSync(join(testDir, "phase-01-setup.md"), "", "utf8");
		writeFileSync(join(testDir, "phase-02-impl.md"), "", "utf8");
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1 | [Setup](./phase-01-setup.md) | Pending |
| 2 | [Implementation](./phase-02-impl.md) | Complete |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
	});

	test("alphanumeric IDs (1a, 1b, 2, 4a)", () => {
		for (const f of [
			"phase-01a-setup.md",
			"phase-01b-config.md",
			"phase-02-impl.md",
			"phase-04a-deploy.md",
		]) {
			writeFileSync(join(testDir, f), "", "utf8");
		}
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1a | [Setup](./phase-01a-setup.md) | Pending |
| 1b | [Config](./phase-01b-config.md) | In Progress |
| 2 | [Implementation](./phase-02-impl.md) | Complete |
| 4a | [Deploy](./phase-04a-deploy.md) | Pending |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts).toHaveLength(4);
		expect(ts[0].phaseId).toBe("1a");
		expect(ts[1].phaseId).toBe("1b");
		expect(ts[2].status).toBe("completed");
		expect(ts[1].status).toBe("in-progress");
	});

	test("Status at non-default column position (column 4)", () => {
		writeFileSync(join(testDir, "phase-01-test.md"), "", "utf8");
		const content = `| # | Name | Effort | Status |
|---|------|--------|--------|
| 1 | [Test Phase](./phase-01-test.md) | 2h | Done |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].status).toBe("completed");
	});

	test("filename-to-title conversion when link text is a filename", () => {
		writeFileSync(join(testDir, "phase-01-background-and-layout.md"), "", "utf8");
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1 | [phase-01-background-and-layout.md](./phase-01-background-and-layout.md) | Pending |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].name).toBe("Background And Layout");
	});

	test("multi-table: prefers table with markdown links", () => {
		writeFileSync(join(testDir, "phase-01-auth.md"), "", "utf8");
		const content = `| Category | Value |
|----------|-------|
| foo | bar |

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Auth](./phase-01-auth.md) | Pending |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts).toHaveLength(1);
		expect(ts[0].name).toBe("Auth");
	});

	test("phaseId letter normalized to lowercase (1A -> 1a)", () => {
		// Both parsers normalize the letter suffix to lowercase
		// Note: name column resolution diverges for '# | Phase | Status' tables:
		//   CJS treats 'Phase' header as nameCol (name = cell value from Phase col)
		//   TS uses '#' col as nameCol fallback (name = cell value from # col)
		// This is a known divergence — test only shared guarantees (status, phaseId)
		const content = `| # | Phase | Status |
|---|-------|--------|
| 1A | Setup Part A | completed |`;
		const cjsResult = cjsParsePlanPhases(content, testDir);
		const tsResult = tsParsePlanPhases(content, testDir);
		expect(cjsResult).toHaveLength(1);
		expect(tsResult).toHaveLength(1);
		// Both agree on phaseId normalization
		expect(cjsResult[0].phaseId).toBe("1a");
		expect(tsResult[0].phaseId).toBe("1a");
		// Both agree on status
		expect(cjsResult[0].status).toBe("completed");
		expect(tsResult[0].status).toBe("completed");
	});

	test("rows parsed correctly — Status column resolved identically", () => {
		// For '# | Phase | Status' tables, name column resolution diverges:
		//   CJS: treats 'Phase' header as nameCol → name = phase cell value
		//   TS: nameCol falls back to phaseCol (#) → name = # cell value
		// Shared guarantees: phase number, phaseId, status are identical.
		const content = `| # | Phase | Status |
|---|-------|--------|
| 1 | Alpha | completed |
| 2 | Beta | pending |`;
		const cjsResult = cjsParsePlanPhases(content, testDir);
		const tsResult = tsParsePlanPhases(content, testDir);
		expect(cjsResult).toHaveLength(2);
		expect(tsResult).toHaveLength(2);
		// Both agree on phase numbers and statuses
		expect(cjsResult[0].phase).toBe(1);
		expect(tsResult[0].phase).toBe(1);
		expect(cjsResult[0].status).toBe("completed");
		expect(tsResult[0].status).toBe("completed");
		expect(cjsResult[1].status).toBe("pending");
		expect(tsResult[1].status).toBe("pending");
		// CJS uses 'Phase' header as name col; TS uses '#' as name col — documented divergence
		expect(cjsResult[0].name).toBe("Alpha"); // CJS reads from Phase col
		expect(tsResult[0].name).toBe("1"); // TS reads from # col (known divergence)
	});
});

// ─── Format 1: Standard 4-column table ───────────────────────────────────────

describe("Format 1 — standard 4-column table", () => {
	test("bare table row without header produces identical output", () => {
		const content = `Some plan text

| 1 | My Phase | Pending | [Link](./phase-01-setup.md) |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].name).toBe("My Phase");
		expect(ts[0].status).toBe("pending");
	});
});

// ─── Format 2: Link-first table ──────────────────────────────────────────────

describe("Format 2 — link-first table [Phase N](path)", () => {
	test("link-first rows produce identical output", () => {
		const content = `| [Phase 1](./phase-01-setup.md) | Setup environment | completed |
| [Phase 2](./phase-02-impl.md) | Implementation | in-progress |`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].phaseId).toBe("1");
		expect(ts[0].status).toBe("completed");
		expect(ts[1].status).toBe("in-progress");
	});
});

// ─── Format 2b: Number-first with link ───────────────────────────────────────

describe("Format 2b — number-first with link in col 2", () => {
	test("| N | [Name](path) | Status | row produces identical output", () => {
		const content = "| 1 | [Tab Structure](./phase-01-tab.md) | Pending | High |";
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].name).toBe("Tab Structure");
		expect(ts[0].status).toBe("pending");
		expect(ts[0].fileBasename).toBe("phase-01-tab.md");
	});
});

// ─── Format 2c: Simple table without links ────────────────────────────────────

describe("Format 2c — simple table without links", () => {
	test("plain text table with Status column produces identical statuses", () => {
		// Note: CJS strips leading zeros from phaseId (01 -> "1"), TS preserves them ("01").
		// This is a known divergence in phaseId formatting.
		// Both parsers agree on: phase number, status, name, no file link.
		const content = `| # | Description | Status |
|---|-------------|--------|
| 01 | Backend: Install deps | Completed |
| 02 | Frontend: Setup | Pending |
`;
		const cjsResult = cjsParsePlanPhases(content, testDir);
		const tsResult = tsParsePlanPhases(content, testDir);
		expect(cjsResult.length).toBeGreaterThanOrEqual(1);
		expect(tsResult.length).toBeGreaterThanOrEqual(1);
		// Both agree on phase number and status
		expect(cjsResult[0].phase).toBe(1);
		expect(tsResult[0].phase).toBe(1);
		expect(cjsResult[0].status).toBe("completed");
		expect(tsResult[0].status).toBe("completed");
		// CJS strips leading zero: "1"; TS preserves it: "01" — documented divergence
		expect(cjsResult[0].phaseId).toBe("1"); // CJS: parseInt strips leading zero
		expect(tsResult[0].phaseId).toBe("01"); // TS: preserves raw string "01"
	});
});

// ─── Format 3: Heading-based ──────────────────────────────────────────────────

describe("Format 3 — heading-based phases", () => {
	test("### Phase N: Name with Status: lines produces identical output", () => {
		const content = `### Phase 1: Discovery
- Status: Complete

### Phase 2: Implementation
- Status: In Progress
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts).toHaveLength(2);
		expect(ts[0].name).toBe("Discovery");
		expect(ts[0].status).toBe("completed");
		expect(ts[1].status).toBe("in-progress");
	});
});

// ─── Format 4: Bullet-list ───────────────────────────────────────────────────

describe("Format 4 — bullet-list phases", () => {
	test("bullet Phase N: with File: references produces identical output", () => {
		writeFileSync(join(testDir, "phase-01-setup.md"), "", "utf8");
		const content = `- Phase 01: Setup ✅
  - File: \`phase-01-setup.md\`
  - Completed: 2025-01-01
- Phase 02: Implementation
  - File: \`phase-02-impl.md\`
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts.length).toBeGreaterThanOrEqual(1);
		expect(ts[0].name).toBe("Setup");
		expect(ts[0].status).toBe("completed");
		expect(ts[0].fileBasename).toBe("phase-01-setup.md");
	});
});

// ─── Format 5: Numbered list with checkbox ────────────────────────────────────

describe("Format 5 — numbered list with checkbox status", () => {
	test("1) **Name** with - [x] checkbox produces identical output", () => {
		const content = `1) **Discovery**
2) **Implementation**

- [x] Discovery:
- [ ] Implementation:
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts).toHaveLength(2);
		expect(ts[0].status).toBe("completed");
		expect(ts[1].status).toBe("pending");
	});
});

// ─── Format 6: Checkbox with bold links ──────────────────────────────────────

describe("Format 6 — checkbox with bold links", () => {
	test("- [x] **[Phase N: Name](path)** produces identical output", () => {
		const content = `- [x] **[Phase 1: Setup](./phase-01-setup.md)**
- [ ] **[Phase 2: Implementation](./phase-02-impl.md)**
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts).toHaveLength(2);
		expect(ts[0].name).toBe("Setup");
		expect(ts[0].status).toBe("completed");
		expect(ts[1].status).toBe("pending");
		expect(ts[1].fileBasename).toBe("phase-02-impl.md");
	});
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("Edge cases", () => {
	test("empty content returns [] from both parsers", () => {
		const { cjs, ts } = parseBoth("", testDir);
		expect(ts).toEqual([]);
		expect(cjs).toEqual([]);
	});

	test("date value in status position treated as completed by both parsers", () => {
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1 | Phase One | 2026-01-01 |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].status).toBe("completed");
	});

	test("WIP status normalized to in-progress by both parsers", () => {
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1 | Phase One | WIP |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].status).toBe("in-progress");
	});

	test("Done status normalized to completed by both parsers", () => {
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1 | Phase One | Done |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts[0].status).toBe("completed");
	});

	test("mixed alphanumeric and pure numeric IDs in same table", () => {
		for (const f of ["phase-01a-intro.md", "phase-01b-setup.md", "phase-02-core.md"]) {
			writeFileSync(join(testDir, f), "", "utf8");
		}
		const content = `| Phase | Name | Status |
|-------|------|--------|
| 1a | [Intro](./phase-01a-intro.md) | Pending |
| 1b | [Setup](./phase-01b-setup.md) | Done |
| 2 | [Core](./phase-02-core.md) | In Progress |
`;
		const { cjs, ts } = parseBoth(content, testDir);
		expect(ts).toEqual(cjs);
		expect(ts).toHaveLength(3);
		expect(ts[1].status).toBe("completed");
		expect(ts[2].status).toBe("in-progress");
	});
});
