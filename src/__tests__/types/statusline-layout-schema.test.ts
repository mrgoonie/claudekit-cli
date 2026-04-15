import { describe, expect, it } from "bun:test";
import { CkConfigSchema, StatuslineLayoutSchema } from "@/types/ck-config.js";

describe("StatuslineLayoutSchema", () => {
	describe("lines validation", () => {
		it("accepts valid lines array", () => {
			const result = StatuslineLayoutSchema.safeParse({
				lines: [
					["model", "context"],
					["directory", "git"],
				],
			});
			expect(result.success).toBe(true);
		});

		it("accepts empty lines array", () => {
			const result = StatuslineLayoutSchema.safeParse({ lines: [] });
			expect(result.success).toBe(true);
		});

		it("accepts undefined lines (backward compat)", () => {
			const result = StatuslineLayoutSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("rejects invalid section IDs in lines", () => {
			const result = StatuslineLayoutSchema.safeParse({
				lines: [["model", "invalid_section"]],
			});
			expect(result.success).toBe(false);
		});

		it("rejects more than 10 lines", () => {
			const lines = Array.from({ length: 11 }, () => ["model"]);
			const result = StatuslineLayoutSchema.safeParse({ lines });
			expect(result.success).toBe(false);
		});
	});

	describe("sectionConfig validation", () => {
		it("accepts valid sectionConfig", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sectionConfig: {
					model: { icon: "🤖", label: "AI Model" },
					git: { color: "magenta" },
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects non-alphabetic color in sectionConfig", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sectionConfig: { model: { color: "#ff0000" } },
			});
			expect(result.success).toBe(false);
		});

		it("rejects maxWidth > 500", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sectionConfig: { model: { maxWidth: 501 } },
			});
			expect(result.success).toBe(false);
		});

		it("accepts maxWidth at boundary (500)", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sectionConfig: { model: { maxWidth: 500 } },
			});
			expect(result.success).toBe(true);
		});
	});

	describe("theme validation", () => {
		it("accepts valid theme", () => {
			const result = StatuslineLayoutSchema.safeParse({
				theme: { contextLow: "green", accent: "cyan" },
			});
			expect(result.success).toBe(true);
		});

		// TDD Red: quotaLow/quotaHigh missing from StatuslineThemeSchema — fields get stripped silently
		it("accepts quotaLow and quotaHigh in theme", () => {
			const result = StatuslineLayoutSchema.safeParse({
				theme: { quotaLow: "green", quotaHigh: "yellow" },
			});
			expect(result.success).toBe(true);
			// These assertions fail because Zod strips unknown fields
			if (result.success) {
				expect(result.data.theme?.quotaLow).toBe("green");
				expect(result.data.theme?.quotaHigh).toBe("yellow");
			}
		});

		// TDD Red: fields stripped when routed through CkConfigSchema
		it("preserves quotaLow/quotaHigh through CkConfigSchema parse", () => {
			const result = CkConfigSchema.safeParse({
				statuslineLayout: {
					theme: { quotaLow: "cyan", quotaHigh: "red" },
				},
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.statuslineLayout?.theme?.quotaLow).toBe("cyan");
				expect(result.data.statuslineLayout?.theme?.quotaHigh).toBe("red");
			}
		});

		// TDD Red: non-alphabetic quotaLow should be rejected (currently ignored — schema doesn't know the field)
		it("rejects non-alphabetic quotaLow", () => {
			const result = StatuslineLayoutSchema.safeParse({
				theme: { quotaLow: "#ff0000" },
			});
			expect(result.success).toBe(false);
		});

		// Regression guard: must still pass after schema fix
		it("accepts theme without quotaLow/quotaHigh (backward compat)", () => {
			const result = StatuslineLayoutSchema.safeParse({
				theme: { contextLow: "green" },
			});
			expect(result.success).toBe(true);
		});
	});
});

describe("CkConfigSchema statuslineLayout", () => {
	it("accepts undefined statuslineLayout (backward compat)", () => {
		const result = CkConfigSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("accepts valid statuslineLayout with lines", () => {
		const result = CkConfigSchema.safeParse({
			statuslineLayout: {
				lines: [["model", "context", "quota"]],
				sectionConfig: { model: { icon: "🤖" } },
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid section ID in lines", () => {
		const result = CkConfigSchema.safeParse({
			statuslineLayout: {
				lines: [["model", "bogus"]],
			},
		});
		expect(result.success).toBe(false);
	});
});
