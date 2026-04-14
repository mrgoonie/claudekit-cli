import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ClaudeKitData from "@/domains/claudekit-data/index.js";
import {
	clearPlanRouteCaches,
	registerPlanRoutes,
} from "@/domains/web-server/routes/plan-routes.js";
import type { RegisteredProject } from "@/types";
import express, { type Express } from "express";

const TMP = join(tmpdir(), `.test-plan-list-all-${Date.now()}`);

function writePlanInRoot(plansRoot: string, slug: string, status: string): void {
	const planDir = join(plansRoot, slug);
	mkdirSync(planDir, { recursive: true });
	writeFileSync(
		join(planDir, "plan.md"),
		`---
title: ${slug}
status: ${status}
---

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Ship](./phase-01-ship.md) | pending |
`,
		"utf8",
	);
	writeFileSync(
		join(planDir, "phase-01-ship.md"),
		`---
title: Ship
status: pending
---
`,
		"utf8",
	);
}

function writePlan(projectDir: string, slug: string, status: string): void {
	writePlanInRoot(join(projectDir, "plans"), slug, status);
}

describe("GET /api/plan/list-all", () => {
	let baseUrl = "";
	let server: ReturnType<Express["listen"]>;
	let listProjectsSpy: ReturnType<typeof spyOn>;
	let scanClaudeProjectsSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		clearPlanRouteCaches();
		rmSync(TMP, { recursive: true, force: true });
		mkdirSync(TMP, { recursive: true });
		listProjectsSpy = spyOn(
			ClaudeKitData.ProjectsRegistryManager,
			"listProjects",
		).mockResolvedValue([] as RegisteredProject[]);
		scanClaudeProjectsSpy = spyOn(ClaudeKitData, "scanClaudeProjects").mockReturnValue([]);

		const app = express();
		app.use(express.json());
		registerPlanRoutes(app);

		server = app.listen(0);
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("Failed to start server");
		baseUrl = `http://127.0.0.1:${address.port}`;
	});

	afterEach(() => {
		server.close();
		listProjectsSpy.mockRestore();
		scanClaudeProjectsSpy.mockRestore();
		clearPlanRouteCaches();
		rmSync(TMP, { recursive: true, force: true });
	});

	test("returns plans grouped by registered and discovered projects", async () => {
		const originalCwd = process.cwd();
		const alpha = join(TMP, "alpha");
		const beta = join(TMP, "beta");
		const gamma = join(TMP, "gamma");
		const empty = join(TMP, "empty");

		[alpha, beta, gamma, empty].forEach((dir) =>
			mkdirSync(join(dir, ".claude"), { recursive: true }),
		);
		writePlan(alpha, "260414-alpha-active", "in-progress");
		writePlan(alpha, "260414-alpha-done", "done");
		writePlan(beta, "260414-beta-pending", "pending");
		writePlan(gamma, "260414-gamma-review", "in-review");

		listProjectsSpy.mockResolvedValue([
			{ id: "project-alpha", path: alpha, alias: "Alpha", addedAt: new Date().toISOString() },
			{ id: "project-beta", path: beta, alias: "Beta", addedAt: new Date().toISOString() },
			{ id: "project-empty", path: empty, alias: "Empty", addedAt: new Date().toISOString() },
		] satisfies RegisteredProject[]);
		scanClaudeProjectsSpy.mockReturnValue([
			{ path: alpha, lastModified: new Date() },
			{ path: gamma, lastModified: new Date() },
		]);

		process.chdir(TMP);
		try {
			const res = await fetch(`${baseUrl}/api/plan/list-all`);
			expect(res.status).toBe(200);

			const body = (await res.json()) as {
				totalPlans: number;
				projects: Array<{
					id: string;
					name: string;
					plansDir: string;
					plans: Array<{ slug: string; summary: { status?: string; progressPct: number } }>;
				}>;
			};

			expect(body.totalPlans).toBe(4);
			expect(body.projects).toHaveLength(4);

			const alphaEntry = body.projects.find((project) => project.id === "project-alpha");
			expect(alphaEntry?.name).toBe("Alpha");
			expect(alphaEntry?.plansDir).toBe(join(realpathSync(alpha), "plans"));
			expect(alphaEntry?.plans.map((plan) => plan.slug).sort()).toEqual([
				"260414-alpha-active",
				"260414-alpha-done",
			]);
			expect(
				alphaEntry?.plans.find((plan) => plan.slug === "260414-alpha-active")?.summary.status,
			).toBe("in-progress");

			const gammaEntry = body.projects.find((project) => project.id.startsWith("discovered-"));
			expect(gammaEntry?.name).toBe("gamma");
			expect(gammaEntry?.plans.map((plan) => plan.slug)).toEqual(["260414-gamma-review"]);

			const emptyEntry = body.projects.find((project) => project.id === "project-empty");
			expect(emptyEntry?.plans).toEqual([]);
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("returns an empty response when no projects are available", async () => {
		const originalCwd = process.cwd();
		listProjectsSpy.mockResolvedValue([]);
		scanClaudeProjectsSpy.mockReturnValue([]);

		process.chdir(TMP);
		try {
			const res = await fetch(`${baseUrl}/api/plan/list-all`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ projects: [], totalPlans: 0 });
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("uses the configured plans directory for registered projects", async () => {
		const projectDir = join(TMP, "configured-project");
		const externalPlansDir = join(TMP, "configured-plans");

		mkdirSync(join(projectDir, ".claude"), { recursive: true });
		mkdirSync(externalPlansDir, { recursive: true });
		writeFileSync(
			join(projectDir, ".claude", ".ck.json"),
			JSON.stringify({ paths: { plans: externalPlansDir } }, null, 2),
			"utf8",
		);
		writePlanInRoot(externalPlansDir, "configured-plan", "pending");

		listProjectsSpy.mockResolvedValue([
			{
				id: "project-configured",
				path: projectDir,
				alias: "Configured",
				addedAt: new Date().toISOString(),
			},
		] satisfies RegisteredProject[]);
		scanClaudeProjectsSpy.mockReturnValue([]);

		const res = await fetch(`${baseUrl}/api/plan/list-all`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			projects: Array<{ id: string; plansDir: string; plans: Array<{ slug: string }> }>;
		};
		expect(body.projects[0]?.id).toBe("project-configured");
		expect(body.projects[0]?.plansDir).toBe(externalPlansDir);
		expect(body.projects[0]?.plans.map((plan) => plan.slug)).toEqual(["configured-plan"]);
	});

	test("skips stale registered projects that no longer exist on disk", async () => {
		const originalCwd = process.cwd();
		const activeProject = join(TMP, "active");
		const missingProject = join(TMP, "missing");

		mkdirSync(join(activeProject, ".claude"), { recursive: true });
		writePlan(activeProject, "260414-active", "pending");

		listProjectsSpy.mockResolvedValue([
			{
				id: "project-active",
				path: activeProject,
				alias: "Active",
				addedAt: new Date().toISOString(),
			},
			{
				id: "project-missing",
				path: missingProject,
				alias: "Missing",
				addedAt: new Date().toISOString(),
			},
		] satisfies RegisteredProject[]);
		scanClaudeProjectsSpy.mockReturnValue([]);

		process.chdir(TMP);
		try {
			const res = await fetch(`${baseUrl}/api/plan/list-all`);
			expect(res.status).toBe(200);

			const body = (await res.json()) as {
				totalPlans: number;
				projects: Array<{ id: string }>;
			};
			expect(body.totalPlans).toBe(1);
			expect(body.projects.map((project) => project.id)).toEqual(["project-active"]);
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("falls back to the current repo when no projects are registered or discovered", async () => {
		const originalCwd = process.cwd();
		const currentProject = join(TMP, "current-project");

		mkdirSync(currentProject, { recursive: true });
		writeFileSync(join(currentProject, ".git"), "gitdir: .git/worktrees/current\n", "utf8");
		writePlan(currentProject, "260414-current", "pending");
		listProjectsSpy.mockResolvedValue([]);
		scanClaudeProjectsSpy.mockReturnValue([]);

		process.chdir(currentProject);
		try {
			const res = await fetch(`${baseUrl}/api/plan/list-all`);
			expect(res.status).toBe(200);

			const body = (await res.json()) as {
				totalPlans: number;
				projects: Array<{ id: string; name: string; plans: Array<{ slug: string }> }>;
			};
			expect(body.totalPlans).toBe(1);
			expect(body.projects[0]?.id).toBe("current");
			expect(body.projects[0]?.name).toBe("current-project");
			expect(body.projects[0]?.plans.map((plan) => plan.slug)).toEqual(["260414-current"]);
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("falls back to a plain local plans directory outside the home directory", async () => {
		const originalCwd = process.cwd();
		const currentProject = join(TMP, "plain-plans-project");

		mkdirSync(currentProject, { recursive: true });
		writePlan(currentProject, "260414-plain", "pending");
		listProjectsSpy.mockResolvedValue([]);
		scanClaudeProjectsSpy.mockReturnValue([]);

		process.chdir(currentProject);
		try {
			const res = await fetch(`${baseUrl}/api/plan/list-all`);
			expect(res.status).toBe(200);

			const body = (await res.json()) as {
				totalPlans: number;
				projects: Array<{ id: string; plans: Array<{ slug: string }> }>;
			};
			expect(body.totalPlans).toBe(1);
			expect(body.projects[0]?.id).toBe("current");
			expect(body.projects[0]?.plans.map((plan) => plan.slug)).toEqual(["260414-plain"]);
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("includes the current repo alongside other discovered or registered projects", async () => {
		const originalCwd = process.cwd();
		const currentProject = join(TMP, "current-project");
		const discoveredProject = join(TMP, "discovered-project");

		mkdirSync(currentProject, { recursive: true });
		mkdirSync(join(discoveredProject, ".claude"), { recursive: true });
		writePlan(currentProject, "260414-current", "pending");
		writePlan(discoveredProject, "260414-discovered", "pending");
		listProjectsSpy.mockResolvedValue([]);
		scanClaudeProjectsSpy.mockReturnValue([{ path: discoveredProject, lastModified: new Date() }]);

		process.chdir(currentProject);
		try {
			const res = await fetch(`${baseUrl}/api/plan/list-all`);
			expect(res.status).toBe(200);

			const body = (await res.json()) as {
				projects: Array<{ id: string; plans: Array<{ slug: string }> }>;
			};
			expect(body.projects.map((project) => project.id).sort()).toEqual([
				"current",
				`discovered-${Buffer.from(discoveredProject).toString("base64url")}`,
			]);
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("ignores external absolute plans paths for discovered projects", async () => {
		const discoveredProject = join(TMP, "discovered-absolute");
		const externalPlansDir = join(TMP, "external-plans");

		mkdirSync(join(discoveredProject, ".claude"), { recursive: true });
		mkdirSync(externalPlansDir, { recursive: true });
		writeFileSync(
			join(discoveredProject, ".claude", ".ck.json"),
			JSON.stringify({ paths: { plans: externalPlansDir } }, null, 2),
			"utf8",
		);
		writePlanInRoot(externalPlansDir, "260414-external", "pending");
		scanClaudeProjectsSpy.mockReturnValue([{ path: discoveredProject, lastModified: new Date() }]);

		const res = await fetch(`${baseUrl}/api/plan/list-all`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			projects: Array<{ id: string; plansDir: string; plans: Array<{ slug: string }> }>;
		};
		const discoveredId = `discovered-${Buffer.from(discoveredProject).toString("base64url")}`;
		const project = body.projects.find((entry) => entry.id === discoveredId);
		expect(project?.plansDir).toBe(join(realpathSync(discoveredProject), "plans"));
		expect(project?.plans).toEqual([]);
	});
});
