import { describe, expect, test } from "vitest";
import skillSchema from "../../../../domains/skills/skill-schema.json";
import { CATEGORY_COLORS, CATEGORY_MAP, CATEGORY_ORDER } from "../skills-dashboard-types.js";

const schemaCategories: string[] =
	(skillSchema.properties?.category as { enum?: string[] })?.enum ?? [];

describe("CATEGORY_MAP", () => {
	test("T1: all engineer categories mapped", () => {
		for (const cat of schemaCategories) {
			expect(CATEGORY_MAP[cat]).toBeDefined();
		}
	});

	test("T2: all mapped categories have colors", () => {
		for (const displayName of Object.values(CATEGORY_MAP)) {
			expect(CATEGORY_COLORS[displayName]).toBeDefined();
		}
	});

	test("T3: all mapped categories in sort order", () => {
		for (const displayName of Object.values(CATEGORY_MAP)) {
			expect(CATEGORY_ORDER).toContain(displayName);
		}
	});

	test("T4: no orphaned colors — every color key is reachable via CATEGORY_MAP", () => {
		const reachable = new Set(Object.values(CATEGORY_MAP));
		for (const colorKey of Object.keys(CATEGORY_COLORS)) {
			expect(reachable.has(colorKey)).toBe(true);
		}
	});

	test("T5: mapping produces display name", () => {
		expect(CATEGORY_MAP["dev-tools"]).toBe("Tooling");
		expect(CATEGORY_MAP.utilities).toBe("Core");
		expect(CATEGORY_MAP["ai-ml"]).toBe("AI");
	});

	test("T6: unknown category passes through", () => {
		const unknown = "never-seen-before";
		const result = CATEGORY_MAP[unknown] || unknown;
		expect(result).toBe(unknown);
	});
});
