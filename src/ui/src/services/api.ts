import { isTauri } from "@/hooks/use-tauri";
import * as tauri from "@/lib/tauri-commands";
import { HealthStatus, KitType } from "@/types";
import type {
	MigrationDiscovery,
	MigrationExecutionResponse,
	MigrationIncludeOptions,
	MigrationProviderInfo,
	Project,
	Session,
	Skill,
} from "@/types";
import type { ProjectActivePlan } from "@/types/plan-types";
import type { InstallDiscoveryResponse } from "@/types/reconcile-types";
import { join } from "pathe";

// TODO(Phase 3): When isTauri() is true, route project/config read/write calls
// through @/lib/tauri-commands (invoke) instead of fetch("/api/..."). The web
// backend (Express) will remain for web mode; Tauri mode bypasses it entirely.
const API_BASE = "/api";

/**
 * Custom error for when backend server is not running.
 * UI should catch this and show "Start server" message.
 */
export class ServerUnavailableError extends Error {
	constructor() {
		super("Backend server is not running. Start it with: ck config");
		this.name = "ServerUnavailableError";
	}
}

/**
 * Check if backend is available. Throws ServerUnavailableError if not.
 * Per validation: Remove mock entirely, require backend.
 * In Tauri mode, we don't need the Express backend for most operations.
 */
async function requireBackend(): Promise<void> {
	if (isTauri()) return;

	try {
		const res = await fetch(`${API_BASE}/health`, { method: "GET" });
		if (!res.ok) throw new ServerUnavailableError();
	} catch (e) {
		if (e instanceof ServerUnavailableError) throw e;
		throw new ServerUnavailableError();
	}
}

/**
 * Generate a project ID from its absolute path.
 * Must match Rust's `discovered_project_id()` which uses URL_SAFE_NO_PAD
 * base64 encoding of the raw UTF-8 bytes.
 */
export function tauriProjectId(path: string): string {
	const bytes = new TextEncoder().encode(path);
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	const b64 = btoa(binary);
	const urlSafe = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `discovered-${urlSafe}`;
}

/**
 * Route a call based on environment (Tauri vs Web).
 * Read-only operations and simple CRUD move to Rust in Tauri mode.
 * Complex operations stay in Express.
 */
async function routeCall<T>(config: {
	tauri: () => Promise<T>;
	web: () => Promise<T>;
	allowFallback?: boolean;
}): Promise<T> {
	if (isTauri()) {
		if (config.allowFallback) {
			try {
				return await config.tauri();
			} catch (e) {
				console.error("[api] Tauri command failed, falling back to web:", e);
				// Fall through to web
			}
		} else {
			return config.tauri(); // Propagate Tauri errors directly
		}
	}
	return config.web();
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
	planSettings?: {
		scope: "project" | "global";
		plansDir: string;
		validationMode: "prompt" | "auto" | "strict" | "none";
		activePlanCount: number;
	};
	activePlans?: ProjectActivePlan[];
	preferences?: {
		terminalApp?: string;
		editorApp?: string;
	};
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
		planSettings: p.planSettings,
		activePlans: p.activePlans,
		preferences: p.preferences,
	};
}

/** Transform Rust ProjectInfo to UI Project. Enrichment happens in fetchProjects. */
function transformTauriProject(p: tauri.ProjectInfo): Project {
	return {
		id: tauriProjectId(p.path),
		name: p.name,
		path: p.path,
		health: p.hasClaudeConfig ? HealthStatus.HEALTHY : HealthStatus.UNKNOWN,
		kitType: KitType.ENGINEER, // Default; TODO: read actual kit from .ck.json in enrichTauriProject
		model: "claude-sonnet-4-5",
		activeHooks: 0,
		mcpServers: 0,
		skills: [],
	};
}

