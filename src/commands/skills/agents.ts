/**
 * Agent registry - defines supported coding agents and their skill paths
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentConfig, AgentType } from "./types.js";

const home = homedir();

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
		projectPath: ".opencode/skill",
		globalPath: join(home, ".config/opencode/skill"),
		detect: async () => existsSync(join(home, ".config/opencode")),
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
		projectPath: ".gemini/skills",
		globalPath: join(home, ".gemini/skills"),
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
