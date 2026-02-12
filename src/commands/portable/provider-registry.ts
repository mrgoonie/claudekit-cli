/**
 * Provider registry — defines all 14 supported providers with their
 * path configurations for agents, commands, and skills.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig, ProviderType } from "./types.js";

const home = homedir();

/**
 * Registry of all supported providers with paths for agents, commands, and skills.
 */
export const providers: Record<ProviderType, ProviderConfig> = {
	"claude-code": {
		name: "claude-code",
		displayName: "Claude Code",
		agents: {
			projectPath: ".claude/agents",
			globalPath: join(home, ".claude/agents"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".claude/commands",
			globalPath: join(home, ".claude/commands"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			projectPath: ".claude/skills",
			globalPath: join(home, ".claude/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "CLAUDE.md",
			globalPath: join(home, ".claude/CLAUDE.md"),
			format: "direct-copy",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".claude/rules",
			globalPath: join(home, ".claude/rules"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".claude")),
	},
	opencode: {
		name: "opencode",
		displayName: "OpenCode",
		agents: {
			projectPath: ".opencode/agents",
			globalPath: join(home, ".config/opencode/agents"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".opencode/commands",
			globalPath: join(home, ".config/opencode/commands"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			projectPath: ".opencode/skill",
			globalPath: join(home, ".config/opencode/skill"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/opencode/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/opencode/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".config/opencode")),
	},
	"github-copilot": {
		name: "github-copilot",
		displayName: "GitHub Copilot",
		agents: {
			projectPath: ".github/agents",
			globalPath: null, // No global path for Copilot agents
			format: "fm-to-fm",
			writeStrategy: "per-file",
			fileExtension: ".agent.md",
		},
		commands: null, // Copilot does not support commands
		skills: {
			projectPath: ".github/skills",
			globalPath: join(home, ".copilot/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".github/copilot-instructions.md",
			globalPath: join(home, ".copilot/instructions.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".github/copilot-instructions.md",
			globalPath: join(home, ".copilot/instructions.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".copilot")),
	},
	codex: {
		name: "codex",
		displayName: "Codex",
		agents: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/AGENTS.md"),
			format: "fm-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		commands: {
			projectPath: null, // Codex commands are global only
			globalPath: join(home, ".codex/prompts"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			projectPath: ".codex/skills",
			globalPath: join(home, ".codex/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/prompts/rules.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".codex")),
	},
	cursor: {
		name: "cursor",
		displayName: "Cursor",
		agents: {
			projectPath: ".cursor/rules",
			globalPath: join(home, ".cursor/rules"),
			format: "fm-to-fm",
			writeStrategy: "per-file",
			fileExtension: ".mdc",
		},
		commands: null, // Cursor does not support commands
		skills: {
			projectPath: ".cursor/skills",
			globalPath: join(home, ".cursor/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".cursor/rules/project-config.mdc",
			globalPath: join(home, ".cursor/rules/project-config.mdc"),
			format: "md-to-mdc",
			writeStrategy: "single-file",
			fileExtension: ".mdc",
		},
		rules: {
			projectPath: ".cursor/rules",
			globalPath: join(home, ".cursor/rules"),
			format: "md-to-mdc",
			writeStrategy: "per-file",
			fileExtension: ".mdc",
		},
		detect: async () => existsSync(join(home, ".cursor")),
	},
	roo: {
		name: "roo",
		displayName: "Roo Code",
		agents: {
			projectPath: ".roomodes",
			globalPath: join(home, ".roo/custom_modes.yaml"),
			format: "fm-to-yaml",
			writeStrategy: "yaml-merge",
			fileExtension: ".yaml",
		},
		commands: null, // Roo does not support commands
		skills: {
			projectPath: ".roo/skills",
			globalPath: join(home, ".roo/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".roo/rules/project-config.md",
			globalPath: join(home, ".roo/rules/project-config.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".roo/rules",
			globalPath: join(home, ".roo/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".roo")),
	},
	kilo: {
		name: "kilo",
		displayName: "Kilo Code",
		agents: {
			projectPath: ".kilocodemodes",
			globalPath: join(home, ".kilocode/custom_modes.yaml"),
			format: "fm-to-yaml",
			writeStrategy: "yaml-merge",
			fileExtension: ".yaml",
		},
		commands: null, // Kilo does not support commands
		skills: {
			projectPath: ".kilocode/skills",
			globalPath: join(home, ".kilocode/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".kilocode/rules/project-config.md",
			globalPath: join(home, ".kilocode/rules/project-config.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".kilocode/rules",
			globalPath: join(home, ".kilocode/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".kilocode")),
	},
	windsurf: {
		name: "windsurf",
		displayName: "Windsurf",
		agents: {
			projectPath: ".windsurf/rules",
			globalPath: join(home, ".codeium/windsurf/rules"),
			format: "fm-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
			charLimit: 12000,
		},
		commands: null, // Windsurf does not support commands
		skills: {
			projectPath: ".windsurf/skills",
			globalPath: join(home, ".codeium/windsurf/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".windsurf/rules/rules.md",
			globalPath: join(home, ".codeium/windsurf/rules/rules.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
			charLimit: 6000,
		},
		rules: {
			projectPath: ".windsurf/rules",
			globalPath: join(home, ".codeium/windsurf/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
			charLimit: 6000,
		},
		detect: async () => existsSync(join(home, ".codeium/windsurf")),
	},
	goose: {
		name: "goose",
		displayName: "Goose",
		agents: {
			projectPath: "AGENTS.md",
			globalPath: null, // Goose uses CONTEXT_FILE_NAMES env var
			format: "fm-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		commands: null, // Goose does not support commands
		skills: {
			projectPath: ".goose/skills",
			globalPath: join(home, ".config/goose/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".goosehints",
			globalPath: join(home, ".config/goose/.goosehints"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: "",
		},
		rules: {
			projectPath: ".goosehints",
			globalPath: join(home, ".config/goose/.goosehints"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: "",
		},
		detect: async () => existsSync(join(home, ".config/goose")),
	},
	"gemini-cli": {
		name: "gemini-cli",
		displayName: "Gemini CLI",
		agents: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".gemini/GEMINI.md"),
			format: "fm-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".gemini/commands",
			globalPath: join(home, ".gemini/commands"),
			format: "md-to-toml",
			writeStrategy: "per-file",
			fileExtension: ".toml",
		},
		skills: {
			projectPath: ".gemini/skills",
			globalPath: join(home, ".gemini/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "GEMINI.md",
			globalPath: join(home, ".gemini/GEMINI.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "GEMINI.md",
			globalPath: join(home, ".gemini/GEMINI.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".gemini")),
	},
	amp: {
		name: "amp",
		displayName: "Amp",
		agents: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/AGENTS.md"),
			format: "fm-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		commands: null, // Amp does not support commands
		skills: {
			projectPath: ".agents/skills",
			globalPath: join(home, ".config/agents/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".amp/rules",
			globalPath: join(home, ".config/amp/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".config/amp")),
	},
	antigravity: {
		name: "antigravity",
		displayName: "Antigravity",
		agents: {
			projectPath: ".agent/rules",
			globalPath: join(home, ".gemini/antigravity"),
			format: "fm-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: null, // Antigravity does not support commands
		skills: {
			projectPath: ".agent/skills",
			globalPath: join(home, ".gemini/antigravity/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "GEMINI.md",
			globalPath: join(home, ".gemini/antigravity/GEMINI.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".agent/rules",
			globalPath: join(home, ".gemini/antigravity/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () =>
			existsSync(join(process.cwd(), ".agent")) || existsSync(join(home, ".gemini/antigravity")),
	},
	cline: {
		name: "cline",
		displayName: "Cline",
		agents: {
			projectPath: ".clinerules",
			globalPath: null, // Cline global is VS Code settings (complex, project-level only)
			format: "fm-to-json",
			writeStrategy: "json-merge",
			fileExtension: ".md",
		},
		commands: null, // Cline does not support commands
		skills: {
			projectPath: ".cline/skills",
			globalPath: join(home, ".cline/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".clinerules/project-config.md",
			globalPath: null,
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".clinerules",
			globalPath: null,
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".cline")),
	},
	openhands: {
		name: "openhands",
		displayName: "OpenHands",
		agents: {
			projectPath: ".openhands/skills",
			globalPath: join(home, ".openhands/skills"),
			format: "skill-md",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: null, // OpenHands does not support commands (skills only)
		skills: {
			projectPath: ".openhands/skills",
			globalPath: join(home, ".openhands/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".openhands/instructions.md",
			globalPath: join(home, ".openhands/instructions.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".openhands/rules",
			globalPath: join(home, ".openhands/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		detect: async () => existsSync(join(home, ".openhands")),
	},
};

/**
 * Get all provider types
 */
export function getAllProviderTypes(): ProviderType[] {
	return Object.keys(providers) as ProviderType[];
}

/**
 * Get provider config by type
 */
export function getProviderConfig(type: ProviderType): ProviderConfig {
	return providers[type];
}

/**
 * Detect which providers are installed on the system
 */
export async function detectInstalledProviders(): Promise<ProviderType[]> {
	const installed: ProviderType[] = [];
	for (const [type, config] of Object.entries(providers)) {
		if (await config.detect()) {
			installed.push(type as ProviderType);
		}
	}
	return installed;
}

/**
 * Get providers that support a specific portable type
 */
export function getProvidersSupporting(
	type: "agents" | "commands" | "skills" | "config" | "rules",
): ProviderType[] {
	return (Object.entries(providers) as [ProviderType, ProviderConfig][])
		.filter(([, config]) => config[type] !== null)
		.map(([name]) => name);
}

/**
 * Get install path for a portable item on a specific provider
 */
export function getPortableInstallPath(
	itemName: string,
	provider: ProviderType,
	portableType: "agents" | "commands" | "skills" | "config" | "rules",
	options: { global: boolean },
): string | null {
	const config = providers[provider];
	const pathConfig = config[portableType];
	if (!pathConfig) return null;

	const basePath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
	if (!basePath) return null;

	// For merge-single / yaml-merge / json-merge / single-file, the path IS the target file
	if (
		pathConfig.writeStrategy === "merge-single" ||
		pathConfig.writeStrategy === "yaml-merge" ||
		pathConfig.writeStrategy === "json-merge" ||
		pathConfig.writeStrategy === "single-file"
	) {
		return basePath;
	}

	// For per-file, append filename
	return join(basePath, `${itemName}${pathConfig.fileExtension}`);
}
