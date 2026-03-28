import { describe, expect, test } from "bun:test";
import { CONFIG_FIELD_DOCS } from "../../services/configFieldDocs";
import { normalizeStringArrayUnionInput } from "./FieldRenderers";

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
});

describe("update pipeline field docs", () => {
	test("documents migrateProviders formatting guidance", () => {
		expect(CONFIG_FIELD_DOCS["updatePipeline.migrateProviders"]).toBeDefined();
		expect(CONFIG_FIELD_DOCS["updatePipeline.migrateProviders"]?.description).toContain(
			"comma-separated list",
		);
	});
});
