import type { ConfigData, HealthStatus, KitType, Project, Session, Skill } from "@/types";

const API_BASE = "/api";

/**
 * Custom error for when backend server is not running.
 * UI should catch this and show "Start server" message.
 */
export class ServerUnavailableError extends Error {
	constructor() {
		super("Backend server is not running. Start it with: ck config ui");
		this.name = "ServerUnavailableError";
	}
}

/**
 * Check if backend is available. Throws ServerUnavailableError if not.
 * Per validation: Remove mock entirely, require backend.
 */
async function requireBackend(): Promise<void> {
	try {
		const res = await fetch(`${API_BASE}/health`, { method: "GET" });
		if (!res.ok) throw new ServerUnavailableError();
	} catch (e) {
		if (e instanceof ServerUnavailableError) throw e;
		throw new ServerUnavailableError();
	}
}

export async function fetchConfig(): Promise<ConfigData> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/config`);
	if (!res.ok) throw new Error("Failed to fetch config");
	return res.json();
}

export async function saveConfig(
	scope: "global" | "local",
	config: Record<string, unknown>,
): Promise<void> {
	await requireBackend();
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
	pinned?: boolean;
	tags?: string[];
	addedAt?: string;
	lastOpened?: string;
}

function transformApiProject(p: ApiProject): Project {
	return {
		id: p.id,
		name: p.name,
		path: p.path,
		health: p.health as HealthStatus,
		kitType: (p.kitType || "engineer") as KitType,
		model: p.model,
		activeHooks: p.activeHooks,
		mcpServers: p.mcpServers,
		skills: p.skills,
		pinned: p.pinned,
		tags: p.tags,
		addedAt: p.addedAt,
		lastOpened: p.lastOpened,
	};
}

export async function fetchProjects(): Promise<Project[]> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/projects`);
	if (!res.ok) throw new Error("Failed to fetch projects");
	const apiProjects: ApiProject[] = await res.json();
	return apiProjects.map(transformApiProject);
}

export async function checkHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${API_BASE}/health`);
		return res.ok;
	} catch {
		return false;
	}
}

// API functions for skills, sessions, settings

export async function fetchSkills(): Promise<Skill[]> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/skills`);
	if (!res.ok) throw new Error("Failed to fetch skills");
	return res.json();
}

/**
 * Fetch sessions for a project.
 * Per validation: Sessions return empty array when backend unavailable (future scope).
 * Sessions API not yet implemented on backend.
 */
export async function fetchSessions(projectId: string): Promise<Session[]> {
	try {
		await requireBackend();
		const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(projectId)}`);
		if (!res.ok) return []; // Sessions not yet implemented - return empty
		return res.json();
	} catch {
		// Sessions are future scope - graceful fallback to empty
		return [];
	}
}

export interface ApiSettings {
	model: string;
	hookCount: number;
	mcpServerCount: number;
	permissions: unknown;
}

export async function fetchSettings(): Promise<ApiSettings> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/settings`);
	if (!res.ok) throw new Error("Failed to fetch settings");
	return res.json();
}

// Project CRUD operations

export interface AddProjectRequest {
	path: string;
	alias?: string;
	pinned?: boolean;
	tags?: string[];
}

export interface UpdateProjectRequest {
	alias?: string;
	pinned?: boolean;
	tags?: string[];
}

export async function addProject(request: AddProjectRequest): Promise<Project> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/projects`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || "Failed to add project");
	}

	const apiProject: ApiProject = await res.json();
	return transformApiProject(apiProject);
}

export async function removeProject(id: string): Promise<void> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
		method: "DELETE",
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || "Failed to remove project");
	}
}

export async function updateProject(id: string, updates: UpdateProjectRequest): Promise<Project> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(updates),
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || "Failed to update project");
	}

	const apiProject: ApiProject = await res.json();
	return transformApiProject(apiProject);
}

// Metadata operations

export async function fetchGlobalMetadata(): Promise<Record<string, unknown>> {
	const res = await fetch(`${API_BASE}/metadata/global`);
	if (!res.ok) {
		console.error("Failed to fetch global metadata");
		return {};
	}
	return res.json();
}

// Project config operations

export async function fetchProjectConfig(projectId: string): Promise<ConfigData> {
	const res = await fetch(`${API_BASE}/config/project/${encodeURIComponent(projectId)}`);
	if (!res.ok) throw new Error("Failed to fetch project config");
	return res.json();
}

export async function saveProjectConfig(
	projectId: string,
	config: Record<string, unknown>,
): Promise<void> {
	const res = await fetch(`${API_BASE}/config/project/${encodeURIComponent(projectId)}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ config }),
	});
	if (!res.ok) throw new Error("Failed to save project config");
}
