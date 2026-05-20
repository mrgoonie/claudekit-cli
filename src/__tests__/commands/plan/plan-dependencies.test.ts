import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePlanDependencies } from "@/commands/plan/plan-dependencies.js";

describe("resolvePlanDependencies", () => {
	let projectDir = "";
	let projectPlansDir = "";
	let globalPlansDir = "";
	let currentPlanFile = "";

	beforeEach(async () => {
		projectDir = await mkdtemp(join(tmpdir(), "ck-plan-dependencies-"));
		projectPlansDir = join(projectDir, "plans", "project");
		globalPlansDir = join(projectDir, "plans", "global");
		currentPlanFile = join(projectPlansDir, "260413-current", "plan.md");

		await mkdir(join(projectDir, ".claude"), { recursive: true });
		await mkdir(join(projectPlansDir, "260413-current"), { recursive: true });
		await mkdir(join(projectPlansDir, "260413-setup"), { recursive: true });
		await mkdir(join(globalPlansDir, "260413-foundation"), { recursive: true });

		await writeFile(
			join(projectDir, ".claude", ".ck.json"),
			JSON.stringify(
				{
					paths: {
						plans: "plans/project",
						globalPlans: globalPlansDir,
					},
				},
				null,
				2,
			),
			"utf8",
		);

		await writeFile(
			currentPlanFile,
			`---
title: Current Plan
status: in-progress
---
`,
			"utf8",
		);

		await writeFile(
			join(projectPlansDir, "260413-setup", "plan.md"),
			`---
title: Setup Plan
status: done
---
`,
			"utf8",
		);

		await writeFile(
			join(globalPlansDir, "260413-foundation", "plan.md"),
			`---
title: Foundation Plan
status: in-review
---
`,
			"utf8",
		);
	});

	afterEach(async () => {
		await rm(projectDir, { recursive: true, force: true });
	});

	test("resolves same-scope project dependencies", async () => {
		const dependencies = await resolvePlanDependencies(["260413-setup"], currentPlanFile);

		expect(dependencies).toEqual([
			{
				reference: "260413-setup",
				scope: "project",
				planId: "260413-setup",
				planFile: join(projectPlansDir, "260413-setup", "plan.md"),
				exists: true,
				title: "Setup Plan",
				status: "done",
				isSelfReference: false,
			},
		]);
	});

	test("resolves explicit global and project dependencies", async () => {
		const dependencies = await resolvePlanDependencies(
			["global:260413-foundation", "project:260413-setup"],
			currentPlanFile,
		);

		expect(dependencies).toEqual([
			{
				reference: "global:260413-foundation",
				scope: "global",
				planId: "260413-foundation",
				planFile: join(globalPlansDir, "260413-foundation", "plan.md"),
				exists: true,
				title: "Foundation Plan",
				status: "in-review",
				isSelfReference: false,
			},
			{
				reference: "project:260413-setup",
				scope: "project",
				planId: "260413-setup",
				planFile: join(projectPlansDir, "260413-setup", "plan.md"),
				exists: true,
				title: "Setup Plan",
				status: "done",
				isSelfReference: false,
			},
		]);
	});

	test("marks traversal references as missing instead of resolving them", async () => {
		const dependencies = await resolvePlanDependencies(["global:../secret"], currentPlanFile);

		expect(dependencies).toEqual([
			{
				reference: "global:../secret",
				scope: "global",
				planId: "../secret",
				planFile: "",
				exists: false,
			},
		]);
	});
});
