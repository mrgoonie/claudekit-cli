/**
 * Tests for Help Color Utilities
 *
 * Tests color functions, ANSI stripping, and string calculations.
 */

import { describe, expect, test } from "bun:test";
import {
	colors,
	defaultTheme,
	getVisibleLength,
	isColorSupported,
	padEnd,
	stripColors,
	truncate,
} from "./help-colors.js";
import type { ColorTheme } from "./help-types.js";

describe("stripColors", () => {
	test("removes ANSI escape codes from text", () => {
		const coloredText = "\x1b[31mred text\x1b[0m";
		expect(stripColors(coloredText)).toBe("red text");
	});

	test("handles multiple ANSI codes", () => {
		const coloredText = "\x1b[31m\x1b[1mbold red\x1b[0m\x1b[32mgreen\x1b[0m";
		expect(stripColors(coloredText)).toBe("bold redgreen");
	});

	test("returns unchanged text with no ANSI codes", () => {
		const plainText = "plain text";
		expect(stripColors(plainText)).toBe("plain text");
	});

	test("handles empty string", () => {
		expect(stripColors("")).toBe("");
	});

	test("handles complex ANSI sequences", () => {
		const complexText = "\x1b[38;5;214mcolorful\x1b[0m text";
		expect(stripColors(complexText)).toBe("colorful text");
	});
});

describe("getVisibleLength", () => {
	test("calculates correct length for plain text", () => {
		expect(getVisibleLength("hello world")).toBe(11);
	});

	test("calculates correct length excluding ANSI codes", () => {
		const coloredText = "\x1b[31mred\x1b[0m";
		expect(getVisibleLength(coloredText)).toBe(3);
	});

	test("handles mixed colored and plain text", () => {
		const mixedText = "plain \x1b[32mgreen\x1b[0m text";
		expect(getVisibleLength(mixedText)).toBe(16);
	});

	test("returns 0 for empty string", () => {
		expect(getVisibleLength("")).toBe(0);
	});

	test("calculates length correctly with multiple ANSI codes", () => {
		const complexText = "\x1b[1m\x1b[31mbold red\x1b[0m normal";
		expect(getVisibleLength(complexText)).toBe(15);
	});
});

describe("padEnd", () => {
	test("pads string to specified width", () => {
		const result = padEnd("test", 10);
		expect(getVisibleLength(result)).toBe(10);
		expect(result).toBe("test      ");
	});

	test("pads colored text correctly accounting for ANSI", () => {
		const coloredText = "\x1b[31mred\x1b[0m"; // visible length: 3
		const result = padEnd(coloredText, 10);
		expect(getVisibleLength(result)).toBe(10);
	});

	test("does not pad if text is already at width", () => {
		const text = "exact";
		const result = padEnd(text, 5);
		expect(result).toBe(text);
	});

	test("does not truncate if text exceeds width", () => {
		const text = "toolongtext";
		const result = padEnd(text, 5);
		expect(result).toBe(text);
		expect(getVisibleLength(result)).toBe(11);
	});

	test("handles zero width", () => {
		const result = padEnd("test", 0);
		expect(result).toBe("test");
	});

	test("handles negative width", () => {
		const result = padEnd("test", -5);
		expect(result).toBe("test");
	});
});

describe("truncate", () => {
	test("truncates long text to max width", () => {
		const longText = "this is a very long text that should be truncated";
		const result = truncate(longText, 20);
		expect(getVisibleLength(result)).toBe(20);
		expect(result).toContain("...");
	});

	test("does not truncate text within max width", () => {
		const shortText = "short";
		const result = truncate(shortText, 20);
		expect(result).toBe(shortText);
	});

	test("truncates colored text correctly", () => {
		const coloredText = "\x1b[31mthis is a very long red text\x1b[0m";
		const result = truncate(coloredText, 15);
		expect(getVisibleLength(result)).toBe(15);
	});

	test("handles text exactly at max width", () => {
		const text = "exacttwenty";
		const result = truncate(text, 11);
		expect(result).toBe(text);
	});
});

describe("colors object", () => {
	test("has all required color functions", () => {
		expect(typeof colors.banner).toBe("function");
		expect(typeof colors.command).toBe("function");
		expect(typeof colors.heading).toBe("function");
		expect(typeof colors.flag).toBe("function");
		expect(typeof colors.description).toBe("function");
		expect(typeof colors.example).toBe("function");
		expect(typeof colors.warning).toBe("function");
		expect(typeof colors.error).toBe("function");
		expect(typeof colors.muted).toBe("function");
		expect(typeof colors.success).toBe("function");
	});

	test("color functions return strings", () => {
		const testText = "test";
		expect(typeof colors.banner(testText)).toBe("string");
		expect(typeof colors.command(testText)).toBe("string");
		expect(typeof colors.heading(testText)).toBe("string");
		expect(typeof colors.flag(testText)).toBe("string");
		expect(typeof colors.description(testText)).toBe("string");
		expect(typeof colors.example(testText)).toBe("string");
		expect(typeof colors.warning(testText)).toBe("string");
		expect(typeof colors.error(testText)).toBe("string");
		expect(typeof colors.muted(testText)).toBe("string");
		expect(typeof colors.success(testText)).toBe("string");
	});

	test("color functions preserve text content", () => {
		const testText = "preserved content";
		expect(stripColors(colors.banner(testText))).toBe(testText);
		expect(stripColors(colors.command(testText))).toBe(testText);
		expect(stripColors(colors.heading(testText))).toBe(testText);
	});

	test("color functions handle empty strings", () => {
		expect(stripColors(colors.banner(""))).toBe("");
		expect(stripColors(colors.error(""))).toBe("");
	});
});

describe("defaultTheme", () => {
	test("implements ColorTheme interface with all required properties", () => {
		const theme: ColorTheme = defaultTheme;
		expect(typeof theme.banner).toBe("function");
		expect(typeof theme.command).toBe("function");
		expect(typeof theme.heading).toBe("function");
		expect(typeof theme.flag).toBe("function");
		expect(typeof theme.description).toBe("function");
		expect(typeof theme.example).toBe("function");
		expect(typeof theme.warning).toBe("function");
		expect(typeof theme.error).toBe("function");
		expect(typeof theme.muted).toBe("function");
		expect(typeof theme.success).toBe("function");
	});

	test("theme functions match colors object", () => {
		expect(defaultTheme.banner).toBe(colors.banner);
		expect(defaultTheme.command).toBe(colors.command);
		expect(defaultTheme.heading).toBe(colors.heading);
		expect(defaultTheme.flag).toBe(colors.flag);
		expect(defaultTheme.description).toBe(colors.description);
		expect(defaultTheme.example).toBe(colors.example);
		expect(defaultTheme.warning).toBe(colors.warning);
		expect(defaultTheme.error).toBe(colors.error);
		expect(defaultTheme.muted).toBe(colors.muted);
		expect(defaultTheme.success).toBe(colors.success);
	});

	test("theme functions produce consistent output", () => {
		const text = "test";
		const result1 = defaultTheme.banner(text);
		const result2 = defaultTheme.banner(text);
		expect(result1).toBe(result2);
	});
});

describe("isColorSupported", () => {
	test("is a boolean value", () => {
		expect(typeof isColorSupported).toBe("boolean");
	});

	// Note: Actual value depends on environment (NO_COLOR, TTY)
	// This test just ensures it's defined and accessible
	test("respects NO_COLOR environment variable", () => {
		// If NO_COLOR is set, colors should not be supported
		if (process.env.NO_COLOR !== undefined) {
			expect(isColorSupported).toBe(false);
		}
	});
});
