// ClaudeKit Control Center — Project management commands
//
// Uses the same ~/.claudekit/projects.json registry as the CLI/web backend so
// desktop project actions and desktop read commands share one source of truth.

use crate::core::{paths, project_ids};
use crate::tray;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs::{self, File, OpenOptions};
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub has_claude_config: bool,
    pub has_ck_config: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectInfo {
    pub project_id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_opened: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectActionPreferences {
    #[serde(skip_serializing_if = "Option::is_none")]
    terminal_app: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    editor_app: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegisteredProject {
    id: String,
    path: String,
    alias: String,
    added_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_opened: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pinned: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preferences: Option<ProjectActionPreferences>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ProjectsRegistry {
    version: u32,
    projects: Vec<RegisteredProject>,
}

const REGISTRY_VERSION: u32 = 1;
const REGISTRY_LOCK_RETRY_MS: u64 = 100;
const REGISTRY_LOCK_MAX_RETRIES: usize = 50;
const REGISTRY_STALE_LOCK_MS: u64 = 30_000;

#[tauri::command]
pub fn list_projects(_app: tauri::AppHandle) -> Result<Vec<ProjectInfo>, String> {
    with_registry_lock(|| {
        let registry = load_registry()?;
        Ok(registry
            .projects
            .iter()
            .filter(|project| Path::new(&project.path).is_dir())
            .map(|project| build_project_info(&project.path))
            .collect())
    })
}

#[tauri::command]
pub fn add_project(app: tauri::AppHandle, path: String) -> Result<ProjectInfo, String> {
    let canonical_path = canonical_project_path(&path)?;
    let (project_info, should_refresh) = with_registry_lock(|| {
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
                pinned: None,
                tags: None,
                preferences: None,
            });
            save_registry(&registry)?;
            return Ok((build_project_info(&canonical_path), true));
        }

        Ok((build_project_info(&canonical_path), false))
    })?;

    if should_refresh {
        refresh_tray_best_effort(&app);
    }

    Ok(project_info)
}

#[tauri::command]
pub fn remove_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let normalized_path = normalize_input_path(&path);
    let should_refresh = with_registry_lock(|| {
        let mut registry = load_registry()?;
        let original_len = registry.projects.len();

        registry.projects.retain(|project| {
            let project_path = normalize_input_path(&project.path);
            project_path != normalized_path && project.path != path
        });

        if registry.projects.len() != original_len {
            save_registry(&registry)?;
            return Ok(true);
        }

        Ok(false)
    })?;

    if should_refresh {
        refresh_tray_best_effort(&app);
    }

    Ok(())
}

#[tauri::command]
pub fn touch_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let canonical_path = canonical_project_path(&path)?;
    with_registry_lock(|| {
        let mut registry = load_registry()?;

        if !set_project_last_opened(&mut registry, &canonical_path, current_timestamp_iso()) {
            return Err(format!("Project is not registered: {canonical_path}"));
        }

        save_registry(&registry)
    })?;
    refresh_tray_best_effort(&app);
    Ok(())
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

pub(crate) fn list_recent_projects(limit: usize) -> Result<Vec<RecentProjectInfo>, String> {
    with_registry_lock(|| {
        let registry = load_registry()?;
        Ok(recent_projects_from_registry(&registry, limit)
            .into_iter()
            .map(|project| build_recent_project_info(&project))
            .collect())
    })
}

pub(crate) fn primary_recent_project() -> Result<Option<RecentProjectInfo>, String> {
    Ok(list_recent_projects(1)?.into_iter().next())
}

pub(crate) fn touch_project_path(
    app: &tauri::AppHandle,
    path: &str,
) -> Result<RecentProjectInfo, String> {
    let canonical_path = canonical_project_path(path)?;
    let updated = with_registry_lock(|| {
        let mut registry = load_registry()?;

        if !set_project_last_opened(&mut registry, &canonical_path, current_timestamp_iso()) {
            return Err(format!("Project is not registered: {canonical_path}"));
        }

        let updated = recent_projects_from_registry(&registry, usize::MAX)
            .into_iter()
            .find(|project| project.path == canonical_path)
            .map(|project| build_recent_project_info(&project))
            .ok_or_else(|| format!("Project is not registered: {canonical_path}"))?;

        save_registry(&registry)?;
        Ok(updated)
    })?;
    refresh_tray_best_effort(app);
    Ok(updated)
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
    match serde_json::from_str::<ProjectsRegistry>(&content) {
        Ok(registry) => Ok(registry),
        Err(err) => {
            let backup_path = std::path::PathBuf::from(format!(
                "{}.backup-{}",
                path.display(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_millis())
                    .unwrap_or_default()
            ));
            let _ = fs::copy(&path, &backup_path);
            eprintln!(
                "[projects] failed to parse registry, backed up {} to {}: {err}",
                path.display(),
                backup_path.display()
            );
            Ok(ProjectsRegistry {
                version: REGISTRY_VERSION,
                projects: Vec::new(),
            })
        }
    }
}

