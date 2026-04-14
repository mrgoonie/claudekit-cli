/**
 * Tests for plan-routes.ts
 * Tests parse, validate, list, and summary API endpoints.
 */
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ClaudeKitData from "@/domains/claudekit-data/index.js";
import { clearActionStore } from "@/domains/plan-actions/action-signal.js";
import {
	clearPlanRouteCaches,
	registerPlanRoutes,
} from "@/domains/web-server/routes/plan-routes.js";
import express, { type Express } from "express";

// ─── Test setup ───────────────────────────────────────────────────────────────

// Use a temp dir inside CWD so isWithinCwd() security check passes.
// System tmpdir() is outside CWD and would be blocked with 403.
const TMP = join(process.cwd(), `.test-tmp-plan-routes-${Date.now()}`);
const EXTERNAL_PROJECT = join(tmpdir(), `.test-plan-routes-project-${Date.now()}`);
const EXTERNAL_PLANS = join(tmpdir(), `.test-plan-routes-plans-${Date.now()}`);
const EXTERNAL_PLAN_DIR = join(EXTERNAL_PLANS, "260413-external");
const EXTERNAL_PLAN_FILE = join(EXTERNAL_PLAN_DIR, "plan.md");
const EXTERNAL_REGISTERED_PROJECT_ID = "project-external";
let baseUrl: string;
let server: ReturnType<Express["listen"]>;
let scanClaudeProjectsSpy: ReturnType<typeof spyOn>;
let getProjectSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
	clearPlanRouteCaches();
	scanClaudeProjectsSpy = spyOn(ClaudeKitData, "scanClaudeProjects").mockReturnValue([
		{ path: EXTERNAL_PROJECT, lastModified: new Date() },
	]);
	getProjectSpy = spyOn(ClaudeKitData.ProjectsRegistryManager, "getProject").mockImplementation(
		async (identifier: string) =>
			identifier === EXTERNAL_REGISTERED_PROJECT_ID
				? {
						id: EXTERNAL_REGISTERED_PROJECT_ID,
						path: EXTERNAL_PROJECT,
						alias: "External",
						addedAt: new Date().toISOString(),
					}
				: null,
	);
	mkdirSync(TMP, { recursive: true });
	mkdirSync(join(EXTERNAL_PROJECT, ".claude"), { recursive: true });
	mkdirSync(EXTERNAL_PLAN_DIR, { recursive: true });

	// Write fixture plan files
	writeFileSync(
		join(TMP, "plan.md"),
		`---
title: Test Plan
status: in-progress
---

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Setup](./phase-01-setup.md) | completed |
| 2 | [Build](./phase-02-build.md) | pending |
`,
		"utf8",
	);
	writeFileSync(
		join(TMP, "phase-01-setup.md"),
		`---
title: Setup
status: completed
effort: 2h
created: 2026-04-01
completed: 2026-04-03
---
## Overview

Setup details
`,
		"utf8",
	);
	writeFileSync(
		join(TMP, "phase-02-build.md"),
		`---
title: Build
status: pending
effort: 4h
created: 2026-04-04
---
## Overview

Build details
`,
		"utf8",
	);

	// Sub-plan directory
	mkdirSync(join(TMP, "sub-plan"), { recursive: true });
	writeFileSync(
		join(TMP, "sub-plan", "plan.md"),
		`---
title: Sub Plan
---

### Phase 1: Alpha
`,
		"utf8",
	);

	writeFileSync(
		join(EXTERNAL_PROJECT, ".claude", ".ck.json"),
		JSON.stringify(
			{
				paths: {
					plans: EXTERNAL_PLANS,
				},
			},
			null,
			2,
		),
		"utf8",
	);
	writeFileSync(
		EXTERNAL_PLAN_FILE,
		`---
title: External Plan
status: in-progress
---

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Ship](./phase-01-ship.md) | pending |
`,
		"utf8",
	);
	writeFileSync(
		join(EXTERNAL_PLAN_DIR, "phase-01-ship.md"),
		`---
title: Ship
status: pending
---
`,
		"utf8",
	);

	// Start express test server
	const app = express();
	app.use(express.json());
	registerPlanRoutes(app);

	server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Failed to start server");
	baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
	scanClaudeProjectsSpy.mockRestore();
	getProjectSpy.mockRestore();
	clearPlanRouteCaches();
	clearActionStore();
	server.close();
	rmSync(TMP, { recursive: true, force: true });
	rmSync(EXTERNAL_PROJECT, { recursive: true, force: true });
	rmSync(EXTERNAL_PLANS, { recursive: true, force: true });
});

