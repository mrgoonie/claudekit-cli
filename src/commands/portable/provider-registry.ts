/**
 * Provider registry — defines all supported providers with their
 * path configurations for agents, commands, and skills.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ProviderConfig, ProviderType } from "./types.js";

const home = homedir();
const cwd = process.cwd();
const isWin = platform() === "win32";
const OPENCODE_BINARY_NAME = isWin ? "opencode.exe" : "opencode";

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

/** Cache for binary lookups (avoids repeated shell spawns within a single run) */
export const binaryCache = new Map<string, boolean>();

/**
 * Check if a binary exists in PATH. Uses `which` (Unix) or `where` (Windows).
 * Results are cached per binary name for the duration of the process.
 */
export function hasBinaryInPath(name: string): boolean {
	const cached = binaryCache.get(name);
	if (cached !== undefined) return cached;

	try {
		execFileSync(isWin ? "where" : "which", [name], { stdio: "pipe", timeout: 3000 });
		binaryCache.set(name, true);
		return true;
	} catch {
		binaryCache.set(name, false);
		return false;
	}
}

function hasOpenCodeInstallSignal(): boolean {
	return (
		hasBinaryInPath("opencode") ||
		hasAnyInstallSignal([
			join(cwd, "opencode.json"),
			join(cwd, "opencode.jsonc"),
			join(cwd, ".opencode/agents"),
			join(cwd, ".opencode/commands"),
			join(home, ".config/opencode/AGENTS.md"),
			join(home, ".config/opencode/agents"),
			join(home, ".config/opencode/commands"),
			join(home, ".opencode/bin", OPENCODE_BINARY_NAME),
		])
	);
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
		hooks: {
			projectPath: ".claude/hooks",
			globalPath: join(home, ".claude/hooks"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: "",
		},
		settingsJsonPath: {
			projectPath: ".claude/settings.json",
			globalPath: join(home, ".claude/settings.json"),
		},
		detect: async () =>
			hasBinaryInPath("claude") ||
			hasAnyInstallSignal([
				join(cwd, ".claude/agents"),
				join(cwd, ".claude/commands"),
				join(cwd, ".claude/skills"),
				join(cwd, ".claude/rules"),
				join(cwd, ".claude/hooks"),
				join(cwd, "CLAUDE.md"),
				join(home, ".claude/agents"),
				join(home, ".claude/commands"),
				join(home, ".claude/skills"),
				join(home, ".claude/rules"),
				join(home, ".claude/hooks"),
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
			format: "fm-to-fm",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: {
			projectPath: ".opencode/commands",
			globalPath: join(home, ".config/opencode/commands"),
			format: "fm-to-fm",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		skills: {
			// OpenCode reads Claude-compatible skill roots natively.
			// Writing duplicate copies to .opencode/skills can shadow .claude/skills
			// and make OpenCode load the wrong version of a skill.
			projectPath: ".claude/skills",
			globalPath: join(home, ".claude/skills"),
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
		settingsJsonPath: null,
		detect: async () => hasOpenCodeInstallSignal(),
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
		settingsJsonPath: null,
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
		hooks: {
			projectPath: ".codex/hooks",
			globalPath: join(home, ".codex/hooks"),
			// "codex-hooks" write strategy: capability-gated transform + wrapper generation.
			// hooks-settings-merger.ts checks for this strategy and routes through the
			// Codex compatibility pipeline instead of direct-copy.
			format: "direct-copy",
			writeStrategy: "codex-hooks",
			fileExtension: "",
		},
		settingsJsonPath: {
			projectPath: ".codex/hooks.json", // Codex uses standalone hooks.json (not embedded in settings.json)
			globalPath: join(home, ".codex/hooks.json"),
		},
		detect: async () =>
			hasBinaryInPath("codex") ||
			hasAnyInstallSignal([
				join(cwd, ".codex/config.toml"),
				join(cwd, ".codex/agents"),
				join(cwd, ".codex/prompts"),
				join(cwd, ".codex/hooks.json"),
				join(home, ".codex/config.toml"),
				join(home, ".codex/agents"),
				join(home, ".codex/AGENTS.md"),
				join(home, ".codex/instructions.md"),
				join(home, ".codex/prompts"),
				join(home, ".codex/hooks.json"),
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
		settingsJsonPath: {
			projectPath: ".factory/settings.json",
			globalPath: join(home, ".factory/settings.json"),
		},
		detect: async () =>
			hasBinaryInPath("droid") ||
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
			projectPath: ".agents/skills", // Cursor reads .agents/skills/ at project level
			globalPath: join(home, ".cursor/skills"), // Cursor does NOT read ~/.agents/skills/ globally
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
		settingsJsonPath: null,
		// Note: .agents/skills/ intentionally omitted — it's shared across 5+ providers
		// and can't identify cursor specifically. Cursor users always have .cursor/rules.
		detect: async () =>
			hasBinaryInPath("cursor") ||
			hasAnyInstallSignal([
				join(cwd, ".cursor/rules"),
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
		settingsJsonPath: null,
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
		settingsJsonPath: null,
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
	kiro: {
		name: "kiro",
		displayName: "Kiro IDE",
		subagents: "none", // Kiro uses steering for context injection, not agent delegation
		agents: {
			projectPath: ".kiro/steering",
			globalPath: null, // Kiro is project-first; no global agents path
			format: "md-to-kiro-steering",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		commands: null, // Kiro does not support commands
		skills: {
			projectPath: ".kiro/skills",
			globalPath: null, // Kiro skills are project-level only
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: ".kiro/steering/project.md",
			globalPath: null, // Kiro config is project-level only
			format: "md-to-kiro-steering",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".kiro/steering",
			globalPath: null, // Kiro rules are project-level only
			format: "md-to-kiro-steering",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		hooks: null, // Kiro hooks are YAML-based, incompatible with Claude Code JS hooks
		settingsJsonPath: null, // Kiro uses .kiro/settings/mcp.json (incompatible format)
		detect: async () =>
			hasAnyInstallSignal([
				join(cwd, ".kiro/steering"),
				join(cwd, ".kiro/skills"),
				join(cwd, ".kiro/hooks"),
				join(cwd, ".kiro/agents"),
				join(cwd, ".kiro/settings/mcp.json"),
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
			projectPath: ".agents/skills", // Windsurf reads .agents/skills/ for cross-agent compat
			globalPath: join(home, ".agents/skills"), // Consolidated: Windsurf scans both paths
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
		settingsJsonPath: null,
		detect: async () =>
			hasBinaryInPath("windsurf") ||
			hasAnyInstallSignal([
				join(cwd, ".windsurf/rules"),
				join(cwd, ".windsurf/workflows"),
				join(home, ".codeium/windsurf/rules"),
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
		settingsJsonPath: null,
		detect: async () =>
			hasBinaryInPath("goose") ||
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
			projectPath: ".agents/skills", // Gemini CLI reads .agents/skills/ with precedence over .gemini/skills/
			globalPath: join(home, ".agents/skills"), // Consolidated: Gemini CLI scans both paths, .agents/ wins
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
		hooks: {
			projectPath: ".gemini/hooks",
			globalPath: join(home, ".gemini/hooks"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: "",
		},
		settingsJsonPath: {
			projectPath: ".gemini/settings.json",
			globalPath: join(home, ".gemini/settings.json"),
		},
		detect: async () =>
			hasBinaryInPath("gemini") ||
			hasAnyInstallSignal([
				join(cwd, ".gemini/commands"),
				join(cwd, "GEMINI.md"),
				join(home, ".gemini/commands"),
				join(home, ".gemini/GEMINI.md"),
			]),
	},
	amp: {
		name: "amp",
		displayName: "Amp",
		subagents: "full",
		agents: {
			projectPath: "AGENT.md",
			globalPath: join(home, ".config/AGENT.md"),
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
			projectPath: "AGENT.md",
			globalPath: join(home, ".config/AGENT.md"),
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
		settingsJsonPath: null,
		detect: async () =>
			hasBinaryInPath("amp") ||
			hasAnyInstallSignal([
				join(cwd, ".amp/rules"),
				join(cwd, "AGENT.md"), // Amp's primary config (not shared with other providers)
				join(home, ".config/amp/rules"),
				join(home, ".config/AGENT.md"),
			]),
	},
	antigravity: {
		name: "antigravity",
		displayName: "Antigravity",
		subagents: "full",
		// Antigravity has no separate "agents" concept — agents ARE skills (SKILL.md format).
		// Claude Code agents are migrated to .agent/skills/ alongside native Antigravity skills.
		agents: null,
		commands: {
			projectPath: ".agent/workflows",
			globalPath: null, // No verified global workflows path; only project-level confirmed
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
			nestedCommands: false, // Verified: Antigravity workflows are flat single-level files
		},
		skills: {
			// Skills use <name>/SKILL.md directory format; installSkillDirectories() copies whole dirs
			// Global: ~/.gemini/antigravity/skills/ (confirmed: Codelabs docs)
			projectPath: ".agent/skills",
			globalPath: join(home, ".gemini/antigravity/skills"),
			format: "direct-copy",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		config: {
			projectPath: "GEMINI.md",
			// Global config lives at ~/.gemini/GEMINI.md (shared with Gemini CLI)
			// Source: Google Codelabs + github.com/google-gemini/gemini-cli/issues/16058
			globalPath: join(home, ".gemini/GEMINI.md"),
			format: "md-strip",
			writeStrategy: "single-file",
			fileExtension: ".md",
		},
		rules: {
			projectPath: ".agent/rules",
			globalPath: null, // No verified global rules path separate from ~/.gemini/GEMINI.md
			format: "md-strip",
			writeStrategy: "per-file",
			fileExtension: ".md",
		},
		hooks: null, // ~/.gemini/settings.json has no user-configurable hooks section
		settingsJsonPath: null, // ~/.gemini/settings.json format incompatible with Claude Code
		detect: async () =>
			hasBinaryInPath("agy") ||
			hasBinaryInPath("antigravity") ||
			hasAnyInstallSignal([
				join(cwd, ".agent/rules"),
				join(cwd, ".agent/skills"),
				join(cwd, ".agent/workflows"),
				join(cwd, "GEMINI.md"),
				join(home, ".gemini/antigravity"), // Global antigravity config dir
				join(home, ".gemini/antigravity/skills"),
			]),
	},
	cline: {
		name: "cline",
		displayName: "Cline",
		subagents: "full",
		agents: {
			projectPath: ".clinerules",
			globalPath: null, // Cline global is VS Code settings (complex, project-level only)
			format: "fm-strip",
			writeStrategy: "per-file",
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
		settingsJsonPath: null,
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
		settingsJsonPath: null,
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
 * Get the base destination path for a portable type on a specific provider.
 * For per-file strategies this returns the parent directory. For merge/single
 * targets it returns the actual target file path.
 */
export function getPortableBasePath(
	provider: ProviderType,
	portableType: "agents" | "commands" | "skills" | "config" | "rules" | "hooks",
	options: { global: boolean },
): string | null {
	const config = providers[provider];
	const pathConfig = config[portableType];
	if (!pathConfig) return null;
	return options.global ? pathConfig.globalPath : pathConfig.projectPath;
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

	const basePath = getPortableBasePath(provider, portableType, options);
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

/** A group of providers that share the same target path for a portable type */
export interface ProviderPathCollision {
	/** The shared target path (e.g., ".agents/skills") */
	path: string;
	/** Portable type category */
	portableType: "agents" | "commands" | "skills" | "config" | "rules" | "hooks";
	/** Whether this is global or project scope */
	global: boolean;
	/** Providers that all target this same path */
	providers: ProviderType[];
}

/**
 * Detect path collisions across selected providers — identifies when multiple
 * providers map to the same target directory for the same portable type and scope.
 *
 * Critical for .agent/ vs .agents/ disambiguation (e.g., codex+amp both target
 * .agents/skills while antigravity targets .agent/skills).
 */
export function detectProviderPathCollisions(
	selectedProviders: ProviderType[],
	options: { global: boolean },
): ProviderPathCollision[] {
	const portableTypes = ["agents", "commands", "skills", "config", "rules", "hooks"] as const;
	const collisions: ProviderPathCollision[] = [];

	for (const portableType of portableTypes) {
		// Map: target base path -> list of providers using it
		const pathToProviders = new Map<string, ProviderType[]>();

		for (const provider of selectedProviders) {
			const config = providers[provider];
			const pathConfig = config[portableType];
			if (!pathConfig) continue;

			const basePath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
			if (!basePath) continue;

			const existing = pathToProviders.get(basePath) || [];
			existing.push(provider);
			pathToProviders.set(basePath, existing);
		}

		// Collect entries where >1 provider shares the same path
		for (const [path, providerList] of pathToProviders) {
			if (providerList.length > 1) {
				collisions.push({
					path,
					portableType,
					global: options.global,
					providers: providerList,
				});
			}
		}
	}

	return collisions;
}
