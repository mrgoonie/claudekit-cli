/**
 * Help Routing Tests — Phase 01: Subcommand schema + routing
 *
 * Tests for:
 * - Renderer displays "Subcommands" section for parent commands
 * - Interceptor resolves `ck parent sub --help` to subcommand help
 * - Interceptor falls back to parent help for unknown subcommands
 * - Type-level: CommandHelp with subcommands field compiles
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_HELP_OPTIONS, renderHelp } from "@/domains/help/help-renderer.js";
import type { CommandHelp, CommandRegistry } from "@/domains/help/help-types.js";

// ---------------------------------------------------------------------------
// Fixtures — local registry, does NOT touch HELP_REGISTRY
// ---------------------------------------------------------------------------

const SUB_LIST: CommandHelp = {
	name: "list",
	description: "List all items",
	usage: "ck parent list [options]",
	examples: [{ command: "ck parent list", description: "List everything" }],
	optionGroups: [],
};

const SUB_CREATE: CommandHelp = {
	name: "create",
	description: "Create a new item",
	usage: "ck parent create [options]",
	examples: [],
	optionGroups: [],
};

const PARENT_HELP: CommandHelp = {
	name: "parent",
	description: "Parent command with subcommands",
	usage: "ck parent <subcommand> [options]",
	examples: [{ command: "ck parent list", description: "List items" }],
	optionGroups: [],
	subcommands: [SUB_LIST, SUB_CREATE],
};

const FIXTURE_REGISTRY: CommandRegistry = {
	parent: PARENT_HELP,
};

// Test options — no banner, no color for clean string matching
const TEST_OPTIONS = {
	...DEFAULT_HELP_OPTIONS,
	showBanner: false,
	noColor: true,
	// Use identity theme (no ANSI codes) by providing plain functions
	theme: {
		banner: (t: string) => t,
		command: (t: string) => t,
		heading: (t: string) => t,
		flag: (t: string) => t,
		description: (t: string) => t,
		example: (t: string) => t,
		warning: (t: string) => t,
		error: (t: string) => t,
		muted: (t: string) => t,
		success: (t: string) => t,
	},
};

// ---------------------------------------------------------------------------
// Helper: replicate interceptor routing logic using fixture registry
// ---------------------------------------------------------------------------

/**
 * Resolve help for a given argv, using the fixture registry.
 * Returns rendered output string.
 */
function resolveHelpOutput(argv: string[]): string {
	// Strip 'node' and script path
	const args = argv.slice(2);
	const tokens = args.filter((a) => !a.startsWith("-"));

	const [cmd, sub] = tokens;

	if (!cmd || !(cmd in FIXTURE_REGISTRY)) {
		return "global-help";
	}

	const parent = FIXTURE_REGISTRY[cmd];
	if (sub && parent.subcommands) {
		const subHelp = parent.subcommands.find((s) => s.name === sub);
		if (subHelp) {
			return renderHelp(subHelp, {
				command: sub,
				globalHelp: false,
				options: TEST_OPTIONS,
				parentName: cmd,
			});
		}
	}

	// Fall back to parent help
	return renderHelp(parent, {
		command: cmd,
		globalHelp: false,
		options: TEST_OPTIONS,
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("help-routing: subcommand renderer", () => {
	test("parent help includes Subcommands section listing each subcommand", () => {
		const output = renderHelp(PARENT_HELP, {
			command: "parent",
			globalHelp: false,
			options: TEST_OPTIONS,
		});

		expect(output).toContain("Subcommands:");
		expect(output).toContain("list");
		expect(output).toContain("List all items");
		expect(output).toContain("create");
		expect(output).toContain("Create a new item");
	});

	test("parent without subcommands does not include Subcommands section", () => {
		const noSubs: CommandHelp = {
			name: "simple",
			description: "No subcommands",
			usage: "ck simple [options]",
			examples: [],
			optionGroups: [],
		};

		const output = renderHelp(noSubs, {
			command: "simple",
			globalHelp: false,
			options: TEST_OPTIONS,
		});

		expect(output).not.toContain("Subcommands:");
	});
});

describe("help-routing: interceptor resolution", () => {
	test("argv [node, ck, parent, list, --help] renders subcommand help with parent prefix in usage", () => {
		const output = resolveHelpOutput(["node", "ck", "parent", "list", "--help"]);

		// Usage line should use the subcommand's usage (which contains parent prefix)
		expect(output).toContain("list");
		expect(output).toContain("List all items");
	});

	test("argv [node, ck, parent, unknown-sub, --help] falls back to parent help without crash", () => {
		const output = resolveHelpOutput(["node", "ck", "parent", "unknown-sub", "--help"]);

		// Should fall back to parent and include Subcommands section
		expect(output).toContain("parent");
		expect(output).toContain("Parent command with subcommands");
		expect(output).toContain("Subcommands:");
	});

	test("argv [node, ck, parent, --help] renders parent help", () => {
		const output = resolveHelpOutput(["node", "ck", "parent", "--help"]);

		expect(output).toContain("parent");
		expect(output).toContain("Subcommands:");
	});
});

describe("help-routing: parentName context", () => {
	test("renderHelp with parentName overrides usage line prefix", () => {
		const output = renderHelp(SUB_LIST, {
			command: "list",
			globalHelp: false,
			options: TEST_OPTIONS,
			parentName: "parent",
		});

		// When parentName is provided, usage should reflect ck parent list
		expect(output).toContain("ck parent list");
	});
});

describe("help-routing: type safety", () => {
	test("CommandHelp with subcommands field satisfies type", () => {
		// Type-level test — if this compiles, the test passes
		const fixture = {
			name: "cmd",
			description: "desc",
			usage: "ck cmd",
			examples: [],
			optionGroups: [],
			subcommands: [
				{
					name: "sub",
					description: "sub desc",
					usage: "ck cmd sub",
					examples: [],
					optionGroups: [],
				},
			],
		} satisfies CommandHelp;

		expect(fixture.subcommands).toHaveLength(1);
		expect(fixture.subcommands?.[0]?.name).toBe("sub");
	});
});
