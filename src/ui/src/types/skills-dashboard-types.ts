/**
 * Types for Skills Dashboard
 */

export interface SkillInfo {
	id: string;
	name: string;
	description: string;
	category: string;
	isAvailable: boolean;
	version?: string;
}

export interface SkillInstallation {
	skillName: string;
	agent: string;
	installedAt: string;
	isGlobal: boolean;
	path: string;
}

export interface AgentInfo {
	name: string;
	displayName: string;
	detected: boolean;
}

export interface InstallResult {
	agent: string;
	success: boolean;
	error?: string;
}

export interface UninstallResult {
	agent: string;
	success: boolean;
	error?: string;
}

export type ViewMode = "list" | "grid";
export type SortMode = "a-z" | "category" | "installed-first";

export const SKILL_CATEGORY_OVERRIDES: Record<string, string> = {
	// Core
	brainstorm: "Core",
	fix: "Core",
	fixing: "Development",
	cook: "Core",
	"code-review": "Core",
	git: "Core",
	planning: "Core",
	scout: "Core",
	"sequential-thinking": "Development",
	"context-engineering": "Development",
	"find-skills": "Core",
	"skill-creator": "Core",
	"problem-solving": "Development",
	debug: "Core",
	// Documentation
	copywriting: "Documentation",
	"docs-seeker": "Documentation",
	docusaurus: "Documentation",
	"markdown-novel-viewer": "Documentation",
	mintlify: "Documentation",
	"prompt-engineer": "Documentation",
	repomix: "Documentation",
	// Tooling
	"claude-code-hooks": "Tooling",
	gkg: "Tooling",
	"mcp-management": "Tooling",
	"plans-kanban": "Tooling",
	"template-skill": "Tooling",
	// Media
	"agent-browser": "Media",
	"chrome-devtools": "Media",
	"media-processing": "Media",
	remotion: "Media",
	shader: "Media",
	threejs: "Media",
	// Frameworks
	"google-adk-python": "Frameworks",
	"mobile-development": "Frameworks",
	"payment-integration": "Frameworks",
	powershell: "Frameworks",
	shopify: "Frameworks",
	supabase: "Frameworks",
	"react-best-practices": "Frameworks",
	"web-frameworks": "Frameworks",
};

export const CATEGORY_ORDER = [
	"Core",
	"AI",
	"UI/UX",
	"Security",
	"DevOps",
	"Backend",
	"Database",
	"Documentation",
	"Tooling",
	"Media",
	"Frameworks",
	"Development",
	"Research",
	"General",
];

export const CATEGORY_COLORS: Record<string, string> = {
	Core: "#D4A574",
	AI: "#7C6BF0",
	Security: "#E56B6F",
	DevOps: "#4ECDC4",
	Backend: "#4A9BD9",
	"UI/UX": "#F7A072",
	Database: "#B8D4E3",
	Documentation: "#8B9DC3",
	Tooling: "#C49B66",
	Media: "#E88D67",
	Frameworks: "#7CB4B8",
	Development: "#95D5B2",
	Research: "#DDA0DD",
	General: "#6B6560",
};