// ─── /api/plan/parse ─────────────────────────────────────────────────────────

describe("GET /api/plan/parse", () => {
	test("returns phases for valid plan.md", async () => {
		const planFile = join(TMP, "plan.md");
		const res = await fetch(`${baseUrl}/api/plan/parse?file=${encodeURIComponent(planFile)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { phases: Array<{ status: string }> };
		expect(Array.isArray(body.phases)).toBe(true);
		expect(body.phases.length).toBeGreaterThan(0);
		expect(body.phases[0].status).toBe("completed");
	});

	test("returns 400 when file param is missing", async () => {
		const res = await fetch(`${baseUrl}/api/plan/parse`);
		expect(res.status).toBe(400);
	});

	test("returns 404 for non-existent file within CWD", async () => {
		const nonExistent = join(process.cwd(), "nonexistent-plan-file.md");
		const res = await fetch(`${baseUrl}/api/plan/parse?file=${encodeURIComponent(nonExistent)}`);
		expect(res.status).toBe(404);
	});

	test("returns 403 for file outside CWD", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/parse?file=${encodeURIComponent("/nonexistent/plan.md")}`,
		);
		expect(res.status).toBe(403);
	});
});

// ─── /api/plan/validate ───────────────────────────────────────────────────────

describe("GET /api/plan/validate", () => {
	test("returns validation result for valid plan", async () => {
		const planFile = join(TMP, "plan.md");
		const res = await fetch(`${baseUrl}/api/plan/validate?file=${encodeURIComponent(planFile)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { valid: boolean; issues: unknown[] };
		expect(typeof body.valid).toBe("boolean");
		expect(Array.isArray(body.issues)).toBe(true);
	});

	test("accepts strict=true parameter", async () => {
		const planFile = join(TMP, "plan.md");
		const res = await fetch(
			`${baseUrl}/api/plan/validate?file=${encodeURIComponent(planFile)}&strict=true`,
		);
		expect(res.status).toBe(200);
	});

	test("returns 400 when file param is missing", async () => {
		const res = await fetch(`${baseUrl}/api/plan/validate`);
		expect(res.status).toBe(400);
	});

	test("returns 404 for non-existent file within CWD", async () => {
		const nonExistent = join(process.cwd(), "nonexistent-plan-file.md");
		const res = await fetch(`${baseUrl}/api/plan/validate?file=${encodeURIComponent(nonExistent)}`);
		expect(res.status).toBe(404);
	});

	test("returns 403 for file outside CWD", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/validate?file=${encodeURIComponent("/nonexistent/plan.md")}`,
		);
		expect(res.status).toBe(403);
	});
});

// ─── /api/plan/list ───────────────────────────────────────────────────────────

