import { describe, expect, it } from "bun:test";
import {
	detectProviderPathCollisions,
	getProvidersSupporting,
	providers,
} from "../provider-registry.js";
import type { ProviderType } from "../types.js";

const ALL_PROVIDERS: ProviderType[] = [
	"claude-code",
	"cursor",
	"codex",
	"droid",
	"opencode",
	"goose",
	"gemini-cli",
	"antigravity",
	"github-copilot",
	"amp",
	"kilo",
	"roo",
	"windsurf",
	"cline",
	"openhands",
];

describe("provider-registry", () => {
	describe("config entries", () => {
		it("all 15 providers have config entry", () => {
			for (const provider of ALL_PROVIDERS) {
				expect(providers[provider].config).not.toBeNull();
			}
		});

		it("getProvidersSupporting('config') returns array of length 15", () => {
			const supporting = getProvidersSupporting("config");
			expect(supporting).toHaveLength(15);
		});

		it("Claude Code uses direct-copy for config", () => {
			expect(providers["claude-code"].config?.format).toBe("direct-copy");
		});

		it("Cursor uses md-to-mdc for config", () => {
			expect(providers.cursor.config?.format).toBe("md-to-mdc");
		});

		it("Codex uses md-strip for config", () => {
			expect(providers.codex.config?.format).toBe("md-strip");
		});

		it("Windsurf config has charLimit 6000", () => {
			expect(providers.windsurf.config?.charLimit).toBe(6000);
		});

		it("config uses merge-single whenever config shares exact target file with agents/rules", () => {
			for (const provider of ALL_PROVIDERS) {
				const providerConfig = providers[provider];
				const config = providerConfig.config;
				if (!config) continue;

				const sharesProjectPath =
					config.projectPath !== null &&
					((providerConfig.agents?.projectPath ?? null) === config.projectPath ||
						(providerConfig.rules?.projectPath ?? null) === config.projectPath);
				const sharesGlobalPath =
					config.globalPath !== null &&
					((providerConfig.agents?.globalPath ?? null) === config.globalPath ||
						(providerConfig.rules?.globalPath ?? null) === config.globalPath);
				const sharesAnyPath = sharesProjectPath || sharesGlobalPath;

				if (sharesAnyPath) {
					expect(config.writeStrategy).toBe("merge-single");
				} else {
					expect(config.writeStrategy).toBe("single-file");
				}
			}
		});

		it("all config entries have fileExtension", () => {
			for (const provider of ALL_PROVIDERS) {
				const config = providers[provider].config;
				if (config) {
					expect(config.fileExtension).toBeDefined();
					expect(typeof config.fileExtension).toBe("string");
				}
			}
		});

		it("Codex config projectPath is AGENTS.md", () => {
			expect(providers.codex.config?.projectPath).toBe("AGENTS.md");
		});

		it("Codex global rules merge into AGENTS.md", () => {
			const rulesPath = providers.codex.rules?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(providers.codex.rules?.writeStrategy).toBe("merge-single");
			expect(rulesPath).toContain(".codex/AGENTS.md");
		});

		it("Goose config projectPath is .goosehints", () => {
			expect(providers.goose.config?.projectPath).toBe(".goosehints");
		});

		it("Droid uses AGENTS.md + .factory global config path", () => {
			expect(providers.droid.config?.projectPath).toBe("AGENTS.md");
			const droidConfigPath = providers.droid.config?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(droidConfigPath).toContain(".factory/AGENTS.md");
		});

		it("Windsurf rules use per-file directory layout", () => {
			const rulesPath = providers.windsurf.rules?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(providers.windsurf.rules?.writeStrategy).toBe("per-file");
			expect(rulesPath).toContain(".codeium/windsurf/rules");
		});
	});

	describe("rules entries", () => {
		it("all 15 providers have rules entry", () => {
			for (const provider of ALL_PROVIDERS) {
				expect(providers[provider].rules).not.toBeNull();
			}
		});

		it("getProvidersSupporting('rules') returns array of length 15", () => {
			const supporting = getProvidersSupporting("rules");
			expect(supporting).toHaveLength(15);
		});
	});

	describe("hooks entries", () => {
		it("Claude Code, Droid, and Codex have hooks migration entries", () => {
			expect(providers["claude-code"].hooks).not.toBeNull();
			expect(providers.droid.hooks).not.toBeNull();
			expect(providers.codex.hooks).not.toBeNull();
			for (const provider of ALL_PROVIDERS) {
				if (provider === "claude-code" || provider === "droid" || provider === "codex") continue;
				expect(providers[provider].hooks ?? null).toBeNull();
			}
		});

		it("getProvidersSupporting('hooks') returns claude-code, droid, and codex", () => {
			const supporting = getProvidersSupporting("hooks");
			expect(supporting).toHaveLength(3);
			expect(supporting).toContain("claude-code");
			expect(supporting).toContain("droid");
			expect(supporting).toContain("codex");
		});

		it("Claude Code hooks path points to .claude/hooks", () => {
			expect(providers["claude-code"].hooks?.projectPath).toBe(".claude/hooks");
			const ccHooksPath = providers["claude-code"].hooks?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(ccHooksPath).toContain(".claude/hooks");
		});

		it("Droid hooks path points to .factory/hooks", () => {
			expect(providers.droid.hooks?.projectPath).toBe(".factory/hooks");
			const droidHooksPath = providers.droid.hooks?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(droidHooksPath).toContain(".factory/hooks");
		});

		it("Claude Code, Droid, and Codex have settingsJsonPath for hooks registration", () => {
			expect(providers["claude-code"].settingsJsonPath).toBeDefined();
			expect(providers["claude-code"].settingsJsonPath?.projectPath).toBe(".claude/settings.json");
			const ccSettingsPath =
				providers["claude-code"].settingsJsonPath?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(ccSettingsPath).toContain(".claude/settings.json");

			expect(providers.droid.settingsJsonPath).toBeDefined();
			expect(providers.droid.settingsJsonPath?.projectPath).toBe(".factory/settings.json");
			const droidSettingsPath =
				providers.droid.settingsJsonPath?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(droidSettingsPath).toContain(".factory/settings.json");

			// Codex uses standalone hooks.json (not embedded in settings.json)
			expect(providers.codex.settingsJsonPath).toBeDefined();
			expect(providers.codex.settingsJsonPath?.projectPath).toBe(".codex/hooks.json");
			const codexSettingsPath =
				providers.codex.settingsJsonPath?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(codexSettingsPath).toContain(".codex/hooks.json");
		});

		it("other providers do not have settingsJsonPath", () => {
			for (const provider of ALL_PROVIDERS) {
				if (provider === "claude-code" || provider === "droid" || provider === "codex") continue;
				expect(providers[provider].settingsJsonPath).toBeNull();
			}
		});
	});

	describe("skills path consolidation to .agents/skills", () => {
		it("opencode skills projectPath is .claude/skills for native Claude compatibility", () => {
			expect(providers.opencode.skills?.projectPath).toBe(".claude/skills");
		});

		it("opencode skills globalPath points to .claude/skills to avoid duplicate shadows", () => {
			const globalPath = providers.opencode.skills?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(globalPath).toContain(".claude/skills");
			expect(globalPath).not.toContain(".config/opencode/skills");
		});

		it("gemini-cli skills projectPath is .agents/skills", () => {
			expect(providers["gemini-cli"].skills?.projectPath).toBe(".agents/skills");
		});

		it("gemini-cli skills globalPath points to .agents/skills", () => {
			const globalPath = providers["gemini-cli"].skills?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(globalPath).toContain(".agents/skills");
			expect(globalPath).not.toContain(".gemini/skills");
		});

		it("windsurf skills projectPath is .agents/skills", () => {
			expect(providers.windsurf.skills?.projectPath).toBe(".agents/skills");
		});

		it("windsurf skills globalPath points to .agents/skills (not .codeium)", () => {
			const globalPath = providers.windsurf.skills?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(globalPath).toContain(".agents/skills");
			expect(globalPath).not.toContain(".codeium/windsurf/skills");
		});

		it("cursor skills projectPath is .agents/skills", () => {
			expect(providers.cursor.skills?.projectPath).toBe(".agents/skills");
		});

		it("cursor skills globalPath stays at .cursor/skills (no global .agents/ support)", () => {
			const globalPath = providers.cursor.skills?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(globalPath).toContain(".cursor/skills");
		});

		it("codex skills projectPath remains .agents/skills after detection cleanup", () => {
			expect(providers.codex.skills?.projectPath).toBe(".agents/skills");
		});
	});

	describe("detectProviderPathCollisions", () => {
		it("detects claude-code+opencode skills path collision in project scope", () => {
			const collisions = detectProviderPathCollisions(["claude-code", "opencode"], {
				global: false,
			});
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			expect(skillCollisions).toHaveLength(1);
			expect(skillCollisions[0].path).toBe(".claude/skills");
			expect(skillCollisions[0].providers).toContain("claude-code");
			expect(skillCollisions[0].providers).toContain("opencode");
		});

		it("detects codex+amp skills path collision in project scope", () => {
			const collisions = detectProviderPathCollisions(["codex", "amp"], { global: false });
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			expect(skillCollisions).toHaveLength(1);
			expect(skillCollisions[0].path).toBe(".agents/skills");
			expect(skillCollisions[0].providers).toContain("codex");
			expect(skillCollisions[0].providers).toContain("amp");
		});

		it("antigravity uses different path (.agent/skills) — no collision with codex+amp", () => {
			const collisions = detectProviderPathCollisions(["codex", "amp", "antigravity"], {
				global: false,
			});
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			// codex+amp collide on .agents/skills, but antigravity uses .agent/skills (no collision)
			expect(skillCollisions).toHaveLength(1);
			expect(skillCollisions[0].providers).not.toContain("antigravity");
		});

		it("returns empty array when no providers collide", () => {
			const collisions = detectProviderPathCollisions(["claude-code", "cursor"], {
				global: false,
			});
			expect(collisions).toHaveLength(0);
		});

		it("returns empty array for single provider", () => {
			const collisions = detectProviderPathCollisions(["codex"], { global: false });
			expect(collisions).toHaveLength(0);
		});

		it("returns empty array for empty provider list", () => {
			const collisions = detectProviderPathCollisions([], { global: false });
			expect(collisions).toHaveLength(0);
		});

		it("no collision in global scope for codex+amp (different global paths)", () => {
			const collisions = detectProviderPathCollisions(["codex", "amp"], { global: true });
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			// codex: ~/.agents/skills, amp: ~/.config/agents/skills — different global paths
			expect(skillCollisions).toHaveLength(0);
		});

		it("collision metadata includes global flag", () => {
			const collisions = detectProviderPathCollisions(["codex", "amp"], { global: false });
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			expect(skillCollisions[0].global).toBe(false);
		});

		it("detects 5-provider .agents/skills collision after consolidation", () => {
			const allConsolidated: ProviderType[] = ["codex", "amp", "gemini-cli", "windsurf", "cursor"];
			const collisions = detectProviderPathCollisions(allConsolidated, { global: false });
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			expect(skillCollisions).toHaveLength(1);
			expect(skillCollisions[0].path).toBe(".agents/skills");
			expect(skillCollisions[0].providers).toHaveLength(5);
		});

		it("global scope: gemini-cli + codex + windsurf collide on ~/.agents/skills", () => {
			const collisions = detectProviderPathCollisions(["codex", "gemini-cli", "windsurf"], {
				global: true,
			});
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			expect(skillCollisions).toHaveLength(1);
			expect(skillCollisions[0].providers).toHaveLength(3);
		});

		it("global scope: cursor does NOT collide with codex (different global paths)", () => {
			const collisions = detectProviderPathCollisions(["codex", "cursor"], { global: true });
			const skillCollisions = collisions.filter((c) => c.portableType === "skills");
			expect(skillCollisions).toHaveLength(0);
		});
	});
});
