import { describe, expect, it } from "bun:test";
import {
	getAllProviderTypes,
	getProvidersSupporting,
	providers,
} from "../../../src/commands/portable/provider-registry.js";

describe("Provider Registry", () => {
	describe("getAllProviderTypes", () => {
		it("returns all 16 providers", () => {
			const allProviders = getAllProviderTypes();

			expect(allProviders).toHaveLength(16);
			expect(allProviders).toContain("claude-code");
			expect(allProviders).toContain("opencode");
			expect(allProviders).toContain("github-copilot");
			expect(allProviders).toContain("codex");
			expect(allProviders).toContain("droid");
			expect(allProviders).toContain("cursor");
			expect(allProviders).toContain("roo");
			expect(allProviders).toContain("kilo");
			expect(allProviders).toContain("kiro");
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

			// 15 of 16 providers support agents (antigravity has agents=null)
			expect(withAgents).toHaveLength(15);
			expect(withAgents).not.toContain("antigravity");

			// Verify each has non-null agents config
			for (const provider of withAgents) {
				expect(providers[provider].agents).not.toBeNull();
			}
		});

		it("returns providers supporting commands (7 providers)", () => {
			const withCommands = getProvidersSupporting("commands");

			expect(withCommands).toHaveLength(7);
			expect(withCommands).toContain("claude-code");
			expect(withCommands).toContain("opencode");
			expect(withCommands).toContain("codex");
			expect(withCommands).toContain("droid");
			expect(withCommands).toContain("gemini-cli");
			expect(withCommands).toContain("antigravity");
			expect(withCommands).toContain("windsurf");

			// Verify each has non-null commands config
			for (const provider of withCommands) {
				expect(providers[provider].commands).not.toBeNull();
			}
		});

		it("returns providers with non-null skills config", () => {
			const withSkills = getProvidersSupporting("skills");

			// All providers that support agents also support skills
			expect(withSkills).toHaveLength(16);

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

		it("cline uses fm-strip format for agents", () => {
			expect(providers.cline.agents?.format).toBe("fm-strip");
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

		it("cline uses per-file for agents", () => {
			expect(providers.cline.agents?.writeStrategy).toBe("per-file");
		});
	});

	describe("Commands support check", () => {
		it("7 providers support commands", () => {
			const commandsProviders = getProvidersSupporting("commands");
			expect(commandsProviders).toHaveLength(7);
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

			// Every agent provider must also support skills (skills is a superset)
			for (const p of agentProviders) {
				expect(skillProviders).toContain(p);
			}
			// Antigravity supports skills but not agents (agents ARE skills in Antigravity)
			expect(skillProviders).toContain("antigravity");
			expect(agentProviders).not.toContain("antigravity");
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

	describe("Subagent support field", () => {
		it("all 16 providers have a subagents field", () => {
			const allProviders = getAllProviderTypes();
			for (const providerType of allProviders) {
				const config = providers[providerType];
				expect(["full", "partial", "none", "planned"]).toContain(config.subagents);
			}
		});

		it("windsurf has subagents: none", () => {
			expect(providers.windsurf.subagents).toBe("none");
		});

		it("codex has subagents: full", () => {
			expect(providers.codex.subagents).toBe("full");
		});

		it("gemini-cli has subagents: planned", () => {
			expect(providers["gemini-cli"].subagents).toBe("planned");
		});

		it("remaining providers have subagents: full", () => {
			const fullProviders = [
				"claude-code",
				"cursor",
				"antigravity",
				"goose",
				"amp",
				"opencode",
				"roo",
				"droid",
				"cline",
				"github-copilot",
				"kilo",
				"openhands",
			] as const;
			for (const p of fullProviders) {
				expect(providers[p].subagents).toBe("full");
			}
		});

		it("kiro has subagents: none (steering context, not delegation)", () => {
			expect(providers.kiro.subagents).toBe("none");
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

		it("antigravity has no agents (agents are skills in Antigravity)", () => {
			const config = providers.antigravity;
			expect(config.agents).toBeNull();
		});

		it("antigravity uses correct paths for commands, skills, config, rules", () => {
			const config = providers.antigravity;
			// Commands (workflows): project only, no verified global path
			expect(config.commands).not.toBeNull();
			expect(config.commands?.projectPath).toBe(".agent/workflows");
			expect(config.commands?.globalPath).toBeNull();

			// Skills: project .agent/skills/, global ~/.gemini/antigravity/skills
			expect(config.skills?.projectPath).toBe(".agent/skills");
			const skillsGlobal = config.skills?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(skillsGlobal).toContain(".gemini/antigravity/skills");

			// Rules: project .agent/rules/, no verified global path
			expect(config.rules?.projectPath).toBe(".agent/rules");
			expect(config.rules?.globalPath).toBeNull();

			// Config: GEMINI.md → ~/.gemini/GEMINI.md (shared with Gemini CLI)
			expect(config.config?.projectPath).toBe("GEMINI.md");
			const configGlobal = config.config?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(configGlobal).toMatch(/\.gemini\/GEMINI\.md$/);
		});

		it("windsurf commands use workflows path", () => {
			const config = providers.windsurf;
			expect(config.commands).not.toBeNull();
			expect(config.commands?.projectPath).toBe(".windsurf/workflows");
			const globalPath = config.commands?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(globalPath).toContain(".codeium/windsurf/workflows");
		});

		it("codex has global-only commands", () => {
			const config = providers.codex;
			expect(config.commands?.projectPath).toBeNull();
			// path.join uses OS-specific separators, so normalize for comparison
			const globalPath = config.commands?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(globalPath).toContain(".codex/prompts");
		});

		it("codex global rules merge into AGENTS.md", () => {
			const rulesPath = providers.codex.rules?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(providers.codex.rules?.writeStrategy).toBe("merge-single");
			expect(rulesPath).toContain(".codex/AGENTS.md");
		});

		it("windsurf rules use per-file directory strategy", () => {
			const rulesPath = providers.windsurf.rules?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(providers.windsurf.rules?.writeStrategy).toBe("per-file");
			expect(rulesPath).toContain(".codeium/windsurf/rules");
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
