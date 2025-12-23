import type { ConfigData, HealthStatus, KitType, Project } from "@/types";

const API_BASE = "/api";

export async function fetchConfig(): Promise<ConfigData> {
	const res = await fetch(`${API_BASE}/config`);
	if (!res.ok) throw new Error("Failed to fetch config");
	return res.json();
}

export async function saveConfig(
	scope: "global" | "local",
	config: Record<string, unknown>,
): Promise<void> {
	const res = await fetch(`${API_BASE}/config`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scope, config }),
	});
	if (!res.ok) throw new Error("Failed to save config");
}

interface ApiProject {
	id: string;
	name: string;
	path: string;
	hasLocalConfig: boolean;
	kitType: string | null;
	version: string | null;
}

export async function fetchProjects(): Promise<Project[]> {
	const res = await fetch(`${API_BASE}/projects`);
	if (!res.ok) throw new Error("Failed to fetch projects");
	const apiProjects: ApiProject[] = await res.json();

	// Transform API response to match UI Project type
	return apiProjects.map(
		(p): Project => ({
			id: p.id,
			name: p.name,
			path: p.path,
			health: "healthy" as HealthStatus,
			kitType: (p.kitType || "engineer") as KitType,
			model: "claude-sonnet-4-20250514",
			activeHooks: 0,
			mcpServers: 0,
			skills: [],
		}),
	);
}

export async function checkHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${API_BASE}/health`);
		return res.ok;
	} catch {
		return false;
	}
}
