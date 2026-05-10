import { describe, expect, it } from "bun:test";
import {
	buildScopedProviderConfigs,
	portableTypeSupportsScope,
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
	it("keeps Codex project-scope content project-local", () => {
		const configs = buildScopedProviderConfigs(["codex"], allTypes, false);

		expect(configs).toEqual([
			{
				provider: "codex",
				global: false,
				types: ["agent", "command", "skill", "config", "rules", "hooks"],
			},
		]);
	});

	it("keeps project-only Codex command migrations project-local", () => {
		const configs = buildScopedProviderConfigs(
			["codex"],
			{ agents: false, commands: true, skills: false, config: false, rules: false, hooks: false },
			false,
		);

		expect(configs).toEqual([
			{
				provider: "codex",
				global: false,
				types: ["command"],
			},
		]);
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

	it("resolves Codex command scope as project when project was requested", () => {
		expect(resolvePortableTypeGlobal("codex", "command", false)).toBe(false);
		expect(resolvePortableGroupGlobal("codex", "commands", false)).toBe(false);
		expect(resolvePortableGroupGlobal("codex", "config", false)).toBe(false);
		expect(portableTypeSupportsScope("codex", "command", false)).toBe(true);
		expect(portableTypeSupportsScope("codex", "command", true)).toBe(true);
	});

	it("allows Codex commands when global was explicitly selected", () => {
		expect(
			buildScopedProviderConfigs(
				["codex"],
				{
					agents: false,
					commands: true,
					skills: false,
					config: false,
					rules: false,
					hooks: false,
				},
				true,
			),
		).toEqual([
			{
				provider: "codex",
				global: true,
				types: ["command"],
			},
		]);
	});
});
