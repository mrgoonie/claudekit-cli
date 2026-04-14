import { describe, expect, test } from "vitest";
import ckConfigSchema from "../../../../schemas/ck-config.schema.json" with { type: "json" };
import { GEMINI_MODEL_VALUES } from "../../../../types/ck-config.js";
import { CONFIG_FIELD_DOCS } from "../../services/configFieldDocs";
import {
	formatStringArrayUnionDisplayValue,
	normalizeStringArrayUnionInput,
	normalizeStringArrayUnionInputOnEdit,
} from "../../utils/config-editor-utils";

function getSchemaValidValues(path: string): string[] | undefined {
	let current: Record<string, unknown> = ckConfigSchema as Record<string, unknown>;

	for (const key of path.split(".")) {
		const properties = current.properties as Record<string, Record<string, unknown>> | undefined;
		if (!properties?.[key]) return undefined;
		current = properties[key];
	}

	if (Array.isArray(current.enum)) {
		return current.enum.map((value) => String(value));
	}

	if (current.items && typeof current.items === "object" && !Array.isArray(current.items)) {
		const items = current.items as Record<string, unknown>;
		if (Array.isArray(items.enum)) {
			return items.enum.map((value) => String(value));
		}
	}

	if (Array.isArray(current.oneOf)) {
		return current.oneOf
			.map((option) => {
				if (!option || typeof option !== "object") return null;
				const typedOption = option as Record<string, unknown>;
				return typedOption.const !== undefined ? String(typedOption.const) : null;
			})
			.filter((value): value is string => Boolean(value));
	}

	return undefined;
}

describe("normalizeStringArrayUnionInput", () => {
	test("maps a single provider to a string array", () => {
		expect(normalizeStringArrayUnionInput("Codex")).toEqual(["codex"]);
	});

	test("maps auto to the scalar keyword", () => {
		expect(normalizeStringArrayUnionInput(" auto ")).toBe("auto");
	});

	test("maps comma-separated values to a deduped array", () => {
		expect(normalizeStringArrayUnionInput("codex, cursor, codex")).toEqual(["codex", "cursor"]);
	});

	test("self-heals pasted JSON arrays", () => {
		expect(normalizeStringArrayUnionInput('["Codex", "cursor"]')).toEqual(["codex", "cursor"]);
	});

	test("self-heals quoted single values", () => {
		expect(normalizeStringArrayUnionInput('"Codex"')).toEqual(["codex"]);
	});

	test("defers empty drafts so auto does not snap back mid-edit", () => {
		expect(normalizeStringArrayUnionInputOnEdit("")).toBeNull();
	});

	test("still normalizes non-empty drafts while typing", () => {
		expect(normalizeStringArrayUnionInputOnEdit("codex,gemini")).toEqual(["codex", "gemini"]);
	});
});

describe("formatStringArrayUnionDisplayValue", () => {
	test("formats saved provider arrays back into comma-separated text", () => {
		expect(formatStringArrayUnionDisplayValue(["codex", "gemini"])).toBe("codex, gemini");
	});
});

describe("update pipeline field docs", () => {
	test("documents migrateProviders formatting guidance", () => {
		expect(CONFIG_FIELD_DOCS["updatePipeline.migrateProviders"]).toBeDefined();
		expect(CONFIG_FIELD_DOCS["updatePipeline.migrateProviders"]?.description).toContain(
			"comma-separated list",
		);
	});

	test("keeps curated enum metadata aligned with schema", () => {
		expect(CONFIG_FIELD_DOCS["gemini.model"]?.validValues).toEqual([...GEMINI_MODEL_VALUES]);

		for (const [path, fieldDoc] of Object.entries(CONFIG_FIELD_DOCS)) {
			if (!fieldDoc?.validValues) continue;

			const schemaValidValues = getSchemaValidValues(path);
			if (!schemaValidValues) continue;

			expect(fieldDoc.validValues).toEqual(schemaValidValues);
		}
	});

	test("keeps plan validation help text aligned with current mode names", () => {
		expect(CONFIG_FIELD_DOCS["plan.validation"]?.effect).toContain("'strict'");
		expect(CONFIG_FIELD_DOCS["plan.validation"]?.effect).toContain("'none'");
		expect(CONFIG_FIELD_DOCS["plan.validation"]?.effect).not.toContain("'off'");
		expect(CONFIG_FIELD_DOCS["plan.validation"]?.effectVi).toContain("'strict'");
		expect(CONFIG_FIELD_DOCS["plan.validation"]?.effectVi).toContain("'none'");
		expect(CONFIG_FIELD_DOCS["plan.validation"]?.effectVi).not.toContain("'off'");
	});
});

describe("statusline field docs", () => {
	test("documents the semantic quota display toggle", () => {
		expect(CONFIG_FIELD_DOCS.statuslineQuota).toBeDefined();
		expect(CONFIG_FIELD_DOCS.statuslineQuota?.description).toContain("5h / wk");
	});

	test("keeps usage-context-awareness prompt-focused", () => {
		expect(CONFIG_FIELD_DOCS["hooks.usage-context-awareness"]).toBeDefined();
		expect(CONFIG_FIELD_DOCS["hooks.usage-context-awareness"]?.description).toContain(
			"prompt context",
		);
	});
});
