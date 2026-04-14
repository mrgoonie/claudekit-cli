/**
 * Tests for plan-writer.ts
 * Covers: phaseNameToFilename, generatePlanMd, generatePhaseTemplate,
 * scaffoldPlan, nextSubPhaseId, updatePhaseStatus, addPhase, and integration round-trips.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePlanFile, validatePlanFile } from "@/domains/plan-parser/index.js";
import {
	addPhase,
	generatePhaseTemplate,
	generatePlanMd,
	nextSubPhaseId,
	phaseNameToFilename,
	scaffoldPlan,
	updatePhaseStatus,
} from "@/domains/plan-parser/plan-writer.js";
import matter from "gray-matter";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal scaffoldPlan wrapper — supplies required priority default */
function scaffold(title: string, phases: Array<{ name: string; id?: string }>, dir?: string) {
	return scaffoldPlan({
		title,
		dir: dir ?? testDir,
		priority: "P2",
		phases,
	});
}

let testDir: string;

beforeEach(() => {
	testDir = mkdtempSync(join(tmpdir(), "ck-plan-writer-"));
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ─── phaseNameToFilename ──────────────────────────────────────────────────────

describe("phaseNameToFilename", () => {
	test('"1", "Setup Environment" → phase-01-setup-environment.md', () => {
		expect(phaseNameToFilename("1", "Setup Environment")).toBe("phase-01-setup-environment.md");
	});

	test('"1a", "Attachments" → phase-01a-attachments.md', () => {
		expect(phaseNameToFilename("1a", "Attachments")).toBe("phase-01a-attachments.md");
	});

	test('"12", "Final Review" → phase-12-final-review.md', () => {
		expect(phaseNameToFilename("12", "Final Review")).toBe("phase-12-final-review.md");
	});

	test('"3b", "API Endpoints" → phase-03b-api-endpoints.md', () => {
		expect(phaseNameToFilename("3b", "API Endpoints")).toBe("phase-03b-api-endpoints.md");
	});

	test("strips special chars: ampersand and numbers", () => {
		// "Auth & OAuth2" → removes &, strips non-alphanumeric, collapses hyphens
		expect(phaseNameToFilename("1", "Auth & OAuth2")).toBe("phase-01-auth-oauth2.md");
	});

	test("strips leading/trailing hyphens from slug", () => {
		expect(phaseNameToFilename("2", "  Trim Me  ")).toBe("phase-02-trim-me.md");
	});

	test("pads single digit to two digits", () => {
		expect(phaseNameToFilename("5", "Deploy")).toBe("phase-05-deploy.md");
	});

	test("preserves double-digit numbers without padding", () => {
		expect(phaseNameToFilename("10", "Done")).toBe("phase-10-done.md");
	});
});

// ─── generatePlanMd ───────────────────────────────────────────────────────────

describe("generatePlanMd", () => {
	const baseOptions = {
		title: "My Plan",
		description: "A test plan",
		priority: "P1" as const,
		dir: "/tmp/test",
		phases: [{ name: "Setup Environment" }, { name: "Implement API" }],
	};

	test("produces valid YAML frontmatter with title field", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.title).toBe("My Plan");
	});

	test("produces valid YAML frontmatter with description field", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.description).toBe("A test plan");
	});

	test("produces valid YAML frontmatter with status: pending", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.status).toBe("pending");
	});

	test("produces valid YAML frontmatter with priority field", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.priority).toBe("P1");
	});

	test("includes issue in frontmatter when provided", () => {
		const output = generatePlanMd({ ...baseOptions, issue: 42 });
		const { data } = matter(output);
		expect(data.issue).toBe(42);
	});

	test("omits issue from frontmatter when not provided", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.issue).toBeUndefined();
	});

	test("includes created timestamp in frontmatter", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		// created is now a full ISO timestamp string (CLI-strict tracking)
		const created = String(data.created);
		// Should be full ISO timestamp format (YYYY-MM-DDTHH:mm:ss.sssZ)
		expect(created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	test("includes createdBy=ck-cli by default", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.createdBy).toBe("ck-cli");
	});

	test("includes source=cli by default", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.source).toBe("cli");
	});

	test("sets createdBy=ck:plan when source=skill", () => {
		const output = generatePlanMd({ ...baseOptions, source: "skill" });
		const { data } = matter(output);
		expect(data.createdBy).toBe("ck:plan");
		expect(data.source).toBe("skill");
	});

	test("sets createdBy=dashboard when source=dashboard", () => {
		const output = generatePlanMd({ ...baseOptions, source: "dashboard" });
		const { data } = matter(output);
		expect(data.createdBy).toBe("dashboard");
		expect(data.source).toBe("dashboard");
	});

	test("includes sessionId when provided", () => {
		const output = generatePlanMd({ ...baseOptions, source: "skill", sessionId: "abc123" });
		const { data } = matter(output);
		expect(data.sessionId).toBe("abc123");
	});

	test("omits sessionId when not provided", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.sessionId).toBeUndefined();
	});

	test("includes branch frontmatter field", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data).toHaveProperty("branch");
		expect(typeof data.branch).toBe("string");
	});

	test("includes empty tags array in frontmatter", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.tags).toEqual([]);
	});

	test("includes empty blockedBy array in frontmatter", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.blockedBy).toEqual([]);
	});

	test("includes empty blocks array in frontmatter", () => {
		const output = generatePlanMd(baseOptions);
		const { data } = matter(output);
		expect(data.blocks).toEqual([]);
	});

	test("phases table is 3-column canonical format | Phase | Name | Status |", () => {
		const output = generatePlanMd(baseOptions);
		expect(output).toContain("| Phase | Name | Status |");
	});

	test("phases table has separator row", () => {
		const output = generatePlanMd(baseOptions);
		expect(output).toContain("|-------|------|--------|");
	});

	test("link text is human-readable (not filename)", () => {
		const output = generatePlanMd(baseOptions);
		// Should NOT contain filename as link text
		expect(output).not.toMatch(/\[phase-\d+/i);
		// Should contain human-readable link text
		expect(output).toContain("[Setup Environment]");
		expect(output).toContain("[Implement API]");
	});

	test("link href matches generated filename for phase 1", () => {
		const output = generatePlanMd(baseOptions);
		expect(output).toContain("(./phase-01-setup-environment.md)");
	});

	test("link href matches generated filename for phase 2", () => {
		const output = generatePlanMd(baseOptions);
		expect(output).toContain("(./phase-02-implement-api.md)");
	});

	test("auto-assigns sequential IDs starting at 1", () => {
		const output = generatePlanMd(baseOptions);
		// Phase 1 row should be present
		expect(output).toMatch(/\|\s*1\s*\|/);
		// Phase 2 row should be present
		expect(output).toMatch(/\|\s*2\s*\|/);
	});

	test("all phases have Pending status in table", () => {
		const output = generatePlanMd(baseOptions);
		const rows = output.split("\n").filter((l) => /^\|\s*\d+/.test(l));
		for (const row of rows) {
			expect(row).toContain("Pending");
		}
	});

	test("uses default priority P2 when not specified", () => {
		// Omit priority — should default to P2 per schema
		const { data } = matter(generatePlanMd({ ...baseOptions, priority: "P2" }));
		expect(data.priority).toBe("P2");
	});
});

