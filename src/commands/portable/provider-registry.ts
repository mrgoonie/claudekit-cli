/**
 * Provider registry — defines all supported providers with their
 * path configurations for agents, commands, and skills.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig, ProviderType } from "./types.js";

const home = homedir();
const cwd = process.cwd();

function hasInstallSignal(path: string | null | undefined): boolean {
	if (!path || !existsSync(path)) {
		return false;
	}

	try {
		const stat = statSync(path);
		if (stat.isDirectory()) {
			return readdirSync(path).length > 0;
		}
		if (stat.isFile()) {
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

function hasAnyInstallSignal(paths: Array<string | null | undefined>): boolean {
	return paths.some((path) => hasInstallSignal(path));
}

/**
 * Registry of all supported providers with paths for agents, commands, and skills.
 */
export const providers: Record<ProviderType, ProviderConfig> = {
	"claude-code": {
		name: "claude-code",
		displayName: "Claude Code",
		subagents: "full",
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".claude/agents"),
				join(cwd, ".claude/commands"),
				join(cwd, ".claude/skills"),
				join(cwd, ".claude/rules"),
				join(cwd, "CLAUDE.md"),
				join(home, ".claude/agents"),
				join(home, ".claude/commands"),
				join(home, ".claude/skills"),
				join(home, ".claude/rules"),
				join(home, ".claude/CLAUDE.md"),
			]),
	},
	opencode: {
		name: "opencode",
		displayName: "OpenCode",
		subagents: "full",
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
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".config/opencode/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, "opencode.json"),
				join(cwd, "opencode.jsonc"),
				join(cwd, ".opencode/agents"),
				join(cwd, ".opencode/commands"),
				join(cwd, ".opencode/skill"),
				join(home, ".config/opencode/AGENTS.md"),
				join(home, ".config/opencode/agents"),
				join(home, ".config/opencode/commands"),
				join(home, ".config/opencode/skill"),
			]),
	},
	"github-copilot": {
		name: "github-copilot",
		displayName: "GitHub Copilot",
		subagents: "full",
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
			globalPath: null, // Copilot has no universal global skills path
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".github/copilot-instructions.md",
			globalPath: null, // Copilot has no universal global config path
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".github/instructions",
			globalPath: null, // Copilot has no universal global instructions path
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".instructions.md",
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".github/agents"),
				join(cwd, ".github/skills"),
				join(cwd, ".github/instructions"),
				join(cwd, ".github/copilot-instructions.md"),
			]),
	},
	codex: {
		name: "codex",
		displayName: "Codex",
		subagents: "full",
		agents: {
			projectPath: ".codex/agents",
			globalPath: join(home, ".codex/agents"),
			format: "fm-to-codex-toml",
			writeStrategy: "codex-toml",
			fileExtension: ".toml",
		},
		commands: {
			projectPath: null, // Codex commands are global only (deprecated — skills preferred)
			globalPath: join(home, ".codex/prompts"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
			nestedCommands: false, // Codex scans top-level only
		},
		skills: {
			projectPath: ".agents/skills", // Codex uses .agents/skills/ for project skills
			globalPath: join(home, ".agents/skills"), // Codex reads ~/.agents/skills/<name>/SKILL.md
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".codex/AGENTS.md"), // Codex has no separate rules — merge into AGENTS.md
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".codex/config.toml"),
				join(cwd, ".codex/agents"),
				join(cwd, ".codex/prompts"),
				join(cwd, ".agents/skills"),
				join(home, ".codex/config.toml"),
				join(home, ".codex/agents"),
				join(home, ".codex/AGENTS.md"),
				join(home, ".codex/instructions.md"),
				join(home, ".codex/prompts"),
				join(home, ".agents/skills"),
			]),
	},
	droid: {
		name: "droid",
		displayName: "Droid",
		subagents: "full",
		agents: {
			projectPath: ".factory/droids",
			globalPath: join(home, ".factory/droids"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".factory/commands",
			globalPath: join(home, ".factory/commands"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			projectPath: ".factory/skills",
			globalPath: join(home, ".factory/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "AGENTS.md",
			globalPath: join(home, ".factory/AGENTS.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".factory/rules",
			globalPath: join(home, ".factory/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		hooks: {
			projectPath: ".factory/hooks",
			globalPath: join(home, ".factory/hooks"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: "",
		},
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".factory/droids"),
				join(cwd, ".factory/commands"),
				join(cwd, ".factory/skills"),
				join(cwd, ".factory/rules"),
				join(cwd, ".factory/hooks"),
				join(cwd, ".factory/settings.json"),
				join(home, ".factory/droids"),
				join(home, ".factory/commands"),
				join(home, ".factory/skills"),
				join(home, ".factory/rules"),
				join(home, ".factory/hooks"),
				join(home, ".factory/AGENTS.md"),
				join(home, ".factory/settings.json"),
			]),
	},
	cursor: {
		name: "cursor",
		displayName: "Cursor",
		subagents: "full",
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".cursor/rules"),
				join(cwd, ".cursor/skills"),
				join(home, ".cursor/rules"),
				join(home, ".cursor/skills"),
			]),
	},
	roo: {
		name: "roo",
		displayName: "Roo Code",
		subagents: "full",
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".roomodes"),
				join(cwd, ".roo/rules"),
				join(cwd, ".roo/skills"),
				join(home, ".roo/custom_modes.yaml"),
				join(home, ".roo/rules"),
				join(home, ".roo/skills"),
			]),
	},
	kilo: {
		name: "kilo",
		displayName: "Kilo Code",
		subagents: "full",
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".kilocodemodes"),
				join(cwd, ".kilocode/rules"),
				join(cwd, ".kilocode/skills"),
				join(home, ".kilocode/custom_modes.yaml"),
				join(home, ".kilocode/rules"),
				join(home, ".kilocode/skills"),
			]),
	},
	windsurf: {
		name: "windsurf",
		displayName: "Windsurf",
		subagents: "none",
		agents: {
			projectPath: ".windsurf/rules",
			globalPath: join(home, ".codeium/windsurf/rules"),
			format: "fm-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
			charLimit: 12000,
		},
		commands: {
			projectPath: ".windsurf/workflows",
			globalPath: join(home, ".codeium/windsurf/workflows"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
			nestedCommands: false, // Windsurf workflows are flat
		},
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
			totalCharLimit: 12000, // per-type aggregate limit for rules (Windsurf caps rules at 12K total)
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".windsurf/rules"),
				join(cwd, ".windsurf/skills"),
				join(cwd, ".windsurf/workflows"),
				join(home, ".codeium/windsurf/rules"),
				join(home, ".codeium/windsurf/skills"),
				join(home, ".codeium/windsurf/workflows"),
			]),
	},
	goose: {
		name: "goose",
		displayName: "Goose",
		subagents: "full",
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
			writeStrategy: "merge-single",
			fileExtension: "",
		},
		rules: {
			projectPath: ".goosehints",
			globalPath: join(home, ".config/goose/.goosehints"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: "",
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".goosehints"),
				join(cwd, ".goose/skills"),
				join(home, ".config/goose/.goosehints"),
				join(home, ".config/goose/skills"),
			]),
	},
	"gemini-cli": {
		name: "gemini-cli",
		displayName: "Gemini CLI",
		subagents: "planned",
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
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		rules: {
			projectPath: "GEMINI.md",
			globalPath: join(home, ".gemini/GEMINI.md"),
			format: "md-strip",
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".gemini/commands"),
				join(cwd, ".gemini/skills"),
				join(cwd, "GEMINI.md"),
				join(home, ".gemini/commands"),
				join(home, ".gemini/skills"),
				join(home, ".gemini/GEMINI.md"),
			]),
	},
	amp: {
		name: "amp",
		displayName: "Amp",
		subagents: "full",
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
			writeStrategy: "merge-single",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".amp/rules",
			globalPath: join(home, ".config/amp/rules"),
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".amp/rules"),
				join(cwd, ".agents/skills"),
				join(home, ".config/AGENTS.md"),
				join(home, ".config/amp/rules"),
				join(home, ".config/agents/skills"),
			]),
	},
	antigravity: {
		name: "antigravity",
		displayName: "Antigravity",
		subagents: "full",
		agents: {
			projectPath: ".agent/rules",
			globalPath: join(home, ".gemini/antigravity"),
			format: "fm-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".agent/workflows",
			globalPath: join(home, ".gemini/antigravity/global_workflows"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
			nestedCommands: false, // Antigravity nesting support unknown, flatten to be safe
		},
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".agent/rules"),
				join(cwd, ".agent/skills"),
				join(cwd, ".agent/workflows"),
				join(cwd, "GEMINI.md"),
				join(home, ".gemini/antigravity/GEMINI.md"),
				join(home, ".gemini/antigravity/rules"),
				join(home, ".gemini/antigravity/skills"),
				join(home, ".gemini/antigravity/global_workflows"),
			]),
	},
	cline: {
		name: "cline",
		displayName: "Cline",
		subagents: "full",
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".clinerules"),
				join(cwd, ".cline/skills"),
				join(home, ".cline/skills"),
			]),
	},
	openhands: {
		name: "openhands",
		displayName: "OpenHands",
		subagents: "full",
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
		hooks: null,
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".openhands/skills"),
				join(cwd, ".openhands/rules"),
				join(cwd, ".openhands/instructions.md"),
				join(home, ".openhands/skills"),
				join(home, ".openhands/rules"),
				join(home, ".openhands/instructions.md"),
			]),
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
	type: "agents" | "commands" | "skills" | "config" | "rules" | "hooks",
): ProviderType[] {
	return (Object.entries(providers) as [ProviderType, ProviderConfig][])
		.filter(([, config]) => config[type] != null)
		.map(([name]) => name);
}

/**
 * Get install path for a portable item on a specific provider
 */
export function getPortableInstallPath(
	itemName: string,
	provider: ProviderType,
	portableType: "agents" | "commands" | "skills" | "config" | "rules" | "hooks",
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
