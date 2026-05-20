/**
 * Tests for api-command-help.ts
 *
 * TDD: written before implementation — expected RED on first run.
 */

import { describe, expect, test } from "bun:test";
import { apiCommandHelp } from "@/domains/help/commands/api-command-help.js";
import type { CommandHelp } from "@/domains/help/help-types.js";

/** Recursively collect all flags from a CommandHelp tree */
function collectAllFlags(help: CommandHelp): string[] {
	const flags = help.optionGroups.flatMap((g) => g.options.map((o) => o.flags));
	const subFlags = (help.subcommands ?? []).flatMap(collectAllFlags);
	return [...flags, ...subFlags];
}

describe("api command help", () => {
	test("has correct name and at least 1 example", () => {
		expect(apiCommandHelp.name).toBe("api");
		expect(apiCommandHelp.examples.length).toBeGreaterThanOrEqual(1);
	});

	test("has exactly 6 top-level subcommands", () => {
		expect(apiCommandHelp.subcommands).toBeDefined();
		expect(apiCommandHelp.subcommands?.length).toBe(6);
	});

	test("subcommand names match expected set", () => {
		const names = apiCommandHelp.subcommands?.map((s) => s.name) ?? [];
		expect(names).toContain("status");
		expect(names).toContain("services");
		expect(names).toContain("setup");
		expect(names).toContain("proxy");
		expect(names).toContain("vidcap");
		expect(names).toContain("reviewweb");
	});

	test("vidcap has exactly 7 nested subcommands", () => {
		const vidcap = apiCommandHelp.subcommands?.find((s) => s.name === "vidcap");
		expect(vidcap).toBeDefined();
		expect(vidcap?.subcommands?.length).toBe(7);
	});

	test("reviewweb has exactly 9 nested subcommands", () => {
		const reviewweb = apiCommandHelp.subcommands?.find((s) => s.name === "reviewweb");
		expect(reviewweb).toBeDefined();
		expect(reviewweb?.subcommands?.length).toBe(9);
	});

	test("all 16 CAC-registered flags appear somewhere in the help tree", () => {
		const allFlags = collectAllFlags(apiCommandHelp).join(" ");

		const expectedFlags = [
			"--method",
			"--body",
			"--query",
			"--key",
			"--force",
			"--json",
			"--locale",
			"--max-results",
			"--second",
			"--order",
			"--format",
			"--max-length",
			"--instructions",
			"--template",
			"--type",
			"--country",
		];

		for (const flag of expectedFlags) {
			expect(allFlags).toContain(flag);
		}
	});
});
