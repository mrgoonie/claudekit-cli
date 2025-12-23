export enum HealthStatus {
	HEALTHY = "healthy",
	WARNING = "warning",
	ERROR = "error",
	LOADING = "loading",
	UNKNOWN = "unknown",
}

export interface Project {
	id: string;
	name: string;
	path: string;
	hasLocalConfig: boolean;
	kitType: string | null;
	version: string | null;
	health?: HealthStatus;
}

export interface ConfigData {
	global: Record<string, unknown>;
	local: Record<string, unknown> | null;
	merged: Record<string, unknown>;
}

export interface AppState {
	projects: Project[];
	currentProjectId: string | null;
	config: ConfigData | null;
	isConnected: boolean;
	view: "dashboard" | "config";
	theme: "light" | "dark";
}
