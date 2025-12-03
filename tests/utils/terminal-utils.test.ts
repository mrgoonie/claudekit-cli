import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { COLOR_PALETTE, getStatusSymbols, supportsUnicode } from "../../src/utils/terminal-utils";

describe("terminal-utils", () => {
	let originalEnv: NodeJS.ProcessEnv;
	let originalTTY: NodeJS.WriteStream;

	beforeEach(() => {
		originalEnv = { ...process.env };
		originalTTY = process.stdout;
	});

	afterEach(() => {
		process.env = originalEnv;
		// Restore TTY
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalTTY.isTTY,
			configurable: true,
		});
	});

	describe("supportsUnicode", () => {
		it("should return true for Windows Terminal", () => {
			// Clear conflicting env vars
			process.env.CI = undefined;
			process.env.TERM = undefined;
			process.env.WT_SESSION = "true";
			expect(supportsUnicode()).toBe(true);
		});

		it("should return false for CI environments", () => {
			process.env.WT_SESSION = undefined;
			process.env.CI = "true";
			expect(supportsUnicode()).toBe(false);
		});

		it("should return false for dumb terminals", () => {
			process.env.CI = undefined;
			process.env.WT_SESSION = undefined;
			process.env.TERM = "dumb";
			expect(supportsUnicode()).toBe(false);
		});

		it("should return false for non-TTY output", () => {
			process.env.CI = undefined;
			process.env.WT_SESSION = undefined;
			process.env.TERM = undefined;
			Object.defineProperty(process.stdout, "isTTY", {
				value: false,
				configurable: true,
			});
			expect(supportsUnicode()).toBe(false);
		});

		it("should return true for Unix-like systems with TTY", () => {
			// Clear ALL conflicting env vars first
			process.env.CI = undefined;
			process.env.WT_SESSION = undefined;
			process.env.TERM = undefined;
			Object.defineProperty(process.stdout, "isTTY", {
				value: true,
				configurable: true,
			});
			// Only test on non-Windows or skip gracefully
			if (process.platform === "win32") {
				// On Windows without WT_SESSION, expect false
				expect(supportsUnicode()).toBe(false);
			} else {
				expect(supportsUnicode()).toBe(true);
			}
		});

		it("should return false for legacy Windows without WT_SESSION", () => {
			// Skip on non-Windows platforms
			if (process.platform !== "win32") {
				expect(true).toBe(true);
				return;
			}
			process.env.CI = undefined;
			process.env.WT_SESSION = undefined;
			process.env.TERM = undefined;
			Object.defineProperty(process.stdout, "isTTY", {
				value: true,
				configurable: true,
			});
			expect(supportsUnicode()).toBe(false);
		});
	});

	describe("getStatusSymbols", () => {
		it("should return Unicode symbols when supported", () => {
			process.env.WT_SESSION = "true";
			const symbols = getStatusSymbols();
			expect(symbols.pass).toBe("✓");
			expect(symbols.warn).toBe("⚠");
			expect(symbols.fail).toBe("✗");
			expect(symbols.info).toBe("ℹ");
		});

		it("should return ASCII fallback when Unicode not supported", () => {
			process.env.CI = "true";
			const symbols = getStatusSymbols();
			expect(symbols.pass).toBe("[PASS]");
			expect(symbols.warn).toBe("[WARN]");
			expect(symbols.fail).toBe("[FAIL]");
			expect(symbols.info).toBe("[INFO]");
		});
	});

	describe("COLOR_PALETTE", () => {
		it("should have all required color functions", () => {
			expect(typeof COLOR_PALETTE.pass).toBe("function");
			expect(typeof COLOR_PALETTE.warn).toBe("function");
			expect(typeof COLOR_PALETTE.fail).toBe("function");
			expect(typeof COLOR_PALETTE.info).toBe("function");
			expect(typeof COLOR_PALETTE.muted).toBe("function");
			expect(typeof COLOR_PALETTE.heading).toBe("function");
		});

		it("should apply colors to text", () => {
			expect(COLOR_PALETTE.pass("test")).toContain("test");
			expect(COLOR_PALETTE.warn("test")).toContain("test");
			expect(COLOR_PALETTE.fail("test")).toContain("test");
			expect(COLOR_PALETTE.info("test")).toContain("test");
			expect(COLOR_PALETTE.muted("test")).toContain("test");
			expect(COLOR_PALETTE.heading("test")).toContain("test");
		});
	});
});
