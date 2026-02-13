/**
 * Help Renderer Module
 *
 * Main rendering logic for custom help output.
 * Combines colors, banner, and content formatting.
 */

import { getBanner } from "./help-banner.js";
import { defaultTheme, padEnd } from "./help-colors.js";
import type {
	ColorTheme,
	CommandHelp,
	CommandRegistry,
	HelpOptions,
	HelpRenderContext,
	OptionGroup,
} from "./help-types.js";

/**
 * Default help rendering options
 */
export const DEFAULT_HELP_OPTIONS: HelpOptions = {
	showBanner: true,
	showExamples: true,
	maxExamples: 2,
	interactive: false,
	width: process.stdout.columns || 80,
	theme: defaultTheme,
	noColor: process.env.NO_COLOR !== undefined,
};

/**
 * Render banner section
 */
function renderBanner(options: HelpOptions): string {
	if (!options.showBanner) return "";
	return `${getBanner()}\n\n`;
}

/**
 * Render command header line
 */
function renderCommandHeader(help: CommandHelp, theme: ColorTheme): string {
	const parts = [theme.command(help.name), theme.muted("-"), theme.description(help.description)];

	// Add aliases if present
	if (help.aliases?.length) {
		const aliasText = theme.muted(`(alias: ${help.aliases.join(", ")})`);
		parts.push(aliasText);
	}

	return parts.join(" ");
}

/**
 * Render usage section
 */
function renderUsage(help: CommandHelp, theme: ColorTheme): string {
	return [theme.heading("Usage:"), `  ${theme.example(help.usage)}`, ""].join("\n");
}

/**
 * Render examples section (max 2 examples)
 */
