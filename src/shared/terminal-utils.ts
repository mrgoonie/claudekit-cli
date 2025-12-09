import pc from "picocolors";

// Unicode symbol set (preferred)
const UNICODE_SYMBOLS = {
	pass: "✓",
	warn: "⚠",
	fail: "✗",
	info: "ℹ",
} as const;

// ASCII fallback
const ASCII_SYMBOLS = {
	pass: "[PASS]",
	warn: "[WARN]",
	fail: "[FAIL]",
	info: "[INFO]",
} as const;

// Detect Unicode support
export function supportsUnicode(): boolean {
	// Windows Terminal and modern consoles
	if (process.env.WT_SESSION) return true;
	// CI environments often don't support Unicode well
	if (process.env.CI) return false;
	// Check TERM - dumb terminal doesn't support Unicode
	if (process.env.TERM === "dumb") return false;
	// Non-TTY output (pipes) - prefer ASCII for parseability
	if (!process.stdout.isTTY) return false;
	// Default: Unix-like systems typically support Unicode
	return process.platform !== "win32" || !!process.env.WT_SESSION;
}

export type StatusSymbols = typeof UNICODE_SYMBOLS | typeof ASCII_SYMBOLS;

export function getStatusSymbols(): StatusSymbols {
	return supportsUnicode() ? UNICODE_SYMBOLS : ASCII_SYMBOLS;
}

// Semantic color palette (extensible)
export const COLOR_PALETTE = {
	pass: pc.green,
	warn: pc.yellow,
	fail: pc.red,
	info: pc.blue,
	muted: pc.dim,
	heading: pc.bold,
} as const;

export type StatusType = keyof typeof UNICODE_SYMBOLS;
