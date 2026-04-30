import { describe, expect, it } from "bun:test";
import {
	buildScopedProviderConfigs,
	resolvePortableGroupGlobal,
	resolvePortableTypeGlobal,
} from "../migrate-provider-scopes.js";
import type { MigrationScope } from "../migrate-scope-resolver.js";

const allTypes: MigrationScope = {
	agents: true,
	commands: true,
	skills: true,
	config: true,
	rules: true,
	hooks: true,
};

describe("migrate provider scopes", () => {
	it("keeps Codex project-scope content project-local while forcing commands global", () => {
		const configs = buildScopedProviderConfigs(["codex"], allTypes, false);

		expect(configs).toContainEqual({
			provider: "codex",
			global: false,
			types: ["agent", "skill", "config", "rules", "hooks"],
		});
		expect(configs).toContainEqual({
			provider: "codex",
			global: true,
			types: ["command"],
		});
	});

	it("uses the requested global scope when global was explicitly selected", () => {
		const configs = buildScopedProviderConfigs(["codex"], allTypes, true);

		expect(configs).toEqual([
			{
				provider: "codex",
				global: true,
				types: ["agent", "command", "skill", "config", "rules", "hooks"],
			},
		]);
	});

	it("resolves Codex command destinations as global in project migration summaries", () => {
		expect(resolvePortableTypeGlobal("codex", "command", false)).toBe(true);
		expect(resolvePortableGroupGlobal("codex", "commands", false)).toBe(true);
		expect(resolvePortableGroupGlobal("codex", "config", false)).toBe(false);
	});
});
