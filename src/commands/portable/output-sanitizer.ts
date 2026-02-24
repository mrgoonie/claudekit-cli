/**
 * Terminal output sanitization utilities.
 * Strips escape/control sequences from untrusted content before console output.
 */

const ESC = "\x1b";
const BEL = "\x07";

// ANSI escape sequences (CSI / OSC / DCS, PM, APC) and standalone ESC controls
const CSI_RE = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g");
const OSC_RE = new RegExp(`${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, "g");
const DCS_RE = new RegExp(`${ESC}[P^_][\\s\\S]*?${ESC}\\\\`, "g");
const ESC_SINGLE_RE = new RegExp(`${ESC}[@-Z\\\\-_]`, "g");

const SINGLE_LINE_BREAK_RE = /[\r\n\t]+/g;
const MULTI_SPACE_RE = / {2,}/g;

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1a) ||
		(codePoint >= 0x1c && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

function stripControlChars(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

/**
 * Remove terminal escape and control characters while preserving normal text.
 */
export function sanitizeTerminalText(value: string): string {
	const withoutEscapes = value
		.replace(CSI_RE, "")
		.replace(OSC_RE, "")
		.replace(DCS_RE, "")
		.replace(ESC_SINGLE_RE, "");
	return stripControlChars(withoutEscapes);
}

/**
 * Sanitize and collapse into a single display-safe line.
 */
export function sanitizeSingleLineTerminalText(value: string): string {
	return sanitizeTerminalText(value)
		.replace(SINGLE_LINE_BREAK_RE, " ")
		.replace(MULTI_SPACE_RE, " ")
		.trim();
}