/** Enrich a transformed project with actual settings data from disk. */
async function enrichTauriProject(project: Project): Promise<Project> {
	try {
		const settings = await tauri.readSettings(project.path);
		return {
			...project,
			model: (settings.model as string) || project.model,
			activeHooks: Array.isArray(settings.hooks) ? settings.hooks.length : 0,
			mcpServers:
				settings.mcpServers != null && typeof settings.mcpServers === "object"
					? Object.keys(settings.mcpServers as object).length
					: 0,
		};
	} catch {
		return project;
	}
}

export async function fetchProjects(): Promise<Project[]> {
	return routeCall({
		tauri: async () => {
			const projects = await tauri.listProjects();
			const base = projects.map(transformTauriProject);
			// Enrich with actual settings in parallel (best-effort)
			return Promise.all(base.map(enrichTauriProject));
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/projects`);
			if (!res.ok) throw new Error("Failed to fetch projects");
			const apiProjects: ApiProject[] = await res.json();
			return apiProjects.map(transformApiProject);
		},
	});
}

// Simple cache to avoid duplicate fetches during same render cycle
const projectCache = new Map<string, { data: Project; timestamp: number }>();
const PROJECT_CACHE_TTL_MS = 5000; // 5 seconds

export async function fetchProject(id: string): Promise<Project> {
	// Check cache first
	const cached = projectCache.get(id);
	if (cached && Date.now() - cached.timestamp < PROJECT_CACHE_TTL_MS) {
		return cached.data;
	}

	const project = await routeCall({
		tauri: async () => {
			// Tauri doesn't have getProject(id) yet, so we find in list
			const projects = await tauri.listProjects();
			const found = projects.find((p) => tauriProjectId(p.path) === id);
			if (!found) throw new Error(`Project not found: ${id}`);
			return enrichTauriProject(transformTauriProject(found));
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`);
			if (!res.ok) throw new Error("Failed to fetch project");
			const apiProject: ApiProject = await res.json();
			return transformApiProject(apiProject);
		},
	});

	// Cache the result
	projectCache.set(id, { data: project, timestamp: Date.now() });
	return project;
}

/** Invalidate project cache (call after mutations) */
export function invalidateProjectCache(id?: string): void {
	if (id) {
		projectCache.delete(id);
	} else {
		projectCache.clear();
	}
}

export async function checkHealth(): Promise<boolean> {
	if (isTauri()) {
		try {
			const health = await tauri.getHealth();
			return health.status === "ok";
		} catch {
			return false;
		}
	}
	try {
		const res = await fetch(`${API_BASE}/health`);
		return res.ok;
	} catch {
		return false;
	}
}

// API functions for skills, sessions, settings

export async function fetchSkills(): Promise<Skill[]> {
	return routeCall({
		tauri: async () => {
			const skills = await tauri.scanSkills();
			return skills.map((s) => ({
				id: s.name,
				name: s.name,
				description: s.description || "",
				category: "General",
				isAvailable: s.installed,
			}));
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/skills`);
			if (!res.ok) throw new Error("Failed to fetch skills");
			return res.json();
		},
	});
}

/**
 * Fetch sessions for a project.
 */
export async function fetchSessions(projectId: string, limit?: number): Promise<Session[]> {
	return routeCall({
		tauri: async () => {
			const sessions = await tauri.listProjectSessions(projectId, limit);
			return sessions.map((s) => ({
				id: s.id,
				timestamp: s.timestamp,
				duration: s.duration,
				summary: s.summary,
			}));
		},
		web: async () => {
			try {
				await requireBackend();
				const params = limit !== undefined ? `?limit=${limit}` : "";
				const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(projectId)}${params}`);
				if (!res.ok) return [];
				return res.json();
			} catch {
				return [];
			}
		},
	});
}

export async function fetchProjectSessionsDetail(
	projectId: string,
	sessionId: string,
	limit?: number,
	offset?: number,
): Promise<tauri.SessionDetail> {
	return routeCall({
		tauri: async () => {
			return await tauri.getSessionDetail(projectId, sessionId, limit, offset);
		},
		web: async () => {
			await requireBackend();
			const params = new URLSearchParams();
			if (limit !== undefined) params.set("limit", String(limit));
			if (offset !== undefined) params.set("offset", String(offset));
			const res = await fetch(
				`${API_BASE}/sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}?${params.toString()}`,
			);
			if (!res.ok) throw new Error("Failed to fetch session detail");
			return res.json();
		},
	});
}

