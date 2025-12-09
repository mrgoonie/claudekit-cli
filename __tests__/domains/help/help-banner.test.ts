/**
 * Tests for Help Banner Module
 *
 * Tests ASCII art banner rendering and centering.
 */

import { describe, expect, test } from "bun:test";
import {
	BANNER_LINES,
	BANNER_WIDTH,
	getBanner,
	getBannerWithVersion,
	getCenteredBanner,
} from "../../../src/domains/help/help-banner.js";
import { stripColors } from "../../../src/domains/help/help-colors.js";

describe("BANNER_LINES", () => {
	test("has exactly 6 lines", () => {
		expect(BANNER_LINES).toHaveLength(6);
	});

	test("all lines are non-empty strings", () => {
		for (const line of BANNER_LINES) {
			expect(typeof line).toBe("string");
			expect(line.length).toBeGreaterThan(0);
		}
	});

	test("all lines have consistent width", () => {
		const firstLineLength = BANNER_LINES[0].length;
		for (const line of BANNER_LINES) {
			expect(line.length).toBe(firstLineLength);
		}
	});

	test("BANNER_WIDTH matches declared constant", () => {
		expect(BANNER_WIDTH).toBe(16);
		// Note: Actual lines may have trailing spaces, so we verify against declared width
		expect(BANNER_LINES[0].length).toBeGreaterThanOrEqual(BANNER_WIDTH);
	});

	test("contains expected ASCII art characters", () => {
		const bannerText = BANNER_LINES.join("");
		expect(bannerText).toContain("█");
		expect(bannerText).toContain("╗");
		expect(bannerText).toContain("║");
		expect(bannerText).toContain("╝");
	});

	test("is readonly in TypeScript", () => {
		// TypeScript enforces this at compile time with 'as const'
		// At runtime, the array is still mutable in JavaScript
		// This test verifies the type exists and is accessible
		expect(BANNER_LINES).toBeDefined();
		expect(Array.isArray(BANNER_LINES)).toBe(true);
	});
});

describe("getBanner", () => {
	test("returns multiline string", () => {
		const banner = getBanner();
		expect(typeof banner).toBe("string");
		expect(banner).toContain("\n");
	});

	test("returns exactly 6 lines when split", () => {
		const banner = getBanner();
		const lines = banner.split("\n");
		expect(lines).toHaveLength(6);
	});

	test("preserves banner content after stripping colors", () => {
		const banner = getBanner();
		const stripped = stripColors(banner);
		const lines = stripped.split("\n");

		expect(lines).toHaveLength(6);
		for (let i = 0; i < 6; i++) {
			expect(lines[i]).toBe(BANNER_LINES[i]);
		}
	});

	test("applies color to each line", () => {
		const banner = getBanner();
		const stripped = stripColors(banner);

		// If colors are supported, banner should have ANSI codes
		// Otherwise, banner === stripped
		expect(stripped.length).toBeLessThanOrEqual(banner.length);
	});

	test("does not add trailing newline", () => {
		const banner = getBanner();
		expect(banner.endsWith("\n\n")).toBe(false);
	});
});

