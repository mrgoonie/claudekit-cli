import { describe, expect, test } from "bun:test";
import { CONFIG_FIELD_DOCS } from "../../services/configFieldDocs";
import {
	formatStringArrayUnionDisplayValue,
	normalizeStringArrayUnionInput,
	normalizeStringArrayUnionInputOnEdit,
} from "../../utils/config-editor-utils";

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