function renderExamples(help: CommandHelp, options: HelpOptions): string {
	if (!options.showExamples || help.examples.length === 0) return "";

	const theme = options.theme;
	const examples = help.examples.slice(0, options.maxExamples);

	const lines = [theme.heading("Examples:")];
	for (const example of examples) {
		lines.push(`  ${theme.example(example.command)}`);
		lines.push(`    ${theme.description(example.description)}`);
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Render a single option group
 */
function renderOptionGroup(group: OptionGroup, theme: ColorTheme): string[] {
	const lines: string[] = [];
	lines.push(theme.heading(`${group.title}:`));

	// Calculate max flag width for alignment
	const maxFlagWidth = Math.max(...group.options.map((opt) => opt.flags.length));

	for (const opt of group.options) {
		const flagsPart = `  ${padEnd(theme.flag(opt.flags), maxFlagWidth + 4)}`;

		if (opt.deprecated) {
			const warning = theme.warning(`[DEPRECATED: ${opt.deprecated.message}]`);
			lines.push(`${flagsPart}${warning}`);
			lines.push(`      Use: ${theme.example(opt.deprecated.alternative)}`);
		} else {
			lines.push(`${flagsPart}${theme.description(opt.description)}`);
			if (opt.defaultValue) {
				lines.push(`      ${theme.muted(`(default: ${opt.defaultValue})`)}`);
			}
		}
	}
	lines.push("");

	return lines;
}

/**
 * Render all option groups
 */
function renderOptionGroups(help: CommandHelp, theme: ColorTheme): string {
	if (help.optionGroups.length === 0) return "";

	const lines: string[] = [];
	for (const group of help.optionGroups) {
		lines.push(...renderOptionGroup(group, theme));
	}

	return lines.join("\n");
}

/**
 * Render additional sections (notes, warnings, etc.)
 */
function renderSections(help: CommandHelp, theme: ColorTheme): string {
	if (!help.sections || help.sections.length === 0) return "";

	const lines: string[] = [];
	for (const section of help.sections) {
		lines.push(theme.heading(`${section.title}:`));
		// Indent content lines
		const contentLines = section.content.split("\n");
		for (const line of contentLines) {
			lines.push(`  ${theme.description(line)}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Render deprecation warning if command is deprecated
 */
function renderDeprecationWarning(help: CommandHelp, theme: ColorTheme): string {
	if (!help.deprecated) return "";

	return [
		theme.warning(`⚠️  DEPRECATED: ${help.deprecated.message}`),
		`   Use: ${theme.example(help.deprecated.alternative)}`,
		help.deprecated.removeInVersion
			? theme.muted(`   Will be removed in ${help.deprecated.removeInVersion}`)
			: "",
		"",
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * Render complete help for a single command
 */
export function renderHelp(
	help: CommandHelp,
	context: HelpRenderContext = { globalHelp: false, options: DEFAULT_HELP_OPTIONS },
): string {
	const options = { ...DEFAULT_HELP_OPTIONS, ...context.options };
	const theme = options.theme;

	const sections = [
		renderBanner(options),
		renderDeprecationWarning(help, theme),
		renderCommandHeader(help, theme),
		"",
		renderUsage(help, theme),
		renderExamples(help, options),
		renderOptionGroups(help, theme),
		renderSections(help, theme),
	];

	return sections.filter((s) => s !== undefined && s !== "").join("\n");
}

/**
 * Render global help (all commands overview)
 */
export function renderGlobalHelp(
	commands: CommandRegistry,
	options: HelpOptions = DEFAULT_HELP_OPTIONS,
): string {
	const theme = options.theme;

	const lines = [
		renderBanner(options),
		theme.heading("ClaudeKit CLI"),
		theme.description("Bootstrap and manage ClaudeKit projects"),
		"",
		theme.heading("Commands:"),
	];

	// Calculate max command name width for alignment
	const commandNames = Object.keys(commands);
	const maxNameWidth = Math.max(...commandNames.map((n) => n.length));

	// Sort commands alphabetically
	const sortedCommands = Object.entries(commands).sort(([a], [b]) => a.localeCompare(b));

	for (const [name, help] of sortedCommands) {
		const cmdPart = `  ${padEnd(theme.command(name), maxNameWidth + 4)}`;
		const descPart = theme.description(help.description);
		lines.push(`${cmdPart}${descPart}`);
	}

	lines.push("");
	lines.push(theme.heading("Quick Start:"));
	lines.push(
		`  ${padEnd(theme.example("ck config"), 24)}${theme.description("Open the config dashboard")}`,
	);
	lines.push(
		`  ${padEnd(theme.example("ck config --help"), 24)}${theme.description("See config actions and dashboard flags")}`,
	);
	lines.push(
		`  ${padEnd(theme.example("ck skills --help"), 24)}${theme.description("Discover skill installation workflows")}`,
	);
	lines.push(
		`  ${padEnd(theme.example("ck port --help"), 24)}${theme.description("Migrate agents/commands/skills across providers")}`,
	);

	lines.push("");
	lines.push(theme.heading("Global Options:"));
	lines.push(
		`  ${padEnd(theme.flag("--verbose"), 20)}${theme.description("Enable verbose logging")}`,
	);
	lines.push(
		`  ${padEnd(theme.flag("--log-file <path>"), 20)}${theme.description("Write logs to file")}`,
	);
	lines.push(
		`  ${padEnd(theme.flag("-V, --version"), 20)}${theme.description("Display version number")}`,
	);
	lines.push(
		`  ${padEnd(theme.flag("-h, --help"), 20)}${theme.description("Display help information")}`,
	);
	lines.push("");
	lines.push(theme.heading("Authentication:"));
	lines.push(
		`  ${padEnd(theme.flag("--use-git"), 20)}${theme.description("Use git clone (SSH/HTTPS) instead of API")}`,
	);
	lines.push(
		`  ${padEnd(theme.flag("GITHUB_TOKEN"), 20)}${theme.description("Environment variable for Classic PAT")}`,
	);
	lines.push(
		`  ${padEnd(theme.flag("gh auth login"), 20)}${theme.description("GitHub CLI authentication (default)")}`,
	);
	lines.push("");
	lines.push(
		theme.muted(
			"Run 'ck <command> --help' for details. Start with 'ck skills --help' and 'ck config --help'.",
		),
	);

	return lines.filter((s) => s !== undefined).join("\n");
}

/**
 * Get terminal width with fallback
 */
export function getTerminalWidth(): number {
	return process.stdout.columns || 80;
}
