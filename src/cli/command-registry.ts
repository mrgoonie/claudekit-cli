/**
 * Command Registry
 *
 * Registers all CLI commands with their options and handlers.
 */

import type { cac } from "cac";
import { doctorCommand } from "../commands/doctor.js";
import { easterEggCommand } from "../commands/easter-egg.js";
import { initCommand } from "../commands/init.js";
import { newCommand } from "../commands/new/index.js";
import { skillCommand } from "../commands/skill/index.js";
import { uninstallCommand } from "../commands/uninstall/index.js";
import { updateCliCommand } from "../commands/update-cli.js";
import { versionCommand } from "../commands/version.js";
import { logger } from "../shared/logger.js";

/**
 * Register all CLI commands
 */
export function registerCommands(cli: ReturnType<typeof cac>): void {
	// New command
	cli
		.command("new", "Bootstrap a new ClaudeKit project (with interactive version selection)")
		.option("--dir <dir>", "Target directory (default: .)")
		.option("--kit <kit>", "Kit to use: engineer, marketing, all, or comma-separated")
		.option(
			"-r, --release <version>",
			"Skip version selection, use specific version (e.g., latest, v1.0.0)",
		)
		.option("--force", "Overwrite existing files without confirmation")
		.option(
			"--exclude <pattern>",
			"Exclude files matching glob pattern (can be used multiple times)",
		)
		.option("--opencode", "Install OpenCode CLI package (non-interactive mode)")
		.option("--gemini", "Install Google Gemini CLI package (non-interactive mode)")
		.option("--install-skills", "Install skills dependencies (non-interactive mode)")
		.option("--with-sudo", "Include system packages requiring sudo (Linux: ffmpeg, imagemagick)")
		.option(
			"--prefix",
			"Add /ck: prefix to all slash commands by moving them to commands/ck/ subdirectory",
		)
		.option("--beta", "Show beta versions in selection prompt")
		.option("--refresh", "Bypass release cache to fetch latest versions from GitHub")
		.option("--docs-dir <name>", "Custom docs folder name (default: docs)")
		.option("--plans-dir <name>", "Custom plans folder name (default: plans)")
		.option("-y, --yes", "Non-interactive mode with sensible defaults (skip all prompts)")
		.option("--use-git", "Use git clone instead of GitHub API (uses SSH/HTTPS credentials)")
		.option("--archive <path>", "Use local archive file instead of downloading (zip/tar.gz)")
		.option("--kit-path <path>", "Use local kit directory instead of downloading")
		.action(async (options) => {
			// Normalize exclude to always be an array (CAC may pass string for single value)
			if (options.exclude && !Array.isArray(options.exclude)) {
				options.exclude = [options.exclude];
			}
			await newCommand(options);
		});

	// Init command (for initializing/updating ClaudeKit projects)
	cli
		.command("init", "Initialize or update ClaudeKit project (with interactive version selection)")
		.option("--dir <dir>", "Target directory (default: .)")
		.option("--kit <kit>", "Kit to use: engineer, marketing, all, or comma-separated")
		.option(
			"-r, --release <version>",
			"Skip version selection, use specific version (e.g., latest, v1.0.0)",
		)
		.option(
			"--exclude <pattern>",
			"Exclude files matching glob pattern (can be used multiple times)",
		)
		.option(
			"--only <pattern>",
			"Include only files matching glob pattern (can be used multiple times)",
		)
		.option("-g, --global", "Use platform-specific user configuration directory")
		.option(
			"--fresh",
			"Completely remove .claude directory before downloading (requires confirmation)",
		)
		.option("--install-skills", "Install skills dependencies (non-interactive mode)")
		.option("--with-sudo", "Include system packages requiring sudo (Linux: ffmpeg, imagemagick)")
		.option(
			"--prefix",
			"Add /ck: prefix to all slash commands by moving them to commands/ck/ subdirectory",
		)
		.option("--beta", "Show beta versions in selection prompt")
		.option("--refresh", "Bypass release cache to fetch latest versions from GitHub")
		.option("--dry-run", "Preview changes without applying them (requires --prefix)")
		.option(
			"--force-overwrite",
			"Override ownership protections and delete user-modified files (requires --prefix)",
		)
		.option(
			"--force-overwrite-settings",
			"Fully replace settings.json instead of selective merge (destroys user customizations)",
		)
		.option("--skip-setup", "Skip interactive configuration wizard")
		.option("--docs-dir <name>", "Custom docs folder name (default: docs)")
		.option("--plans-dir <name>", "Custom plans folder name (default: plans)")
		.option("-y, --yes", "Non-interactive mode with sensible defaults (skip all prompts)")
		.option("--sync", "Sync config files from upstream with interactive hunk-by-hunk merge")
		.option("--use-git", "Use git clone instead of GitHub API (uses SSH/HTTPS credentials)")
		.option("--archive <path>", "Use local archive file instead of downloading (zip/tar.gz)")
		.option("--kit-path <path>", "Use local kit directory instead of downloading")
		.action(async (options) => {
			// Normalize exclude and only to always be arrays (CAC may pass string for single value)
			if (options.exclude && !Array.isArray(options.exclude)) {
				options.exclude = [options.exclude];
			}
			if (options.only && !Array.isArray(options.only)) {
				options.only = [options.only];
			}
			await initCommand(options);
		});

	// Update command (for updating the CLI itself)
	cli
		.command("update", "Update ClaudeKit CLI to the latest version")
		.option("-r, --release <version>", "Update to a specific version")
		.option("--check", "Check for updates without installing")
		.option("-y, --yes", "Non-interactive mode with sensible defaults (skip all prompts)")
		.option("-d, --dev", "Update to the latest dev version")
		.option("--beta", "Alias for --dev (deprecated)")
		.option("--registry <url>", "Custom npm registry URL")
		.option("--kit <kit>", "[DEPRECATED] Use 'ck init --kit <kit>' instead")
		.option("-g, --global", "[DEPRECATED] Use 'ck init --global' instead")
		.action(async (options) => {
			// Grace handling for deprecated --kit and --global usage
			if (options.kit || options.global) {
				console.log();
				const deprecatedFlags = [options.kit && "--kit", options.global && "--global"]
					.filter(Boolean)
					.join(" and ");
				logger.warning(
					`The ${deprecatedFlags} option${options.kit && options.global ? "s are" : " is"} no longer supported with 'ck update'`,
				);
				console.log();
				console.log("  'ck update' now only updates the ClaudeKit CLI itself.");
				console.log();
				console.log("  To update a kit installation, use:");
				// Build the suggested command
				const suggestedCmd = ["ck init"];
				if (options.kit) suggestedCmd.push(`--kit ${options.kit}`);
				if (options.global) suggestedCmd.push("--global");
				console.log(`    ${suggestedCmd.join(" ")}`);
				console.log();
				process.exit(0);
			}

			try {
				await updateCliCommand(options);
			} catch (error) {
				// Error already logged by updateCliCommand
				process.exit(1);
			}
		});

	// Versions command
	cli
		.command("versions", "List available versions of ClaudeKit repositories")
		.option("--kit <kit>", "Filter by specific kit (engineer, marketing)")
		.option("--limit <limit>", "Number of releases to show (default: 30)")
		.option("--all", "Show all releases including prereleases")
		.action(async (options) => {
			await versionCommand(options);
		});

	// Doctor command
	cli
		.command("doctor", "Comprehensive health check for ClaudeKit")
		.option("--report", "Generate shareable diagnostic report")
		.option("--fix", "Auto-fix all fixable issues")
		.option("--check-only", "CI mode: no prompts, exit 1 on failures")
		.option("--json", "Output JSON format")
		.option("--full", "Include extended priority checks (slower)")
		.action(async (options) => {
			await doctorCommand(options);
		});

	// Uninstall command
	cli
		.command("uninstall", "Remove ClaudeKit installations")
		.option("-y, --yes", "Non-interactive mode with sensible defaults (skip all prompts)")
		.option("-l, --local", "Uninstall only local installation (current project)")
		.option("-g, --global", "Uninstall only global installation (~/.claude/)")
		.option("-A, --all", "Uninstall from both local and global locations")
		.option("-k, --kit <type>", "Uninstall specific kit only (engineer, marketing)")
		.option("--dry-run", "Preview what would be removed without deleting")
		.option("--force-overwrite", "Delete even user-modified files (requires confirmation)")
		.action(async (options) => {
			await uninstallCommand(options);
		});

	// Easter Egg command (Code Hunt 2025)
	cli
		.command("easter-egg", "🥚 Roll for a random discount code (Code Hunt 2025)")
		.action(async () => {
			await easterEggCommand();
		});

	// Skill command - install skills to other coding agents
	cli
		.command("skill", "Install ClaudeKit skills to other coding agents")
		.option("-n, --name <skill>", "Skill name to install")
		.option("-a, --agent <agents...>", "Target agents (claude-code, cursor, codex, etc.)")
		.option("-g, --global", "Install globally instead of project-level")
		.option("-l, --list", "List available skills without installing")
		.option("--all", "Install to all supported agents")
		.option("-y, --yes", "Skip confirmation prompts")
		.action(async (options) => {
			// Normalize agent to always be an array
			if (options.agent && !Array.isArray(options.agent)) {
				options.agent = [options.agent];
			}
			await skillCommand(options);
		});
}