describe("GET /api/plan/list", () => {
	test("lists plan.md files in subdirectories", async () => {
		const res = await fetch(`${baseUrl}/api/plan/list?dir=${encodeURIComponent(TMP)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			plans: Array<{ file: string; name: string; summary: { progressPct: number } }>;
		};
		expect(Array.isArray(body.plans)).toBe(true);
		expect(body.plans.length).toBeGreaterThanOrEqual(1);
		const names = body.plans.map((p) => p.name);
		expect(names).toContain("sub-plan");
		expect(body.plans[0]?.summary.progressPct).toBeDefined();
	});

	test("returns 400 when dir param is missing", async () => {
		const res = await fetch(`${baseUrl}/api/plan/list`);
		expect(res.status).toBe(400);
	});

	test("returns 404 for non-existent directory within CWD", async () => {
		const nonExistent = join(process.cwd(), "nonexistent-plans-dir");
		const res = await fetch(`${baseUrl}/api/plan/list?dir=${encodeURIComponent(nonExistent)}`);
		expect(res.status).toBe(404);
	});

	test("returns 403 for directory outside CWD", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/list?dir=${encodeURIComponent("/nonexistent/dir")}`,
		);
		expect(res.status).toBe(403);
	});

	test("allows project-specific plan roots when projectId is supplied", async () => {
		const withoutProject = await fetch(
			`${baseUrl}/api/plan/list?dir=${encodeURIComponent(EXTERNAL_PLANS)}`,
		);
		expect(withoutProject.status).toBe(403);

		const withProject = await fetch(
			`${baseUrl}/api/plan/list?dir=${encodeURIComponent(EXTERNAL_PLANS)}&projectId=${encodeURIComponent(EXTERNAL_REGISTERED_PROJECT_ID)}`,
		);
		expect(withProject.status).toBe(200);
		const body = (await withProject.json()) as { plans: Array<{ name: string }> };
		expect(body.plans.map((plan) => plan.name)).toContain("260413-external");
	});

	test("rejects forged discovered project ids", async () => {
		const forgedProjectId = `discovered-${Buffer.from(join(tmpdir(), "forged-project")).toString("base64url")}`;
		const res = await fetch(
			`${baseUrl}/api/plan/list?dir=${encodeURIComponent(EXTERNAL_PLANS)}&projectId=${encodeURIComponent(forgedProjectId)}`,
		);
		expect(res.status).toBe(403);
	});
});

// ─── /api/plan/summary ───────────────────────────────────────────────────────

describe("GET /api/plan/summary", () => {
	test("returns summary with progress stats", async () => {
		const planFile = join(TMP, "plan.md");
		const res = await fetch(`${baseUrl}/api/plan/summary?file=${encodeURIComponent(planFile)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			totalPhases: number;
			completed: number;
			inProgress: number;
			pending: number;
			title: string;
		};
		expect(body.totalPhases).toBeGreaterThan(0);
		expect(typeof body.completed).toBe("number");
		expect(typeof body.inProgress).toBe("number");
		expect(typeof body.pending).toBe("number");
		expect(body.title).toBe("Test Plan");
	});

	test("returns 400 when file param is missing", async () => {
		const res = await fetch(`${baseUrl}/api/plan/summary`);
		expect(res.status).toBe(400);
	});
});

describe("GET /api/plan/timeline", () => {
	test("returns plan summary and timeline data for a plan directory", async () => {
		const res = await fetch(`${baseUrl}/api/plan/timeline?dir=${encodeURIComponent(TMP)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			plan: { title?: string };
			timeline: {
				phases: Array<{ phaseId: string; startDate: string | null; endDate: string | null }>;
				todayPct: number;
			};
		};
		expect(body.plan.title).toBe("Test Plan");
		expect(body.timeline.phases.length).toBeGreaterThan(0);
		expect(body.timeline.todayPct).toBeGreaterThanOrEqual(0);
		const setup = body.timeline.phases.find((phase) => phase.phaseId === "1");
		expect(setup?.startDate?.startsWith("2026-04-01")).toBe(true);
		expect(setup?.endDate?.startsWith("2026-04-03")).toBe(true);
	});
});

describe("GET /api/plan/file", () => {
	test("returns raw markdown content for a plan file", async () => {
		const planFile = join(TMP, "phase-01-setup.md");
		const res = await fetch(`${baseUrl}/api/plan/file?file=${encodeURIComponent(planFile)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { raw: string; content: string };
		expect(body.raw).toContain("title: Setup");
		expect(body.content).toContain("Setup");
	});

	test("rejects files outside the selected plan directory", async () => {
		const outsideFile = join(process.cwd(), "package.json");
		const res = await fetch(
			`${baseUrl}/api/plan/file?file=${encodeURIComponent(outsideFile)}&dir=${encodeURIComponent(TMP)}`,
		);
		expect(res.status).toBe(403);
	});

	test("allows project-specific files when projectId is supplied", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/file?file=${encodeURIComponent(EXTERNAL_PLAN_FILE)}&dir=${encodeURIComponent(EXTERNAL_PLAN_DIR)}&projectId=${encodeURIComponent(EXTERNAL_REGISTERED_PROJECT_ID)}`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { raw: string };
		expect(body.raw).toContain("title: External Plan");
	});
});

describe("POST /api/plan/action", () => {
	test("updates phase status and exposes status polling", async () => {
		const firstRes = await fetch(`${baseUrl}/api/plan/action`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "complete", planDir: TMP, phaseId: "2" }),
		});
		expect(firstRes.status).toBe(200);
		const firstAction = (await firstRes.json()) as { id: string; status: string };
		expect(firstAction.status).toBe("completed");

		const statusRes = await fetch(
			`${baseUrl}/api/plan/action/status?id=${encodeURIComponent(firstAction.id)}`,
		);
		expect(statusRes.status).toBe(200);
		const status = (await statusRes.json()) as { status: string };
		expect(status.status).toBe("completed");

		const secondRes = await fetch(`${baseUrl}/api/plan/action`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "validate", planDir: TMP }),
		});
		expect(secondRes.status).toBe(200);
		const secondAction = (await secondRes.json()) as { id: string; status: string };
		expect(secondAction.status).toBe("completed");

		const firstStatusRes = await fetch(
			`${baseUrl}/api/plan/action/status?id=${encodeURIComponent(firstAction.id)}`,
		);
		expect(firstStatusRes.status).toBe(200);

		const summaryRes = await fetch(
			`${baseUrl}/api/plan/summary?file=${encodeURIComponent(join(TMP, "plan.md"))}`,
		);
		const summary = (await summaryRes.json()) as { completed: number };
		expect(summary.completed).toBe(2);
	});

	test("allows actions against project-specific plan roots when projectId is supplied", async () => {
		const res = await fetch(`${baseUrl}/api/plan/action`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "complete",
				planDir: EXTERNAL_PLAN_DIR,
				phaseId: "1",
				projectId: EXTERNAL_REGISTERED_PROJECT_ID,
			}),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("completed");
	});
});