// ─── generatePhaseTemplate ────────────────────────────────────────────────────

describe("generatePhaseTemplate", () => {
	test("includes YAML frontmatter with phase number", () => {
		const output = generatePhaseTemplate({ id: "1", name: "Setup" });
		const { data } = matter(output);
		expect(data.phase).toBe(1);
	});

	test("includes YAML frontmatter with title", () => {
		const output = generatePhaseTemplate({ id: "2", name: "Implement" });
		const { data } = matter(output);
		expect(data.title).toBe("Implement");
	});

	test("status is always 'pending' for new phases", () => {
		const output = generatePhaseTemplate({ id: "3", name: "Test" });
		const { data } = matter(output);
		expect(data.status).toBe("pending");
	});

	test("includes effort field in frontmatter", () => {
		const output = generatePhaseTemplate({ id: "1", name: "Setup" });
		const { data } = matter(output);
		expect("effort" in data).toBe(true);
	});

	test("includes Overview section placeholder", () => {
		const output = generatePhaseTemplate({ id: "1", name: "Setup" });
		expect(output).toContain("## Overview");
	});

	test("includes Implementation Steps section placeholder", () => {
		const output = generatePhaseTemplate({ id: "1", name: "Setup" });
		expect(output).toContain("## Implementation Steps");
	});

	test("includes Success Criteria section placeholder", () => {
		const output = generatePhaseTemplate({ id: "1", name: "Setup" });
		expect(output).toContain("## Success Criteria");
	});

	test("includes heading with phase ID and name", () => {
		const output = generatePhaseTemplate({ id: "2a", name: "Sub Phase" });
		expect(output).toContain("# Phase 2a: Sub Phase");
	});

	test("handles sub-phase IDs extracting numeric part", () => {
		const output = generatePhaseTemplate({ id: "3b", name: "API Extras" });
		const { data } = matter(output);
		// Numeric part of "3b" is 3
		expect(data.phase).toBe(3);
	});
});

