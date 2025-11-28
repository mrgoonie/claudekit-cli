/**
 * Tests for Help Renderer Module
 *
 * Tests main rendering logic for help output.
 */

import { describe, expect, test } from "bun:test";
import { defaultTheme, stripColors } from "./help-colors.js";
import {
	DEFAULT_HELP_OPTIONS,
	getTerminalWidth,
	renderGlobalHelp,
	renderHelp,
} from "./help-renderer.js";
import type {
	ColorTheme,
	CommandHelp,
	CommandRegistry,
	HelpOptions,
	HelpRenderContext,
} from "./help-types.js";

// Test fixtures
const createMockCommandHelp = (): CommandHelp => ({
	name: "test",
	description: "Test command description",
	usage: "ck test [options]",
	examples: [
		{ command: "ck test --verbose", description: "Run with verbose output" },
		{ command: "ck test --dry-run", description: "Preview changes without executing" },
		{ command: "ck test --format json", description: "Output in JSON format" },
	],
	optionGroups: [
		{
			title: "Test Options",
			options: [
				{
					flags: "-v, --verbose",
					description: "Enable verbose logging",
				},
				{
					flags: "-d, --dry-run",
					description: "Preview without executing",
				},
			],
		},
	],
	sections: [
		{
			title: "Notes",
			content: "This is a test note.\nSecond line of note.",
		},
	],
	aliases: ["t"],
});

const createDeprecatedCommandHelp = (): CommandHelp => ({
	name: "old-command",
	description: "Deprecated command",
	usage: "ck old-command",
	examples: [],
	optionGroups: [],
	deprecated: {
		message: "This command is deprecated",
		alternative: "ck new-command",
		removeInVersion: "3.0.0",
	},
});

const createCommandWithDeprecatedOption = (): CommandHelp => ({
	name: "test",
	description: "Test command",
	usage: "ck test",
	examples: [],
	optionGroups: [
		{
			title: "Options",
			options: [
				{
					flags: "--old-flag",
					description: "Old flag",
					deprecated: {
						message: "Use --new-flag instead",
						alternative: "--new-flag",
					},
				},
				{
					flags: "--new-flag",
					description: "New flag",
				},
			],
		},
	],
});

const createSimpleRegistry = (): CommandRegistry => ({
	new: {
		name: "new",
		description: "Create a new ClaudeKit project",
		usage: "ck new [options]",
		examples: [],
		optionGroups: [],
	},
	init: {
		name: "init",
		description: "Initialize ClaudeKit in current directory",
		usage: "ck init",
		examples: [],
		optionGroups: [],
	},
	doctor: {
		name: "doctor",
		description: "Diagnose installation issues",
		usage: "ck doctor",
		examples: [],
		optionGroups: [],
	},
});

describe("DEFAULT_HELP_OPTIONS", () => {
	test("has correct default values", () => {
		expect(DEFAULT_HELP_OPTIONS.showBanner).toBe(true);
		expect(DEFAULT_HELP_OPTIONS.showExamples).toBe(true);
		expect(DEFAULT_HELP_OPTIONS.maxExamples).toBe(2);
		expect(DEFAULT_HELP_OPTIONS.interactive).toBe(false);
	});

	test("has width property", () => {
		expect(typeof DEFAULT_HELP_OPTIONS.width).toBe("number");
		expect(DEFAULT_HELP_OPTIONS.width).toBeGreaterThan(0);
	});

	test("has theme property matching defaultTheme", () => {
		expect(DEFAULT_HELP_OPTIONS.theme).toBe(defaultTheme);
	});

	test("respects NO_COLOR environment variable", () => {
		if (process.env.NO_COLOR !== undefined) {
			expect(DEFAULT_HELP_OPTIONS.noColor).toBe(true);
		}
	});

	test("implements HelpOptions interface", () => {
		const options: HelpOptions = DEFAULT_HELP_OPTIONS;
		expect(options.showBanner).toBeDefined();
		expect(options.showExamples).toBeDefined();
		expect(options.maxExamples).toBeDefined();
		expect(options.interactive).toBeDefined();
		expect(options.width).toBeDefined();
		expect(options.theme).toBeDefined();
		expect(options.noColor).toBeDefined();
	});
});

