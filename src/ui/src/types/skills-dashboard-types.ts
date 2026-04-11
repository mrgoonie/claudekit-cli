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
	author?: string;
	// Source tracking for install skip detection
	sourceAgent?: "claude-code";
	// Metadata.json enrichment fields
	kit?: string;
	installedVersion?: string;
	sourceTimestamp?: string;
	installedAt?: string;
	isCustomized?: boolean;
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
	skipped?: boolean;
	skipReason?: string;
}

export interface UninstallResult {
	agent: string;
	success: boolean;
	error?: string;
}

export type ViewMode = "list" | "grid";
export type SortMode = "a-z" | "category" | "installed-first";

/**
 * Maps engineer frontmatter category (kebab-case) to dashboard display name.
 * Source of truth: claude/schemas/skill-schema.json category enum.
 */
export const CATEGORY_MAP: Record<string, string> = {
	utilities: "Core",
	"dev-tools": "Tooling",
	"ai-ml": "AI",
	frontend: "UI/UX",
	backend: "Backend",
	infrastructure: "DevOps",
	database: "Database",
	multimedia: "Media",
	frameworks: "Frameworks",
	other: "General",
};

export const CATEGORY_ORDER = [
	"Core",
	"AI",
	"UI/UX",
	"DevOps",
	"Backend",
	"Database",
	"Tooling",
	"Media",
	"Frameworks",
	"General",
];

export const CATEGORY_COLORS: Record<string, string> = {
	Core: "#D4A574",
	AI: "#7C6BF0",
	DevOps: "#4ECDC4",
	Backend: "#4A9BD9",
	"UI/UX": "#F7A072",
	Database: "#B8D4E3",
	Tooling: "#C49B66",
	Media: "#E88D67",
	Frameworks: "#7CB4B8",
	General: "#6B6560",
};
