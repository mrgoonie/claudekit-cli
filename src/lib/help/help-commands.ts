/**
 * Help Command Definitions
 *
 * Declarative help content for all CLI commands.
 * Single source of truth for help output.
 */

import type { CommandHelp, CommandRegistry } from "./help-types.js";

/**
 * Help definition for 'new' command
 * Bootstrap a new ClaudeKit project
 */
const newCommandHelp: CommandHelp = {
	name: "new",
	description: "Bootstrap a new ClaudeKit project (with interactive version selection)",
	usage: "ck new [options]",
	examples: [
		{
			command: "ck new --kit engineer --dir ./my-project",
			description: "Create engineer kit project in specific directory",
		},
		{
			command: "ck new --beta --install-skills",
			description: "Create project with beta version and install skills dependencies",
		},
	],
	optionGroups: [
		{
			title: "Project Options",
			options: [
				{
					flags: "--dir <directory>",
					description: "Target directory for the new project",
					defaultValue: ".",
				},
				{
					flags: "--kit <kit>",
					description: "Kit to use (engineer, marketing)",
				},
				{
					flags: "-r, --release <version>",
					description: "Skip version selection, use specific version (e.g., latest, v1.0.0)",
				},
				{
					flags: "--force",
					description: "Overwrite existing files without confirmation",
				},
			],
		},
		{
			title: "Filter Options",
			options: [
				{
					flags: "--exclude <pattern>",
					description: "Exclude files matching glob pattern (can be used multiple times)",
				},
				{
					flags: "--beta",
					description: "Show beta versions in selection prompt",
				},
				{
					flags: "--refresh",
					description: "Bypass release cache to fetch latest versions from GitHub",
				},
			],
		},
		{
			title: "Installation Options",
			options: [
				{
					flags: "--opencode",
					description: "Install OpenCode CLI package (non-interactive mode)",
				},
				{
					flags: "--gemini",
					description: "Install Google Gemini CLI package (non-interactive mode)",
				},
				{
					flags: "--install-skills",
					description: "Install skills dependencies (non-interactive mode)",
				},
				{
					flags: "--prefix",
					description: "Add /ck: prefix to all slash commands",
				},
			],
		},
		{
			title: "Folder Options",
			options: [
				{
					flags: "--docs-dir <name>",
					description: "Custom docs folder name to avoid conflicts with existing folders",
					defaultValue: "docs",
				},
				{
					flags: "--plans-dir <name>",
					description: "Custom plans folder name to avoid conflicts with existing folders",
					defaultValue: "plans",
				},
			],
		},
	],
};

/**
 * Help definition for 'init' command
 * Initialize or update ClaudeKit project
 */
const initCommandHelp: CommandHelp = {
	name: "init",
	description: "Initialize or update ClaudeKit project (with interactive version selection)",
	usage: "ck init [options]",
	examples: [
		{
			command: "ck init --kit engineer",
			description: "Update local project with latest engineer kit",
		},
		{
			command: "ck init --global --fresh",
			description: "Fresh reinstall to global directory",
		},
	],
	optionGroups: [
		{
			title: "Project Options",
			options: [
				{
					flags: "--dir <directory>",
					description: "Target directory to initialize/update",
					defaultValue: ".",
				},
				{
					flags: "--kit <kit>",
					description: "Kit to use (engineer, marketing)",
				},
				{
					flags: "-r, --release <version>",
					description: "Skip version selection, use specific version",
				},
				{
					flags: "-g, --global",
					description: "Use platform-specific user configuration directory",
				},
				{
					flags: "--fresh",
					description:
						"Completely remove .claude directory before downloading (requires confirmation)",
				},
			],
		},
		{
			title: "Filter Options",
			options: [
				{
					flags: "--exclude <pattern>",
					description: "Exclude files matching glob pattern (can be used multiple times)",
				},
				{
					flags: "--only <pattern>",
					description: "Include only files matching glob pattern (can be used multiple times)",
				},
				{
					flags: "--beta",
					description: "Show beta versions in selection prompt",
				},
				{
					flags: "--refresh",
					description: "Bypass release cache to fetch latest versions from GitHub",
				},
			],
		},
		{
			title: "Installation Options",
			options: [
				{
					flags: "--install-skills",
					description: "Install skills dependencies (non-interactive mode)",
				},
				{
					flags: "--prefix",
					description: "Add /ck: prefix to all slash commands",
				},
				{
					flags: "--dry-run",
					description: "Preview changes without applying them (requires --prefix)",
				},
				{
					flags: "--force-overwrite",
					description: "Override ownership protections and delete user-modified files",
				},
			],
		},
		{
			title: "Folder Options",
			options: [
				{
					flags: "--docs-dir <name>",
					description: "Custom docs folder name to avoid conflicts with existing folders",
					defaultValue: "docs",
				},
				{
					flags: "--plans-dir <name>",
					description: "Custom plans folder name to avoid conflicts with existing folders",
					defaultValue: "plans",
				},
			],
		},
	],
};

/**
 * Help definition for 'update' command
 * Update ClaudeKit CLI itself (not kits)
 */
