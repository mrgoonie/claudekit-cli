/**
 * Types for the skill command
 */
import { z } from "zod";

// Supported coding agents and their skill paths
export const AgentType = z.enum([
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
]);
export type AgentType = z.infer<typeof AgentType>;

// Agent configuration
export interface AgentConfig {
	name: AgentType;
	displayName: string;
	projectPath: string; // Relative path for project-level install
	globalPath: string; // Absolute path for global install
	detect: () => Promise<boolean>; // Check if agent is installed
}

// Skill metadata from SKILL.md frontmatter
export interface SkillInfo {
	name: string;
	description: string;
	version?: string;
	license?: string;
	path: string; // Full path to skill directory
}

// Skill command options schema
export const SkillCommandOptionsSchema = z.object({
	name: z.string().optional(),
	agent: z.array(z.string()).optional(),
	global: z.boolean().optional(),
	yes: z.boolean().optional(),
	list: z.boolean().optional(),
	all: z.boolean().optional(),
});
export type SkillCommandOptions = z.infer<typeof SkillCommandOptionsSchema>;

// Skill install context (for multi-phase)
export interface SkillContext {
	options: SkillCommandOptions;
	cancelled: boolean;
	selectedSkill?: SkillInfo;
	selectedAgents: AgentType[];
	installGlobally: boolean;
	availableSkills: SkillInfo[];
	detectedAgents: AgentType[];
}

// Install result for each agent
export interface InstallResult {
	agent: AgentType;
	agentDisplayName: string;
	success: boolean;
	path: string;
	error?: string;
	overwritten?: boolean;
}
