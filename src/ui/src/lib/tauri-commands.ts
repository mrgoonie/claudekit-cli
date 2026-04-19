/**
 * Typed wrappers for all 29 Tauri v2 commands registered in src-tauri/src/lib.rs.
 *
 * Command names match the Rust side (snake_case), but argument keys must use
 * Tauri's default camelCase mapping unless a command explicitly opts into
 * `rename_all = "snake_case"`. Our commands do not override that default.
 *
 * Usage:
 *   import { readConfig } from "@/lib/tauri-commands";
 *   const cfg = await readConfig("/absolute/path/to/project");
 */

import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Config commands — src-tauri/src/commands/config.rs
// ---------------------------------------------------------------------------

/** Read .claude/.ck.json for a project. Returns {} when file is absent. */
export const readConfig = (projectPath: string): Promise<Record<string, unknown>> =>
	invoke<Record<string, unknown>>("read_config", { projectPath });

/** Write .claude/.ck.json for a project. Creates .claude/ directory if needed. */
export const writeConfig = (projectPath: string, config: Record<string, unknown>): Promise<void> =>
	invoke<void>("write_config", { projectPath, config });

/** Read .claude/settings.json for a project. Returns {} when file is absent. */
export const readSettings = (projectPath: string): Promise<Record<string, unknown>> =>
	invoke<Record<string, unknown>>("read_settings", { projectPath });

/** Check whether .claude/settings.json exists for a project. */
export const settingsFileExists = (projectPath: string): Promise<boolean> =>
	invoke<boolean>("settings_file_exists", { projectPath });

/** Write .claude/settings.json for a project. Creates .claude/ directory if needed. */
export const writeSettings = (
	projectPath: string,
	settings: Record<string, unknown>,
): Promise<void> => invoke<void>("write_settings", { projectPath, settings });

/**
 * Read statusline-related fields from settings.json.
 * Returns an object with keys: statusline, statuslineColors, statuslineQuota,
 * statuslineLayout — or an empty object if the file / keys are absent.
 */
export const readStatusline = (projectPath: string): Promise<Record<string, unknown>> =>
	invoke<Record<string, unknown>>("read_statusline", { projectPath });

/** Merge statusline fields into settings.json. Preserves all other existing keys. */
export const writeStatusline = (
	projectPath: string,
	config: Record<string, unknown>,
): Promise<void> => invoke<void>("write_statusline", { projectPath, config });

/** Return the absolute path to $HOME/.claude/settings.json. */
export const getGlobalConfigPath = (): Promise<string> => invoke<string>("get_global_config_path");

/** Return the absolute path to the global .claude directory. */
export const getGlobalConfigDir = (): Promise<string> => invoke<string>("get_global_config_dir");

/** Return the absolute path to the current user's home directory. */
export const getHomeDir = (): Promise<string> => invoke<string>("get_home_dir");

// ---------------------------------------------------------------------------
// Project commands — src-tauri/src/projects.rs
// ---------------------------------------------------------------------------

/** Metadata about a ClaudeKit project directory. Mirrors Rust ProjectInfo struct. */
export interface ProjectInfo {
	/** Directory name (last path component) */
	name: string;
	/** Absolute path to the project root */
	path: string;
	/** Whether .claude/ directory exists */
	hasClaudeConfig: boolean;
	/** Whether .claude/.ck.json exists (indicates CK-managed project) */
	hasCkConfig: boolean;
}

/**
 * List all registered projects from the persistent store.
 * Returns an empty array if no projects have been added yet.
 * Requires the Tauri AppHandle — only callable from desktop mode.
 */
export const listProjects = (): Promise<ProjectInfo[]> => invoke<ProjectInfo[]>("list_projects");

/**
 * Register a directory as a project in the persistent store.
 * Returns the ProjectInfo for the newly-added (or already-present) project.
 */
export const addProject = (path: string): Promise<ProjectInfo> =>
	invoke<ProjectInfo>("add_project", { path });

/**
 * Unregister a project by path. No-ops if the path is not registered.
 */
export const removeProject = (path: string): Promise<void> =>
	invoke<void>("remove_project", { path });

/** Update a project's last-opened timestamp in the desktop registry. */
export const touchProject = (path: string): Promise<void> =>
	invoke<void>("touch_project", { path });

