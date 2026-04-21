/**
 * Flag Parity Matrix Test
 *
 * Parameterized matrix asserting that every help file exposes the flags and
 * subcommand names that the CAC command-registry.ts actually registers.
 * Run this test FIRST (TDD: RED → fix help files → GREEN).
 */

import { describe, expect, test } from "bun:test";
import { getCommandHelp } from "@/domains/help/help-commands.js";
import type { CommandHelp } from "@/domains/help/help-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectAllFlags(help: CommandHelp): string[] {
	return help.optionGroups.flatMap((g) => g.options.map((o) => o.flags));
}

function collectSubcommandNames(help: CommandHelp): string[] {
	return (help.subcommands ?? []).map((s) => s.name);
}

/**
 * Returns true if any flag entry in the set starts with or contains the token.
 * e.g. flagToken "--catalog" matches flags field "--catalog"
 * e.g. flagToken "-d, --dev" matches flags field "-d, --dev"
 */
function hasFlag(allFlags: string[], flagToken: string): boolean {
	// Exact match OR the flags string contains the token
	return allFlags.some((f) => f === flagToken || f.includes(flagToken));
}

// ---------------------------------------------------------------------------
// Matrix definition
// Each row: [commandName, requiredFlagTokens[], requiredSubcommandNames[]]
// ---------------------------------------------------------------------------

type MatrixRow = {
	command: string;
	requiredFlags: string[];
	requiredSubcommands: string[];
};

const matrix: MatrixRow[] = [
	// 03A ── skills
	{
		command: "skills",
		requiredFlags: ["--catalog", "--regenerate", "--search", "--json", "--limit", "--validate"],
		requiredSubcommands: [],
	},
	// 03B ── app
	{
		command: "app",
		requiredFlags: ["--dev", "--stable"],
		requiredSubcommands: [],
	},
	// 03B ── content (subcommands populated in subcommands array)
	{
		command: "content",
		requiredFlags: [],
		requiredSubcommands: ["start", "stop", "status", "logs", "setup", "queue", "approve", "reject"],
	},
	// 03C ── watch
	{
		command: "watch",
		requiredFlags: ["--verbose"],
		requiredSubcommands: [],
	},
	// 03C ── update
	{
		command: "update",
		requiredFlags: ["-d, --dev"],
		requiredSubcommands: [],
	},
	// 03C ── new
	{
		command: "new",
		requiredFlags: ["--archive", "--kit-path"],
		requiredSubcommands: [],
	},
	// 03C ── init
	{
		command: "init",
		requiredFlags: ["--archive", "--kit-path"],
		requiredSubcommands: [],
	},
	// 03D ── projects
	{
		command: "projects",
		requiredFlags: ["--pinned"],
		requiredSubcommands: ["list", "add", "remove"],
	},
	// 03D ── backups (subcommands in subcommands array)
	{
		command: "backups",
		requiredFlags: [],
		requiredSubcommands: ["list", "restore", "prune"],
	},
	// 03D ── config (subcommands in subcommands array)
	{
		command: "config",
		requiredFlags: [],
		requiredSubcommands: ["ui", "get", "set", "show"],
	},
];

// ---------------------------------------------------------------------------
// Parameterized tests
// ---------------------------------------------------------------------------

describe("flag parity matrix", () => {
	for (const { command, requiredFlags, requiredSubcommands } of matrix) {
		describe(`ck ${command}`, () => {
			test("help definition exists", () => {
				const help = getCommandHelp(command);
				expect(help).toBeDefined();
			});

			if (requiredFlags.length > 0) {
				test("exposes required flags", () => {
					const help = getCommandHelp(command) as CommandHelp;
					const allFlags = collectAllFlags(help);

					for (const flagToken of requiredFlags) {
						expect(
							hasFlag(allFlags, flagToken),
							`ck ${command}: missing flag "${flagToken}" in optionGroups.\nFound: ${JSON.stringify(allFlags, null, 2)}`,
						).toBe(true);
					}
				});
			}

			if (requiredSubcommands.length > 0) {
				test("exposes required subcommands", () => {
					const help = getCommandHelp(command) as CommandHelp;
					const subNames = collectSubcommandNames(help);

					for (const name of requiredSubcommands) {
						expect(
							subNames.includes(name),
							`ck ${command}: missing subcommand "${name}" in subcommands.\nFound: ${JSON.stringify(subNames, null, 2)}`,
						).toBe(true);
					}
				});
			}
		});
	}
});