// ─── Path traversal security edge cases ───────────────────────────────────────

describe("Path traversal security", () => {
	// /api/plan/parse traversal
	test("parse: ?file=../../../etc/passwd → 403", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/parse?file=${encodeURIComponent("../../../etc/passwd")}`,
		);
		expect(res.status).toBe(403);
	});

	test("parse: ?file=/etc/passwd (absolute outside CWD) → 403", async () => {
		const res = await fetch(`${baseUrl}/api/plan/parse?file=${encodeURIComponent("/etc/passwd")}`);
		expect(res.status).toBe(403);
	});

	test("parse: ?file= (empty string) → 400", async () => {
		const res = await fetch(`${baseUrl}/api/plan/parse?file=`);
		expect(res.status).toBe(400);
	});

	test("parse: ?file=nonexistent.md (within CWD, missing) → 404", async () => {
		const nonExistent = join(process.cwd(), "definitely-nonexistent-plan-file.md");
		const res = await fetch(`${baseUrl}/api/plan/parse?file=${encodeURIComponent(nonExistent)}`);
		expect(res.status).toBe(404);
	});

	// /api/plan/list traversal
	test("list: ?dir=../../../ → 403", async () => {
		const res = await fetch(`${baseUrl}/api/plan/list?dir=${encodeURIComponent("../../../")}`);
		expect(res.status).toBe(403);
	});

	test("list: ?dir=/tmp → 403", async () => {
		const res = await fetch(`${baseUrl}/api/plan/list?dir=${encodeURIComponent("/tmp")}`);
		expect(res.status).toBe(403);
	});

	// /api/plan/validate traversal
	test("validate: ?file=../../../etc/passwd → 403", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/validate?file=${encodeURIComponent("../../../etc/passwd")}`,
		);
		expect(res.status).toBe(403);
	});

	test("validate: ?file=/etc/passwd (absolute outside CWD) → 403", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/validate?file=${encodeURIComponent("/etc/passwd")}`,
		);
		expect(res.status).toBe(403);
	});

	test("validate: ?file= (empty string) → 400", async () => {
		const res = await fetch(`${baseUrl}/api/plan/validate?file=`);
		expect(res.status).toBe(400);
	});

	// /api/plan/summary traversal
	test("summary: ?file=../../../etc/passwd → 403", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/summary?file=${encodeURIComponent("../../../etc/passwd")}`,
		);
		expect(res.status).toBe(403);
	});

	test("summary: ?file=/etc/passwd (absolute outside CWD) → 403", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/summary?file=${encodeURIComponent("/etc/passwd")}`,
		);
		expect(res.status).toBe(403);
	});
});
