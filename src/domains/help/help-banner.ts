/**
 * Help Banner Module
 *
 * ASCII art banner for ClaudeKit CLI help output.
 * Exactly 6 lines as specified.
 */

import { defaultTheme, getVisibleLength } from "./help-colors.js";

/**
 * 6-line ASCII art banner for CK (ClaudeKit CLI)
 * Width: 19 characters per line
 */
export const BANNER_LINES = [
	" ██████╗██╗  ██╗",
	"██╔════╝██║ ██╔╝",
	"██║     █████╔╝ ",
	"██║     ██╔═██╗ ",
	"╚██████╗██║  ██╗",
	" ╚═════╝╚═╝  ╚═╝",
] as const;

/** Banner width in characters */
export const BANNER_WIDTH = 16;

/**
 * Get colored banner as multiline string
 */
export function getBanner(): string {
	return BANNER_LINES.map((line) => defaultTheme.banner(line)).join("\n");
}

/**
 * Get centered banner for given terminal width
 * Falls back to left-aligned if terminal too narrow
 *
 * @param width - Terminal width (default: 80)
 */
export function getCenteredBanner(width = 80): string {
	// Skip centering if terminal is too narrow
	if (width < BANNER_WIDTH + 4) {
		return getBanner();
	}

	const padding = Math.floor((width - BANNER_WIDTH) / 2);
	const paddingStr = " ".repeat(padding);

	return BANNER_LINES.map((line) => paddingStr + defaultTheme.banner(line)).join("\n");
}

/**
 * Get banner with version subtitle
 *
 * @param version - CLI version string
 * @param width - Terminal width for centering
 */
export function getBannerWithVersion(version: string, width = 80): string {
	const banner = getCenteredBanner(width);
	const versionLine = defaultTheme.muted(`v${version}`);

	// Center the version under the banner
	const versionPadding = Math.floor((width - getVisibleLength(versionLine)) / 2);
	const centeredVersion = " ".repeat(Math.max(0, versionPadding)) + versionLine;

	return `${banner}\n${centeredVersion}`;
}
