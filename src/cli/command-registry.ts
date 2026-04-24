/**
 * Command Registry
 *
 * Registers all CLI commands with their options and handlers.
 */

import type { cac } from "cac";
import { agentsCommand } from "../commands/agents/index.js";
import { apiCommand } from "../commands/api/index.js";
import { registerAppCommand } from "../commands/app/index.js";
import { registerBackupsCommand } from "../commands/backups/index.js";
import { commandsCommand } from "../commands/commands/index.js";
import { configCommand } from "../commands/config/index.js";
import { doctorCommand } from "../commands/doctor.js";
import { easterEggCommand } from "../commands/easter-egg.js";
import { initCommand } from "../commands/init.js";
import { migrateCommand } from "../commands/migrate/index.js";
import { newCommand } from "../commands/new/index.js";
import { planCommand } from "../commands/plan/index.js";
import { registerProjectsCommand } from "../commands/projects/index.js";
import { setupCommand } from "../commands/setup/index.js";
import { skillsCommand } from "../commands/skills/index.js";
import { uninstallCommand } from "../commands/uninstall/index.js";
import { updateCliCommand } from "../commands/update-cli.js";
import { versionCommand } from "../commands/version.js";
import { watchCommand } from "../commands/watch/index.js";
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
			"Full reset: remove CK files, replace settings.json and CLAUDE.md, reinstall from scratch",
		)
		.option(
			"--force",
			"Force reinstall even if already at latest version (use with --yes; re-onboards missing files without full reset)",
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

	// Backups command
	registerBackupsCommand(cli);

	// Desktop app launcher command
	registerAppCommand(cli);

	// Easter Egg command (Code Hunt 2025)
	cli
		.command("easter-egg", "🥚 Roll for a random discount code (Code Hunt 2025)")
		.action(async () => {
			await easterEggCommand();
		});

	// Content command — multi-channel content automation engine
	cli
		.command(
			"content [action] [id]",
			"Multi-channel content automation (start|stop|status|logs|setup|queue|approve|reject)",
		)
		.option("--dry-run", "Generate content without publishing")
		.option("--verbose", "Enable verbose logging")
		.option("--force", "Kill existing process and start fresh")
		.option("--tail", "Follow log output (for logs action)")
		.option("--reason <reason>", "Rejection reason (for reject action)")
		.action(
			async (
				action: string | undefined,
				id: string | undefined,
				options: Record<string, unknown>,
			) => {
				const content = await import("@/commands/content/index.js");
				switch (action) {
					case "start":
					case undefined:
						await content.startContent(options);
						break;
					case "stop":
						await content.stopContent();
						break;
					case "status":
						await content.statusContent();
						break;
					case "logs":
						await content.logsContent(options);
						break;
					case "setup":
						await content.setupContent();
						break;
					case "queue":
						await content.queueContent();
						break;
					case "approve":
						if (!id) {
							console.error("Usage: ck content approve <id>");
							return;
						}
						await content.approveContentCmd(id);
						break;
					case "reject":
						if (!id) {
							console.error("Usage: ck content reject <id>");
							return;
						}
						await content.rejectContentCmd(id, options.reason as string | undefined);
						break;
					default:
						console.error(
							`Unknown action: ${action}. Available: start, stop, status, logs, setup, queue, approve, reject`,
						);
				}
			},
		);

	// Config command with subcommands
	cli
		.command("config [action] [key] [value]", "Manage ClaudeKit configuration")
		.option("-g, --global", "Use global config (~/.claudekit/config.json)")
		.option("-l, --local", "Use local config (.claude/.ck.json)")
		.option("--json", "Output in JSON format")
		.option("--port <port>", "Port for UI server (default: auto)")
		.option("--host <host>", "Bind dashboard host (default: 127.0.0.1)")
		.option("--no-open", "Don't auto-open browser")
		.option("--dev", "Run UI in development mode with HMR")
		.action(async (action, key, value, options) => {
			await configCommand(action, key, value, options);
		});

	// Projects command with subcommands
	registerProjectsCommand(cli);

	// Setup command
	cli
		.command("setup", "Configure API keys and optional packages")
		.option("--global", "Configure globally (~/.claude/)")
		.option("--skip-packages", "Skip optional package installation")
		.option("--dir <dir>", "Target directory (default: current directory)")
		.action(async (options) => {
			await setupCommand(options);
		});

	// Skill command - install skills to other coding agents
	cli
		.command("skills", "Install ClaudeKit skills to other coding agents")
		.option("-n, --name <skill>", "Skill name to install/uninstall")
		.option("-a, --agent <agents...>", "Target agents (claude-code, cursor, codex, etc.)")
		.option("-g, --global", "Install/uninstall globally instead of project-level")
		.option("-l, --list", "List available skills")
		.option("--installed", "Show installed skills (use with --list)")
		.option("--all", "Install to all supported agents")
		.option("-u, --uninstall", "Uninstall skill(s)")
		.option("--force", "Force uninstall even if not in registry")
		.option("--sync", "Sync registry with filesystem (remove orphans)")
		.option("-y, --yes", "Skip confirmation prompts")
		.option("--catalog", "Show skill catalog stats")
		.option("--regenerate", "Force regenerate catalog (use with --catalog)")
		.option("--search <query>", "BM25 full-text search over skill catalog")
		.option("--json", "Output search results as JSON (use with --search)")
		.option("--limit <n>", "Max search results, default 10 (use with --search)")
		.option("--validate", "Validate SKILL.md frontmatter fields")
		.action(async (options) => {
			// Normalize agent to always be an array
			if (options.agent && !Array.isArray(options.agent)) {
				options.agent = [options.agent];
			}
			// Normalize limit to number
			if (options.limit !== undefined) {
				options.limit = Number(options.limit);
			}
			await skillsCommand(options);
		});

	// Agents command - install agents to other coding providers
	cli
		.command("agents", "Install Claude Code agents to other coding providers")
		.option("-n, --name <agent>", "Agent name to install/uninstall")
		.option("-a, --agent <agents...>", "Target providers (opencode, cursor, codex, etc.)")
		.option("-g, --global", "Install/uninstall globally instead of project-level")
		.option("-l, --list", "List available agents")
		.option("--installed", "Show installed agents (use with --list)")
		.option("--all", "Install to all supported providers")
		.option("-u, --uninstall", "Uninstall agent(s)")
		.option("--force", "Force uninstall even if not in registry")
		.option("--sync", "Sync registry with filesystem (remove orphans)")
		.option("-y, --yes", "Skip confirmation prompts")
		.action(async (options) => {
			if (options.agent && !Array.isArray(options.agent)) {
				options.agent = [options.agent];
			}
			await agentsCommand(options);
		});

	// Commands command - install commands to other coding providers
	cli
		.command("commands", "Install Claude Code commands to other coding providers")
		.option("-n, --name <command>", "Command name to install/uninstall")
		.option("-a, --agent <agents...>", "Target providers (opencode, codex, gemini-cli, etc.)")
		.option("-g, --global", "Install/uninstall globally instead of project-level")
		.option("-l, --list", "List available commands")
		.option("--installed", "Show installed commands (use with --list)")
		.option("--all", "Install to all supported providers")
		.option("-u, --uninstall", "Uninstall command(s)")
		.option("--force", "Force uninstall even if not in registry")
		.option("--sync", "Sync registry with filesystem (remove orphans)")
		.option("-y, --yes", "Skip confirmation prompts")
		.action(async (options) => {
			if (options.agent && !Array.isArray(options.agent)) {
				options.agent = [options.agent];
			}
			await commandsCommand(options);
		});

	// Plan command - parse, validate, status, kanban, create, check, uncheck, add-phase
	cli
		.command(
			"plan [action] [target]",
			"Plan management: parse, validate, status, kanban, create, check, uncheck, add-phase",
		)
		.option("--json", "Output in JSON format")
		.option("--strict", "Strict validation mode")
		.option("--port <port>", "Port for kanban dashboard")
		.option("--no-open", "Don't auto-open browser")
		.option("--dev", "Development mode for dashboard")
		.option("-g, --global", "Use global plans scope (~/.claude/plans or configured global root)")
		.option("--title <title>", "Plan title (for create)")
		.option("--phases <phases>", "Comma-separated phase names (for create)")
		.option("--dir <dir>", "Plan directory (for create)")
		.option("--priority <priority>", "Priority: P1, P2, P3 (for create)")
		.option("--issue <issue>", "GitHub issue number (for create)")
		.option("--after <after>", "Insert after phase ID (for add-phase)")
		.option("--start", "Mark as in-progress instead of completed (for check)")
		.option("--source <source>", "Creation source: skill | cli | dashboard (for create)")
		.option("--session-id <id>", "Claude session ID for tracking (for create)")
		.action(async (action, target, options) => {
			await planCommand(action, target, options);
		});

	// API command - interact with ClaudeKit.cc services
	cli
		.command("api [action] [service] [path]", "Interact with ClaudeKit API and proxy services")
		.option("--method <method>", "HTTP method for proxy requests (default: GET)")
		.option("--body <json>", "Request body as JSON string (proxy only)")
		.option("--query <json>", "Query params as JSON string (proxy only)")
		.option("--key <key>", "API key to use (setup only)")
		.option("--force", "Force re-setup even if key exists (setup only)")
		.option("--json", "Output raw JSON instead of formatted display")
		.option("--locale <locale>", "Locale for vidcap summary/caption (default: en)")
		.option("--max-results <n>", "Max results for vidcap search")
		.option("--second <s>", "Timestamp in seconds for vidcap screenshot")
		.option("--order <order>", "Sort order for vidcap comments (time/relevance)")
		.option("--format <fmt>", "Summary format for reviewweb (bullet/paragraph)")
		.option("--max-length <n>", "Max summary length for reviewweb")
		.option("--instructions <text>", "Extraction instructions for reviewweb extract")
		.option("--template <json>", "JSON template for reviewweb extract")
		.option("--type <type>", "Link type filter for reviewweb links (web/image/file/all)")
		.option("--country <code>", "Country code for reviewweb SEO commands")
		.action(async (action, service, path, options) => {
			await apiCommand(action, service, path, options);
		});

	// Migrate command - one-shot migration of agents, commands, skills, config, rules, and hooks
	cli
		.command(
			"migrate",
			"Migrate agents, commands, skills, config, rules, and hooks to other providers",
		)
		.option("-a, --agent <agents...>", "Target providers (cursor, codex, droid, opencode, etc.)")
		.option("-g, --global", "Install globally instead of project-level")
		.option("--all", "Migrate to all supported providers")
		.option("-y, --yes", "Skip confirmation prompts")
		.option("--config", "Migrate CLAUDE.md config only")
		.option("--rules", "Migrate .claude/rules/ only")
		.option("--hooks", "Migrate .claude/hooks/ only")
		.option("--skip-config", "Skip config migration")
		.option("--skip-rules", "Skip rules migration")
		.option("--skip-hooks", "Skip hooks migration")
		.option(
			"--source <path>",
			"Custom CLAUDE.md source path (config only, not agents/commands/skills/hooks)",
		)
		.option("--dry-run", "Preview migration targets without writing files")
		.option("-f, --force", "Force reinstall deleted/edited items")
		// Mode flags (P5 — smart default: unknown checksums → install, valid registry → reconcile)
		.option("--install", "Opt-in install picker mode (select specific items to install)")
		.option("--reconcile", "Force reconcile mode (current default when registry is valid)")
		.option(
			"--reinstall-empty-dirs",
			"Reinstall all items when their type directory is empty (default: true)",
		)
		.option(
			"--respect-deletions",
			"Preserve deletion even when type directory is empty (disables reinstall-empty-dirs)",
		)
		.action(async (options) => {
			if (options.agent && !Array.isArray(options.agent)) {
				options.agent = [options.agent];
			}
			await migrateCommand(options);
		});

	// Watch command — GitHub issues auto-responder
	cli
		.command("watch", "Watch GitHub issues and auto-respond with AI analysis")
		.option("--interval <ms>", "Poll interval in milliseconds (default: 30000)")
		.option("--dry-run", "Detect issues without posting responses")
		.option("--force", "Kill existing watch process and start fresh")
		.option("--verbose", "Enable verbose logging")
		.action(async (options) => {
			await watchCommand(options);
		});
}
