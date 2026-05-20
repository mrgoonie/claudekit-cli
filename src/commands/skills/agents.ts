/**
 * Agent registry - defines supported coding agents and their skill paths
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { AgentConfig, AgentType } from "./types.js";

const home = homedir();
const OPENCODE_BINARY_NAME = platform() === "win32" ? "opencode.exe" : "opencode";

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

function hasOpenCodeInstallSignal(): boolean {
	return hasAnyInstallSignal([
		join(process.cwd(), "opencode.json"),
		join(process.cwd(), "opencode.jsonc"),
		join(process.cwd(), ".opencode/agents"),
		join(process.cwd(), ".opencode/commands"),
		join(home, ".config/opencode/AGENTS.md"),
		join(home, ".config/opencode/agents"),
		join(home, ".config/opencode/commands"),
		join(home, ".opencode", "bin", OPENCODE_BINARY_NAME),
	]);
}

/**
 * Registry of supported coding agents with their skill directory paths
 * Paths follow the open Agent Skills specification
 */
export const agents: Record<AgentType, AgentConfig> = {
	"claude-code": {
		name: "claude-code",
		displayName: "Claude Code",
		projectPath: ".claude/skills",
		globalPath: join(home, ".claude/skills"),
		detect: async () => existsSync(join(home, ".claude")),
	},
	cursor: {
		name: "cursor",
		displayName: "Cursor",
		projectPath: ".cursor/skills",
		globalPath: join(home, ".cursor/skills"),
		detect: async () => existsSync(join(home, ".cursor")),
	},
	codex: {
		name: "codex",
		displayName: "Codex",
		projectPath: ".codex/skills",
		globalPath: join(home, ".codex/skills"),
		detect: async () => existsSync(join(home, ".codex")),
	},
	opencode: {
		name: "opencode",
		displayName: "OpenCode",
		// OpenCode discovers Claude-compatible skill roots automatically.
		// Reusing .claude/skills avoids redundant shadow copies in .opencode/skills.
		projectPath: ".claude/skills",
		globalPath: join(home, ".claude/skills"),
		detect: async () => hasOpenCodeInstallSignal(),
	},
	goose: {
		name: "goose",
		displayName: "Goose",
		projectPath: ".goose/skills",
		globalPath: join(home, ".config/goose/skills"),
		detect: async () => existsSync(join(home, ".config/goose")),
	},
	"gemini-cli": {
		name: "gemini-cli",
		displayName: "Gemini CLI",
		// Shares projectPath with amp — intentional: .agents/skills/ is a universal shared directory
		// that multiple agents read. globalPath also shared with amp/windsurf/codex at ~/.agents/skills/.
		// See also: LEGACY_SKILL_PATHS in skills-installer.ts, REGISTRY_PATH_MIGRATIONS in skills-registry.ts
		projectPath: ".agents/skills",
		globalPath: join(home, ".agents/skills"),
		detect: async () => existsSync(join(home, ".gemini")),
	},
	antigravity: {
		name: "antigravity",
		displayName: "Antigravity",
		projectPath: ".agent/skills",
		globalPath: join(home, ".gemini/antigravity/skills"),
		detect: async () =>
			existsSync(join(process.cwd(), ".agent")) || existsSync(join(home, ".gemini/antigravity")),
	},
	"github-copilot": {
		name: "github-copilot",
		displayName: "GitHub Copilot",
		projectPath: ".github/skills",
		globalPath: join(home, ".copilot/skills"),
		detect: async () => existsSync(join(home, ".copilot")),
	},
	amp: {
		name: "amp",
		displayName: "Amp",
		projectPath: ".agents/skills",
		globalPath: join(home, ".config/agents/skills"),
		detect: async () => existsSync(join(home, ".config/amp")),
	},
	kilo: {
		name: "kilo",
		displayName: "Kilo Code",
		projectPath: ".kilocode/skills",
		globalPath: join(home, ".kilocode/skills"),
		detect: async () => existsSync(join(home, ".kilocode")),
	},
	roo: {
		name: "roo",
		displayName: "Roo Code",
		projectPath: ".roo/skills",
		globalPath: join(home, ".roo/skills"),
		detect: async () => existsSync(join(home, ".roo")),
	},
	windsurf: {
		name: "windsurf",
		displayName: "Windsurf",
		projectPath: ".windsurf/skills",
		globalPath: join(home, ".codeium/windsurf/skills"),
		detect: async () => existsSync(join(home, ".codeium/windsurf")),
	},
	cline: {
		name: "cline",
		displayName: "Cline",
		projectPath: ".cline/skills",
		globalPath: join(home, ".cline/skills"),
		detect: async () => existsSync(join(home, ".cline")),
	},
	openhands: {
		name: "openhands",
		displayName: "OpenHands",
		projectPath: ".openhands/skills",
		globalPath: join(home, ".openhands/skills"),
		detect: async () => existsSync(join(home, ".openhands")),
	},
};

/**
 * Detect which coding agents are installed on the system
 */
export async function detectInstalledAgents(): Promise<AgentType[]> {
	const installed: AgentType[] = [];

	for (const [type, config] of Object.entries(agents)) {
		if (await config.detect()) {
			installed.push(type as AgentType);
		}
	}

	return installed;
}

/**
 * Get agent configuration by type
 */
export function getAgentConfig(type: AgentType): AgentConfig {
	return agents[type];
}

/**
 * Get install path for a skill on a specific agent
 */
export function getInstallPath(
	skillName: string,
	agent: AgentType,
	options: { global: boolean },
): string {
	const config = agents[agent];
	const basePath = options.global ? config.globalPath : config.projectPath;
	return join(basePath, skillName);
}

/**
 * Check if a skill is already installed for an agent
 */
export function isSkillInstalled(
	skillName: string,
	agent: AgentType,
	options: { global: boolean },
): boolean {
	const installPath = getInstallPath(skillName, agent, options);
	return existsSync(installPath);
}