fn save_registry(registry: &ProjectsRegistry) -> Result<(), String> {
    let path = registry_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create {}: {err}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(registry)
        .map_err(|err| format!("Failed to serialize projects registry: {err}"))?;
    let temp_path = std::path::PathBuf::from(format!("{}.tmp", path.display()));
    fs::write(&temp_path, content)
        .map_err(|err| format!("Failed to write {}: {err}", temp_path.display()))?;
    fs::rename(&temp_path, &path)
        .map_err(|err| format!("Failed to replace {}: {err}", path.display()))
}

fn refresh_tray_best_effort(app: &tauri::AppHandle) {
    if let Err(err) = tray::refresh_tray(app) {
        eprintln!("[projects] failed to refresh tray: {err}");
    }
}

fn with_registry_lock<T>(operation: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    static PROJECTS_REGISTRY_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    let lock = PROJECTS_REGISTRY_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = lock
        .lock()
        .map_err(|_| "Projects registry lock poisoned".to_string())?;
    let _file_lock = acquire_registry_file_lock()?;
    operation()
}

struct RegistryFileLock {
    _file: File,
    path: std::path::PathBuf,
}

impl Drop for RegistryFileLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn acquire_registry_file_lock() -> Result<RegistryFileLock, String> {
    let registry_path = registry_path()?;
    let lock_path = std::path::PathBuf::from(format!("{}.lock", registry_path.display()));
    if let Some(parent) = lock_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create {}: {err}", parent.display()))?;
    }

    for attempt in 0..=REGISTRY_LOCK_MAX_RETRIES {
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
        {
            Ok(file) => {
                return Ok(RegistryFileLock {
                    _file: file,
                    path: lock_path,
                })
            }
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
                if let Ok(metadata) = fs::metadata(&lock_path) {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(age) = SystemTime::now().duration_since(modified) {
                            if age.as_millis() as u64 > REGISTRY_STALE_LOCK_MS {
                                let _ = fs::remove_file(&lock_path);
                                continue;
                            }
                        }
                    }
                }

                if attempt == REGISTRY_LOCK_MAX_RETRIES {
                    return Err(format!(
                        "Failed to acquire registry lock at {}",
                        lock_path.display()
                    ));
                }

                thread::sleep(Duration::from_millis(REGISTRY_LOCK_RETRY_MS));
            }
            Err(err) => {
                return Err(format!(
                    "Failed to acquire registry lock at {}: {err}",
                    lock_path.display()
                ))
            }
        }
    }

    Err(format!(
        "Failed to acquire registry lock at {}",
        lock_path.display()
    ))
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

fn recent_projects_from_registry(
    registry: &ProjectsRegistry,
    limit: usize,
) -> Vec<RegisteredProject> {
    let mut projects = registry
        .projects
        .iter()
        .filter(|project| Path::new(&project.path).is_dir())
        .cloned()
        .collect::<Vec<_>>();

    projects.sort_by(compare_recent_projects);
    projects.truncate(limit);
    projects
}

fn compare_recent_projects(left: &RegisteredProject, right: &RegisteredProject) -> Ordering {
    normalize_timestamp(right.last_opened.as_deref())
        .cmp(&normalize_timestamp(left.last_opened.as_deref()))
        .then_with(|| normalize_timestamp(Some(&right.added_at)).cmp(&normalize_timestamp(Some(&left.added_at))))
        .then_with(|| left.alias.cmp(&right.alias))
}

fn normalize_timestamp(timestamp: Option<&str>) -> String {
    let Some(timestamp) = timestamp else {
        return String::new();
    };
    if let Some(base) = timestamp.strip_suffix('Z') {
        if base.contains('.') {
            return timestamp.to_string();
        }
        return format!("{base}.000Z");
    }
    timestamp.to_string()
}

fn set_project_last_opened(
    registry: &mut ProjectsRegistry,
    canonical_path: &str,
    timestamp: String,
) -> bool {
    if let Some(project) = registry
        .projects
        .iter_mut()
        .find(|project| normalize_input_path(&project.path) == canonical_path)
    {
        project.last_opened = Some(timestamp);
        return true;
    }

    false
}

fn build_recent_project_info(project: &RegisteredProject) -> RecentProjectInfo {
    RecentProjectInfo {
        project_id: project_ids::discovered_project_id(&project.path),
        name: project.alias.clone(),
        path: project.path.clone(),
        last_opened: project.last_opened.clone(),
    }
}

