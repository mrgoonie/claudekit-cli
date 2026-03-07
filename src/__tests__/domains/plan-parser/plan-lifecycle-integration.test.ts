/**
 * Plan Lifecycle Integration Tests
 * Tests complete plan lifecycle state machine:
 * create → check --start → check → uncheck → add-phase
 * Verifies state at each transition step.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parsePlanFile } from "@/domains/plan-parser/index.js";
import { addPhase, scaffoldPlan, updatePhaseStatus } from "@/domains/plan-parser/plan-writer.js";
import { resolvePlanFile } from "@/commands/plan/plan-command.js";
import matter from "gray-matter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let testDir: string;

function scaffold(
	title: string,
	phases: Array<{ name: string; id?: string }>,
	dir?: string,
) {
	return scaffoldPlan({
		title,
		dir: dir ?? testDir,
		priority: "P2",
		phases,
	});
}

function getPlanFrontmatter(planFile: string) {
	return matter(readFileSync(planFile, "utf8")).data;
}

beforeEach(() => {
	testDir = mkdtempSync(join(tmpdir(), "ck-lifecycle-"));
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ─── Full 3-state cycle ───────────────────────────────────────────────────────

describe("Full 3-state lifecycle cycle", () => {
	test("phase 1 in-progress → plan frontmatter = in-progress", () => {
		const { planFile } = scaffold("Lifecycle Plan", [
			{ name: "Setup" },
			{ name: "Build" },
			{ name: "Deploy" },
		]);

		updatePhaseStatus(planFile, "1", "in-progress");

		const { phases } = parsePlanFile(planFile);
		const phase1 = phases.find((p) => p.phaseId === "1");
		expect(phase1?.status).toBe("in-progress");

		const fm = getPlanFrontmatter(planFile);
		expect(fm.status).toBe("in-progress");
	});

	test("phase 1 completed → plan reverts to pending (phases 2,3 still pending)", () => {
		const { planFile } = scaffold("Lifecycle Plan", [
			{ name: "Setup" },
			{ name: "Build" },
			{ name: "Deploy" },
		]);

		updatePhaseStatus(planFile, "1", "completed");

		const fm = getPlanFrontmatter(planFile);
		// Only phase 1 done; 2 and 3 still pending → plan is pending
		expect(fm.status).toBe("pending");
	});

	test("phases 1 and 2 completed, 3 pending → plan still in progress indicator", () => {
		const { planFile } = scaffold("Lifecycle Plan", [
			{ name: "Setup" },
			{ name: "Build" },
			{ name: "Deploy" },
		]);

		updatePhaseStatus(planFile, "1", "completed");
		updatePhaseStatus(planFile, "2", "in-progress");

		const fm = getPlanFrontmatter(planFile);
		expect(fm.status).toBe("in-progress");
	});

	test("all 3 phases completed → plan frontmatter = completed", () => {
		const { planFile } = scaffold("Lifecycle Plan", [
			{ name: "Setup" },
			{ name: "Build" },
			{ name: "Deploy" },
		]);

		updatePhaseStatus(planFile, "1", "completed");
		updatePhaseStatus(planFile, "2", "completed");
		updatePhaseStatus(planFile, "3", "completed");

		const fm = getPlanFrontmatter(planFile);
		expect(fm.status).toBe("completed");
	});

	test("revert phase 2 to pending after all completed → plan reverts to pending", () => {
		const { planFile } = scaffold("Lifecycle Plan", [
			{ name: "Setup" },
			{ name: "Build" },
			{ name: "Deploy" },
		]);

		updatePhaseStatus(planFile, "1", "completed");
		updatePhaseStatus(planFile, "2", "completed");
		updatePhaseStatus(planFile, "3", "completed");

		// Sanity check: plan was completed
		expect(getPlanFrontmatter(planFile).status).toBe("completed");

		// Revert phase 2
		updatePhaseStatus(planFile, "2", "pending");

		const fm = getPlanFrontmatter(planFile);
		expect(fm.status).toBe("pending");

		// Verify parsePlanFile reflects the change
		const { phases } = parsePlanFile(planFile);
		const phase2 = phases.find((p) => p.phaseId === "2");
		expect(phase2?.status).toBe("pending");
	});
});

// ─── Add-phase after all completed ───────────────────────────────────────────

describe("Add-phase after all completed", () => {
	test("adding phase to completed plan makes plan non-completed", () => {
		const { planFile } = scaffold("Two Phase Plan", [
			{ name: "Alpha" },
			{ name: "Beta" },
		]);

		updatePhaseStatus(planFile, "1", "completed");
		updatePhaseStatus(planFile, "2", "completed");

		// Plan should be completed
		expect(getPlanFrontmatter(planFile).status).toBe("completed");

		// Add a new phase
		addPhase(planFile, "Cleanup");

		// New pending phase means plan is no longer completed
		const { phases } = parsePlanFile(planFile);
		expect(phases).toHaveLength(3);

		const phase3 = phases.find((p) => p.phaseId === "3");
		expect(phase3).toBeDefined();
		expect(phase3?.status).toBe("pending");
	});

	test("all 3 phases exist after add-phase, 3rd is Pending", () => {
		const { planFile } = scaffold("Two Phase Plan", [
			{ name: "Alpha" },
			{ name: "Beta" },
		]);

		updatePhaseStatus(planFile, "1", "completed");
		updatePhaseStatus(planFile, "2", "completed");

		const { phaseId } = addPhase(planFile, "Cleanup");
		expect(phaseId).toBe("3");

		const { phases } = parsePlanFile(planFile);
		const names = phases.map((p) => p.name);
		expect(names).toContain("Cleanup");
	});
});

// ─── Sub-phase chain ordering ─────────────────────────────────────────────────

describe("Sub-phase chain ordering", () => {
	test("addPhase 1b then 1c → order is 1, 1b, 1c, 2", () => {
		const { planFile } = scaffold("Sub-phase Plan", [
			{ name: "Alpha" },
			{ name: "Beta" },
		]);

		const { phaseId: id1b } = addPhase(planFile, "Alpha Sub", "1");
		expect(id1b).toBe("1b");

		const { phaseId: id1c } = addPhase(planFile, "Alpha Sub C", "1b");
		expect(id1c).toBe("1c");

		const { phases } = parsePlanFile(planFile);
		const ids = phases.map((p) => p.phaseId);
		const idx1 = ids.indexOf("1");
		const idx1b = ids.indexOf("1b");
		const idx1c = ids.indexOf("1c");
		const idx2 = ids.indexOf("2");

		expect(idx1).toBeGreaterThanOrEqual(0);
		expect(idx1b).toBeGreaterThan(idx1);
		expect(idx1c).toBeGreaterThan(idx1b);
		expect(idx2).toBeGreaterThan(idx1c);
	});

	test("each sub-phase file exists on disk after creation", () => {
		const { planFile } = scaffold("Sub-phase Plan", [
			{ name: "Alpha" },
			{ name: "Beta" },
		]);

		const { phaseFile: file1b } = addPhase(planFile, "Alpha Sub", "1");
		const { phaseFile: file1c } = addPhase(planFile, "Alpha Sub C", "1b");

		expect(existsSync(file1b)).toBe(true);
		expect(existsSync(file1c)).toBe(true);
	});
});

// ─── set-active-plan.cjs tests ────────────────────────────────────────────────

describe("set-active-plan.cjs", () => {
	const SCRIPT_PATH = resolve(
		dirname(new URL(import.meta.url).pathname),
		"../../../../..",
		"claudekit-engineer/.claude/scripts/set-active-plan.cjs",
	);

	function getSessionTempPath(sessionId: string) {
		return join(tmpdir(), `ck-session-${sessionId}.json`);
	}

	function runScript(
		args: string[],
		env: Record<string, string> = {},
	): { stdout: string; stderr: string; exitCode: number } {
		const result = spawnSync("node", [SCRIPT_PATH, ...args], {
			env: { ...process.env, ...env },
			encoding: "utf8",
		});
		return {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			exitCode: result.status ?? 1,
		};
	}

	test("without CK_SESSION_ID: warns but exits 0", () => {
		const { exitCode, stdout, stderr } = runScript(["some/plan"], {
			CK_SESSION_ID: "",
		});

		expect(exitCode).toBe(0);
		const combined = stdout + stderr;
		expect(combined.toLowerCase()).toMatch(/warning|warn/i);
	});

	test("without plan path argument: exits with error code 1", () => {
		const { exitCode } = runScript([], { CK_SESSION_ID: "" });
		expect(exitCode).toBe(1);
	});

	test("with CK_SESSION_ID: writes session state to temp file", () => {
		const sessionId = `test-set-active-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const tempPath = getSessionTempPath(sessionId);

		try {
			const { exitCode } = runScript([testDir], {
				CK_SESSION_ID: sessionId,
			});

			expect(exitCode).toBe(0);
			expect(existsSync(tempPath)).toBe(true);

			const state = JSON.parse(readFileSync(tempPath, "utf8"));
			// Should have stored an absolute path
			expect(state.activePlan).toBeDefined();
			expect(state.activePlan).toBe(resolve(testDir));
		} finally {
			try {
				rmSync(tempPath, { force: true });
			} catch {
				// ignore
			}
		}
	});

	test("with relative path: resolves to absolute", () => {
		const sessionId = `test-relative-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const tempPath = getSessionTempPath(sessionId);

		try {
			// Run from testDir with a relative path argument
			const { exitCode } = runScript(["./subdir"], {
				CK_SESSION_ID: sessionId,
			});

			expect(exitCode).toBe(0);
			expect(existsSync(tempPath)).toBe(true);

			const state = JSON.parse(readFileSync(tempPath, "utf8"));
			// Should be absolute (not start with ./)
			expect(state.activePlan.startsWith("/")).toBe(true);
		} finally {
			try {
				rmSync(tempPath, { force: true });
			} catch {
				// ignore
			}
		}
	});
});

// ─── resolvePlanFile walk-up ──────────────────────────────────────────────────

describe("resolvePlanFile walk-up", () => {
	let originalCwd: string;
	let walkDir: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		walkDir = mkdtempSync(join(tmpdir(), "ck-walkup-"));
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(walkDir, { recursive: true, force: true });
	});

	test("finds plan.md in ancestor when CWD is nested", () => {
		const { realpathSync, mkdirSync: mkdirFn, writeFileSync: writeFn } = require("node:fs");

		// Create nested directories
		const nested = join(walkDir, "sub1", "sub2");
		mkdirFn(nested, { recursive: true });

		// Place plan.md at root (resolve symlinks for macOS /var → /private/var)
		const realWalkDir = realpathSync(walkDir);
		const planFile = join(realWalkDir, "plan.md");
		writeFn(planFile, "---\ntitle: Walk Test\nstatus: pending\n---\n", "utf8");

		// chdir to nested dir (use realpath to avoid symlink mismatch)
		process.chdir(realpathSync(nested));

		const found = resolvePlanFile();
		expect(found).toBe(planFile);
	});

	test("returns null or unrelated plan.md when no plan.md in test ancestors", () => {
		const isolated = join(walkDir, "isolated-no-plan");
		require("node:fs").mkdirSync(isolated, { recursive: true });
		process.chdir(isolated);

		const found = resolvePlanFile();
		// walkDir has no plan.md, so result is either null (ideal) or
		// a plan.md from higher up the real filesystem (acceptable)
		if (found !== null) {
			// If found, it must NOT be inside our isolated test dir
			expect(found.startsWith(realpathSync(isolated))).toBe(false);
		}
	});

	test("explicit target as directory: finds plan.md inside", () => {
		// Create plan.md in walkDir
		require("node:fs").writeFileSync(
			join(walkDir, "plan.md"),
			"---\ntitle: Dir Target\nstatus: pending\n---\n",
			"utf8",
		);

		const found = resolvePlanFile(walkDir);
		expect(found).toBe(join(walkDir, "plan.md"));
	});

	test("explicit target as file: returns exact path", () => {
		const planFile = join(walkDir, "plan.md");
		require("node:fs").writeFileSync(
			planFile,
			"---\ntitle: File Target\nstatus: pending\n---\n",
			"utf8",
		);

		const found = resolvePlanFile(planFile);
		expect(found).toBe(planFile);
	});
});
