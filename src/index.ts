#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cac } from "cac";
import packageInfo from "../package.json" assert { type: "json" };
import { diagnoseCommand } from "./commands/diagnose.js";
import { doctorCommand } from "./commands/doctor.js";
import { newCommand } from "./commands/new.js";
import { updateCommand } from "./commands/update.js";
import { versionCommand } from "./commands/version.js";
import { VersionChecker } from "./lib/version-checker.js";
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

	// Check local project kit version
	const localMetadataPath = join(process.cwd(), ".claude", "metadata.json");
	if (existsSync(localMetadataPath)) {
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
	const globalKitDir = PathResolver.getGlobalKitDir();
	const globalMetadataPath = join(globalKitDir, "metadata.json");
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

	// Check for updates (non-blocking)
	if (localKitVersion) {
		try {
			const updateCheck = await VersionChecker.check(localKitVersion);
			if (updateCheck?.updateAvailable) {
				VersionChecker.displayNotification(updateCheck);
			}
		} catch (error) {
			// Silent failure - don't block version display
			logger.debug(`Version check failed: ${error}`);
		}
	}
}

const cli = cac("ck");

// Global options
cli.option("--verbose", "Enable verbose logging for debugging");
cli.option("--log-file <path>", "Write logs to file");

// New command
cli
	.command("new", "Bootstrap a new ClaudeKit project")
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
	.option("--force", "Overwrite existing files without confirmation")
	.option("--exclude <pattern>", "Exclude files matching glob pattern (can be used multiple times)")
	.option("--opencode", "Install OpenCode CLI package (non-interactive mode)")
	.option("--gemini", "Install Google Gemini CLI package (non-interactive mode)")
	.option(
		"--prefix",
		"Add /ck: prefix to all slash commands by moving them to commands/ck/ subdirectory",
	)
	.action(async (options) => {
		// Normalize exclude to always be an array (CAC may pass string for single value)
		if (options.exclude && !Array.isArray(options.exclude)) {
			options.exclude = [options.exclude];
		}
		await newCommand(options);
	});

// Init command (renamed from update)
cli
	.command("init", "Initialize or update ClaudeKit project")
	.alias("update") // Deprecated alias for backward compatibility
	.option("--dir <dir>", "Target directory (default: .)")
	.option("--kit <kit>", "Kit to use (engineer, marketing)")
	.option("--version <version>", "Specific version to download (default: latest)")
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
	.option(
		"--prefix",
		"Add /ck: prefix to all slash commands by moving them to commands/ck/ subdirectory",
	)
	.action(async (options) => {
		// Check if deprecated 'update' alias was used
		// Filter out flags to get actual command name
		const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
		if (args[0] === "update") {
			logger.warning("Warning: 'update' command is deprecated. Please use 'init' instead.");
		}

		// Normalize exclude and only to always be arrays (CAC may pass string for single value)
		if (options.exclude && !Array.isArray(options.exclude)) {
			options.exclude = [options.exclude];
		}
		if (options.only && !Array.isArray(options.only)) {
			options.only = [options.only];
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

// Doctor command
cli.command("doctor", "Show current ClaudeKit setup and component overview").action(async () => {
	await doctorCommand();
});

// Register version and help flags manually (without CAC's built-in handlers)
cli.option("-V, --version", "Display version number");

// Help
cli.help();

// Parse to get global options first
const parsed = cli.parse(process.argv, { run: false });

// If version was requested, show custom version info and exit
if (parsed.options.version) {
	await displayVersion();
	process.exit(0);
}

// If help was requested, exit early (already handled by first parse)
// This prevents duplicate output from second parse
if (parsed.options.help) {
	process.exit(0);
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
