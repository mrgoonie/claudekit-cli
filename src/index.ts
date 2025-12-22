#!/usr/bin/env bun

// Suppress Buffer() deprecation warning from yauzl library (DEP0005)
// Must be set before any imports that might trigger it
process.on("warning", (warning: Error & { code?: string }) => {
	if (warning.name === "DeprecationWarning" && warning.code === "DEP0005") {
		return; // Silently ignore yauzl's Buffer() deprecation
	}
	console.error(warning.toString());
});

import { createCliInstance, registerGlobalFlags } from "./cli/cli-config.js";
import { registerCommands } from "./cli/command-registry.js";
import { displayVersion, getPackageVersion } from "./cli/version-display.js";
import { logger } from "./shared/logger.js";
import { output } from "./shared/output-manager.js";

// Set proper output encoding to prevent unicode rendering issues
if (process.stdout.setEncoding) {
	process.stdout.setEncoding("utf8");
}
if (process.stderr.setEncoding) {
	process.stderr.setEncoding("utf8");
}

const cli = createCliInstance();
registerCommands(cli);
registerGlobalFlags(cli);

// Parse to get global options first
const parsed = cli.parse(process.argv, { run: false });

// Main execution wrapped in async IIFE to allow early returns
// This prevents libuv assertion failures on Windows (Node.js 23.x/24.x/25.x)
// See: https://github.com/nodejs/node/issues/56645
(async () => {
	try {
		// If version was requested, show custom version info and exit
		if (parsed.options.version) {
			await displayVersion();
			process.exitCode = 0;
			return;
		}

		// If help was requested OR no command provided, show custom help
		// Note: cli.matchedCommand is set when a valid command is parsed
		if (parsed.options.help || (!cli.matchedCommand && parsed.args.length === 0)) {
			const { handleHelp } = await import("./domains/help/help-interceptor.js");
			await handleHelp(parsed.args);
			// handleHelp sets process.exitCode = 0
			return;
		}

		// Check environment variable
		const envVerbose =
			process.env.CLAUDEKIT_VERBOSE === "1" || process.env.CLAUDEKIT_VERBOSE === "true";

		// Enable verbose if flag or env var is set
		const isVerbose = parsed.options.verbose || envVerbose;
		const isJson = parsed.options.json || false;

		// Configure output manager
		output.configure({
			verbose: isVerbose,
			json: isJson,
		});

		if (isVerbose) {
			logger.setVerbose(true);
		}

		// Set log file if specified
		if (parsed.options.logFile) {
			logger.setLogFile(parsed.options.logFile);
		}

		// Log startup info in verbose mode
		logger.verbose("ClaudeKit CLI starting", {
			version: getPackageVersion(),
			command: parsed.args[0] || "none",
			options: parsed.options,
			cwd: process.cwd(),
			node: process.version,
		});

		// Run the matched command and await completion
		await cli.runMatchedCommand();

		// Flush JSON buffer before exit (critical for --json flag to work)
		if (output.isJson()) {
			await output.flushJson();
		}
	} catch (error) {
		// Ensure proper exit code on unhandled errors
		console.error("CLI error:", error instanceof Error ? error.message : error);
		process.exitCode = 1;

		// Still flush JSON buffer on error (may contain partial progress)
		if (output.isJson()) {
			await output.flushJson();
		}
	}
})().catch(async (error) => {
	// Catch any unhandled promise rejections from the async IIFE
	console.error("Unhandled error:", error instanceof Error ? error.message : error);
	process.exitCode = 1;

	// Final fallback: flush JSON buffer on unhandled errors
	if (output.isJson()) {
		await output.flushJson();
	}
});
