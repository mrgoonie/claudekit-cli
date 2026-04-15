// ClaudeKit Control Center — Project management commands
//
// Uses the same ~/.claudekit/projects.json registry as the CLI/web backend so
// desktop project actions and desktop read commands share one source of truth.

use crate::core::paths;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub has_claude_config: bool,
    pub has_ck_config: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisteredProject {
    id: String,
    path: String,
    alias: String,
    added_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_opened: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ProjectsRegistry {
    version: u32,
    projects: Vec<RegisteredProject>,
}

const REGISTRY_VERSION: u32 = 1;

#[tauri::command]
pub fn list_projects(_app: tauri::AppHandle) -> Result<Vec<ProjectInfo>, String> {
    let registry = load_registry()?;
    Ok(registry
        .projects
        .iter()
        .filter(|project| Path::new(&project.path).is_dir())
        .map(|project| build_project_info(&project.path))
        .collect())
}

#[tauri::command]
pub fn add_project(_app: tauri::AppHandle, path: String) -> Result<ProjectInfo, String> {
    let canonical_path = canonical_project_path(&path)?;
    let mut registry = load_registry()?;

    if !registry
        .projects
        .iter()
        .any(|project| project.path == canonical_path)
    {
        let project_name = Path::new(&canonical_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(&canonical_path)
            .to_string();

        registry.projects.push(RegisteredProject {
            id: Uuid::new_v4().to_string(),
            path: canonical_path.clone(),
            alias: project_name,
            added_at: current_timestamp_iso(),
            last_opened: None,
        });
        save_registry(&registry)?;
    }

    Ok(build_project_info(&canonical_path))
}

#[tauri::command]
pub fn remove_project(_app: tauri::AppHandle, path: String) -> Result<(), String> {
    let normalized_path = normalize_input_path(&path);
    let mut registry = load_registry()?;
    registry.projects.retain(|project| {
        let project_path = normalize_input_path(&project.path);
        project_path != normalized_path && project.path != path
    });
    save_registry(&registry)
}

#[tauri::command]
pub async fn scan_for_projects(
    root_path: String,
    max_depth: Option<u32>,
) -> Result<Vec<ProjectInfo>, String> {
    let p = Path::new(&root_path);
    if !p.is_absolute() {
        return Err(format!("Scan root must be an absolute path: {root_path}"));
    }
    if !p.is_dir() {
        return Err(format!(
            "Scan root is not a directory or does not exist: {root_path}"
        ));
    }
    let depth = max_depth.unwrap_or(3);

    tauri::async_runtime::spawn_blocking(move || {
        let mut found: Vec<ProjectInfo> = Vec::new();
        scan_recursive(Path::new(&root_path), depth, &mut found);
        found
    })
    .await
    .map_err(|e| format!("Scan failed: {e}"))
}

fn registry_path() -> Result<std::path::PathBuf, String> {
    paths::projects_registry_path()
        .ok_or_else(|| "Cannot determine projects registry path".to_string())
}

fn load_registry() -> Result<ProjectsRegistry, String> {
    let path = registry_path()?;
    if !path.exists() {
        return Ok(ProjectsRegistry {
            version: REGISTRY_VERSION,
            projects: Vec::new(),
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
    serde_json::from_str::<ProjectsRegistry>(&content)
        .map_err(|err| format!("Failed to parse {}: {err}", path.display()))
}

fn save_registry(registry: &ProjectsRegistry) -> Result<(), String> {
    let path = registry_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create {}: {err}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(registry)
        .map_err(|err| format!("Failed to serialize projects registry: {err}"))?;
    fs::write(&path, content).map_err(|err| format!("Failed to write {}: {err}", path.display()))
}

fn canonical_project_path(path: &str) -> Result<String, String> {
    let project_path = Path::new(path);
    if !project_path.is_dir() {
        return Err(format!("Path is not a directory or does not exist: {path}"));
    }
    project_path
        .canonicalize()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|err| format!("Path is not a directory or does not exist: {path} ({err})"))
}

fn normalize_input_path(path: &str) -> String {
    Path::new(path)
        .canonicalize()
        .unwrap_or_else(|_| Path::new(path).to_path_buf())
        .to_string_lossy()
        .into_owned()
}

fn current_timestamp_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let days = (now / 86_400) as i64;
    let secs_of_day = (now % 86_400) as i64;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = y + (month <= 2) as i64;
    let hour = secs_of_day / 3_600;
    let minute = (secs_of_day % 3_600) / 60;
    let second = secs_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn scan_recursive(dir: &Path, depth: u32, results: &mut Vec<ProjectInfo>) {
    if depth == 0 {
        return;
    }

    if dir.join(".claude").is_dir() {
        results.push(build_project_info(&dir.to_string_lossy()));
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() || path.is_symlink() {
            continue;
        }

        let name = path.file_name().unwrap_or_default().to_string_lossy();
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        scan_recursive(&path, depth - 1, results);
    }
}

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
