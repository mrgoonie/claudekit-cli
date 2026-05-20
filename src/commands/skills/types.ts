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
	name: string; // Directory name (canonical ID)
	displayName?: string; // Frontmatter name (for UI display)
	description: string;
	version?: string; // From metadata.version (fallback: top-level version)
	author?: string; // From metadata.author
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
	installed: z.boolean().optional(), // Show installed skills
	all: z.boolean().optional(),
	uninstall: z.boolean().optional(), // Uninstall mode
	force: z.boolean().optional(), // Force uninstall without registry
	sync: z.boolean().optional(), // Sync registry with filesystem
});
export type SkillCommandOptions = z.infer<typeof SkillCommandOptionsSchema>;
// Extended options type alias (defined after catalog types below)
export type SkillCommandOptionsExtended = SkillCommandOptions & {
	catalog?: boolean;
	regenerate?: boolean;
	search?: string;
	json?: boolean;
	limit?: number;
	validate?: boolean;
};

// Skill install context (for multi-phase)
export interface SkillContext {
	options: SkillCommandOptions;
	cancelled: boolean;
	selectedSkills: SkillInfo[];
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
	skipped?: boolean; // True when source and target are same location
	skipReason?: string; // Reason for skipping installation
}

// Registry installation record (re-export from skill-registry)
export type { SkillInstallation } from "./skills-registry.js";

// Enriched skill with catalog-specific frontmatter fields
export interface EnrichedSkillInfo extends SkillInfo {
	category?: string;
	keywords?: string[];
	requires?: string[];
	related?: string[];
	maturity?: string;
	crossRefs?: string[]; // extracted from SKILL.md body text
}

// Flat entry stored in the catalog JSON
export interface CatalogSkillEntry {
	name: string;
	displayName: string;
	description: string;
	version?: string;
	author?: string;
	category?: string;
	keywords?: string[];
	requires?: string[];
	related?: string[];
	maturity?: string;
	path: string; // RELATIVE path (e.g., "deploy/SKILL.md")
	hasScripts: boolean;
	hasReferences: boolean;
	crossRefs?: string[];
}

// Top-level catalog JSON structure
export interface SkillCatalog {
	version: string; // "1.0.0"
	generated: string; // ISO timestamp
	skillCount: number;
	skills: CatalogSkillEntry[];
}

// Search result returned by BM25 search
export interface SkillSearchResult {
	name: string;
	displayName: string;
	description: string;
	category?: string;
	score: number;
	path: string; // relative path
}
