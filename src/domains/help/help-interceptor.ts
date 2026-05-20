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
		maxExamples: 3,
		interactive: isTTY, // Enable interactive mode for TTY
		width,
		noColor,
	};
}

/**
 * Extract command chain from process.argv.
 * Returns up to 2 non-option tokens: [topLevelCommand, candidateSubcommand?].
 * Backward-compatible: single-token case still returns a 1-element array.
 * Returns empty array for global help (no matching top-level command).
 */
export function getCommandChainFromArgv(): string[] {
	// process.argv: ['node', 'ck', 'command', 'subcommand', '--help']
	const argv = process.argv.slice(2); // Remove 'node' and script path
	const tokens = argv.filter((arg) => !arg.startsWith("-"));

	const [first, second] = tokens;

	if (!first || !hasCommand(first)) {
		// No valid top-level command — global help or let CAC handle
		return [];
	}

	const chain: string[] = [first];

	// Capture a candidate subcommand token (may or may not exist in registry)
	if (second) {
		chain.push(second);
	}

	return chain;
}

/**
 * Main help handler - intercepts help requests and renders custom output
 * Note: args parameter is kept for API compatibility but we parse argv directly
 */
export async function handleHelp(_args: readonly string[]): Promise<void> {
	try {
		const options = getHelpOptions();
		const chain = getCommandChainFromArgv();

		let output: string;

		if (chain.length === 0) {
			// Global help: ck --help
			output = renderGlobalHelp(HELP_REGISTRY, options);
		} else {
			const [parentCmd, subCmd] = chain;
			const parentHelp = HELP_REGISTRY[parentCmd];

			// Attempt subcommand resolution: ck <parent> <sub> --help
			if (subCmd && parentHelp.subcommands) {
				const subHelp = parentHelp.subcommands.find((s) => s.name === subCmd);
				if (subHelp) {
					output = renderHelp(subHelp, {
						command: subCmd,
						globalHelp: false,
						options,
						parentName: parentCmd,
					});
					await displayHelp(output, options);
					process.exitCode = 0;
					return;
				}
			}

			// Fallback to parent help (unknown subcommand or no subcommands)
			output = renderHelp(parentHelp, {
				command: parentCmd,
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
