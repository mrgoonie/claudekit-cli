/**
 * Help Interceptor Module
 *
 * Intercepts --help flag before CAC processes it,
 * routes to custom help renderer with proper context.
 */

import { HELP_REGISTRY, hasCommand } from "./help-commands.js";
import { displayHelp } from "./help-interactive.js";
import { DEFAULT_HELP_OPTIONS, renderGlobalHelp, renderHelp } from "./help-renderer.js";
import type { HelpOptions } from "./help-types.js";

/**
 * Detect terminal environment and configure help options
 */
function getHelpOptions(): HelpOptions {
	const isTTY = process.stdout.isTTY ?? false;
	const width = process.stdout.columns || 80;
	const noColor = process.env.NO_COLOR !== undefined || !isTTY;

	return {
		...DEFAULT_HELP_OPTIONS,
		showBanner: isTTY, // Hide banner in pipes/CI
		showExamples: true,
		maxExamples: 2,
		interactive: isTTY, // Enable interactive mode for TTY
		width,
		noColor,
	};
}

/**
 * Extract command name from process.argv
 * CAC args may be empty when command is matched, so we parse argv directly
 * Returns null for global help or invalid commands
 */
function getCommandFromArgv(): string | null {
	// process.argv: ['node', 'ck', 'command', '--help']
	// Find first non-option argument after the script name
	const argv = process.argv.slice(2); // Remove 'node' and script path

	for (const arg of argv) {
		// Skip options (start with -)
		if (arg.startsWith("-")) {
			continue;
		}
		// Found a potential command
		if (hasCommand(arg)) {
			return arg;
		}
		// Invalid command - return null to show global help or let CAC handle
		return null;
	}

	// No command found - global help
	return null;
}

/**
 * Main help handler - intercepts help requests and renders custom output
 * Note: args parameter is kept for API compatibility but we parse argv directly
 */
export async function handleHelp(_args: readonly string[]): Promise<void> {
	try {
		const options = getHelpOptions();
		const command = getCommandFromArgv();

		let output: string;

		if (command === null) {
			// Global help: ck --help
			output = renderGlobalHelp(HELP_REGISTRY, options);
		} else {
			// Command help: ck <command> --help
			const help = HELP_REGISTRY[command];
			output = renderHelp(help, {
				command,
				globalHelp: false,
				options,
			});
		}

		// Display with optional paging for long content
		await displayHelp(output, options);
	} catch (error) {
		// Fallback: show error but let CAC handle default help
		console.error("Error rendering help:", error);
		return; // Don't exit, let CAC show default help
	}

	// Exit cleanly to prevent CAC from showing default help
	// Use exitCode instead of exit() to allow proper handle cleanup on Windows
	// See: https://github.com/nodejs/node/issues/56645
	process.exitCode = 0;
}

/**
 * Check if help flag was requested
 * Used for early detection before full parsing
 */
export function isHelpRequested(argv: readonly string[]): boolean {
	return argv.includes("--help") || argv.includes("-h");
}
