// ClaudeKit Control Center — Project management commands
//
// Provides Tauri commands for multi-project management:
//   - list_projects   — Return all registered projects from persistent store
//   - add_project     — Register a directory as a project
//   - remove_project  — Unregister a project by path
//   - scan_for_projects — Recursively discover .claude/ directories

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri_plugin_store::StoreExt;

/// Metadata about a ClaudeKit project directory
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectInfo {
    /// Directory name (last path component)
    pub name: String,
    /// Absolute path to the project root
    pub path: String,
    /// Whether .claude/ directory exists
    pub has_claude_config: bool,
    /// Whether .claude/.ck.json exists (indicates CK-managed project)
    pub has_ck_config: bool,
}

/// Store key under which the list of project paths is persisted
const STORE_KEY: &str = "paths";

/// List all registered projects from the persistent store.
///
/// Returns an empty list if no projects have been added yet.
#[tauri::command]
pub fn list_projects(app: tauri::AppHandle) -> Result<Vec<ProjectInfo>, String> {
    let store = app
        .store("projects.json")
        .map_err(|e| format!("Failed to open store: {e}"))?;

    let paths: Vec<String> = store
        .get(STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(paths.iter().map(|p| build_project_info(p.as_str())).collect())
}

/// Add a project directory to the persistent store.
///
/// Validates that the path exists on disk. Silently skips duplicates.
/// Returns the ProjectInfo for the newly-added (or already-present) project.
#[tauri::command]
pub fn add_project(app: tauri::AppHandle, path: String) -> Result<ProjectInfo, String> {
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let store = app
        .store("projects.json")
        .map_err(|e| format!("Failed to open store: {e}"))?;

    let mut paths: Vec<String> = store
        .get(STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if !paths.contains(&path) {
        paths.push(path.clone());
        store.set(
            STORE_KEY,
            serde_json::to_value(&paths).map_err(|e| format!("Serialization error: {e}"))?,
        );
        store.save().map_err(|e| format!("Failed to save store: {e}"))?;
    }

    Ok(build_project_info(&path))
}

/// Remove a project directory from the persistent store.
///
/// No-ops if the path is not registered.
#[tauri::command]
pub fn remove_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let store = app
        .store("projects.json")
        .map_err(|e| format!("Failed to open store: {e}"))?;

    let mut paths: Vec<String> = store
        .get(STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    paths.retain(|p| p != &path);

    store.set(
        STORE_KEY,
        serde_json::to_value(&paths).map_err(|e| format!("Serialization error: {e}"))?,
    );
    store.save().map_err(|e| format!("Failed to save store: {e}"))?;

    Ok(())
}

/// Recursively scan a root directory for ClaudeKit projects (those containing .claude/).
///
/// `max_depth` caps recursion depth (default 3) to avoid unbounded traversal.
/// Hidden directories, node_modules, target, and dist are skipped.
#[tauri::command]
pub fn scan_for_projects(
    root_path: String,
    max_depth: Option<u32>,
) -> Result<Vec<ProjectInfo>, String> {
    let depth = max_depth.unwrap_or(3);
    let mut found: Vec<ProjectInfo> = Vec::new();
    scan_recursive(Path::new(&root_path), depth, &mut found);
    Ok(found)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Walk `dir` recursively up to `depth` levels, collecting directories that
/// contain a `.claude/` subdirectory.
fn scan_recursive(dir: &Path, depth: u32, results: &mut Vec<ProjectInfo>) {
    if depth == 0 {
        return;
    }

    // Record this directory if it is itself a CK project
    if dir.join(".claude").is_dir() {
        results.push(build_project_info(&dir.to_string_lossy()));
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        // Silently skip unreadable directories (permissions, broken symlinks)
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = path.file_name().unwrap_or_default().to_string_lossy();

        // Skip hidden dirs and well-known build/dependency dirs to stay fast
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        scan_recursive(&path, depth - 1, results);
    }
}

/// Build a `ProjectInfo` from a raw path string.
///
/// Does not require the path to exist — callers must pre-validate when needed.
fn build_project_info(path: &str) -> ProjectInfo {
    let p = Path::new(path);

    let name = p
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    ProjectInfo {
        name,
        path: path.to_string(),
        has_claude_config: p.join(".claude").is_dir(),
        has_ck_config: p.join(".claude/.ck.json").is_file(),
    }
}
