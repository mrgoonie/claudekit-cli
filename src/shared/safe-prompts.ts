import * as clack from "@clack/prompts";
import picocolors from "picocolors";
import { output } from "./output-manager.js";

/**
 * Safe wrapper around clack prompts that uses Unicode or ASCII characters
 * based on terminal capabilities.
 *
 * This module provides terminal-aware alternatives for clack/prompts functions
 * that automatically switch between Unicode and ASCII based on detection.
 */

/**
 * Get current symbols from output manager
 */
function getSymbols() {
	return output.getSymbols();
}

/**
 * Simple intro with terminal-aware symbols
 */
export function intro(message: string): void {
	if (output.isJson()) return;
	console.log();
	console.log(picocolors.cyan(`${getSymbols().pointer} ${message}`));
	console.log();
}

/**
 * Simple outro with terminal-aware symbols
 */
export function outro(message: string): void {
	if (output.isJson()) return;
	console.log();
	console.log(picocolors.green(`${getSymbols().success} ${message}`));
	console.log();
}

/**
 * Simple note with terminal-aware formatting
 */
export function note(message: string, title?: string): void {
	if (output.isJson()) return;
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
 * Terminal-aware log functions with automatic symbol switching
 */
export const log = {
	info: (message: string): void => {
		if (output.isJson()) return;
		console.log(picocolors.blue(`${getSymbols().info} ${message}`));
	},
	success: (message: string): void => {
		if (output.isJson()) return;
		console.log(picocolors.green(`${getSymbols().success} ${message}`));
	},
	warn: (message: string): void => {
		if (output.isJson()) return;
		console.log(picocolors.yellow(`${getSymbols().warning} ${message}`));
	},
	warning: (message: string): void => {
		if (output.isJson()) return;
		console.log(picocolors.yellow(`${getSymbols().warning} ${message}`));
	},
	error: (message: string): void => {
		if (output.isJson()) return;
		console.log(picocolors.red(`${getSymbols().error} ${message}`));
	},
	step: (message: string): void => {
		if (output.isJson()) return;
		console.log(picocolors.cyan(`${getSymbols().pointer} ${message}`));
	},
	message: (message: string): void => {
		if (output.isJson()) return;
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