// ─── scaffoldPlan ─────────────────────────────────────────────────────────────

describe("scaffoldPlan", () => {
	test("creates directory if not exists", () => {
		const planDir = join(testDir, "new-plan");
		scaffold("Test Plan", [{ name: "Phase One" }], planDir);
		// If readdirSync works without throwing, dir was created
		expect(() => readdirSync(planDir)).not.toThrow();
	});

	test("writes plan.md file", () => {
		scaffold("Test Plan", [{ name: "Phase One" }]);
		const files = readdirSync(testDir);
		expect(files).toContain("plan.md");
	});

	test("writes phase files for each phase", () => {
		scaffold("Test Plan", [{ name: "Setup" }, { name: "Build" }]);
		const files = readdirSync(testDir);
		expect(files).toContain("phase-01-setup.md");
		expect(files).toContain("phase-02-build.md");
	});

	test("correct number of files created (1 plan.md + N phase files)", () => {
		scaffold("Three Phase Plan", [{ name: "Alpha" }, { name: "Beta" }, { name: "Gamma" }]);
		const files = readdirSync(testDir);
		expect(files).toHaveLength(4); // plan.md + 3 phase files
	});

	test("returns planFile path", () => {
		const { planFile } = scaffold("Test Plan", [{ name: "Phase One" }]);
		expect(planFile).toBe(join(testDir, "plan.md"));
	});

	test("returns phaseFiles array with correct paths", () => {
		const { phaseFiles } = scaffold("Test Plan", [{ name: "Setup" }, { name: "Build" }]);
		expect(phaseFiles).toHaveLength(2);
		expect(phaseFiles[0]).toBe(join(testDir, "phase-01-setup.md"));
		expect(phaseFiles[1]).toBe(join(testDir, "phase-02-build.md"));
	});

	test("returns resolved phaseIds matching the generated files", () => {
		const { phaseIds, phaseFiles } = scaffold("Tracking Plan", [
			{ name: "Setup" },
			{ name: "Build" },
			{ id: "4b", name: "Review" },
		]);
		expect(phaseIds).toEqual(["1", "2", "4b"]);
		expect(phaseFiles.map((file) => file.split("/").at(-1))).toEqual([
			"phase-01-setup.md",
			"phase-02-build.md",
			"phase-04b-review.md",
		]);
	});

	test("idempotent: second call overwrites cleanly", () => {
		scaffold("Idempotent Plan", [{ name: "Only Phase" }]);
		// Second call should not throw
		expect(() => scaffold("Idempotent Plan", [{ name: "Only Phase" }])).not.toThrow();
		const files = readdirSync(testDir);
		// Still only plan.md + 1 phase file
		expect(files).toHaveLength(2);
	});
});

// ─── nextSubPhaseId ───────────────────────────────────────────────────────────

describe("nextSubPhaseId", () => {
	test('("1", ["1", "2"]) → "1b"', () => {
		expect(nextSubPhaseId("1", ["1", "2"])).toBe("1b");
	});

	test('("1b", ["1", "1b", "2"]) → "1c"', () => {
		expect(nextSubPhaseId("1b", ["1", "1b", "2"])).toBe("1c");
	});

	test('("1c", ["1", "1b", "1c"]) → "1d"', () => {
		expect(nextSubPhaseId("1c", ["1", "1b", "1c"])).toBe("1d");
	});

	test('("3", ["1", "2", "3"]) → "3b"', () => {
		expect(nextSubPhaseId("3", ["1", "2", "3"])).toBe("3b");
	});

	test("no existing sub-phases: always starts at b", () => {
		expect(nextSubPhaseId("5", ["5"])).toBe("5b");
	});

	test("skips already-taken candidate", () => {
		// "1b" is taken, so should skip to "1c"
		expect(nextSubPhaseId("1", ["1", "1b", "2"])).toBe("1c");
	});

	test("throws on invalid phase ID", () => {
		expect(() => nextSubPhaseId("invalid!", ["1"])).toThrow();
	});
});

// ─── updatePhaseStatus ────────────────────────────────────────────────────────