export async function fetchSessionActivity(period?: string): Promise<tauri.ActivityMetrics> {
	return routeCall({
		tauri: async () => {
			return await tauri.getSessionActivity(period);
		},
		web: async () => {
			await requireBackend();
			const params = period ? `?period=${period}` : "";
			const res = await fetch(`${API_BASE}/sessions/activity${params}`);
			if (!res.ok) throw new Error("Failed to fetch session activity");
			return res.json();
		},
	});
}

export interface ActionAppOption {
	id: string;
	label: string;
	detected: boolean;
	available: boolean;
	confidence: "high" | "medium" | "low" | null;
	reason?: string;
	openMode: "open-directory" | "open-directory-inferred" | "open-app";
	capabilities: string[];
}

export interface ActionOptionsResponse {
	platform: string;
	terminals: ActionAppOption[];
	editors: ActionAppOption[];
	defaults: {
		terminalApp: string;
		terminalSource: "project" | "global" | "system";
		editorApp: string;
		editorSource: "project" | "global" | "system";
	};
	preferences: {
		project: {
			terminalApp?: string;
			editorApp?: string;
		};
		global: {
			terminalApp?: string;
			editorApp?: string;
		};
	};
}

export async function fetchActionOptions(
	projectId?: string,
	signal?: AbortSignal,
): Promise<ActionOptionsResponse> {
	if (isTauri()) {
		throw new Error(
			"Project quick actions require the web dashboard (ck config ui) — not yet available in desktop mode",
		);
	}
	await requireBackend();
	const params = new URLSearchParams();
	if (projectId) params.set("projectId", projectId);
	const res = await fetch(`${API_BASE}/actions/options?${params.toString()}`, { signal });
	if (!res.ok) throw new Error("Failed to fetch action options");
	return res.json();
}

/** Open an external action (terminal, editor, launch) at a project path */
export async function openAction(
	action: string,
	path: string,
	appId?: string,
	projectId?: string,
): Promise<void> {
	if (isTauri()) {
		throw new Error(
			"Project quick actions require the web dashboard (ck config ui) — not yet available in desktop mode",
		);
	}
	await requireBackend();
	const res = await fetch(`${API_BASE}/actions/open`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action, path, appId, projectId }),
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
	settingsPath?: string;
	settingsExists?: boolean;
	settings?: Record<string, unknown>;
}

export interface ApiSettingsFile {
	path: string;
	exists: boolean;
	settings: Record<string, unknown>;
}

export interface SaveSettingsFileResponse {
	success: boolean;
	path: string;
	backupPath: string | null;
	absolutePath: string;
}

// Keep these interfaces aligned with src/services/claude-data/types.ts on the backend.
export interface HookDiagnosticsEntry {
	ts: string;
	hook: string;
	event?: string;
	tool?: string;
	target?: string;
	note?: string;
	dur?: number;
	status: string;
	exit?: number;
	error?: string;
}

export interface HookDiagnosticsSummary {
	total: number;
	parseErrors: number;
	lastEventAt: string | null;
	inspectedLines: number;
	truncated: boolean;
	statusCounts: Record<string, number>;
	hookCounts: Record<string, number>;
	toolCounts: Record<string, number>;
}

export interface HookDiagnosticsResponse {
	scope: "global" | "project";
	projectId: string | null;
	path: string;
	exists: boolean;
	entries: HookDiagnosticsEntry[];
	summary: HookDiagnosticsSummary;
}

