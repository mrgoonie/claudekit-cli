/**
 * Help Interactive Mode
 *
 * Provides scrollable help viewer for long content.
 * Uses system pager (less/more) with fallback to basic pager.
 */

import { spawn } from "node:child_process";
import * as readline from "node:readline";
import { stripColors } from "./help-colors.js";
import type { HelpOptions } from "./help-types.js";

/**
 * Get terminal height in rows
 * Falls back to 24 rows if not available
 */
function getTerminalHeight(): number {
	return process.stdout.rows || 24;
}

/**
 * Get content height in lines (strips ANSI codes for accuracy)
 */
function getContentHeight(content: string): number {
	return stripColors(content).split("\n").length;
}

/**
 * Determine if paging should be used for the content
 *
 * Criteria:
 * - Interactive mode enabled
 * - Terminal is TTY
 * - Terminal width >= 80 cols
 * - Content height > terminal height - 2 (margin)
 */
export function shouldUsePager(content: string, options: HelpOptions): boolean {
	// Don't page if explicitly disabled
	if (!options.interactive) return false;

	// Don't page in non-TTY
	if (!process.stdout.isTTY) return false;

	// Don't page for narrow terminals
	if (options.width < 80) return false;

	// Only page if content exceeds terminal height
	const termHeight = getTerminalHeight();
	const contentHeight = getContentHeight(content);

	return contentHeight > termHeight - 2; // -2 for prompt margin
}

/**
 * Get pager arguments based on pager command
 */
function getPagerArgs(pagerCmd: string): string[] {
	if (pagerCmd.includes("less")) {
		return [
			"-R", // Raw color codes (preserve ANSI)
			"-F", // Quit if content fits screen
			"-X", // Don't clear screen on exit
		];
	}
	// more and other pagers: no special args
	return [];
}

/**
 * Try using system pager (less/more)
 * Returns true if pager succeeded, false otherwise
 */
async function trySystemPager(content: string): Promise<boolean> {
	return new Promise((resolve) => {
		const pagerCmd = process.env.PAGER || "less";
		const pagerArgs = getPagerArgs(pagerCmd);

		try {
			const pager = spawn(pagerCmd, pagerArgs, {
				stdio: ["pipe", process.stdout, process.stderr],
				shell: false,
			});

			// Timeout protection (30 seconds for user interaction)
			const timeout = setTimeout(() => {
				pager.kill();
				resolve(false);
			}, 30000);

			pager.stdin.write(content);
			pager.stdin.end();

			pager.on("close", (code) => {
				clearTimeout(timeout);
				resolve(code === 0);
			});

			pager.on("error", () => {
				clearTimeout(timeout);
				resolve(false);
			});
		} catch {
			resolve(false);
		}
	});
}

/**
 * Basic pager using readline for systems without less/more
 * Shows content page by page with "More" prompt
 */
async function basicPager(content: string): Promise<void> {
	const lines = content.split("\n");
	const termHeight = getTerminalHeight();
	const pageSize = termHeight - 1; // Reserve 1 line for prompt

	let currentLine = 0;

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	// Handle interrupt - use exitCode for proper handle cleanup on Windows
	// See: https://github.com/nodejs/node/issues/56645
	rl.on("SIGINT", () => {
		rl.close();
		process.exitCode = 0;
	});

	while (currentLine < lines.length) {
		// Show page
		const pageLines = lines.slice(currentLine, currentLine + pageSize);
		console.log(pageLines.join("\n"));

		currentLine += pageSize;

		if (currentLine >= lines.length) {
			break; // No more content
		}

		// Show prompt and wait for user
		const remaining = lines.length - currentLine;
		await new Promise<void>((resolve) => {
			rl.question(`-- More (${remaining} lines) [Enter/q] --`, (answer) => {
				if (answer.toLowerCase() === "q") {
					rl.close();
					// Use exitCode for proper handle cleanup on Windows
					process.exitCode = 0;
					resolve();
					return;
				}
				// Clear the prompt line
				process.stdout.write("\x1B[1A\x1B[2K");
				resolve();
			});
		});
	}

	rl.close();
}

/**
 * Display help content with optional paging
 *
 * Strategy:
 * 1. Check if paging is needed
 * 2. Try system pager (less/more)
 * 3. Fallback to basic pager
 * 4. Last resort: plain output
 */
export async function displayHelp(content: string, options: HelpOptions): Promise<void> {
	// Check if paging is needed
	if (!shouldUsePager(content, options)) {
		console.log(content);
		return;
	}

	// Try system pager first (preserves colors with -R)
	const pagerSuccess = await trySystemPager(content);
	if (pagerSuccess) {
		return;
	}

	// Fallback to basic pager
	try {
		await basicPager(content);
	} catch {
		// Last resort: plain output
		console.log(content);
	}
}
