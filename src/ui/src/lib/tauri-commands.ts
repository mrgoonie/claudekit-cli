/**
 * Typed wrappers for all 11 Tauri v2 commands registered in src-tauri/src/lib.rs.
 *
 * Command names and parameter names match the Rust side exactly (snake_case),
 * since Tauri's invoke() serialises JS camelCase keys to snake_case automatically
 * only when using the `rename_all` serde attribute. Our Rust commands use explicit
 * parameter names that match the snake_case JSON keys, so we pass them as-is.
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
	invoke<Record<string, unknown>>("read_config", { project_path: projectPath });

/** Write .claude/.ck.json for a project. Creates .claude/ directory if needed. */
export const writeConfig = (projectPath: string, config: Record<string, unknown>): Promise<void> =>
	invoke<void>("write_config", { project_path: projectPath, config });

/** Read .claude/settings.json for a project. Returns {} when file is absent. */
export const readSettings = (projectPath: string): Promise<Record<string, unknown>> =>
	invoke<Record<string, unknown>>("read_settings", { project_path: projectPath });

/** Write .claude/settings.json for a project. Creates .claude/ directory if needed. */
export const writeSettings = (
	projectPath: string,
	settings: Record<string, unknown>,
): Promise<void> => invoke<void>("write_settings", { project_path: projectPath, settings });

/**
 * Read statusline-related fields from settings.json.
 * Returns an object with keys: statusline, statuslineColors, statuslineQuota,
 * statuslineLayout — or an empty object if the file / keys are absent.
 */
export const readStatusline = (projectPath: string): Promise<Record<string, unknown>> =>
	invoke<Record<string, unknown>>("read_statusline", { project_path: projectPath });

/** Merge statusline fields into settings.json. Preserves all other existing keys. */
export const writeStatusline = (
	projectPath: string,
	config: Record<string, unknown>,
): Promise<void> => invoke<void>("write_statusline", { project_path: projectPath, config });

/** Return the absolute path to $HOME/.claude/settings.json. */
export const getGlobalConfigPath = (): Promise<string> => invoke<string>("get_global_config_path");

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
	has_claude_config: boolean;
	/** Whether .claude/.ck.json exists (indicates CK-managed project) */
	has_ck_config: boolean;
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

/**
 * Recursively scan a root directory for ClaudeKit projects (.claude/ presence).
 * `maxDepth` caps recursion depth (default 3 on Rust side).
 */
export const scanForProjects = (rootPath: string, maxDepth?: number): Promise<ProjectInfo[]> =>
	invoke<ProjectInfo[]>("scan_for_projects", { root_path: rootPath, max_depth: maxDepth });
