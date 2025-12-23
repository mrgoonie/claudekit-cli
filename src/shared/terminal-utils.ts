import pc from "picocolors";

// Re-export consolidated symbols from output-manager (single source of truth)
export { getStatusSymbols, type StatusSymbols, type StatusType } from "./output-manager.js";

/**
 * Detect Unicode support based on terminal environment.
 * Auto-detects without user config - modern terminals get Unicode, legacy get ASCII.
 *
 * Detection order:
 * 1. Explicit modern terminal indicators (high confidence)
 * 2. Locale-based detection (medium confidence)
 * 3. Platform defaults (fallback)
 */
export function supportsUnicode(): boolean {
	// Modern terminal emulators - high confidence
	if (process.env.WT_SESSION) return true; // Windows Terminal
	if (process.env.TERM_PROGRAM === "iTerm.app") return true;
	if (process.env.TERM_PROGRAM === "Apple_Terminal") return true;
	if (process.env.TERM_PROGRAM === "vscode") return true;
	if (process.env.KONSOLE_VERSION) return true;

	// CI environments - usually support Unicode
	if (process.env.CI) return true;

	// Dumb terminal - no Unicode
	if (process.env.TERM === "dumb") return false;

	// Non-TTY output (pipes, redirects) - prefer ASCII for parseability
	if (!process.stdout.isTTY) return false;

	// Locale-based detection
	const locale = process.env.LANG || process.env.LC_ALL || "";
	if (locale.toLowerCase().includes("utf")) return true;

	// Windows without modern terminal = legacy CMD
	if (process.platform === "win32") return false;

	// Default: Unix-like systems typically support Unicode
	return true;
}

/**
 * Check if running in a TTY (interactive terminal)
 */
export function isTTY(): boolean {
	return process.stdout.isTTY === true;
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
