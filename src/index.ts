#!/usr/bin/env bun

import { cac } from "cac";
import { newCommand } from "./commands/new.js";
import { updateCommand } from "./commands/update.js";
import { versionCommand } from "./commands/version.js";
import { logger } from "./utils/logger.js";
import versionInfo from "./version.json" assert { type: "json" };

// Set proper output encoding to prevent unicode rendering issues
if (process.stdout.setEncoding) {
	process.stdout.setEncoding("utf8");
}
if (process.stderr.setEncoding) {
	process.stderr.setEncoding("utf8");
}

const packageVersion = versionInfo.version;

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
	.action(async (options) => {
		await newCommand(options);
	});

// Update command
cli
	.command("update", "Update existing ClaudeKit project")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
	.action(async (options) => {
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

// Version
cli.version(packageVersion);

// Help
cli.help();

// Parse to get global options first
const parsed = cli.parse(process.argv, { run: false });

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
