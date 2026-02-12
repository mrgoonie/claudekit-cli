import type {
	HealthStatus,
	KitType,
	MigrationDiscovery,
	MigrationExecutionResponse,
	MigrationIncludeOptions,
	MigrationProviderInfo,
	Project,
	Session,
	Skill,
} from "@/types";

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
export async function fetchSessions(projectId: string, limit?: number): Promise<Session[]> {
	try {
		await requireBackend();
		const params = limit !== undefined ? `?limit=${limit}` : "";
		const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(projectId)}${params}`);
		if (!res.ok) return [];
		return res.json();
	} catch {
		return [];
	}
}

/** Open an external action (terminal, editor, launch) at a project path */
export async function openAction(action: string, path: string): Promise<void> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/actions/open`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action, path }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({ error: "Action failed" }));
		throw new Error(data.error || "Action failed");
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

// Skills API functions

export interface FetchInstalledSkillsResponse {
	installations: import("@/types").SkillInstallation[];
}

export async function fetchInstalledSkills(): Promise<FetchInstalledSkillsResponse> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/skills/installed`);
	if (!res.ok) throw new Error("Failed to fetch installed skills");
	return res.json();
}

export interface FetchAgentsResponse {
	agents: import("@/types").AgentInfo[];
}

export async function fetchAgents(): Promise<FetchAgentsResponse> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/agents`);
	if (!res.ok) throw new Error("Failed to fetch agents");
	return res.json();
}

export interface InstallSkillResponse {
	results: import("@/types").InstallResult[];
}

export async function installSkill(
	skillName: string,
	agents: string[],
	global: boolean,
): Promise<InstallSkillResponse> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/skills/install`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ skillName, agents, global }),
	});
	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || "Failed to install skill");
	}
	return res.json();
}

export interface UninstallSkillResponse {
	results: import("@/types").UninstallResult[];
}

export async function uninstallSkill(
	skillName: string,
	agents: string[],
): Promise<UninstallSkillResponse> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/skills/uninstall`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ skillName, agents }),
	});
	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || "Failed to uninstall skill");
	}
	return res.json();
}

export interface FetchMigrationProvidersResponse {
	providers: MigrationProviderInfo[];
}

export async function fetchMigrationProviders(): Promise<FetchMigrationProvidersResponse> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/migrate/providers`);
	if (!res.ok) throw new Error("Failed to fetch migration providers");
	return res.json();
}

export async function fetchMigrationDiscovery(): Promise<MigrationDiscovery> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/migrate/discovery`);
	if (!res.ok) throw new Error("Failed to discover migration items");
	return res.json();
}

export interface ExecuteMigrationRequest {
	providers: string[];
	global: boolean;
	include: MigrationIncludeOptions;
	source?: string;
}

export async function executeMigration(
	request: ExecuteMigrationRequest,
): Promise<MigrationExecutionResponse> {
	await requireBackend();
	const res = await fetch(`${API_BASE}/migrate/execute`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!res.ok) {
		const error = await res.text();
		throw new Error(error || "Failed to execute migration");
	}
	return res.json();
}
