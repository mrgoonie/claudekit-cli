/**
 * Tests for plan-command-help.ts
 *
 * TDD: written before implementation — expected RED on first run.
 */

import { describe, expect, test } from "bun:test";
import { planCommandHelp } from "@/domains/help/commands/plan-command-help.js";

/** Collect all flags from a single CommandHelp's optionGroups */
function collectFlags(help: { optionGroups: { options: { flags: string }[] }[] }): string[] {
	return help.optionGroups.flatMap((g) => g.options.map((o) => o.flags));
}

describe("plan command help", () => {
	test("has correct name and at least 1 example", () => {
		expect(planCommandHelp.name).toBe("plan");
		expect(planCommandHelp.examples.length).toBeGreaterThanOrEqual(1);
	});

	test("has exactly 8 subcommands", () => {
		expect(planCommandHelp.subcommands).toBeDefined();
		expect(planCommandHelp.subcommands?.length).toBe(8);
	});

	test("subcommand names match expected set", () => {
		const names = planCommandHelp.subcommands?.map((s) => s.name) ?? [];
		expect(names).toContain("parse");
		expect(names).toContain("validate");
		expect(names).toContain("status");
		expect(names).toContain("kanban");
		expect(names).toContain("create");
		expect(names).toContain("check");
		expect(names).toContain("uncheck");
		expect(names).toContain("add-phase");
	});

	test("create subcommand has required flags", () => {
		const create = planCommandHelp.subcommands?.find((s) => s.name === "create");
		expect(create).toBeDefined();
		const flags = collectFlags(create ?? { optionGroups: [] }).join(" ");
		expect(flags).toContain("--title");
		expect(flags).toContain("--phases");
		expect(flags).toContain("--dir");
		expect(flags).toContain("--priority");
		expect(flags).toContain("--issue");
		expect(flags).toContain("--source");
		expect(flags).toContain("--session-id");
	});

	test("kanban subcommand has --port, --no-open, --dev", () => {
		const kanban = planCommandHelp.subcommands?.find((s) => s.name === "kanban");
		expect(kanban).toBeDefined();
		const flags = collectFlags(kanban ?? { optionGroups: [] }).join(" ");
		expect(flags).toContain("--port");
		expect(flags).toContain("--no-open");
		expect(flags).toContain("--dev");
	});

	test("check subcommand has --start flag", () => {
		const check = planCommandHelp.subcommands?.find((s) => s.name === "check");
		expect(check).toBeDefined();
		const flags = collectFlags(check ?? { optionGroups: [] }).join(" ");
		expect(flags).toContain("--start");
	});

	test("add-phase subcommand has --after flag", () => {
		const addPhase = planCommandHelp.subcommands?.find((s) => s.name === "add-phase");
		expect(addPhase).toBeDefined();
		const flags = collectFlags(addPhase ?? { optionGroups: [] }).join(" ");
		expect(flags).toContain("--after");
	});
});
