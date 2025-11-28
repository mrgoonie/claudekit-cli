/**
 * Help System Type Definitions
 *
 * Foundation types for claudekit-cli custom help system.
 * Used by help-colors.ts, help-renderer.ts, help-commands.ts, and help-interactive.ts.
 */

/**
 * Deprecation information for commands or options
 * Shows grace message when deprecated flag is used
 */
export interface DeprecatedInfo {
	/** User-friendly deprecation message */
	message: string;
	/** Suggested alternative command/option */
	alternative: string;
	/** Version when this will be removed */
	removeInVersion?: string;
}

/**
 * Single option definition with flags, description, and metadata
 */
export interface OptionDefinition {
	/** Flag syntax (e.g., "-r, --release <version>") */
	flags: string;
	/** Brief description of the option */
	description: string;
	/** Default value if any */
	defaultValue?: string;
	/** Deprecation info if option is deprecated */
	deprecated?: DeprecatedInfo;
}

/**
 * Logical grouping of related options
 * Used to organize options into sections (e.g., "Output Options", "Filter Options")
 */
export interface OptionGroup {
	/** Group title (e.g., "Output Options") */
	title: string;
	/** Options in this group */
	options: OptionDefinition[];
}

/**
 * Single usage example with command and description
 * Limited to 2 per command for conciseness
 */
export interface HelpExample {
	/** Example command (e.g., "ck new --kit engineer") */
	command: string;
	/** Brief explanation of what this example does */
	description: string;
}

/**
 * Generic help section for additional content
 * Used for notes, warnings, related commands, etc.
 */
export interface HelpSection {
	/** Section title */
	title: string;
	/** Section content (can contain newlines) */
	content: string;
}

/**
 * Complete help data for a single command
 * Central interface used by help renderer
 */
export interface CommandHelp {
	/** Command name (e.g., "new", "init") */
	name: string;
	/** Brief command description (shown in command list) */
	description: string;
	/** Usage syntax (e.g., "ck new [options]") */
	usage: string;
	/** Usage examples (max 2 recommended) */
	examples: HelpExample[];
	/** Grouped options */
	optionGroups: OptionGroup[];
	/** Additional sections (notes, warnings, etc.) */
	sections?: HelpSection[];
	/** Command aliases (e.g., ["i"] for init) */
	aliases?: string[];
	/** Command deprecation info */
	deprecated?: DeprecatedInfo;
}

/**
 * Function type for color formatting
 * Maps text to colored text (or plain if NO_COLOR)
 */
export type ColorFunction = (text: string) => string;

/**
 * Color theme for help output
 * All functions should respect NO_COLOR environment variable
 */
export interface ColorTheme {
	/** Banner/logo color (cyan/bold) */
	banner: ColorFunction;
	/** Command name color (green) */
	command: ColorFunction;
	/** Section heading color (bold) */
	heading: ColorFunction;
	/** Flag/option color (yellow) */
	flag: ColorFunction;
	/** Description text color (dim) */
	description: ColorFunction;
	/** Example command color (cyan) */
	example: ColorFunction;
	/** Warning message color (yellow) */
	warning: ColorFunction;
	/** Error message color (red) */
	error: ColorFunction;
	/** Muted/secondary text color (gray/dim) */
	muted: ColorFunction;
	/** Success message color (green) */
	success: ColorFunction;
}

/**
 * Help renderer configuration options
 */
export interface HelpOptions {
	/** Show ASCII banner at top */
	showBanner: boolean;
	/** Show usage examples */
	showExamples: boolean;
	/** Maximum examples to show per command */
	maxExamples: number;
	/** Enable interactive scrolling for long content */
	interactive: boolean;
	/** Terminal width for formatting (default: 80) */
	width: number;
	/** Color theme to use */
	theme: ColorTheme;
	/** Disable colors (NO_COLOR support) */
	noColor: boolean;
}

/**
 * Context passed to help renderer
 */
export interface HelpRenderContext {
	/** Command name if showing specific command help */
	command?: string;
	/** True if showing global help (all commands) */
	globalHelp: boolean;
	/** Renderer options */
	options: HelpOptions;
}

/**
 * Registry of all command help definitions
 * Key is command name, value is full help data
 */
export type CommandRegistry = Record<string, CommandHelp>;

/**
 * Function type for custom help formatters
 * Allows extending/customizing help output
 */
export type HelpFormatter = (help: CommandHelp, context: HelpRenderContext) => string;

/**
 * Global help data (shown with `ck --help`)
 */
export interface GlobalHelp {
	/** CLI name */
	name: string;
	/** CLI description */
	description: string;
	/** CLI version */
	version: string;
	/** Global usage syntax */
	usage: string;
	/** All available commands */
	commands: CommandHelp[];
	/** Global options */
	globalOptions: OptionDefinition[];
}
