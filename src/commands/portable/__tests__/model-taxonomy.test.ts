/**
 * Tests for model taxonomy resolution
 */
import { afterEach, describe, expect, it } from "bun:test";
import { resolveModel, setTaxonomyOverrides } from "../model-taxonomy.js";

describe("resolveModel", () => {
	describe("codex provider", () => {
		it("resolves opus to gpt-5.4 with xhigh effort", () => {
			const result = resolveModel("opus", "codex");
			expect(result.resolved).toEqual({ model: "gpt-5.4", effort: "xhigh" });
			expect(result.warning).toBeUndefined();
		});

		it("resolves sonnet to gpt-5.4 with high effort", () => {
			const result = resolveModel("sonnet", "codex");
			expect(result.resolved).toEqual({ model: "gpt-5.4", effort: "high" });
			expect(result.warning).toBeUndefined();
		});

		it("resolves haiku to gpt-5.4-mini with medium effort", () => {
			const result = resolveModel("haiku", "codex");
			expect(result.resolved).toEqual({ model: "gpt-5.4-mini", effort: "medium" });
			expect(result.warning).toBeUndefined();
		});

		it("returns null for undefined model", () => {
			const result = resolveModel(undefined, "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null for inherit keyword", () => {
			const result = resolveModel("inherit", "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null for empty string", () => {
			const result = resolveModel("", "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null for whitespace-only string", () => {
			const result = resolveModel("  ", "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null with warning for unknown model", () => {
			const result = resolveModel("unknown-model", "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toContain("Unknown model");
			expect(result.warning).toContain("unknown-model");
		});

		it("returns null with warning for non-string model", () => {
			const result = resolveModel(42 as unknown as string, "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toContain("non-string");
		});
	});

	describe("gemini-cli provider", () => {
		it("maps opus to gemini-3.1-pro-preview", () => {
			const result = resolveModel("opus", "gemini-cli");
			expect(result.resolved).toEqual({ model: "gemini-3.1-pro-preview" });
			expect(result.warning).toBeUndefined();
		});

		it("maps sonnet to gemini-3.1-pro-preview", () => {
			const result = resolveModel("sonnet", "gemini-cli");
			expect(result.resolved).toEqual({ model: "gemini-3.1-pro-preview" });
		});

		it("maps haiku to gemini-3-flash-preview", () => {
			const result = resolveModel("haiku", "gemini-cli");
			expect(result.resolved).toEqual({ model: "gemini-3-flash-preview" });
		});

		it("returns no effort field for any tier", () => {
			const result = resolveModel("opus", "gemini-cli");
			expect(result.resolved?.effort).toBeUndefined();
		});
	});

	describe("unmapped providers (pass-through)", () => {
		it("returns null for unmapped provider without warning", () => {
			const result = resolveModel("opus", "cursor");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null for windsurf provider without warning", () => {
			const result = resolveModel("opus", "windsurf");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null for github-copilot (pass-through provider)", () => {
			const result = resolveModel("opus", "github-copilot");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});

		it("returns null for any unknown provider", () => {
			const result = resolveModel("sonnet", "custom-provider");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});
	});

	describe("edge cases", () => {
		it("trims whitespace from model names", () => {
			const result = resolveModel("  opus  ", "codex");
			expect(result.resolved).toEqual({ model: "gpt-5.4", effort: "xhigh" });
			expect(result.warning).toBeUndefined();
		});

		it("distinguishes inherit from unknown model", () => {
			const result1 = resolveModel("inherit", "codex");
			const result2 = resolveModel("inherited", "codex");
			expect(result1.warning).toBeUndefined();
			expect(result2.warning).toContain("Unknown model");
		});

		it("handles null as falsy without throwing", () => {
			const result = resolveModel(null as unknown as string, "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toBeUndefined();
		});
	});

	describe("config overrides via setTaxonomyOverrides", () => {
		afterEach(() => {
			// Clean up module-level state
			setTaxonomyOverrides(undefined);
		});

		it("overrides take precedence over defaults", () => {
			setTaxonomyOverrides({
				codex: {
					heavy: { model: "custom-model", effort: "max" },
					balanced: { model: "custom-balanced" },
					light: { model: "custom-light" },
				},
			});
			const result = resolveModel("opus", "codex");
			expect(result.resolved).toEqual({ model: "custom-model", effort: "max" });
		});

		it("non-overridden providers still use defaults", () => {
			setTaxonomyOverrides({
				codex: {
					heavy: { model: "custom" },
					balanced: { model: "custom" },
					light: { model: "custom" },
				},
			});
			const result = resolveModel("opus", "gemini-cli");
			expect(result.resolved).toEqual({ model: "gemini-3.1-pro-preview" });
		});

		it("clearing overrides restores defaults", () => {
			setTaxonomyOverrides({
				codex: { heavy: { model: "x" }, balanced: { model: "x" }, light: { model: "x" } },
			});
			setTaxonomyOverrides(undefined);
			const result = resolveModel("opus", "codex");
			expect(result.resolved).toEqual({ model: "gpt-5.4", effort: "xhigh" });
		});

		it("partial override falls through to default for missing tiers", () => {
			setTaxonomyOverrides({
				codex: {
					heavy: { model: "custom-heavy" },
				},
			});
			const heavy = resolveModel("opus", "codex");
			expect(heavy.resolved).toEqual({ model: "custom-heavy" });

			// balanced not overridden — should use default
			const balanced = resolveModel("sonnet", "codex");
			expect(balanced.resolved).toEqual({ model: "gpt-5.4", effort: "high" });
		});
	});
});
