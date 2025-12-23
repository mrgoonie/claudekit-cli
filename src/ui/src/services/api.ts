import type { ConfigData, HealthStatus, KitType, Project, Session, Skill } from "@/types";
import {
	mockConfig,
	mockProjects,
	mockSessions,
	mockSettings,
	mockSkills,
} from "./mock-data";

const API_BASE = "/api";
const IS_DEV = import.meta.env.DEV;

// Track if backend is available (checked once)
let backendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
	if (backendAvailable !== null) return backendAvailable;

	try {
		const res = await fetch(`${API_BASE}/health`, { method: "GET" });
		backendAvailable = res.ok;
	} catch {
		backendAvailable = false;
	}

	if (IS_DEV && !backendAvailable) {
		console.info("[Dev Mode] Backend unavailable, using mock data");
	}

	return backendAvailable;
}

export async function fetchConfig(): Promise<ConfigData> {
	if (IS_DEV && !(await isBackendAvailable())) {
		return mockConfig as ConfigData;
	}

	const res = await fetch(`${API_BASE}/config`);
	if (!res.ok) throw new Error("Failed to fetch config");
	return res.json();
}

export async function saveConfig(
	scope: "global" | "local",
	config: Record<string, unknown>,
): Promise<void> {
	if (IS_DEV && !(await isBackendAvailable())) {
		console.info("[Dev Mode] Save config skipped (mock mode):", { scope, config });
		return;
	}

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
	health: "healthy" | "warning" | "error" | "unknown";
	model: string;
	activeHooks: number;
	mcpServers: number;
	skills: string[];
}

export async function fetchProjects(): Promise<Project[]> {
	if (IS_DEV && !(await isBackendAvailable())) {
		return mockProjects;
	}

	const res = await fetch(`${API_BASE}/projects`);
	if (!res.ok) throw new Error("Failed to fetch projects");
	const apiProjects: ApiProject[] = await res.json();

	// Transform API response to match UI Project type
	return apiProjects.map(
		(p): Project => ({
			id: p.id,
			name: p.name,
			path: p.path,
			health: p.health as HealthStatus,
			kitType: (p.kitType || "engineer") as KitType,
			model: p.model,
			activeHooks: p.activeHooks,
			mcpServers: p.mcpServers,
			skills: p.skills,
		}),
	);
}

export async function checkHealth(): Promise<boolean> {
	if (IS_DEV && !(await isBackendAvailable())) {
		return true; // Mock healthy status
	}

	try {
		const res = await fetch(`${API_BASE}/health`);
		return res.ok;
	} catch {
		return false;
	}
}

// New API functions for skills, sessions, settings

export async function fetchSkills(): Promise<Skill[]> {
	if (IS_DEV && !(await isBackendAvailable())) {
		return mockSkills;
	}

	const res = await fetch(`${API_BASE}/skills`);
	if (!res.ok) throw new Error("Failed to fetch skills");
	return res.json();
}

export async function fetchSessions(projectId: string): Promise<Session[]> {
	if (IS_DEV && !(await isBackendAvailable())) {
		return mockSessions[projectId] || [];
	}

	const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(projectId)}`);
	if (!res.ok) throw new Error("Failed to fetch sessions");
	return res.json();
}

export interface ApiSettings {
	model: string;
	hookCount: number;
	mcpServerCount: number;
	permissions: unknown;
}

export async function fetchSettings(): Promise<ApiSettings> {
	if (IS_DEV && !(await isBackendAvailable())) {
		return mockSettings;
	}

	const res = await fetch(`${API_BASE}/settings`);
	if (!res.ok) throw new Error("Failed to fetch settings");
	return res.json();
}
