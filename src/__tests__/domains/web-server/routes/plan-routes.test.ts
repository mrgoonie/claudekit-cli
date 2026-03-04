/**
 * Tests for plan-routes.ts
 * Tests parse, validate, list, and summary API endpoints.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerPlanRoutes } from "@/domains/web-server/routes/plan-routes.js";
import express, { type Express } from "express";

// ─── Test setup ───────────────────────────────────────────────────────────────

const TMP = join(tmpdir(), `ck-plan-routes-${Date.now()}`);
let baseUrl: string;
let server: ReturnType<Express["listen"]>;

beforeAll(() => {
	mkdirSync(TMP, { recursive: true });

	// Write fixture plan files
	writeFileSync(
		join(TMP, "plan.md"),
		`---
title: Test Plan
status: in-progress
---

| # | Name | Status |
|---|------|--------|
| 1 | [Setup](./phase-01-setup.md) | completed |
| 2 | [Build](./phase-02-build.md) | pending |
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
	server.close();
	rmSync(TMP, { recursive: true, force: true });
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

	test("returns 404 for non-existent file", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/parse?file=${encodeURIComponent("/nonexistent/plan.md")}`,
		);
		expect(res.status).toBe(404);
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

	test("returns 404 for non-existent file", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/validate?file=${encodeURIComponent("/nonexistent/plan.md")}`,
		);
		expect(res.status).toBe(404);
	});
});

// ─── /api/plan/list ───────────────────────────────────────────────────────────

describe("GET /api/plan/list", () => {
	test("lists plan.md files in subdirectories", async () => {
		const res = await fetch(`${baseUrl}/api/plan/list?dir=${encodeURIComponent(TMP)}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { plans: Array<{ file: string; name: string }> };
		expect(Array.isArray(body.plans)).toBe(true);
		expect(body.plans.length).toBeGreaterThanOrEqual(1);
		const names = body.plans.map((p) => p.name);
		expect(names).toContain("sub-plan");
	});

	test("returns 400 when dir param is missing", async () => {
		const res = await fetch(`${baseUrl}/api/plan/list`);
		expect(res.status).toBe(400);
	});

	test("returns 404 for non-existent directory", async () => {
		const res = await fetch(
			`${baseUrl}/api/plan/list?dir=${encodeURIComponent("/nonexistent/dir")}`,
		);
		expect(res.status).toBe(404);
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