fn current_timestamp_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.subsec_millis();
    let days = (secs / 86_400) as i64;
    let secs_of_day = (secs % 86_400) as i64;
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
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
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

#[cfg(test)]
mod tests {
    use super::{
        compare_recent_projects, current_timestamp_iso, recent_projects_from_registry,
        set_project_last_opened, ProjectsRegistry, RegisteredProject, REGISTRY_VERSION,
    };
    use std::cmp::Ordering;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-projects-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    fn registered_project(path: &PathBuf, alias: &str, added_at: &str) -> RegisteredProject {
        RegisteredProject {
            id: format!("id-{alias}"),
            path: path.to_string_lossy().into_owned(),
            alias: alias.to_string(),
            added_at: added_at.to_string(),
            last_opened: None,
            pinned: None,
            tags: None,
            preferences: None,
        }
    }

    #[test]
    fn recent_projects_sort_by_last_opened_then_added_at() {
        let alpha = temp_dir("alpha");
        let beta = temp_dir("beta");
        let gamma = temp_dir("gamma");

        let mut alpha_project = registered_project(&alpha, "alpha", "2026-04-10T09:00:00Z");
        alpha_project.last_opened = Some("2026-04-16T10:00:00Z".to_string());

        let mut beta_project = registered_project(&beta, "beta", "2026-04-15T09:00:00Z");
        beta_project.last_opened = Some("2026-04-15T11:00:00Z".to_string());

        let gamma_project = registered_project(&gamma, "gamma", "2026-04-16T08:00:00Z");
        let missing_project = RegisteredProject {
            id: "id-missing".to_string(),
            path: "/tmp/does-not-exist".to_string(),
            alias: "missing".to_string(),
            added_at: "2026-04-20T00:00:00Z".to_string(),
            last_opened: Some("2026-04-20T00:00:00Z".to_string()),
            pinned: None,
            tags: None,
            preferences: None,
        };

        let registry = ProjectsRegistry {
            version: REGISTRY_VERSION,
            projects: vec![beta_project, missing_project, gamma_project, alpha_project],
        };

        let recent = recent_projects_from_registry(&registry, 3);
        let aliases = recent
            .iter()
            .map(|project| project.alias.as_str())
            .collect::<Vec<_>>();

        assert_eq!(aliases, vec!["alpha", "beta", "gamma"]);
    }

    #[test]
    fn touch_updates_matching_project_timestamp() {
        let alpha = temp_dir("touch-alpha");
        let beta = temp_dir("touch-beta");
        let canonical_alpha = alpha
            .canonicalize()
            .expect("alpha path should canonicalize")
            .to_string_lossy()
            .into_owned();

        let mut registry = ProjectsRegistry {
            version: REGISTRY_VERSION,
            projects: vec![
                registered_project(&alpha, "alpha", "2026-04-10T09:00:00Z"),
                registered_project(&beta, "beta", "2026-04-15T09:00:00Z"),
            ],
        };

        let touched = set_project_last_opened(
            &mut registry,
            &canonical_alpha,
            "2026-04-16T11:22:33Z".to_string(),
        );

        assert!(touched);
        assert_eq!(
            registry.projects[0].last_opened.as_deref(),
            Some("2026-04-16T11:22:33Z")
        );
        assert_eq!(registry.projects[1].last_opened, None);
    }

    #[test]
    fn compare_recent_projects_prefers_newer_timestamps() {
        let alpha = temp_dir("cmp-alpha");
        let beta = temp_dir("cmp-beta");
        let mut left = registered_project(&alpha, "alpha", "2026-04-10T09:00:00Z");
        let mut right = registered_project(&beta, "beta", "2026-04-15T09:00:00Z");
        left.last_opened = Some("2026-04-16T08:00:00Z".to_string());
        right.last_opened = Some("2026-04-16T09:00:00Z".to_string());

        assert_eq!(compare_recent_projects(&left, &right), Ordering::Greater);
    }

    #[test]
    fn compare_recent_projects_normalizes_second_precision_timestamps() {
        let alpha = temp_dir("cmp-ms-alpha");
        let beta = temp_dir("cmp-ms-beta");
        let mut left = registered_project(&alpha, "alpha", "2026-04-10T09:00:00Z");
        let mut right = registered_project(&beta, "beta", "2026-04-15T09:00:00Z");
        left.last_opened = Some("2026-04-16T08:00:00Z".to_string());
        right.last_opened = Some("2026-04-16T08:00:00.123Z".to_string());

        assert_eq!(compare_recent_projects(&left, &right), Ordering::Greater);
    }

    #[test]
    fn timestamp_generator_returns_iso_shape() {
        let timestamp = current_timestamp_iso();
        assert_eq!(timestamp.len(), 24);
        assert!(timestamp.contains('.'));
        assert!(timestamp.ends_with('Z'));
    }
}
