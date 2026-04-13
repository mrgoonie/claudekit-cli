import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeAction } from "@/domains/plan-actions/action-executor.js";
import { type PlanAction, clearActionStore } from "@/domains/plan-actions/action-signal.js";
import { scaffoldPlan } from "@/domains/plan-parser/plan-writer.js";
import { readRegistry, registerNewPlan } from "@/domains/plan-parser/plans-registry.js";

let originalCwd: string;
let testRoot: string;

function createAction(action: PlanAction["action"], planDir: string, phaseId?: string): PlanAction {
	return {
		id: `${action}-${phaseId ?? "plan"}`,
		action,
		planDir,
		phaseId,
		timestamp: new Date().toISOString(),
		status: "pending",
	};
}

function createTrackedPlan() {
	const planDir = join(testRoot, "plans", "260412-dashboard-demo");
	const result = scaffoldPlan({
		title: "Dashboard Demo",
		dir: planDir,
		priority: "P2",
		phases: [{ name: "Setup" }, { name: "Build" }],
	});
	registerNewPlan({
		dir: planDir,
		title: "Dashboard Demo",
		priority: "P2",
		source: "cli",
		phases: result.phaseIds,
		cwd: testRoot,
	});
	return { planDir };
}

beforeEach(() => {
	originalCwd = process.cwd();
	testRoot = mkdtempSync(join(tmpdir(), "ck-plan-actions-"));
	mkdirSync(join(testRoot, ".claude"), { recursive: true });
	process.chdir(testRoot);
});

afterEach(() => {
	clearActionStore();
	process.chdir(originalCwd);
	rmSync(testRoot, { recursive: true, force: true });
});

describe("executeAction", () => {
	test("keeps the registry in sync for dashboard complete actions", async () => {
		const { planDir } = createTrackedPlan();

		await executeAction(createAction("complete", planDir, "1"));
		let entry = readRegistry(testRoot).plans[0];
		expect(entry?.progressPct).toBe(50);
		expect(entry?.status).toBe("in-progress");

		await executeAction(createAction("complete", planDir, "2"));
		entry = readRegistry(testRoot).plans[0];
		expect(entry?.progressPct).toBe(100);
		expect(entry?.status).toBe("done");
	});

	test("keeps the registry in sync for start-next and reset actions", async () => {
		const { planDir } = createTrackedPlan();

		const started = await executeAction(createAction("start-next", planDir));
		expect(started.phaseId).toBe("1");
		let entry = readRegistry(testRoot).plans[0];
		expect(entry?.status).toBe("in-progress");
		expect(entry?.progressPct).toBe(0);

		await executeAction(createAction("reset", planDir, "1"));
		entry = readRegistry(testRoot).plans[0];
		expect(entry?.status).toBe("pending");
		expect(entry?.progressPct).toBe(0);
	});
});