describe("renderHelp", () => {
	test("includes all sections for complete command", () => {
		const help = createMockCommandHelp();
		const output = renderHelp(help);
		const stripped = stripColors(output);

		// Should include command name and description
		expect(stripped).toContain("test");
		expect(stripped).toContain("Test command description");

		// Should include usage
		expect(stripped).toContain("Usage:");
		expect(stripped).toContain("ck test [options]");

		// Should include examples
		expect(stripped).toContain("Examples:");
		expect(stripped).toContain("ck test --verbose");

		// Should include options
		expect(stripped).toContain("Test Options:");
		expect(stripped).toContain("-v, --verbose");

		// Should include sections
		expect(stripped).toContain("Notes:");
		expect(stripped).toContain("This is a test note");
	});

	test("shows banner by default", () => {
		const help = createMockCommandHelp();
		const output = renderHelp(help);
		const stripped = stripColors(output);

		// Banner should contain ASCII art
		expect(stripped).toContain("██████");
	});

	test("hides banner when showBanner is false", () => {
		const help = createMockCommandHelp();
		const context: HelpRenderContext = {
			globalHelp: false,
			options: { ...DEFAULT_HELP_OPTIONS, showBanner: false },
		};

		const output = renderHelp(help, context);
		const stripped = stripColors(output);

		expect(stripped).not.toContain("██████");
	});

	test("shows aliases in header", () => {
		const help = createMockCommandHelp();
		const output = renderHelp(help);
		const stripped = stripColors(output);

		expect(stripped).toContain("(alias: t)");
	});

	test("shows deprecated command warning", () => {
		const help = createDeprecatedCommandHelp();
		const output = renderHelp(help);
		const stripped = stripColors(output);

		expect(stripped).toContain("DEPRECATED: This command is deprecated");
		expect(stripped).toContain("Use: ck new-command");
		expect(stripped).toContain("Will be removed in 3.0.0");
	});

	test("shows deprecated option warnings", () => {
		const help = createCommandWithDeprecatedOption();
		const output = renderHelp(help);
		const stripped = stripColors(output);

		expect(stripped).toContain("DEPRECATED: Use --new-flag instead");
		expect(stripped).toContain("Use: --new-flag");
	});

	test("shows option default values", () => {
		const help: CommandHelp = {
			name: "test",
			description: "Test",
			usage: "ck test",
			examples: [],
			optionGroups: [
				{
					title: "Options",
					options: [
						{
							flags: "--timeout <ms>",
							description: "Request timeout",
							defaultValue: "5000",
						},
					],
				},
			],
		};

		const output = renderHelp(help);
		const stripped = stripColors(output);

		expect(stripped).toContain("(default: 5000)");
	});

	test("handles command with no examples", () => {
		const help: CommandHelp = {
			name: "test",
			description: "Test",
			usage: "ck test",
			examples: [],
			optionGroups: [],
		};

		const output = renderHelp(help);
		const stripped = stripColors(output);

		expect(stripped).not.toContain("Examples:");
	});

	test("handles command with no option groups", () => {
		const help: CommandHelp = {
			name: "test",
			description: "Test",
			usage: "ck test",
			examples: [],
			optionGroups: [],
		};

		const output = renderHelp(help);
		const stripped = stripColors(output);

		// Should still render other sections
		expect(stripped).toContain("test");
		expect(stripped).toContain("Usage:");
	});

	test("handles command with no sections", () => {
		const help: CommandHelp = {
			name: "test",
			description: "Test",
			usage: "ck test",
			examples: [],
			optionGroups: [],
		};

		const output = renderHelp(help);
		// Should not throw, just render without sections
		expect(output).toBeDefined();
	});

	test("uses custom theme", () => {
		const customTheme: ColorTheme = {
			...defaultTheme,
			command: (text: string) => `[CMD]${text}[/CMD]`,
		};

		const help: CommandHelp = {
			name: "test",
			description: "Test",
			usage: "ck test",
			examples: [],
			optionGroups: [],
		};

		const context: HelpRenderContext = {
			globalHelp: false,
			options: { ...DEFAULT_HELP_OPTIONS, theme: customTheme },
		};

		const output = renderHelp(help, context);
		expect(output).toContain("[CMD]test[/CMD]");
	});
});

describe("renderHelp - examples limit", () => {
	test("limits examples to maxExamples (default 2)", () => {
		const help = createMockCommandHelp(); // Has 3 examples
		const output = renderHelp(help);
		const stripped = stripColors(output);

		// Should show first 2 examples
		expect(stripped).toContain("ck test --verbose");
		expect(stripped).toContain("ck test --dry-run");

		// Should NOT show 3rd example
		expect(stripped).not.toContain("ck test --format json");
	});

	test("respects custom maxExamples value", () => {
		const help = createMockCommandHelp();
		const context: HelpRenderContext = {
			globalHelp: false,
			options: { ...DEFAULT_HELP_OPTIONS, maxExamples: 1 },
		};

		const output = renderHelp(help, context);
		const stripped = stripColors(output);

		// Should only show 1 example
		expect(stripped).toContain("ck test --verbose");
		expect(stripped).not.toContain("ck test --dry-run");
		expect(stripped).not.toContain("ck test --format json");
	});

	test("shows all examples if maxExamples is greater than available", () => {
		const help = createMockCommandHelp();
		const context: HelpRenderContext = {
			globalHelp: false,
			options: { ...DEFAULT_HELP_OPTIONS, maxExamples: 10 },
		};

		const output = renderHelp(help, context);
		const stripped = stripColors(output);

		// Should show all 3 examples
		expect(stripped).toContain("ck test --verbose");
		expect(stripped).toContain("ck test --dry-run");
		expect(stripped).toContain("ck test --format json");
	});

	test("hides examples when showExamples is false", () => {
		const help = createMockCommandHelp();
		const context: HelpRenderContext = {
			globalHelp: false,
			options: { ...DEFAULT_HELP_OPTIONS, showExamples: false },
		};

		const output = renderHelp(help, context);
		const stripped = stripColors(output);

		expect(stripped).not.toContain("Examples:");
		expect(stripped).not.toContain("ck test --verbose");
	});
});

