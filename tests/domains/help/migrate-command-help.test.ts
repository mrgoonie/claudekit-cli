import { describe, expect, test } from "bun:test";
import { migrateCommandHelp } from "@/domains/help/commands/migrate-command-help.js";

describe("migrate command help", () => {
	test("documents the new dry-run and ASCII fallback workflows", () => {
		expect(migrateCommandHelp.description).toContain("Claude Code");
		expect(migrateCommandHelp.examples.map((example) => example.command)).toContain(
			"ck migrate --agent codex --dry-run",
		);
		expect(migrateCommandHelp.examples.map((example) => example.command).join(" ")).toContain(
			"CK_FORCE_ASCII=1",
		);
		expect(
			migrateCommandHelp.optionGroups
				.flatMap((group) => group.options)
				.find((option) => option.flags === "--dry-run")?.description,
		).toContain("destinations");
	});
});