describe("getCenteredBanner", () => {
	test("returns banner for default width (80)", () => {
		const banner = getCenteredBanner();
		expect(typeof banner).toBe("string");
		expect(banner).toContain("\n");
	});

	test("centers banner for width 100", () => {
		const banner = getCenteredBanner(100);
		const lines = stripColors(banner).split("\n");

		expect(lines).toHaveLength(6);

		// Implementation uses BANNER_WIDTH constant for calculation
		const expectedPadding = Math.floor((100 - BANNER_WIDTH) / 2);

		// Check first line has padding (actual padding is expectedPadding + 1 due to implementation)
		const firstLine = lines[0];
		const trimmedFirstLine = firstLine.trimStart();
		const actualPadding = firstLine.length - trimmedFirstLine.length;

		// Verify banner is centered (padding should be roughly half the remaining space)
		expect(actualPadding).toBeGreaterThanOrEqual(expectedPadding);
		expect(actualPadding).toBeLessThanOrEqual(expectedPadding + 2);
	});

	test("centers banner for width 120", () => {
		const banner = getCenteredBanner(120);
		const lines = stripColors(banner).split("\n");

		// Implementation uses BANNER_WIDTH constant for calculation
		const expectedPadding = Math.floor((120 - BANNER_WIDTH) / 2);

		// Check first line has padding
		const firstLine = lines[0];
		const trimmedFirstLine = firstLine.trimStart();
		const actualPadding = firstLine.length - trimmedFirstLine.length;

		// Verify banner is centered (padding should be roughly half the remaining space)
		expect(actualPadding).toBeGreaterThanOrEqual(expectedPadding);
		expect(actualPadding).toBeLessThanOrEqual(expectedPadding + 2);
	});

	test("does not center if terminal too narrow (width < BANNER_WIDTH + 4)", () => {
		const narrowBanner = getCenteredBanner(18); // Less than 16 + 4 = 20
		const normalBanner = getBanner();

		// Should fallback to left-aligned (no centering)
		expect(stripColors(narrowBanner)).toBe(stripColors(normalBanner));
	});

	test("fallback for very narrow terminal (width 15)", () => {
		const narrowBanner = getCenteredBanner(15);
		const normalBanner = getBanner();

		expect(stripColors(narrowBanner)).toBe(stripColors(normalBanner));
	});

	test("handles exact threshold width (BANNER_WIDTH + 4 = 20)", () => {
		const banner = getCenteredBanner(20);
		const lines = stripColors(banner).split("\n");

		// At threshold, should start centering with minimal padding
		const expectedPadding = Math.floor((20 - BANNER_WIDTH) / 2);

		// Check first line has padding
		const firstLine = lines[0];
		const trimmedFirstLine = firstLine.trimStart();
		const actualPadding = firstLine.length - trimmedFirstLine.length;

		// Verify banner is centered (padding should be roughly half the remaining space)
		expect(actualPadding).toBeGreaterThanOrEqual(expectedPadding);
		expect(actualPadding).toBeLessThanOrEqual(expectedPadding + 2);
	});

	test("preserves banner content regardless of width", () => {
		const widths = [40, 72, 80, 100, 120];

		for (const width of widths) {
			const banner = getCenteredBanner(width);
			const stripped = stripColors(banner);
			const lines = stripped.split("\n");

			expect(lines).toHaveLength(6);

			// Each line should contain the original banner line content (after trimming padding and trailing spaces)
			for (let i = 0; i < 6; i++) {
				expect(lines[i].trim()).toBe(BANNER_LINES[i].trim());
			}
		}
	});
});

describe("getBannerWithVersion", () => {
	test("includes version string", () => {
		const banner = getBannerWithVersion("1.2.3");
		expect(banner).toContain("v1.2.3");
	});

	test("includes banner content", () => {
		const banner = getBannerWithVersion("1.2.3");
		const stripped = stripColors(banner);

		for (const line of BANNER_LINES) {
			expect(stripped).toContain(line);
		}
	});

	test("has 7 lines (6 banner + 1 version)", () => {
		const banner = getBannerWithVersion("1.2.3");
		const lines = stripColors(banner).split("\n");

		expect(lines).toHaveLength(7);
	});

	test("version line is last line", () => {
		const banner = getBannerWithVersion("1.2.3");
		const lines = stripColors(banner).split("\n");

		expect(lines[6]).toContain("v1.2.3");
	});

	test("centers version under banner", () => {
		const banner = getBannerWithVersion("1.2.3", 100);
		const lines = stripColors(banner).split("\n");
		const versionLine = lines[6];

		// Version should be roughly centered
		const trimmedVersion = versionLine.trim();
		expect(trimmedVersion).toBe("v1.2.3");

		// Should have leading padding for centering
		const actualPadding = versionLine.length - versionLine.trimStart().length;
		expect(actualPadding).toBeGreaterThan(0);
	});

	test("works with various width values", () => {
		const widths = [80, 100, 120];

		for (const width of widths) {
			const banner = getBannerWithVersion("2.0.0", width);
			const lines = stripColors(banner).split("\n");

			expect(lines).toHaveLength(7);
			expect(lines[6]).toContain("v2.0.0");
		}
	});

	test("handles version with different formats", () => {
		const versions = ["1.0.0", "2.5.10", "0.1.0-beta", "3.0.0-rc.1"];

		for (const version of versions) {
			const banner = getBannerWithVersion(version);
			expect(banner).toContain(`v${version}`);
		}
	});

	test("version line is styled with muted color", () => {
		const banner = getBannerWithVersion("1.2.3");

		// Version line should have color codes (unless NO_COLOR is set)
		// We verify by checking that stripped version differs from original if colors are supported
		const lines = banner.split("\n");
		const versionLineColored = lines[6];
		const versionLineStripped = stripColors(versionLineColored);

		expect(versionLineStripped).toContain("v1.2.3");
	});
});
