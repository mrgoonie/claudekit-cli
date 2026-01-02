/**
 * Tests for kit-comparison data structures
 */
import { describe, expect, it, vi } from "vitest";
import {
	KIT_COMPARISONS,
	KIT_FEATURES,
	getKitFeatures,
} from "../kit-comparison";

describe("kit-comparison data", () => {
	describe("KIT_FEATURES", () => {
		it("contains 6 features", () => {
			expect(KIT_FEATURES).toHaveLength(6);
		});

		it("has required properties for each feature", () => {
			for (const feature of KIT_FEATURES) {
				expect(feature).toHaveProperty("id");
				expect(feature).toHaveProperty("name");
				expect(feature).toHaveProperty("description");
				expect(feature).toHaveProperty("engineer");
				expect(feature).toHaveProperty("marketing");
			}
		});

		it("has agents, hooks, skills features for both kits", () => {
			const sharedFeatures = KIT_FEATURES.filter((f) => f.engineer && f.marketing);
			expect(sharedFeatures.map((f) => f.id)).toContain("agents");
			expect(sharedFeatures.map((f) => f.id)).toContain("hooks");
			expect(sharedFeatures.map((f) => f.id)).toContain("skills");
		});

		it("has multiagent for engineer only", () => {
			const multiagent = KIT_FEATURES.find((f) => f.id === "multiagent");
			expect(multiagent?.engineer).toBe(true);
			expect(multiagent?.marketing).toBe(false);
		});

		it("has content and social for marketing only", () => {
			const content = KIT_FEATURES.find((f) => f.id === "content");
			const social = KIT_FEATURES.find((f) => f.id === "social");
			expect(content?.engineer).toBe(false);
			expect(content?.marketing).toBe(true);
			expect(social?.engineer).toBe(false);
			expect(social?.marketing).toBe(true);
		});
	});

	describe("KIT_COMPARISONS", () => {
		it("contains engineer and marketing kits", () => {
			expect(KIT_COMPARISONS).toHaveProperty("engineer");
			expect(KIT_COMPARISONS).toHaveProperty("marketing");
		});

		it("engineer kit has correct properties", () => {
			const engineer = KIT_COMPARISONS.engineer;
			expect(engineer.id).toBe("engineer");
			expect(engineer.name).toBe("kitEngineerName");
			expect(engineer.tagline).toBe("kitEngineerTagline");
			expect(engineer.primaryColor).toBe("text-blue-500");
			expect(engineer.features).toContain("multiagent");
		});

		it("marketing kit has correct properties", () => {
			const marketing = KIT_COMPARISONS.marketing;
			expect(marketing.id).toBe("marketing");
			expect(marketing.name).toBe("kitMarketingName");
			expect(marketing.tagline).toBe("kitMarketingTagline");
			expect(marketing.primaryColor).toBe("text-purple-500");
			expect(marketing.features).toContain("content");
			expect(marketing.features).toContain("social");
		});
	});

	describe("getKitFeatures", () => {
		it("returns 4 features for engineer kit", () => {
			const features = getKitFeatures("engineer");
			expect(features).toHaveLength(4);
			expect(features.map((f) => f.id)).toEqual(["agents", "hooks", "skills", "multiagent"]);
		});

		it("returns 5 features for marketing kit", () => {
			const features = getKitFeatures("marketing");
			expect(features).toHaveLength(5);
			expect(features.map((f) => f.id)).toEqual(["agents", "hooks", "skills", "content", "social"]);
		});

		it("returns empty array for invalid kit type", () => {
			// Mock console.warn to prevent test output pollution
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// @ts-expect-error - testing invalid input
			const features = getKitFeatures("invalid");
			expect(features).toEqual([]);
			expect(warnSpy).toHaveBeenCalledWith("Unknown kit type: invalid");

			warnSpy.mockRestore();
		});

		it("returns all KitFeature objects with complete properties", () => {
			const features = getKitFeatures("engineer");
			for (const feature of features) {
				expect(feature.id).toBeDefined();
				expect(feature.name).toBeDefined();
				expect(feature.description).toBeDefined();
				expect(typeof feature.engineer).toBe("boolean");
				expect(typeof feature.marketing).toBe("boolean");
			}
		});
	});
});