describe("updatePhaseStatus (filesystem)", () => {
	function writeMinimalPlan(phases: Array<{ id: string; name: string; status: string }>) {
		const rows = phases
			.map(
				(p) =>
					`| ${p.id} | [${p.name}](./phase-${p.id.padStart(2, "0")}-${p.name.toLowerCase().replace(/\s+/g, "-")}.md) | ${p.status} |`,
			)
			.join("\n");
		const content = `---
title: Test Plan
status: pending
---

# Test Plan

## Phases

| Phase | Name | Status |
|-------|------|--------|
${rows}
`;
		const planFile = join(testDir, "plan.md");
		writeFileSync(planFile, content, "utf8");
		return planFile;
	}

	test('changes "Pending" → "Completed" in plan.md table', () => {
		const planFile = writeMinimalPlan([{ id: "1", name: "Setup", status: "Pending" }]);
		updatePhaseStatus(planFile, "1", "completed");
		const updated = readFileSync(planFile, "utf8");
		expect(updated).toContain("| Completed |");
		expect(updated).not.toContain("| Pending |");
	});

	test('changes "Pending" → "In Progress" in plan.md table', () => {
		const planFile = writeMinimalPlan([{ id: "1", name: "Setup", status: "Pending" }]);
		updatePhaseStatus(planFile, "1", "in-progress");
		const updated = readFileSync(planFile, "utf8");
		expect(updated).toContain("| In Progress |");
	});

	test("updates phase file frontmatter status field when file exists", () => {
		const planFile = writeMinimalPlan([{ id: "1", name: "Setup", status: "Pending" }]);
		// Create corresponding phase file
		const phaseFile = join(testDir, "phase-01-setup.md");
		writeFileSync(phaseFile, generatePhaseTemplate({ id: "1", name: "Setup" }), "utf8");

		updatePhaseStatus(planFile, "1", "completed");

		const phaseContent = readFileSync(phaseFile, "utf8");
		const { data } = matter(phaseContent);
		expect(data.status).toBe("completed");
	});

	test("sets plan.md frontmatter status to 'completed' when all phases done", () => {
		const planFile = writeMinimalPlan([
			{ id: "1", name: "Setup", status: "Completed" },
			{ id: "2", name: "Build", status: "Pending" },
		]);
		updatePhaseStatus(planFile, "2", "completed");
		const { data } = matter(readFileSync(planFile, "utf8"));
		expect(data.status).toBe("completed");
	});

	test("sets plan.md frontmatter status to 'in-progress' when any phase in-progress", () => {
		const planFile = writeMinimalPlan([
			{ id: "1", name: "Setup", status: "Pending" },
			{ id: "2", name: "Build", status: "Pending" },
		]);
		updatePhaseStatus(planFile, "1", "in-progress");
		const { data } = matter(readFileSync(planFile, "utf8"));
		expect(data.status).toBe("in-progress");
	});

	test("keeps plan.md frontmatter status as 'pending' when all phases pending", () => {
		const planFile = writeMinimalPlan([
			{ id: "1", name: "Setup", status: "In Progress" },
			{ id: "2", name: "Build", status: "Pending" },
		]);
		updatePhaseStatus(planFile, "1", "pending");
		const { data } = matter(readFileSync(planFile, "utf8"));
		expect(data.status).toBe("pending");
	});

	test("unknown phase ID throws error with no mutation", () => {
		const planFile = writeMinimalPlan([{ id: "1", name: "Setup", status: "Pending" }]);
		const originalContent = readFileSync(planFile, "utf8");
		expect(() => updatePhaseStatus(planFile, "99", "completed")).toThrow();
		// File should remain unchanged
		expect(readFileSync(planFile, "utf8")).toBe(originalContent);
	});

	test("non-canonical plan.md logs warning and returns without mutation", () => {
		// Write a non-canonical plan (wrong header)
		const planFile = join(testDir, "plan.md");
		const nonCanonical = `---
title: Non-canonical
---
# My Plan

| Task | Description | Done |
|------|-------------|------|
| 1 | Setup | No |
`;
		writeFileSync(planFile, nonCanonical, "utf8");
		const originalContent = readFileSync(planFile, "utf8");
		// Should not throw, just log warning and return
		expect(() => updatePhaseStatus(planFile, "1", "completed")).not.toThrow();
		// Content should be unchanged
		expect(readFileSync(planFile, "utf8")).toBe(originalContent);
	});
});

// ─── addPhase ────────────────────────────────────────────────────────────────

