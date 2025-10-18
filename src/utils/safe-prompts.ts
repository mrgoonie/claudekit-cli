import picocolors from "picocolors";

/**
 * Safe wrapper around clack prompts that uses simple ASCII characters
 * instead of unicode box drawing to avoid rendering issues.
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

// Re-export other clack functions unchanged
export { select, confirm, text, isCancel } from "@clack/prompts";
