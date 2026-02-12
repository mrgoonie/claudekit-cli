import { describe, expect, it } from "bun:test";
import {
	getAllProviderTypes,
	getProvidersSupporting,
	providers,
} from "../../../src/commands/portable/provider-registry.js";

describe("Provider Registry", () => {
	describe("getAllProviderTypes", () => {
		it("returns all 14 providers", () => {
			const allProviders = getAllProviderTypes();

			expect(allProviders).toHaveLength(14);
			expect(allProviders).toContain("claude-code");
			expect(allProviders).toContain("opencode");
			expect(allProviders).toContain("github-copilot");
			expect(allProviders).toContain("codex");
			expect(allProviders).toContain("cursor");
			expect(allProviders).toContain("roo");
			expect(allProviders).toContain("kilo");
			expect(allProviders).toContain("windsurf");
			expect(allProviders).toContain("goose");
			expect(allProviders).toContain("gemini-cli");
			expect(allProviders).toContain("amp");
			expect(allProviders).toContain("antigravity");
			expect(allProviders).toContain("cline");
			expect(allProviders).toContain("openhands");
		});
	});

	describe("providers object structure", () => {
		it("each provider has name, displayName, detect function", () => {
			const allProviders = getAllProviderTypes();

			for (const providerType of allProviders) {
				const config = providers[providerType];
				expect(config.name).toBe(providerType);
				expect(typeof config.displayName).toBe("string");
				expect(typeof config.detect).toBe("function");
			}
		});
	});

	describe("getProvidersSupporting", () => {
		it("returns providers with non-null agents config", () => {
			const withAgents = getProvidersSupporting("agents");

			// All 14 providers support agents
			expect(withAgents).toHaveLength(14);

			// Verify each has non-null agents config
			for (const provider of withAgents) {
				expect(providers[provider].agents).not.toBeNull();
			}
		});

		it("returns limited set for commands (only 4 providers)", () => {
			const withCommands = getProvidersSupporting("commands");

			expect(withCommands).toHaveLength(4);
			expect(withCommands).toContain("claude-code");
			expect(withCommands).toContain("opencode");
			expect(withCommands).toContain("codex");
			expect(withCommands).toContain("gemini-cli");

			// Verify each has non-null commands config
			for (const provider of withCommands) {
				expect(providers[provider].commands).not.toBeNull();
			}
		});

		it("returns providers with non-null skills config", () => {
			const withSkills = getProvidersSupporting("skills");

			// All providers that support agents also support skills
			expect(withSkills).toHaveLength(14);

			// Verify each has non-null skills config
			for (const provider of withSkills) {
				expect(providers[provider].skills).not.toBeNull();
			}
		});
	});

	describe("Provider agent format validation", () => {
		it("cursor uses fm-to-fm format for agents", () => {
			expect(providers.cursor.agents?.format).toBe("fm-to-fm");
		});

		it("github-copilot uses fm-to-fm format for agents", () => {
			expect(providers["github-copilot"].agents?.format).toBe("fm-to-fm");
		});

		it("roo uses fm-to-yaml format for agents", () => {
			expect(providers.roo.agents?.format).toBe("fm-to-yaml");
		});

		it("windsurf uses fm-strip format for agents", () => {
			expect(providers.windsurf.agents?.format).toBe("fm-strip");
		});

		it("cline uses fm-to-json format for agents", () => {
			expect(providers.cline.agents?.format).toBe("fm-to-json");
		});

		it("gemini-cli uses md-to-toml for commands", () => {
			expect(providers["gemini-cli"].commands?.format).toBe("md-to-toml");
		});

		it("openhands uses skill-md for agents", () => {
			expect(providers.openhands.agents?.format).toBe("skill-md");
		});
	});

	describe("Write strategy validation", () => {
		it("cursor uses per-file for agents", () => {
			expect(providers.cursor.agents?.writeStrategy).toBe("per-file");
		});

		it("goose uses merge-single for agents", () => {
			expect(providers.goose.agents?.writeStrategy).toBe("merge-single");
		});

		it("roo uses yaml-merge for agents", () => {
			expect(providers.roo.agents?.writeStrategy).toBe("yaml-merge");
		});

		it("cline uses json-merge for agents", () => {
			expect(providers.cline.agents?.writeStrategy).toBe("json-merge");
		});
	});

	describe("Commands support check", () => {
		it("only 4 providers support commands", () => {
			const commandsProviders = getProvidersSupporting("commands");
			expect(commandsProviders).toHaveLength(4);
		});

		it("providers without commands have null commands config", () => {
			const allProviders = getAllProviderTypes();
			const commandsProviders = getProvidersSupporting("commands");

			for (const provider of allProviders) {
				if (commandsProviders.includes(provider)) {
					expect(providers[provider].commands).not.toBeNull();
				} else {
					expect(providers[provider].commands).toBeNull();
				}
			}
		});
	});

	describe("Skills support check", () => {
		it("all providers that support agents also support skills", () => {
			const agentProviders = getProvidersSupporting("agents");
			const skillProviders = getProvidersSupporting("skills");

			// All agent providers should support skills
			expect(agentProviders.sort()).toEqual(skillProviders.sort());
		});

		it("skills paths align with agents for providers", () => {
			const agentProviders = getProvidersSupporting("agents");

			for (const provider of agentProviders) {
				const config = providers[provider];
				// Both agents and skills should exist
				expect(config.agents).not.toBeNull();
				expect(config.skills).not.toBeNull();
			}
		});
	});

	describe("Specific provider configurations", () => {
		it("claude-code has correct agent configuration", () => {
			const config = providers["claude-code"];
			expect(config.agents?.projectPath).toBe(".claude/agents");
			expect(config.agents?.format).toBe("direct-copy");
			expect(config.agents?.writeStrategy).toBe("per-file");
			expect(config.agents?.fileExtension).toBe(".md");
		});

		it("windsurf has character limit for agents", () => {
			const config = providers.windsurf;
			expect(config.agents?.charLimit).toBe(12000);
		});

		it("codex has global-only commands", () => {
			const config = providers.codex;
			expect(config.commands?.projectPath).toBeNull();
			expect(config.commands?.globalPath).toContain(".codex/prompts");
		});

		it("github-copilot uses .agent.md extension", () => {
			const config = providers["github-copilot"];
			expect(config.agents?.fileExtension).toBe(".agent.md");
		});

		it("kilo uses yaml-merge write strategy", () => {
			const config = providers.kilo;
			expect(config.agents?.writeStrategy).toBe("yaml-merge");
			expect(config.agents?.format).toBe("fm-to-yaml");
		});
	});
});
