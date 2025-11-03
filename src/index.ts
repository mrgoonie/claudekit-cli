#!/usr/bin/env bun

import { cac } from "cac";
import packageInfo from "../package.json" assert { type: "json" };
import { diagnoseCommand } from "./commands/diagnose.js";
import { newCommand } from "./commands/new.js";
import { updateCommand } from "./commands/update.js";
import { versionCommand } from "./commands/version.js";
import { logger } from "./utils/logger.js";

// Set proper output encoding to prevent unicode rendering issues
if (process.stdout.setEncoding) {
	process.stdout.setEncoding("utf8");
}
if (process.stderr.setEncoding) {
	process.stderr.setEncoding("utf8");
}

const packageVersion = packageInfo.version;

const cli = cac("ck");

// Global options
cli.option("--verbose, -v", "Enable verbose logging for debugging");
cli.option("--log-file <path>", "Write logs to file");

// New command
cli
	.command("new", "Bootstrap a new ClaudeKit project")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
	.option("--force", "Overwrite existing files without confirmation")
	.option("--exclude <pattern>", "Exclude files matching glob pattern (can be used multiple times)")
	.action(async (options) => {
		// Normalize exclude to always be an array (CAC may pass string for single value)
		if (options.exclude && !Array.isArray(options.exclude)) {
			options.exclude = [options.exclude];
		}
		await newCommand(options);
	});

// Update command
cli
	.command("update", "Update existing ClaudeKit project")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
	.option("--exclude <pattern>", "Exclude files matching glob pattern (can be used multiple times)")
	.option("--global, -g", "Install ClaudeKit globally for system-wide access")
	.action(async (options) => {
		// Normalize exclude to always be an array (CAC may pass string for single value)
		if (options.exclude && !Array.isArray(options.exclude)) {
			options.exclude = [options.exclude];
		}
		await updateCommand(options);
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

// Diagnose command
cli
	.command("diagnose", "Run diagnostics to troubleshoot authentication and access issues")
	.option("--kit <kit>", "Check specific kit (engineer, marketing)")
	.action(async (options) => {
		await diagnoseCommand(options);
	});

// Version
cli.version(packageVersion);

// Help
cli.help();

// Parse and run the command
const parsed = cli.parse();

// Check environment variable for verbose (command line verbose is handled by CAC)
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

// Log startup info in verbose mode (after verbose is enabled)
logger.verbose("ClaudeKit CLI starting", {
	version: packageVersion,
	command: parsed.args[0] || "none",
	options: parsed.options,
	cwd: process.cwd(),
	node: process.version,
});
