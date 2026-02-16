import { describe, expect, it } from "bun:test";
import { getProvidersSupporting, providers } from "../provider-registry.js";
import type { ProviderType } from "../types.js";

const ALL_PROVIDERS: ProviderType[] = [
	"claude-code",
	"cursor",
	"codex",
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
		it("all 14 providers have config entry", () => {
			for (const provider of ALL_PROVIDERS) {
				expect(providers[provider].config).not.toBeNull();
			}
		});

		it("getProvidersSupporting('config') returns array of length 14", () => {
			const supporting = getProvidersSupporting("config");
			expect(supporting).toHaveLength(14);
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

		it("Codex global rules target a single rules.md file", () => {
			const rulesPath = providers.codex.rules?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(providers.codex.rules?.writeStrategy).toBe("merge-single");
			expect(rulesPath).toContain(".codex/prompts/rules.md");
		});

		it("Goose config projectPath is .goosehints", () => {
			expect(providers.goose.config?.projectPath).toBe(".goosehints");
		});

		it("Windsurf rules use per-file directory layout", () => {
			const rulesPath = providers.windsurf.rules?.globalPath?.replace(/\\/g, "/") ?? "";
			expect(providers.windsurf.rules?.writeStrategy).toBe("per-file");
			expect(rulesPath).toContain(".codeium/windsurf/rules");
		});
	});

	describe("rules entries", () => {
		it("all 14 providers have rules entry", () => {
			for (const provider of ALL_PROVIDERS) {
				expect(providers[provider].rules).not.toBeNull();
			}
		});

		it("getProvidersSupporting('rules') returns array of length 14", () => {
			const supporting = getProvidersSupporting("rules");
			expect(supporting).toHaveLength(14);
		});
	});
});
