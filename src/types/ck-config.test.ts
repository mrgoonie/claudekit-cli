import { describe, expect, test } from "bun:test";
import {
	CkConfigSchema,
	normalizeCkConfigInput,
	normalizeMigrateProvidersInput,
} from "./ck-config.js";

describe("normalizeCkConfigInput", () => {
	test("preserves semantic statusline quota config", () => {
		const parsed = CkConfigSchema.parse({
			statuslineQuota: false,
			hooks: {
				"usage-context-awareness": true,
			},
		});

		expect(parsed.statuslineQuota).toBe(false);
		expect(parsed.hooks?.["usage-context-awareness"]).toBe(true);
	});

	test("converts a single migrateProviders string into a provider list", () => {
		const normalized = normalizeCkConfigInput({
			updatePipeline: {
				migrateProviders: "Codex",
			},
		}) as { updatePipeline: { migrateProviders: string[] } };

		expect(normalized.updatePipeline.migrateProviders).toEqual(["codex"]);
		expect(CkConfigSchema.parse(normalized).updatePipeline?.migrateProviders).toEqual(["codex"]);
	});

	test("normalizes comma-separated providers and removes duplicates", () => {
		const normalized = normalizeCkConfigInput({
			updatePipeline: {
				migrateProviders: "codex, cursor, codex",
			},
		}) as { updatePipeline: { migrateProviders: string[] } };

		expect(normalized.updatePipeline.migrateProviders).toEqual(["codex", "cursor"]);
	});

	test("preserves auto as the schema default keyword", () => {
		const normalized = normalizeCkConfigInput({
			updatePipeline: {
				migrateProviders: " auto ",
			},
		}) as { updatePipeline: { migrateProviders: string } };

		expect(normalized.updatePipeline.migrateProviders).toBe("auto");
		expect(CkConfigSchema.parse(normalized).updatePipeline?.migrateProviders).toBe("auto");
	});

	test("self-heals a pasted JSON array string", () => {
		const normalized = normalizeCkConfigInput({
			updatePipeline: {
				migrateProviders: '["Codex", "cursor"]',
			},
		}) as { updatePipeline: { migrateProviders: string[] } };

		expect(normalized.updatePipeline.migrateProviders).toEqual(["codex", "cursor"]);
		expect(CkConfigSchema.parse(normalized).updatePipeline?.migrateProviders).toEqual([
			"codex",
			"cursor",
		]);
	});
});

describe("normalizeMigrateProvidersInput", () => {
	test("accepts a quoted provider name", () => {
		expect(normalizeMigrateProvidersInput('"Codex"')).toEqual(["codex"]);
	});

	test("accepts bracketed provider lists without requiring valid JSON", () => {
		expect(normalizeMigrateProvidersInput("[codex, cursor]")).toEqual(["codex", "cursor"]);
	});
});
