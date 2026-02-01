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

export const CATEGORY_COLORS: Record<string, string> = {
	AI: "#7C6BF0",
	Security: "#E56B6F",
	DevOps: "#4ECDC4",
	Backend: "#4A9BD9",
	"UI/UX": "#F7A072",
	Database: "#B8D4E3",
	Development: "#95D5B2",
	Research: "#DDA0DD",
	General: "#6B6560",
};
