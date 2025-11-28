/**
 * Help Color Utilities
 *
 * Color functions for help output using picocolors.
 * Respects NO_COLOR env var for accessibility.
 */

import pc from "picocolors";
import type { ColorFunction, ColorTheme } from "./help-types.js";

/** Check if colors should be disabled (NO_COLOR standard) */
const NO_COLOR = process.env.NO_COLOR !== undefined;

/** Check if output supports colors (TTY + no NO_COLOR) */
export const isColorSupported = !NO_COLOR && Boolean(process.stdout.isTTY);

/** Identity function for no-color fallback */
const identity: ColorFunction = (text: string): string => text;

/**
 * Color functions with NO_COLOR fallback
 * Each function returns colored text if supported, plain text otherwise
 */
export const colors = {
	banner: isColorSupported ? pc.cyan : identity,
	command: isColorSupported ? pc.bold : identity,
	heading: isColorSupported ? pc.yellow : identity,
	flag: isColorSupported ? pc.green : identity,
	description: isColorSupported ? pc.gray : identity,
	example: isColorSupported ? pc.blue : identity,
	warning: isColorSupported ? pc.yellow : identity,
	error: isColorSupported ? pc.red : identity,
	muted: isColorSupported ? pc.dim : identity,
	success: isColorSupported ? pc.green : identity,
} as const;

/**
 * Default color theme implementing ColorTheme interface
 */
export const defaultTheme: ColorTheme = {
	banner: colors.banner,
	command: colors.command,
	heading: colors.heading,
	flag: colors.flag,
	description: colors.description,
	example: colors.example,
	warning: colors.warning,
	error: colors.error,
	muted: colors.muted,
	success: colors.success,
};

/**
 * Strip ANSI escape codes from text
 * Useful for calculating visible string length
 */
export function stripColors(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape code pattern
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Get visible string length (excluding ANSI codes)
 */
export function getVisibleLength(text: string): number {
	return stripColors(text).length;
}

/**
 * Pad string to specified width (accounting for ANSI codes)
 */
export function padEnd(text: string, width: number): string {
	const visibleLength = getVisibleLength(text);
	const padding = Math.max(0, width - visibleLength);
	return text + " ".repeat(padding);
}

/**
 * Truncate string to max width (accounting for ANSI codes)
 */
export function truncate(text: string, maxWidth: number): string {
	if (getVisibleLength(text) <= maxWidth) return text;

	const stripped = stripColors(text);
	return `${stripped.slice(0, maxWidth - 3)}...`;
}