export async function fetchSettings(): Promise<ApiSettings> {
	return routeCall({
		tauri: async () => {
			const globalPath = await tauri.getGlobalConfigPath();
			const homeDir = await tauri.getHomeDir();
			const settings = await tauri.readSettings(homeDir);
			return {
				model: (settings.model as string) || "claude-3-5-sonnet",
				hookCount: Array.isArray(settings.hooks) ? settings.hooks.length : 0,
				mcpServerCount:
					settings.mcpServers != null && typeof settings.mcpServers === "object"
						? Object.keys(settings.mcpServers as object).length
						: 0,
				permissions: settings.permissions || {},
				settingsPath: globalPath,
				settingsExists: true,
				settings: settings as Record<string, unknown>,
			};
		},

		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/settings`);
			if (!res.ok) throw new Error("Failed to fetch settings");
			return res.json();
		},
	});
}

export async function fetchSettingsFile(): Promise<ApiSettingsFile> {
	return routeCall({
		tauri: async () => {
			// Derive the display path from a single homeDir call and ask Rust whether
			// the file exists so desktop mode can distinguish "missing" from "{}".
			const homeDir = await tauri.getHomeDir();
			const settingsPath = join(homeDir, ".claude", "settings.json");

			let exists: boolean;
			let settings: Record<string, unknown>;
			try {
				[exists, settings] = await Promise.all([
					tauri.settingsFileExists(homeDir),
					tauri.readSettings(homeDir) as Promise<Record<string, unknown>>,
				]);
			} catch (err) {
				const detail = err instanceof Error ? err.message : String(err);
				throw new Error(`Failed to read settings from ${settingsPath}: ${detail}`);
			}

			return {
				path: settingsPath,
				exists,
				settings,
			};
		},
		web: async () => {
			await requireBackend();
			try {
				const res = await fetch(`${API_BASE}/settings/raw`);
				if (res.ok) return res.json();
			} catch {
				// Fall through to legacy endpoint.
			}

			const legacyRes = await fetch(`${API_BASE}/settings`);
			if (!legacyRes.ok) throw new Error("Failed to fetch settings file");

			const legacy = (await legacyRes.json()) as ApiSettings;
			const embeddedSettings =
				legacy.settings && typeof legacy.settings === "object"
					? legacy.settings
					: {
							model: legacy.model,
							permissions: legacy.permissions,
							hookCount: legacy.hookCount,
							mcpServerCount: legacy.mcpServerCount,
						};

			return {
				path: legacy.settingsPath ?? "~/.claude/settings.json",
				exists: legacy.settingsExists ?? true,
				settings: embeddedSettings,
			};
		},
	});
}

export async function saveSettingsFile(
	settings: Record<string, unknown>,
): Promise<SaveSettingsFileResponse> {
	return routeCall({
		tauri: async () => {
			const globalPath = await tauri.getGlobalConfigPath();
			const homeDir = await tauri.getHomeDir();
			await tauri.writeSettings(homeDir, settings);
			return {
				success: true,
				path: globalPath,
				backupPath: null,
				absolutePath: globalPath,
			};
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/settings/raw`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ settings }),
			});

			if (!res.ok) {
				const data = (await res
					.json()
					.catch(() => ({ error: "Failed to save settings file" }))) as {
					error?: string;
					details?: unknown;
				};
				throw new Error(data.error || "Failed to save settings file");
			}

			return res.json();
		},
	});
}

export async function fetchHookDiagnostics(params?: {
	scope?: "global" | "project";
	projectId?: string;
	limit?: number;
	signal?: AbortSignal;
}): Promise<HookDiagnosticsResponse> {
	return routeCall({
		tauri: async () => {
			return await tauri.getHookDiagnostics(params?.scope, params?.projectId, params?.limit);
		},
		web: async () => {
			await requireBackend();
			const query = new URLSearchParams();
			if (params?.scope) query.set("scope", params.scope);
			if (params?.projectId) query.set("projectId", params.projectId);
			if (params?.limit !== undefined) query.set("limit", String(params.limit));

			const suffix = query.toString();
			const res = await fetch(`${API_BASE}/system/hook-diagnostics${suffix ? `?${suffix}` : ""}`, {
				signal: params?.signal,
			});
			if (!res.ok) {
				const data = (await res
					.json()
					.catch(() => ({ error: "Failed to fetch hook diagnostics" }))) as {
					error?: string;
				};
				throw new Error(data.error || "Failed to fetch hook diagnostics");
			}
			return res.json();
		},
	});
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
	preferences?: {
		terminalApp?: string | null;
		editorApp?: string | null;
	} | null;
}

