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
