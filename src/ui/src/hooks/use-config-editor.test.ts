import { describe, expect, test } from "bun:test";
import { buildSchemaFieldDoc, resolveActiveFieldPath } from "../utils/config-editor-utils";

const schema = {
	type: "object",
	properties: {
		updatePipeline: {
			type: "object",
			properties: {
				autoInitAfterUpdate: {
					type: "boolean",
					default: false,
					description: "Automatically run ck init after ck update when kit has new version",
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
		expect(resolveActiveFieldPath("updatePipeline.autoInitAfterUpdate", "experimental.mode")).toBe(
			"updatePipeline.autoInitAfterUpdate",
		);
	});

	test("falls back to the JSON cursor field when form focus is cleared", () => {
		expect(resolveActiveFieldPath(null, "experimental.mode")).toBe("experimental.mode");
	});
});

describe("buildSchemaFieldDoc", () => {
	test("returns curated docs for autoInitAfterUpdate", () => {
		const fieldDoc = buildSchemaFieldDoc("updatePipeline.autoInitAfterUpdate", schema);

		expect(fieldDoc?.path).toBe("updatePipeline.autoInitAfterUpdate");
		expect(fieldDoc?.description).toContain("Automatically run");
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
