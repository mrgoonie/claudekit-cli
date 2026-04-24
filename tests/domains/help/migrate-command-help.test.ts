import { describe, expect, test } from "bun:test";
import { migrateCommandHelp } from "@/domains/help/commands/migrate-command-help.js";

describe("migrate command help", () => {
	test("documents install picker, dry-run, and respect-deletions workflows", () => {
		expect(migrateCommandHelp.description).toContain("Claude Code");
		const commands = migrateCommandHelp.examples.map((example) => example.command);
		expect(commands).toContain("ck migrate --install");
		expect(commands).toContain("ck migrate --agent codex --dry-run");
		expect(commands).toContain("ck migrate --respect-deletions");
		expect(
			migrateCommandHelp.optionGroups
				.flatMap((group) => group.options)
				.find((option) => option.flags === "--dry-run")?.description,
		).toContain("destinations");
	});
});