export async function addProject(request: AddProjectRequest): Promise<Project> {
	return routeCall({
		tauri: async () => {
			const info = await tauri.addProject(request.path);
			return transformTauriProject(info);
		},
		web: async () => {
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
		},
	});
}

export async function removeProject(id: string): Promise<void> {
	return routeCall({
		tauri: async () => {
			// Find project path from id
			const projects = await tauri.listProjects();
			const found = projects.find((p) => tauriProjectId(p.path) === id);
			if (!found) throw new Error(`Project not found: ${id}`);
			await tauri.removeProject(found.path);
			invalidateProjectCache(id);
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const error = await res.text();
				throw new Error(error || "Failed to remove project");
			}
			invalidateProjectCache(id);
		},
	});
}

export async function updateProject(id: string, updates: UpdateProjectRequest): Promise<Project> {
	return routeCall({
		allowFallback: true,
		tauri: async () => {
			// TODO: Implement update_project Tauri command (#676)
			throw new Error(
				"Project updates require the web dashboard (ck config ui) — not yet available in desktop mode",
			);
		},
		web: async () => {
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

			invalidateProjectCache(id);
			const apiProject: ApiProject = await res.json();
			return transformApiProject(apiProject);
		},
	});
}

export async function touchProject(path: string): Promise<void> {
	if (!isTauri()) return;
	await tauri.touchProject(path);
	invalidateProjectCache();
}

// Metadata operations

export async function fetchGlobalMetadata(): Promise<Record<string, unknown>> {
	return routeCall({
		tauri: async () => {
			return await tauri.getGlobalMetadata();
		},
		web: async () => {
			const res = await fetch(`${API_BASE}/metadata/global`);
			if (!res.ok) {
				console.error("Failed to fetch global metadata");
				return {};
			}
			return res.json();
		},
	});
}

// Plans operations (New in Phase 2E)

export async function fetchPlans(
	dir: string,
	projectId?: string,
	limit?: number,
	offset?: number,
): Promise<tauri.PlanListResponse> {
	return routeCall({
		tauri: async () => {
			return await tauri.listPlans(dir, limit, offset);
		},
		web: async () => {
			await requireBackend();
			const params = new URLSearchParams();
			params.set("dir", dir);
			if (projectId) params.set("projectId", projectId);
			if (limit !== undefined) params.set("limit", String(limit));
			if (offset !== undefined) params.set("offset", String(offset));
			const res = await fetch(`${API_BASE}/plan/list?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to fetch plans");
			return res.json();
		},
	});
}

export async function parsePlan(file: string, projectId?: string): Promise<tauri.PlanDetail> {
	return routeCall({
		tauri: async () => {
			return await tauri.parsePlan(file);
		},
		web: async () => {
			await requireBackend();
			const params = new URLSearchParams();
			params.set("file", file);
			if (projectId) params.set("projectId", projectId);
			const res = await fetch(`${API_BASE}/plan/parse?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to parse plan");
			return res.json();
		},
	});
}

export async function fetchPlanSummary(
	file: string,
	projectId?: string,
): Promise<tauri.PlanSummary> {
	return routeCall({
		tauri: async () => {
			return await tauri.getPlanSummary(file);
		},
		web: async () => {
			await requireBackend();
			const params = new URLSearchParams();
			params.set("file", file);
			if (projectId) params.set("projectId", projectId);
			const res = await fetch(`${API_BASE}/plan/summary?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to fetch plan summary");
			return res.json();
		},
	});
}

// Skills API functions

export interface FetchInstalledSkillsResponse {
	installations: import("@/types").SkillInstallation[];
}

export async function fetchInstalledSkills(): Promise<FetchInstalledSkillsResponse> {
	return routeCall({
		tauri: async () => {
			const skills = await tauri.scanSkills();
			return {
				installations: skills
					.filter((s) => s.installed)
					.map((s) => ({
						skillId: s.name,
						agentIds: [], // Rust doesn't provide agent mapping yet
						isGlobal: true, // Rust scanner only reads ~/.claude/skills/ (global)
					})),
			};
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/skills/installed`);
			if (!res.ok) throw new Error("Failed to fetch installed skills");
			return res.json();
		},
	});
}

export interface FetchAgentsResponse {
	agents: import("@/types").AgentInfo[];
}

export async function fetchAgents(): Promise<FetchAgentsResponse> {
	return routeCall({
		tauri: async () => {
			const agents = await tauri.scanAgents();
			return {
				agents: agents.map((a) => ({
					id: a.slug,
					name: a.name,
					description: a.description,
					model: a.model || undefined,
					configPath: a.relativePath,
				})),
			};
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/agents`);
			if (!res.ok) throw new Error("Failed to fetch agents");
			return res.json();
		},
	});
}

// Dashboard & System operations (New in Phase 2)

export async function fetchDashboardStats(): Promise<tauri.DashboardStats> {
	return routeCall({
		tauri: async () => {
			return await tauri.getDashboardStats();
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/dashboard/stats`);
			if (!res.ok) throw new Error("Failed to fetch dashboard stats");
			return res.json();
		},
	});
}

