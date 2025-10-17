import * as clack from "@clack/prompts";

/**
 * Safe wrapper around clack prompts that handles unicode rendering issues.
 * Sets up proper environment to minimize encoding problems.
 */

// Store original methods
const originalIntro = clack.intro;
const originalOutro = clack.outro;
const originalNote = clack.note;

/**
 * Wrapped intro that handles encoding better
 */
export function intro(message: string): void {
	try {
		originalIntro(message);
	} catch {
		// Fallback to simple console log if clack fails
		console.log(`\n=== ${message} ===\n`);
	}
}

/**
 * Wrapped outro that handles encoding better
 */
export function outro(message: string): void {
	try {
		originalOutro(message);
	} catch {
		// Fallback to simple console log if clack fails
		console.log(`\n=== ${message} ===\n`);
	}
}

/**
 * Wrapped note that handles encoding better
 */
export function note(message: string, title?: string): void {
	try {
		originalNote(message, title);
	} catch {
		// Fallback to simple console log if clack fails
		if (title) {
			console.log(`\n--- ${title} ---`);
		}
		console.log(message);
		console.log();
	}
}

// Re-export other clack functions unchanged
export { select, confirm, text, isCancel } from "@clack/prompts";