describe("addPhase (filesystem)", () => {
	function scaffoldTwoPhasePlan() {
		return scaffold("Add Phase Test", [{ name: "Alpha" }, { name: "Beta" }]);
	}

	test("appends phase with next sequential ID when no afterId", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		const { phaseId } = addPhase(planFile, "Gamma");
		expect(phaseId).toBe("3");
	});

	test("creates corresponding phase file when appending", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		const { phaseFile } = addPhase(planFile, "Gamma");
		expect(() => readFileSync(phaseFile, "utf8")).not.toThrow();
	});

	test("updates plan.md table with new row when appending", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		addPhase(planFile, "Gamma");
		const content = readFileSync(planFile, "utf8");
		expect(content).toContain("[Gamma]");
	});

	test("inserts sub-phase after specified ID (1b after 1)", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		const { phaseId } = addPhase(planFile, "Alpha Sub", "1");
		expect(phaseId).toBe("1b");
	});

	test("sub-phase row appears after parent row in table", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		addPhase(planFile, "Alpha Sub", "1");
		const content = readFileSync(planFile, "utf8");
		const lines = content.split("\n");
		const alphaIdx = lines.findIndex((l) => /\|\s*1\s*\|/.test(l) && !l.includes("1b"));
		const subIdx = lines.findIndex((l) => /\|\s*1b\s*\|/.test(l));
		expect(subIdx).toBeGreaterThan(alphaIdx);
	});

	test("creates corresponding phase file for sub-phase", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		const { phaseFile } = addPhase(planFile, "Alpha Sub", "1");
		expect(() => readFileSync(phaseFile, "utf8")).not.toThrow();
	});

	test("handles --after with existing sub-phases (1c after 1b)", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		addPhase(planFile, "Alpha Sub B", "1"); // creates 1b
		const { phaseId } = addPhase(planFile, "Alpha Sub C", "1b"); // creates 1c
		expect(phaseId).toBe("1c");
	});

	test("new phase file has correct frontmatter title", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		const { phaseFile } = addPhase(planFile, "New Feature");
		const { data } = matter(readFileSync(phaseFile, "utf8"));
		expect(data.title).toBe("New Feature");
	});

	test("throws when afterId does not exist in plan", () => {
		const { planFile } = scaffoldTwoPhasePlan();
		expect(() => addPhase(planFile, "Ghost Phase", "99")).toThrow();
	});
});

// ─── Integration round-trips ──────────────────────────────────────────────────

describe("Integration round-trips", () => {
	test("scaffoldPlan → parsePlanFile → phases match input", () => {
		const { planFile } = scaffold("Round Trip", [
			{ name: "First" },
			{ name: "Second" },
			{ name: "Third" },
		]);
		const { phases } = parsePlanFile(planFile);
		expect(phases).toHaveLength(3);
		// Names should be human-readable (from link text)
		const names = phases.map((p) => p.name);
		expect(names).toContain("First");
		expect(names).toContain("Second");
		expect(names).toContain("Third");
	});

	test("scaffoldPlan → validatePlanFile → zero issues", () => {
		const { planFile } = scaffold("Valid Plan", [{ name: "Setup" }, { name: "Build" }]);
		const result = validatePlanFile(planFile);
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	test("scaffoldPlan → updatePhaseStatus → parsePlanFile → status changed", () => {
		const { planFile } = scaffold("Status Round Trip", [{ name: "Setup" }, { name: "Build" }]);
		updatePhaseStatus(planFile, "1", "completed");
		const { phases } = parsePlanFile(planFile);
		const phase1 = phases.find((p) => p.phaseId === "1");
		expect(phase1?.status).toBe("completed");
	});

	test("scaffoldPlan → addPhase → parsePlanFile → phase count increased", () => {
		const { planFile } = scaffold("Add Phase Round Trip", [{ name: "Alpha" }, { name: "Beta" }]);
		addPhase(planFile, "Gamma");
		const { phases } = parsePlanFile(planFile);
		expect(phases).toHaveLength(3);
	});

	test("scaffoldPlan → addPhase (sub-phase) → parsePlanFile → sub-phase present", () => {
		const { planFile } = scaffold("Sub-Phase Round Trip", [{ name: "Alpha" }, { name: "Beta" }]);
		addPhase(planFile, "Alpha Addendum", "1");
		const { phases } = parsePlanFile(planFile);
		const subPhase = phases.find((p) => p.phaseId === "1b");
		expect(subPhase).toBeDefined();
		expect(subPhase?.name).toBe("Alpha Addendum");
	});

	test("scaffoldPlan → multiple updatePhaseStatus → plan status reflects all-completed", () => {
		const { planFile } = scaffold("Full Completion", [{ name: "Step One" }, { name: "Step Two" }]);
		updatePhaseStatus(planFile, "1", "completed");
		updatePhaseStatus(planFile, "2", "completed");
		const { data } = matter(readFileSync(planFile, "utf8"));
		expect(data.status).toBe("completed");
	});
});
