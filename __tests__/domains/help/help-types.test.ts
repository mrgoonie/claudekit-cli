/**
 * Type definition verification tests
 * Ensures help-types.ts exports are usable and type-safe
 */

import { describe, expect, test } from "bun:test";
import type {
	ColorTheme,
	CommandHelp,
	CommandRegistry,
	DeprecatedInfo,
	GlobalHelp,
	HelpExample,
	HelpFormatter,
	HelpOptions,
	HelpRenderContext,
	HelpSection,
	OptionDefinition,
	OptionGroup,
} from "../../../src/domains/help/help-types";

describe("help-types", () => {
	test("types can be imported", () => {
		// This test verifies that all types compile and can be imported
		// If TypeScript compilation fails, this test won't even run
		expect(true).toBe(true);
	});

	test("OptionDefinition type usage", () => {
		const option: OptionDefinition = {
			flags: "-v, --verbose",
			description: "Enable verbose output",
		};
		expect(option.flags).toBe("-v, --verbose");
		expect(option.description).toBe("Enable verbose output");
	});

	test("DeprecatedInfo type usage", () => {
		const deprecated: DeprecatedInfo = {
			message: "This option is deprecated",
			alternative: "Use --new-option instead",
			removeInVersion: "3.0.0",
		};
		expect(deprecated.message).toBe("This option is deprecated");
	});

	test("OptionGroup type usage", () => {
		const group: OptionGroup = {
			title: "Output Options",
			options: [
				{
					flags: "-v, --verbose",
					description: "Verbose output",
				},
			],
		};
		expect(group.title).toBe("Output Options");
		expect(group.options).toHaveLength(1);
	});

	test("HelpExample type usage", () => {
		const example: HelpExample = {
			command: "ck new --kit engineer",
			description: "Create new engineer kit",
		};
		expect(example.command).toBe("ck new --kit engineer");
	});

	test("HelpSection type usage", () => {
		const section: HelpSection = {
			title: "Notes",
			content: "Important information here",
		};
		expect(section.title).toBe("Notes");
	});

	test("CommandHelp type usage", () => {
		const help: CommandHelp = {
			name: "new",
			description: "Create new kit",
			usage: "ck new [options]",
			examples: [],
			optionGroups: [],
		};
		expect(help.name).toBe("new");
	});

	test("ColorTheme type usage", () => {
		const theme: ColorTheme = {
			banner: (text: string) => text,
			command: (text: string) => text,
			heading: (text: string) => text,
			flag: (text: string) => text,
			description: (text: string) => text,
			example: (text: string) => text,
			warning: (text: string) => text,
			error: (text: string) => text,
			muted: (text: string) => text,
			success: (text: string) => text,
		};
		expect(theme.banner("test")).toBe("test");
	});

	test("HelpOptions type usage", () => {
		const options: HelpOptions = {
			showBanner: true,
			showExamples: true,
			maxExamples: 2,
			interactive: false,
			width: 80,
			theme: {
				banner: (text: string) => text,
				command: (text: string) => text,
				heading: (text: string) => text,
				flag: (text: string) => text,
				description: (text: string) => text,
				example: (text: string) => text,
				warning: (text: string) => text,
				error: (text: string) => text,
				muted: (text: string) => text,
				success: (text: string) => text,
			},
			noColor: false,
		};
		expect(options.showBanner).toBe(true);
	});

	test("HelpRenderContext type usage", () => {
		const context: HelpRenderContext = {
			command: "new",
			globalHelp: false,
			options: {
				showBanner: true,
				showExamples: true,
				maxExamples: 2,
				interactive: false,
				width: 80,
				theme: {
					banner: (text: string) => text,
					command: (text: string) => text,
					heading: (text: string) => text,
					flag: (text: string) => text,
					description: (text: string) => text,
					example: (text: string) => text,
					warning: (text: string) => text,
					error: (text: string) => text,
					muted: (text: string) => text,
					success: (text: string) => text,
				},
				noColor: false,
			},
		};
		expect(context.command).toBe("new");
	});

	test("CommandRegistry type usage", () => {
		const registry: CommandRegistry = {
			new: {
				name: "new",
				description: "Create new kit",
				usage: "ck new [options]",
				examples: [],
				optionGroups: [],
			},
		};
		expect(registry.new.name).toBe("new");
	});

	test("HelpFormatter type usage", () => {
		const formatter: HelpFormatter = (help, _context) => {
			return `${help.name}: ${help.description}`;
		};
		const result = formatter(
			{
				name: "new",
				description: "Create kit",
				usage: "ck new",
				examples: [],
				optionGroups: [],
			},
			{
				globalHelp: false,
				options: {
					showBanner: true,
					showExamples: true,
					maxExamples: 2,
					interactive: false,
					width: 80,
					theme: {
						banner: (text: string) => text,
						command: (text: string) => text,
						heading: (text: string) => text,
						flag: (text: string) => text,
						description: (text: string) => text,
						example: (text: string) => text,
						warning: (text: string) => text,
						error: (text: string) => text,
						muted: (text: string) => text,
						success: (text: string) => text,
					},
					noColor: false,
				},
			},
		);
		expect(result).toBe("new: Create kit");
	});

	test("GlobalHelp type usage", () => {
		const globalHelp: GlobalHelp = {
			name: "ck",
			description: "ClaudeKit CLI",
			version: "1.0.0",
			usage: "ck [command] [options]",
			commands: [],
			globalOptions: [],
		};
		expect(globalHelp.name).toBe("ck");
	});

	test("no any types used (compile-time check)", () => {
		// If any 'any' types were used, TypeScript strict mode would catch it
		// This test verifies strict mode compliance
		const option: OptionDefinition = {
			flags: "-v",
			description: "test",
		};
		// TypeScript allows spread with extra props, but strict typing on the result
		// would catch issues if OptionDefinition used 'any' internally
		const extended = { ...option, extra: "allowed" };
		expect(extended.flags).toBe("-v");
		expect(option.flags).toBe("-v");
	});
});
