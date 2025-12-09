import * as clack from "@clack/prompts";
import picocolors from "picocolors";

/**
 * Safe wrapper around clack prompts that uses simple ASCII characters
 * instead of unicode box drawing to avoid rendering issues.
 *
 * This module provides ASCII-safe alternatives for clack/prompts functions
 * that use Unicode characters which may not render correctly on all terminals.
 */

/**
 * Simple intro with ASCII characters
 */
export function intro(message: string): void {
	console.log();
	console.log(picocolors.cyan(`> ${message}`));
	console.log();
}

/**
 * Simple outro with ASCII characters
 */
export function outro(message: string): void {
	console.log();
	console.log(picocolors.green(`[OK] ${message}`));
	console.log();
}

/**
 * Simple note with ASCII box drawing
 */
export function note(message: string, title?: string): void {
	console.log();
	if (title) {
		console.log(picocolors.cyan(`  ${title}:`));
		console.log();
	}
	// Split message into lines and indent each
	const lines = message.split("\n");
	for (const line of lines) {
		console.log(`  ${line}`);
	}
	console.log();
}

/**
 * ASCII-safe log functions that wrap clack.log with ASCII symbols
 */
export const log = {
	info: (message: string): void => {
		console.log(picocolors.blue(`[i] ${message}`));
	},
	success: (message: string): void => {
		console.log(picocolors.green(`[+] ${message}`));
	},
	warn: (message: string): void => {
		console.log(picocolors.yellow(`[!] ${message}`));
	},
	warning: (message: string): void => {
		console.log(picocolors.yellow(`[!] ${message}`));
	},
	error: (message: string): void => {
		console.log(picocolors.red(`[x] ${message}`));
	},
	step: (message: string): void => {
		console.log(picocolors.cyan(`[>] ${message}`));
	},
	message: (message: string): void => {
		console.log(`    ${message}`);
	},
};

// Re-export clack functions that don't have Unicode issues or work correctly
// Note: select, confirm, text use Unicode but the core functionality works
// The Unicode issues are mainly in the decorative elements
export {
	select,
	confirm,
	text,
	isCancel,
	spinner,
	multiselect,
	groupMultiselect,
} from "@clack/prompts";

// Re-export the entire clack module for cases where full access is needed
export { clack };