/**
 * Recursively scan a root directory for ClaudeKit projects (.claude/ presence).
 * `maxDepth` caps recursion depth (default 3 on Rust side).
 */
export const scanForProjects = (rootPath: string, maxDepth?: number): Promise<ProjectInfo[]> =>
	invoke<ProjectInfo[]>("scan_for_projects", {
		rootPath,
		...(maxDepth !== undefined && { maxDepth }),
	});

// ---------------------------------------------------------------------------
// Session commands — src-tauri/src/commands/sessions.rs
// ---------------------------------------------------------------------------

export interface ProjectSessionSummary {
	id: string;
	name: string;
	path: string;
	sessionCount: number;
	lastActive: string;
}

export interface SessionMeta {
	id: string;
	timestamp: string;
	duration: string;
	summary: string;
}

export interface ProjectActivity {
	name: string;
	path: string;
	sessionCount: number;
	lastActive: string | null;
}

export interface DailyCount {
	date: string;
	count: number;
}

export interface ActivityMetrics {
	totalSessions: number;
	projects: ProjectActivity[];
	dailyCounts: DailyCount[];
}

export interface SessionContentBlock {
	type: "text" | "thinking" | "tool_use" | "tool_result" | "system";
	text?: string;
	toolName?: string;
	toolInput?: string;
	toolUseId?: string;
	result?: string;
	isError?: boolean;
}

export interface SessionMessage {
	role: string;
	timestamp?: string;
	contentBlocks: SessionContentBlock[];
}

export interface SessionSummary {
	messageCount: number;
	toolCallCount: number;
	duration?: string;
}

export interface SessionDetail {
	messages: SessionMessage[];
	summary: SessionSummary;
}

export const scanSessions = (): Promise<ProjectSessionSummary[]> =>
	invoke<ProjectSessionSummary[]>("scan_sessions");

export const listProjectSessions = (projectId: string, limit?: number): Promise<SessionMeta[]> =>
	invoke<SessionMeta[]>("list_project_sessions", {
		projectId,
		...(limit !== undefined && { limit }),
	});

export const getSessionDetail = (
	projectId: string,
	sessionId: string,
	limit?: number,
	offset?: number,
): Promise<SessionDetail> =>
	invoke<SessionDetail>("get_session_detail", {
		projectId,
		sessionId,
		...(limit !== undefined && { limit }),
		...(offset !== undefined && { offset }),
	});

export const getSessionActivity = (period?: string): Promise<ActivityMetrics> =>
	invoke<ActivityMetrics>("get_session_activity", {
		...(period !== undefined && { period }),
	});

// ---------------------------------------------------------------------------
// System commands — src-tauri/src/commands/system.rs
// ---------------------------------------------------------------------------

export interface DesktopSystemInfo {
	configPath: string;
	nodeVersion: string;
	bunVersion: string | null;
	os: string;
	cliVersion: string;
	packageManager: string;
	installLocation: string;
	gitVersion: string;
	ghVersion: string;
	shell: string;
	homeDir: string;
	cpuCores: number;
	totalMemoryGb: string;
}

export interface DesktopHealthStatus {
	status: string;
	timestamp: string;
	uptime: number;
	settingsExists: boolean;
	claudeJsonExists: boolean;
	projectsRegistryExists: boolean;
}

export interface HookDiagnosticEntry {
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
	entries: HookDiagnosticEntry[];
	summary: HookDiagnosticsSummary;
}

export const getSystemInfo = (): Promise<DesktopSystemInfo> =>
	invoke<DesktopSystemInfo>("get_system_info");

export const getHealth = (): Promise<DesktopHealthStatus> =>
	invoke<DesktopHealthStatus>("get_health");

export const getGlobalMetadata = (): Promise<Record<string, unknown>> =>
	invoke<Record<string, unknown>>("get_global_metadata");

export const getHookDiagnostics = (
	scope?: "global" | "project",
	projectId?: string,
	limit?: number,
): Promise<HookDiagnosticsResponse> =>
	invoke<HookDiagnosticsResponse>("get_hook_diagnostics", {
		...(scope !== undefined && { scope }),
		...(projectId !== undefined && { projectId }),
		...(limit !== undefined && { limit }),
	});

// ---------------------------------------------------------------------------
// Entity browser commands — src-tauri/src/commands/*.rs
// ---------------------------------------------------------------------------

