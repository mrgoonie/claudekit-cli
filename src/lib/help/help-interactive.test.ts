/**
 * Tests for Help Interactive Mode
 *
 * Tests paging logic, terminal detection, and display functions.
 */

import { describe, expect, mock, test } from "bun:test";
import { defaultTheme } from "./help-colors.js";
import { displayHelp, shouldUsePager } from "./help-interactive.js";
import type { HelpOptions } from "./help-types.js";

// Create default test options with all required fields
function createTestOptions(overrides: Partial<HelpOptions> = {}): HelpOptions {
	return {
		showBanner: true,
		showExamples: true,
		maxExamples: 2,
		interactive: true,
		width: 120,
		noColor: false,
		theme: defaultTheme,
		...overrides,
	};
}

describe("shouldUsePager", () => {
	test("returns false when interactive is disabled", () => {
		const options = createTestOptions({ interactive: false });
		const content = "line\n".repeat(100);
		expect(shouldUsePager(content, options)).toBe(false);
	});

	test("returns false when terminal width is narrow", () => {
		const options = createTestOptions({ interactive: true, width: 60 });
		const content = "line\n".repeat(100);
		// Note: also depends on TTY status
		expect(shouldUsePager(content, options)).toBe(false);
	});

	test("returns boolean type", () => {
		const options = createTestOptions({ interactive: false });
		const result = shouldUsePager("test", options);
		expect(typeof result).toBe("boolean");
	});

	test("returns false for short content regardless of settings", () => {
		const options = createTestOptions({ interactive: true, width: 120 });
		const content = "line\n".repeat(3); // Only 3 lines
		// Short content should not need paging
		expect(shouldUsePager(content, options)).toBe(false);
	});
});

describe("displayHelp", () => {
	const originalLog = console.log;

	test("outputs content directly when interactive is disabled", async () => {
		const logged: string[] = [];
		console.log = mock((...args: unknown[]) => {
			logged.push(args.join(" "));
		});

		const options = createTestOptions({ interactive: false });
		const content = "Test help content";

		await displayHelp(content, options);

		expect(logged).toHaveLength(1);
		expect(logged[0]).toBe("Test help content");

		console.log = originalLog;
	});

	test("outputs multiline content correctly", async () => {
		const logged: string[] = [];
		console.log = mock((...args: unknown[]) => {
			logged.push(args.join(" "));
		});

		const options = createTestOptions({ interactive: false });
		const content = "Line 1\nLine 2\nLine 3";

		await displayHelp(content, options);

		expect(logged).toHaveLength(1);
		expect(logged[0]).toContain("Line 1");
		expect(logged[0]).toContain("Line 2");
		expect(logged[0]).toContain("Line 3");

		console.log = originalLog;
	});

	test("preserves empty lines in content", async () => {
		const logged: string[] = [];
		console.log = mock((...args: unknown[]) => {
			logged.push(args.join(" "));
		});

		const options = createTestOptions({ interactive: false });
		const content = "Line 1\n\nLine 3"; // Empty line in middle

		await displayHelp(content, options);

		expect(logged).toHaveLength(1);
		expect(logged[0]).toBe("Line 1\n\nLine 3");

		console.log = originalLog;
	});

	test("handles empty content", async () => {
		const logged: string[] = [];
		console.log = mock((...args: unknown[]) => {
			logged.push(args.join(" "));
		});

		const options = createTestOptions({ interactive: false });
		await displayHelp("", options);

		expect(logged).toHaveLength(1);
		expect(logged[0]).toBe("");

		console.log = originalLog;
	});

	test("handles content with only newlines", async () => {
		const logged: string[] = [];
		console.log = mock((...args: unknown[]) => {
			logged.push(args.join(" "));
		});

		const options = createTestOptions({ interactive: false });
		await displayHelp("\n\n\n", options);

		expect(logged).toHaveLength(1);
		expect(logged[0]).toBe("\n\n\n");

		console.log = originalLog;
	});

	test("handles content with ANSI codes", async () => {
		const logged: string[] = [];
		console.log = mock((...args: unknown[]) => {
			logged.push(args.join(" "));
		});

		const options = createTestOptions({ interactive: false });
		const content = "\x1B[31mRed text\x1B[0m and normal";

		await displayHelp(content, options);

		expect(logged).toHaveLength(1);
		expect(logged[0]).toBe(content);

		console.log = originalLog;
	});

	test("returns Promise", () => {
		const originalLog2 = console.log;
		console.log = mock(() => {});

		const options = createTestOptions({ interactive: false });
		const result = displayHelp("test", options);
		expect(result).toBeInstanceOf(Promise);

		console.log = originalLog2;
	});

	test("resolves without error", async () => {
		const originalLog2 = console.log;
		console.log = mock(() => {});

		const options = createTestOptions({ interactive: false });
		await expect(displayHelp("test content", options)).resolves.toBeUndefined();

		console.log = originalLog2;
	});
});

describe("paging behavior with narrow width", () => {
	test("narrow terminal (width < 80) skips paging even for long content", () => {
		const options = createTestOptions({ interactive: true, width: 60 });
		const content = "line\n".repeat(200);
		expect(shouldUsePager(content, options)).toBe(false);
	});

	test("wide terminal (width >= 80) allows paging consideration", () => {
		const options = createTestOptions({ interactive: true, width: 120 });
		// Result depends on TTY and terminal height
		const result = shouldUsePager("line\n".repeat(200), options);
		expect(typeof result).toBe("boolean");
	});
});