const updateCommandHelp: CommandHelp = {
	name: "update",
	description: "Update ClaudeKit CLI to the latest version",
	usage: "ck update [options]",
	examples: [
		{
			command: "ck update --check",
			description: "Check for CLI updates without installing",
		},
		{
			command: "ck update --beta --yes",
			description: "Update to latest beta version without confirmation",
		},
	],
	optionGroups: [
		{
			title: "Update Options",
			options: [
				{
					flags: "-r, --release <version>",
					description: "Update to a specific version",
				},
				{
					flags: "--check",
					description: "Check for updates without installing",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompt",
				},
				{
					flags: "--beta",
					description: "Update to the latest beta version",
				},
				{
					flags: "--registry <url>",
					description: "Custom npm registry URL",
				},
			],
		},
		{
			title: "Deprecated Options",
			options: [
				{
					flags: "--kit <kit>",
					description: "This option is no longer supported with 'ck update'",
					deprecated: {
						message: "Use 'ck init --kit <kit>' to update kit installations",
						alternative: "ck init --kit <kit>",
					},
				},
				{
					flags: "-g, --global",
					description: "This option is no longer supported with 'ck update'",
					deprecated: {
						message: "Use 'ck init --global' to update global kit",
						alternative: "ck init --global",
					},
				},
			],
		},
	],
	sections: [
		{
			title: "Note",
			content:
				"'ck update' now only updates the ClaudeKit CLI itself. To update a kit installation, use 'ck init'.",
		},
	],
};

/**
 * Help definition for 'versions' command
 * List available versions of ClaudeKit repositories
 */
const versionsCommandHelp: CommandHelp = {
	name: "versions",
	description: "List available versions of ClaudeKit repositories",
	usage: "ck versions [options]",
	examples: [
		{
			command: "ck versions --kit engineer --limit 10",
			description: "Show latest 10 versions of engineer kit",
		},
		{
			command: "ck versions --all",
			description: "Show all releases including prereleases",
		},
	],
	optionGroups: [
		{
			title: "Filter Options",
			options: [
				{
					flags: "--kit <kit>",
					description: "Filter by specific kit (engineer, marketing)",
				},
				{
					flags: "--limit <number>",
					description: "Number of releases to show",
					defaultValue: "30",
				},
				{
					flags: "--all",
					description: "Show all releases including prereleases",
				},
			],
		},
	],
};

/**
 * Help definition for 'doctor' command
 * Show current ClaudeKit setup
 */
const doctorCommandHelp: CommandHelp = {
	name: "doctor",
	description: "Comprehensive health check for ClaudeKit",
	usage: "ck doctor [options]",
	examples: [
		{
			command: "ck doctor",
			description: "Run full health check interactively",
		},
		{
			command: "ck doctor --fix",
			description: "Auto-fix all fixable issues",
		},
		{
			command: "ck doctor --check-only",
			description: "CI mode: exit 1 on failures, no prompts",
		},
	],
	optionGroups: [
		{
			title: "Options",
			options: [
				{
					flags: "--report",
					description: "Generate shareable diagnostic report",
				},
				{
					flags: "--fix",
					description: "Auto-fix all fixable issues",
				},
				{
					flags: "--check-only",
					description: "CI mode: no prompts, exit 1 on failures",
				},
				{
					flags: "--json",
					description: "Output JSON format",
				},
			],
		},
	],
};

/**
 * Help definition for 'uninstall' command
 * Remove ClaudeKit installations
 */
const uninstallCommandHelp: CommandHelp = {
	name: "uninstall",
	description: "Remove ClaudeKit installations (ownership-aware)",
	usage: "ck uninstall [options]",
	examples: [
		{
			command: "ck uninstall --local --yes",
			description: "Remove local installation without confirmation",
		},
		{
			command: "ck uninstall --dry-run",
			description: "Preview what would be removed without deleting",
		},
	],
	optionGroups: [
		{
			title: "Scope Options",
			options: [
				{
					flags: "-l, --local",
					description: "Uninstall only local installation (current project)",
				},
				{
					flags: "-g, --global",
					description: "Uninstall only global installation (~/.claude/)",
				},
				{
					flags: "-A, --all",
					description: "Uninstall from both local and global locations",
				},
			],
		},
		{
			title: "Safety Options",
			options: [
				{
					flags: "--dry-run",
					description: "Preview what would be removed without deleting",
				},
				{
					flags: "--force-overwrite",
					description: "Delete even user-modified files (requires confirmation)",
				},
				{
					flags: "-y, --yes",
					description: "Skip confirmation prompt",
				},
			],
		},
	],
	sections: [
		{
			title: "Ownership-Aware Uninstall",
			content:
				"Uninstall preserves user customizations by default. Only CK-installed files that haven't been modified are removed. User-created files and modified files are preserved unless --force-overwrite is used.",
		},
	],
};

/**
 * Registry of all command help definitions
 */
export const HELP_REGISTRY: CommandRegistry = {
	new: newCommandHelp,
	init: initCommandHelp,
	update: updateCommandHelp,
	versions: versionsCommandHelp,
	doctor: doctorCommandHelp,
	uninstall: uninstallCommandHelp,
};

/**
 * Get help definition for a specific command
 */
export function getCommandHelp(command: string): CommandHelp | undefined {
	return HELP_REGISTRY[command];
}

/**
 * Get list of all command names
 */
export function getAllCommands(): string[] {
	return Object.keys(HELP_REGISTRY);
}

/**
 * Check if a command exists in the registry
 */
export function hasCommand(command: string): boolean {
	return command in HELP_REGISTRY;
}
