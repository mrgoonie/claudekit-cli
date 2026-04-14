import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectPlanData } from "@/domains/web-server/project-plan-data.js";

describe("buildProjectPlanData", () => {
	let projectDir = "";

	beforeEach(async () => {
		projectDir = await mkdtemp(join(tmpdir(), "ck-project-plan-data-"));
		await mkdir(join(projectDir, ".claude"), { recursive: true });
		await writeFile(
			join(projectDir, ".claude", ".ck.json"),
			JSON.stringify({
				plan: {
					validation: {
						mode: "strict",
					},
				},
				paths: {
					plans: "plans/project",
				},
			}),
			"utf8",
		);

		const activePlanDir = join(projectDir, "plans", "project", "260413-demo");
		const donePlanDir = join(projectDir, "plans", "project", "260413-done");
		await mkdir(activePlanDir, { recursive: true });
		await mkdir(donePlanDir, { recursive: true });

		await writeFile(
			join(activePlanDir, "plan.md"),
			`---
title: Demo Plan
status: in-progress
blockedBy: [global:260413-foundation]
---

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Implement](./phase-01-implement.md) | In Progress |
`,
			"utf8",
		);

		await writeFile(
			join(donePlanDir, "plan.md"),
			`---
title: Done Plan
status: done
---

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Complete](./phase-01-complete.md) | Completed |
`,
			"utf8",
		);
	});

	afterEach(async () => {
		await rm(projectDir, { recursive: true, force: true });
	});

	test("returns scoped settings and only active plans", async () => {
		const result = await buildProjectPlanData(projectDir, "project");

		expect(result.planSettings.scope).toBe("project");
		expect(result.planSettings.plansDir).toBe(join(projectDir, "plans", "project"));
		expect(result.planSettings.validationMode).toBe("strict");
		expect(result.planSettings.activePlanCount).toBe(1);
		expect(result.activePlans).toHaveLength(1);
		expect(result.activePlans[0]?.title).toBe("Demo Plan");
		expect(result.activePlans[0]?.blockedBy).toEqual(["global:260413-foundation"]);
	});
});
