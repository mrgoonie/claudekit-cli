import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	readRegistry,
	updateRegistryEntry,
	writeRegistry,
} from "@/domains/plan-parser/plans-registry.js";

let testRoot: string;

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "ck-plans-registry-"));
	mkdirSync(join(testRoot, ".claude"), { recursive: true });
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
});

describe("plans-registry", () => {
	test("recovers with an empty registry when the file shape is invalid", () => {
		writeFileSync(
			join(testRoot, ".claude", "plans-registry.json"),
			JSON.stringify({ version: 1, plans: {}, stats: {} }),
			"utf8",
		);

		expect(readRegistry(testRoot)).toEqual({
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		});
	});

	test("writes a backup and stores plan dirs relative to the project root", () => {
		writeRegistry(
			{
				version: 1,
				plans: [],
				stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
			},
			testRoot,
		);

		updateRegistryEntry(
			{
				dir: join(testRoot, "plans", "260412-demo"),
				title: "Demo Plan",
				status: "pending",
				created: "2026-04-12T00:00:00.000Z",
				createdBy: "ck-cli",
				source: "cli",
				phases: ["1", "2"],
				progressPct: 0,
			},
			testRoot,
		);

		const saved = readFileSync(join(testRoot, ".claude", "plans-registry.json"), "utf8");
		expect(saved).toContain('"dir": "plans/260412-demo"');
		expect(existsSync(join(testRoot, ".claude", "plans-registry.json.bak"))).toBe(true);
	});
});
