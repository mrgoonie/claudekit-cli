/**
 * Diff display module — generate and display unified diffs
 * Security: Sanitizes ANSI escape sequences from file content before display
 */
import { createTwoFilesPatch } from "diff";

/**
 * Generate unified diff between old and new content
 */
export function generateDiff(oldContent: string, newContent: string, fileName: string): string {
	return createTwoFilesPatch(
		`a/${fileName}`,
		`b/${fileName}`,
		oldContent,
		newContent,
		"registered version",
		"current version",
		{ context: 3 },
	);
}

// ANSI sanitization patterns — built via RegExp to avoid biome noControlCharactersInRegex
const ESC = "\x1b";
const BEL = "\x07";
const CSI_RE = new RegExp(`${ESC}\\[[?0-9;]*[a-zA-Z]`, "g");
const OSC_RE = new RegExp(`${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, "g");
const DCS_RE = new RegExp(`${ESC}[P^_][^${ESC}]*${ESC}\\\\`, "g");

/**
 * Display diff with color-coded output
 * Security: Strips ANSI/OSC escape sequences to prevent terminal escape injection
 */
export function displayDiff(diff: string, options: { color: boolean }): void {
	for (const line of diff.split("\n")) {
		// Strip any existing ANSI escape sequences from file content before display
		// Covers: CSI (including private modes with ?), OSC, DCS, PM, APC sequences
		const sanitized = line.replace(CSI_RE, "").replace(OSC_RE, "").replace(DCS_RE, "");

		if (options.color) {
			if (sanitized.startsWith("+")) {
				console.log(`${ESC}[32m${sanitized}${ESC}[0m`);
			} else if (sanitized.startsWith("-")) {
				console.log(`${ESC}[31m${sanitized}${ESC}[0m`);
			} else if (sanitized.startsWith("@@")) {
				console.log(`${ESC}[36m${sanitized}${ESC}[0m`);
			} else {
				console.log(sanitized);
			}
		} else {
			console.log(sanitized);
		}
	}
}
