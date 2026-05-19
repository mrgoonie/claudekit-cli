import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildPlanCreateReadReminder } from "@/commands/plan/plan-write-handlers.js";

describe("plan create read reminder", () => {
	test("reminds Claude Code agents to read generated files before editing", () => {
		const cwd = "/tmp/demo project";
		const lines = buildPlanCreateReadReminder(
			join(cwd, "plans", "260519-demo", "plan.md"),
			[
				join(cwd, "plans", "260519-demo", "phase-01-recon.md"),
				join(cwd, "plans", "260519-demo", "phase-02-build.md"),
			],
			cwd,
		);
		const output = lines.join("\n");

		expect(output).toContain("read plan.md and every phase-*.md before editing");
		expect(output).toContain("Write/Edit without Read may be rejected after wasting tokens");
		expect(output).toContain('cat "plans/260519-demo/plan.md"');
		expect(output).toContain('"plans/260519-demo/phase-01-recon.md"');
		expect(output).toContain('"plans/260519-demo/phase-02-build.md"');
	});
});
