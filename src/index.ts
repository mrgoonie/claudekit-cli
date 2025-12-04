#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cac } from "cac";
import packageInfo from "../package.json" assert { type: "json" };
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { updateCliCommand } from "./commands/update-cli.js";
import { versionCommand } from "./commands/version.js";
import { CliVersionChecker, VersionChecker } from "./lib/version-checker.js";
import { MetadataSchema } from "./types.js";
import { logger } from "./utils/logger.js";
import { PathResolver } from "./utils/path-resolver.js";

// Set proper output encoding to prevent unicode rendering issues
if (process.stdout.setEncoding) {
	process.stdout.setEncoding("utf8");
}
if (process.stderr.setEncoding) {
	process.stderr.setEncoding("utf8");
}

const packageVersion = packageInfo.version;

/**
 * Display version information
 * Shows CLI version, Local Kit version, and Global Kit version (if they exist)
 */
async function displayVersion() {
	console.log(`CLI Version: ${packageVersion}`);

	let foundAnyKit = false;
	let localKitVersion: string | null = null;
	let isGlobalOnlyKit = false; // Track if only global kit exists (no local)

	// Determine paths
	const globalKitDir = PathResolver.getGlobalKitDir();
	const globalMetadataPath = join(globalKitDir, "metadata.json");
	const prefix = PathResolver.getPathPrefix(false); // Local mode check
	const localMetadataPath = prefix
		? join(process.cwd(), prefix, "metadata.json")
		: join(process.cwd(), "metadata.json");

	// Check if local path is actually the global path (e.g., when cwd is ~)
	const isLocalSameAsGlobal = localMetadataPath === globalMetadataPath;

	// Check local project kit version (skip if it's the same as global)
	if (!isLocalSameAsGlobal && existsSync(localMetadataPath)) {
		try {
			const rawMetadata = JSON.parse(readFileSync(localMetadataPath, "utf-8"));
			const metadata = MetadataSchema.parse(rawMetadata);

			if (metadata.version) {
				const kitName = metadata.name || "ClaudeKit";
				console.log(`Local Kit Version: ${metadata.version} (${kitName})`);
				localKitVersion = metadata.version;
				foundAnyKit = true;
			}
		} catch (error) {
			// Log to verbose if metadata is invalid
			logger.verbose("Failed to parse local metadata.json", { error });
		}
	}

	// Check global kit installation
	if (existsSync(globalMetadataPath)) {
		try {
			const rawMetadata = JSON.parse(readFileSync(globalMetadataPath, "utf-8"));
			const metadata = MetadataSchema.parse(rawMetadata);

			if (metadata.version) {
				const kitName = metadata.name || "ClaudeKit";
				console.log(`Global Kit Version: ${metadata.version} (${kitName})`);
				// Use global version if no local version found
				if (!localKitVersion) {
					localKitVersion = metadata.version;
					isGlobalOnlyKit = true; // Only global kit found, no local
				}
				foundAnyKit = true;
			}
		} catch (error) {
			// Log to verbose if metadata is invalid
			logger.verbose("Failed to parse global metadata.json", { error });
		}
	}

	// Show message if no kits found
	if (!foundAnyKit) {
		console.log("No ClaudeKit installation found");
	}

	// Check for CLI updates (non-blocking)
	try {
		const cliUpdateCheck = await CliVersionChecker.check(packageVersion);
		if (cliUpdateCheck?.updateAvailable) {
			CliVersionChecker.displayNotification(cliUpdateCheck);
		}
	} catch (error) {
		// Silent failure - don't block version display
		logger.debug(`CLI version check failed: ${error}`);
	}

	// Check for kit updates (non-blocking)
	if (localKitVersion) {
		try {
			const updateCheck = await VersionChecker.check(localKitVersion);
			if (updateCheck?.updateAvailable) {
				VersionChecker.displayNotification(updateCheck, { isGlobal: isGlobalOnlyKit });
			}
		} catch (error) {
			// Silent failure - don't block version display
			logger.debug(`Kit version check failed: ${error}`);
		}
	}
}

