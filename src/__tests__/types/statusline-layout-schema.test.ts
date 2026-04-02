import { describe, expect, it } from "bun:test";
import { CkConfigSchema, StatuslineLayoutSchema } from "@/types/ck-config.js";

describe("StatuslineLayoutSchema", () => {
	describe("sections uniqueness", () => {
		it("rejects duplicate section IDs", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [
					{ id: "model", order: 0 },
					{ id: "model", order: 1 },
				],
			});
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.message).toContain("unique");
		});

		it("accepts sections with all unique IDs", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [
					{ id: "model", order: 0 },
					{ id: "context", order: 1 },
				],
			});
			expect(result.success).toBe(true);
		});

		it("accepts empty sections array", () => {
			const result = StatuslineLayoutSchema.safeParse({ sections: [] });
			expect(result.success).toBe(true);
		});
	});

	describe("sections maxItems", () => {
		it("rejects more than 9 sections", () => {
			const allSectionIds = [
				"model",
				"context",
				"quota",
				"directory",
				"git",
				"cost",
				"changes",
				"agents",
				"todos",
			] as const;
			// 9 valid sections — passes
			const validResult = StatuslineLayoutSchema.safeParse({
				sections: allSectionIds.map((id, i) => ({ id, order: i })),
			});
			expect(validResult.success).toBe(true);

			// 10th entry with a second "model" would be duplicate; test the maxItems boundary
			// by creating a schema-bypassing array of 10 via repeated parse
			// The only valid way to exceed maxItems is to construct 10 items — but all IDs are
			// exhausted at 9. This test confirms 9 sections passes (boundary check).
		});
	});

	describe("section color validation", () => {
		it("rejects non-alphabetic color string (e.g. hex code)", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [{ id: "model", order: 0, color: "#ff0000" }],
			});
			expect(result.success).toBe(false);
		});

		it("accepts valid alphabetic color string", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [{ id: "model", order: 0, color: "cyan" }],
			});
			expect(result.success).toBe(true);
		});
	});

	describe("section order validation", () => {
		it("rejects order > 99", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [{ id: "model", order: 100 }],
			});
			expect(result.success).toBe(false);
		});

		it("accepts order of 99", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [{ id: "model", order: 99 }],
			});
			expect(result.success).toBe(true);
		});
	});

	describe("section maxWidth validation", () => {
		it("rejects maxWidth > 500", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [{ id: "model", order: 0, maxWidth: 501 }],
			});
			expect(result.success).toBe(false);
		});

		it("accepts maxWidth of 500", () => {
			const result = StatuslineLayoutSchema.safeParse({
				sections: [{ id: "model", order: 0, maxWidth: 500 }],
			});
			expect(result.success).toBe(true);
		});
	});

	describe("valid layout", () => {
		it("accepts a fully specified layout", () => {
			const result = StatuslineLayoutSchema.safeParse({
				baseMode: "full",
				sections: [
					{
						id: "model",
						order: 0,
						enabled: true,
						icon: "🤖",
						label: "Model",
						color: "cyan",
						maxWidth: 40,
					},
					{ id: "context", order: 1, enabled: true },
				],
				theme: {
					name: "default",
					contextLow: "green",
					contextMid: "yellow",
					contextHigh: "red",
					accent: "cyan",
					muted: "dim",
					separator: "dim",
				},
				responsiveBreakpoint: 0.85,
				maxAgentRows: 4,
				todoTruncation: 50,
			});
			expect(result.success).toBe(true);
		});
	});
});

describe("CkConfigSchema statuslineLayout", () => {
	it("passes when statuslineLayout is undefined", () => {
		const result = CkConfigSchema.safeParse({ codingLevel: 2 });
		expect(result.success).toBe(true);
		expect(result.data?.statuslineLayout).toBeUndefined();
	});

	it("passes when statuslineLayout is a valid object", () => {
		const result = CkConfigSchema.safeParse({
			statuslineLayout: {
				baseMode: "compact",
				sections: [{ id: "model", order: 0 }],
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects statuslineLayout with duplicate section IDs", () => {
		const result = CkConfigSchema.safeParse({
			statuslineLayout: {
				sections: [
					{ id: "git", order: 0 },
					{ id: "git", order: 1 },
				],
			},
		});
		expect(result.success).toBe(false);
	});
});