export interface AgentInfo {
	slug: string;
	name: string;
	description: string;
	model?: string | null;
	color?: string | null;
	skillCount: number;
	dirLabel: string;
	relativePath: string;
}

export interface AgentDetail extends AgentInfo {
	frontmatter: Record<string, unknown>;
	body: string;
}

export interface CommandNode {
	name: string;
	path: string;
	description?: string;
	children?: CommandNode[];
}

export interface CommandDetail {
	name: string;
	path: string;
	content: string;
	description?: string;
}

export interface SkillInfo {
	name: string;
	description?: string;
	triggers?: string[];
	source: "local" | "github";
	installed: boolean;
}

export interface SkillDetail {
	name: string;
	content: string;
	description?: string;
	triggers?: string[];
	source: "local" | "github";
	installed: boolean;
}

export interface SkillSearchResult {
	name: string;
	displayName?: string;
	description?: string;
	category?: string;
	score: number;
	path: string;
}

export interface McpServerInfo {
	name: string;
	command: string;
	args: string[];
	envKeys?: string[];
	source: string;
	sourceLabel: string;
}

export interface ModelDistribution {
	opus: number;
	sonnet: number;
	haiku: number;
	unset: number;
}

export interface DashboardStats {
	agents: number;
	commands: number;
	skills: number;
	mcpServers: number;
	modelDistribution: ModelDistribution;
}

export interface DashboardAgentEntry {
	name: string;
	model: string;
	description: string;
	color?: string;
}

export interface Suggestion {
	type: "warning" | "info" | "success" | string;
	message: string;
	target?: string;
}

export const scanAgents = (): Promise<AgentInfo[]> => invoke<AgentInfo[]>("scan_agents");

export const getAgentDetail = (slug: string): Promise<AgentDetail> =>
	invoke<AgentDetail>("get_agent_detail", { slug });

export const scanCommands = (): Promise<CommandNode[]> => invoke<CommandNode[]>("scan_commands");

export const getCommandDetail = (slug: string): Promise<CommandDetail> =>
	invoke<CommandDetail>("get_command_detail", { slug });

export const scanSkills = (): Promise<SkillInfo[]> => invoke<SkillInfo[]>("scan_skills");

export const getSkillDetail = (name: string): Promise<SkillDetail> =>
	invoke<SkillDetail>("get_skill_detail", { name });

export const searchSkills = (query: string, limit?: number): Promise<SkillSearchResult[]> =>
	invoke<SkillSearchResult[]>("search_skills", {
		query,
		...(limit !== undefined && { limit }),
	});

export const discoverMcpServers = (projectPath?: string): Promise<McpServerInfo[]> =>
	invoke<McpServerInfo[]>("discover_mcp_servers", {
		...(projectPath !== undefined && { projectPath }),
	});

export const getDashboardStats = (): Promise<DashboardStats> =>
	invoke<DashboardStats>("get_dashboard_stats");

export const getDashboardAgents = (): Promise<DashboardAgentEntry[]> =>
	invoke<DashboardAgentEntry[]>("get_dashboard_agents");

export const getSuggestions = (): Promise<Suggestion[]> => invoke<Suggestion[]>("get_suggestions");

// ---------------------------------------------------------------------------
// Plans commands — src-tauri/src/commands/plans.rs
// ---------------------------------------------------------------------------

export interface PlanSummary {
	planFile: string;
	planDir: string;
	name: string;
	slug: string;
	frontmatter: Record<string, unknown>;
	progressPct: number;
	status: string;
	totalTasks: number;
	completedTasks: number;
}

export interface PlanDetail {
	file: string;
	frontmatter: Record<string, unknown>;
	phases: string[];
	content: string;
}

export interface PlanListResponse {
	dir: string;
	total: number;
	plans: PlanSummary[];
}

export const listPlans = (
	dir: string,
	limit?: number,
	offset?: number,
): Promise<PlanListResponse> =>
	invoke<PlanListResponse>("list_plans", {
		dir,
		...(limit !== undefined && { limit }),
		...(offset !== undefined && { offset }),
	});

export const parsePlan = (file: string): Promise<PlanDetail> =>
	invoke<PlanDetail>("parse_plan", { file });

export const getPlanSummary = (file: string): Promise<PlanSummary> =>
	invoke<PlanSummary>("get_plan_summary", { file });