const cli = cac("ck");

// Global options
cli.option("--verbose", "Enable verbose logging for debugging");
cli.option("--log-file <path>", "Write logs to file");

// New command
cli
	.command("new", "Bootstrap a new ClaudeKit project (with interactive version selection)")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option(
		"-r, --release <version>",
		"Skip version selection, use specific version (e.g., latest, v1.0.0)",
	)
	.option("--force", "Overwrite existing files without confirmation")
	.option("--exclude <pattern>", "Exclude files matching glob pattern (can be used multiple times)")
	.option("--opencode", "Install OpenCode CLI package (non-interactive mode)")
	.option("--gemini", "Install Google Gemini CLI package (non-interactive mode)")
	.option("--install-skills", "Install skills dependencies (non-interactive mode)")
	.option(
		"--prefix",
		"Add /ck: prefix to all slash commands by moving them to commands/ck/ subdirectory",
	)
	.option("--beta", "Show beta versions in selection prompt")
	.option("--refresh", "Bypass release cache to fetch latest versions from GitHub")
	.option("--docs-dir <name>", "Custom docs folder name (default: docs)")
	.option("--plans-dir <name>", "Custom plans folder name (default: plans)")
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
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option(
		"-r, --release <version>",
		"Skip version selection, use specific version (e.g., latest, v1.0.0)",
	)
	.option("--exclude <pattern>", "Exclude files matching glob pattern (can be used multiple times)")
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
	.option("--skip-setup", "Skip interactive configuration wizard")
	.option("--docs-dir <name>", "Custom docs folder name (default: docs)")
	.option("--plans-dir <name>", "Custom plans folder name (default: plans)")
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
	.option("-y, --yes", "Skip confirmation prompt")
	.option("--beta", "Update to the latest beta version")
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
	.action(async (options) => {
		await doctorCommand(options);
	});

// Uninstall command
cli
	.command("uninstall", "Remove ClaudeKit installations")
	.option("-y, --yes", "Skip confirmation prompt")
	.option("-l, --local", "Uninstall only local installation (current project)")
	.option("-g, --global", "Uninstall only global installation (~/.claude/)")
	.option("-A, --all", "Uninstall from both local and global locations")
	.option("--dry-run", "Preview what would be removed without deleting")
	.option("--force-overwrite", "Delete even user-modified files (requires confirmation)")
	.action(async (options) => {
		await uninstallCommand(options);
	});

// Register version and help flags manually (without CAC's built-in handlers)
cli.option("-V, --version", "Display version number");
cli.option("-h, --help", "Display help information");

// Parse to get global options first
const parsed = cli.parse(process.argv, { run: false });

// If version was requested, show custom version info and exit
if (parsed.options.version) {
	await displayVersion();
	process.exit(0);
}

// If help was requested OR no command provided, show custom help
// Note: cli.matchedCommand is set when a valid command is parsed
if (parsed.options.help || (!cli.matchedCommand && parsed.args.length === 0)) {
	const { handleHelp } = await import("./lib/help/help-interceptor.js");
	await handleHelp(parsed.args);
	// handleHelp calls process.exit(0)
}

// Check environment variable
const envVerbose =
	process.env.CLAUDEKIT_VERBOSE === "1" || process.env.CLAUDEKIT_VERBOSE === "true";

// Enable verbose if flag or env var is set
const isVerbose = parsed.options.verbose || envVerbose;

if (isVerbose) {
	logger.setVerbose(true);
}

// Set log file if specified
if (parsed.options.logFile) {
	logger.setLogFile(parsed.options.logFile);
}

// Log startup info in verbose mode
logger.verbose("ClaudeKit CLI starting", {
	version: packageVersion,
	command: parsed.args[0] || "none",
	options: parsed.options,
	cwd: process.cwd(),
	node: process.version,
});

// Parse again to run the command
cli.parse();
