import { describe, expect, test } from "vitest";
import { buildSchemaFieldDoc, resolveActiveFieldPath } from "../utils/config-editor-utils";

const schema = {
	type: "object",
	properties: {
		updatePipeline: {
			type: "object",
			properties: {
				migrateProviders: {
					oneOf: [{ const: "auto" }, { type: "array", items: { type: "string" } }],
					default: "auto",
					description: "Choose providers to auto-migrate after init.",
				},
			},
		},
		experimental: {
			type: "object",
			properties: {
				mode: {
					type: "string",
					enum: ["off", "guided"],
					default: "off",
					description: "Schema-only fallback help.",
				},
			},
		},
	},
} satisfies Record<string, unknown>;

describe("resolveActiveFieldPath", () => {
	test("prefers explicit form focus over the JSON cursor field", () => {
		expect(resolveActiveFieldPath("updatePipeline.migrateProviders", "experimental.mode")).toBe(
			"updatePipeline.migrateProviders",
		);
	});

	test("falls back to the JSON cursor field when form focus is cleared", () => {
		expect(resolveActiveFieldPath(null, "experimental.mode")).toBe("experimental.mode");
	});
});

describe("buildSchemaFieldDoc", () => {
	test("returns curated docs for migrateProviders", () => {
		const fieldDoc = buildSchemaFieldDoc("updatePipeline.migrateProviders", schema);

		expect(fieldDoc?.path).toBe("updatePipeline.migrateProviders");
		expect(fieldDoc?.description).toContain("Choose which providers");
		expect(fieldDoc?.validValues).toEqual(["auto"]);
	});

	test("builds schema-derived docs when no curated entry exists", () => {
		const fieldDoc = buildSchemaFieldDoc("experimental.mode", schema);

		expect(fieldDoc).toEqual({
			path: "experimental.mode",
			type: "string",
			default: '"off"',
			validValues: ["off", "guided"],
			description: "Schema-only fallback help.",
			descriptionVi: "Schema-only fallback help.",
		});
	});
});
