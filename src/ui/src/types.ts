export enum HealthStatus {
	HEALTHY = "healthy",
	WARNING = "warning",
	ERROR = "error",
	LOADING = "loading",
	UNKNOWN = "unknown",
}

export enum KitType {
	ENGINEER = "engineer",
	MARKETING = "marketing",
	ARCHITECT = "architect",
	RESEARCHER = "researcher",
	DEVOP = "devops",
}

export interface Skill {
	id: string;
	name: string;
	description: string;
	category: string;
	isAvailable: boolean;
}

export interface Session {
	id: string;
	timestamp: string;
	duration: string;
	summary: string;
}

export interface Project {
	id: string;
	name: string;
	path: string;
	health: HealthStatus;
	kitType: KitType;
	model: string;
	activeHooks: number;
	mcpServers: number;
	skills: string[]; // Skill IDs
	// Registry fields (optional for backward compat)
	pinned?: boolean;
	tags?: string[];
	addedAt?: string;
	lastOpened?: string;
}

export interface AppState {
	projects: Project[];
	currentProjectId: string | null;
	isSidebarCollapsed: boolean;
	isConnected: boolean;
	view: "dashboard" | "config" | "skills" | "migrate" | "health";
}

export interface ConfigData {
	global: Record<string, unknown>;
	local: Record<string, unknown> | null;
	merged: Record<string, unknown>;
}

// Re-export skills dashboard types
export * from "./types/skills-dashboard-types";
export * from "./types/migration-types";