export async function fetchDashboardAgents(): Promise<tauri.DashboardAgentEntry[]> {
	return routeCall({
		tauri: async () => {
			return await tauri.getDashboardAgents();
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/dashboard/agents`);
			if (!res.ok) throw new Error("Failed to fetch dashboard agents");
			return res.json();
		},
	});
}

export async function fetchSuggestions(): Promise<tauri.Suggestion[]> {
	return routeCall({
		tauri: async () => {
			return await tauri.getSuggestions();
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/dashboard/suggestions`);
			if (!res.ok) throw new Error("Failed to fetch suggestions");
			return res.json();
		},
	});
}

export async function getSystemInfo(): Promise<tauri.DesktopSystemInfo> {
	return routeCall({
		tauri: async () => {
			return await tauri.getSystemInfo();
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/system/info`);
			if (!res.ok) throw new Error("Failed to fetch system info");
			return res.json();
		},
	});
}

export async function getHealth(): Promise<tauri.DesktopHealthStatus> {
	return routeCall({
		tauri: async () => {
			return await tauri.getHealth();
		},
		web: async () => {
			await requireBackend();
			const res = await fetch(`${API_BASE}/system/health`);
			if (!res.ok) throw new Error("Failed to fetch health");
			return res.json();
		},
	});
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

function extractMessageFromUnknown(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;
		// Some backends serialize JSON payloads as string bodies.
		if (
			(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
			(trimmed.startsWith("[") && trimmed.endsWith("]"))
		) {
			try {
				return extractMessageFromUnknown(JSON.parse(trimmed)) ?? trimmed;
			} catch {
				return trimmed;
			}
		}
		return trimmed;
	}

	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		for (const key of ["message", "error", "detail", "details", "reason"] as const) {
			const candidate = record[key];
			if (typeof candidate === "string" && candidate.trim()) {
				return candidate.trim();
			}
		}
	}

	return null;
}

function decodeJsonCapture(value: string): string {
	try {
		return JSON.parse(`"${value}"`) as string;
	} catch {
		return value;
	}
}

function extractMigrationErrorMessage(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	try {
		return extractMessageFromUnknown(JSON.parse(trimmed)) ?? trimmed;
	} catch {
		// Continue with raw string fallbacks.
	}

	const messageMatch = trimmed.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
	if (messageMatch?.[1]) return decodeJsonCapture(messageMatch[1]);

	const errorMatch = trimmed.match(/"error"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
	if (errorMatch?.[1]) return decodeJsonCapture(errorMatch[1]);

	return trimmed;
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
		const raw = await res.text();
		const parsedMessage = extractMigrationErrorMessage(raw);
		throw new Error(parsedMessage || "Failed to execute migration");
	}
	return res.json();
}

// ---------------------------------------------------------------------------
// P2: Reconcile plan fetcher (typed, with new params)
// ---------------------------------------------------------------------------

export interface FetchReconcilePlanParams {
	providers: string[];
	global?: boolean;
	source?: string;
	agents?: boolean;
	commands?: boolean;
	skills?: boolean;
	config?: boolean;
	rules?: boolean;
	hooks?: boolean;
	/** Default: true. Pass false to suppress empty-dir reinstall override. */
	reinstallEmptyDirs?: boolean;
	/** Default: false. Pass true to suppress reinstall of empty dirs. */
	respectDeletions?: boolean;
	/** Default: 'reconcile'. */
	mode?: "reconcile" | "install";
}

export interface FetchReconcilePlanResponse {
	plan: unknown; // Typed by UI once ReconcilePlan shape is consumed
	suggestedMode: "reconcile" | "install";
}

/**
 * Fetch a reconcile plan from the server.
 * Wraps GET /api/migrate/reconcile with P2 params.
 */
export async function fetchReconcilePlan(
	params: FetchReconcilePlanParams,
): Promise<FetchReconcilePlanResponse> {
	await requireBackend();
	const qs = new URLSearchParams();
	for (const p of params.providers) {
		qs.append("providers", p);
	}
	if (params.global !== undefined) qs.set("global", String(params.global));
	if (params.source) qs.set("source", params.source);
	if (params.agents !== undefined) qs.set("agents", String(params.agents));
	if (params.commands !== undefined) qs.set("commands", String(params.commands));
	if (params.skills !== undefined) qs.set("skills", String(params.skills));
	if (params.config !== undefined) qs.set("config", String(params.config));
	if (params.rules !== undefined) qs.set("rules", String(params.rules));
	if (params.hooks !== undefined) qs.set("hooks", String(params.hooks));
	if (params.reinstallEmptyDirs !== undefined)
		qs.set("reinstallEmptyDirs", String(params.reinstallEmptyDirs));
	if (params.respectDeletions !== undefined)
		qs.set("respectDeletions", String(params.respectDeletions));
	if (params.mode) qs.set("mode", params.mode);

	const res = await fetch(`${API_BASE}/migrate/reconcile?${qs.toString()}`);
	if (!res.ok) {
		const raw = await res.text();
		const parsedMessage = extractMigrationErrorMessage(raw);
		throw new Error(parsedMessage || "Failed to fetch reconcile plan");
	}
	return res.json();
}

// ---------------------------------------------------------------------------
// P2: Install discovery (Install mode picker)
// ---------------------------------------------------------------------------

export interface FetchInstallCandidatesParams {
	providers: string[];
	global?: boolean;
	source?: string;
	agents?: boolean;
	commands?: boolean;
	skills?: boolean;
	config?: boolean;
	rules?: boolean;
	hooks?: boolean;
}

/**
 * Fetch install candidates for Install mode without running reconcile.
 * Wraps GET /api/migrate/install-discovery.
 * Fast — no checksum computation.
 */
export async function fetchInstallCandidates(
	params: FetchInstallCandidatesParams,
): Promise<InstallDiscoveryResponse> {
	await requireBackend();
	const qs = new URLSearchParams();
	for (const p of params.providers) {
		qs.append("providers", p);
	}
	if (params.global !== undefined) qs.set("global", String(params.global));
	if (params.source) qs.set("source", params.source);
	if (params.agents !== undefined) qs.set("agents", String(params.agents));
	if (params.commands !== undefined) qs.set("commands", String(params.commands));
	if (params.skills !== undefined) qs.set("skills", String(params.skills));
	if (params.config !== undefined) qs.set("config", String(params.config));
	if (params.rules !== undefined) qs.set("rules", String(params.rules));
	if (params.hooks !== undefined) qs.set("hooks", String(params.hooks));

	const res = await fetch(`${API_BASE}/migrate/install-discovery?${qs.toString()}`);
	if (!res.ok) throw new Error("Failed to fetch install candidates");
	return res.json();
}