describe("renderGlobalHelp", () => {
	test("lists all commands from registry", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		expect(stripped).toContain("new");
		expect(stripped).toContain("Create a new ClaudeKit project");

		expect(stripped).toContain("init");
		expect(stripped).toContain("Initialize ClaudeKit in current directory");

		expect(stripped).toContain("doctor");
		expect(stripped).toContain("Diagnose installation issues");
	});

	test("includes ClaudeKit CLI header", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		expect(stripped).toContain("ClaudeKit CLI");
		expect(stripped).toContain("Bootstrap and manage ClaudeKit projects");
	});

	test("includes Commands section", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		expect(stripped).toContain("Commands:");
	});

	test("includes Global Options section", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		expect(stripped).toContain("Global Options:");
		expect(stripped).toContain("--verbose");
		expect(stripped).toContain("--log-file");
		expect(stripped).toContain("-V, --version");
		expect(stripped).toContain("-h, --help");
	});

	test("includes usage hint at bottom", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		expect(stripped).toContain("Run 'ck <command> --help' for detailed command information");
	});

	test("sorts commands alphabetically", () => {
		const registry: CommandRegistry = {
			zebra: {
				name: "zebra",
				description: "Last command",
				usage: "ck zebra",
				examples: [],
				optionGroups: [],
			},
			alpha: {
				name: "alpha",
				description: "First command",
				usage: "ck alpha",
				examples: [],
				optionGroups: [],
			},
			middle: {
				name: "middle",
				description: "Middle command",
				usage: "ck middle",
				examples: [],
				optionGroups: [],
			},
		};

		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		const alphaIndex = stripped.indexOf("alpha");
		const middleIndex = stripped.indexOf("middle");
		const zebraIndex = stripped.indexOf("zebra");

		expect(alphaIndex).toBeLessThan(middleIndex);
		expect(middleIndex).toBeLessThan(zebraIndex);
	});

	test("shows banner by default", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const stripped = stripColors(output);

		expect(stripped).toContain("██████");
	});

	test("hides banner when showBanner is false", () => {
		const registry = createSimpleRegistry();
		const options: HelpOptions = { ...DEFAULT_HELP_OPTIONS, showBanner: false };

		const output = renderGlobalHelp(registry, options);
		const stripped = stripColors(output);

		expect(stripped).not.toContain("██████");
	});

	test("aligns command names and descriptions", () => {
		const registry = createSimpleRegistry();
		const output = renderGlobalHelp(registry);
		const lines = output.split("\n");

		// Find lines with command descriptions
		const commandLines = lines.filter((line) => {
			const stripped = stripColors(line);
			return stripped.includes("new") || stripped.includes("init") || stripped.includes("doctor");
		});

		expect(commandLines.length).toBeGreaterThan(0);

		// All command lines should have similar structure (command name padded, then description)
		// This is a basic check - exact alignment tested by visual inspection
		for (const line of commandLines) {
			const stripped = stripColors(line);
			expect(stripped.startsWith("  ")).toBe(true); // Should have indent
		}
	});

	test("handles empty registry", () => {
		const registry: CommandRegistry = {};
		const output = renderGlobalHelp(registry);

		// Should still render header and global options
		expect(output).toBeDefined();
		expect(stripColors(output)).toContain("ClaudeKit CLI");
		expect(stripColors(output)).toContain("Global Options:");
	});
});

describe("getTerminalWidth", () => {
	test("returns a positive number", () => {
		const width = getTerminalWidth();
		expect(typeof width).toBe("number");
		expect(width).toBeGreaterThan(0);
	});

	test("has reasonable default fallback", () => {
		const width = getTerminalWidth();
		// Should be at least 80 (fallback value)
		expect(width).toBeGreaterThanOrEqual(80);
	});

	test("returns consistent value on multiple calls", () => {
		const width1 = getTerminalWidth();
		const width2 = getTerminalWidth();
		expect(width1).toBe(width2);
	});
});
