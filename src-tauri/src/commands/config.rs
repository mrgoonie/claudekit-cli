// commands/config.rs — Tauri commands for CK config and statusline read/write
//
// All commands return Result<_, String> — errors are surfaced to the frontend
// via Tauri's invoke error channel. Missing files return empty objects (not errors)
// so the UI can treat "no config yet" and "fresh config" identically.
//
// Config file locations:
//   CK config  : <project>/.claude/.ck.json
//   Settings   : <project>/.claude/settings.json
//   Statusline : <project>/.claude/settings.json (field within settings)
//   Global     : $HOME/.claude/settings.json

use crate::core::{config_parser, paths};
use serde_json::Value;
use std::path::Path;

/// Validate that a project path is absolute, exists, and resolve traversal.
/// Canonicalizes the path to prevent `/../../../etc` escapes.
fn validate_project_path(project_path: &str) -> Result<String, String> {
    let p = Path::new(project_path);
    if !p.is_absolute() {
        return Err(format!("Project path must be absolute: {project_path}"));
    }
    let canonical = p.canonicalize().map_err(|e| {
        format!("Project path does not exist or is inaccessible: {project_path} ({e})")
    })?;
    if !canonical.is_dir() {
        return Err(format!("Project path is not a directory: {project_path}"));
    }
    Ok(canonical.to_string_lossy().into_owned())
}

// ---------------------------------------------------------------------------
// CK config (.ck.json)
// ---------------------------------------------------------------------------

/// Read CK config for a project. Returns empty object when file is absent.
#[tauri::command]
pub fn read_config(project_path: String) -> Result<Value, String> {
    let safe_path = validate_project_path(&project_path)?;
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::ck_config_path(&base);
    config_parser::read_json_file(&path)
}

/// Write CK config for a project. Creates .claude/ directory if needed.
#[tauri::command]
pub fn write_config(project_path: String, config: Value) -> Result<(), String> {
    let safe_path = validate_project_path(&project_path)?;
    if !config.is_object() {
        return Err("Config must be a JSON object".to_string());
    }
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::ck_config_path(&base);
    config_parser::write_json_file(&path, &config)
}

// ---------------------------------------------------------------------------
// Settings (settings.json)
// ---------------------------------------------------------------------------

/// Read settings.json for a project. Returns empty object when file is absent.
#[tauri::command]
pub fn read_settings(project_path: String) -> Result<Value, String> {
    let safe_path = validate_project_path(&project_path)?;
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::settings_path(&base);
    config_parser::read_json_file(&path)
}

/// Check whether settings.json exists for a project.
#[tauri::command]
pub fn settings_file_exists(project_path: String) -> Result<bool, String> {
    let safe_path = validate_project_path(&project_path)?;
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::settings_path(&base);
    Ok(path.exists())
}

/// Write settings.json for a project. Creates .claude/ directory if needed.
#[tauri::command]
pub fn write_settings(project_path: String, settings: Value) -> Result<(), String> {
    let safe_path = validate_project_path(&project_path)?;
    if !settings.is_object() {
        return Err("Settings must be a JSON object".to_string());
    }
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::settings_path(&base);
    config_parser::write_json_file(&path, &settings)
}

// ---------------------------------------------------------------------------
// Statusline (field inside settings.json)
// ---------------------------------------------------------------------------

/// Read the statusline-related fields from settings.json.
/// Returns an object with keys: statusline, statuslineColors, statuslineQuota,
/// statuslineLayout — or an empty object if the file / keys are absent.
#[tauri::command]
pub fn read_statusline(project_path: String) -> Result<Value, String> {
    let safe_path = validate_project_path(&project_path)?;
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::settings_path(&base);
    let full = config_parser::read_json_file(&path)?;

    // Extract only the statusline-related keys
    let mut out = serde_json::Map::new();
    if let Value::Object(ref map) = full {
        for key in &[
            "statusline",
            "statuslineColors",
            "statuslineQuota",
            "statuslineLayout",
        ] {
            if let Some(v) = map.get(*key) {
                out.insert(key.to_string(), v.clone());
            }
        }
    }
    Ok(Value::Object(out))
}

/// Merge statusline fields into settings.json. Preserves all existing keys.
/// Accepted keys: statusline, statuslineColors, statuslineQuota, statuslineLayout.
/// Unknown keys in the payload are ignored to prevent accidental corruption.
#[tauri::command]
pub fn write_statusline(project_path: String, config: Value) -> Result<(), String> {
    let safe_path = validate_project_path(&project_path)?;
    let base = paths::project_claude_dir(&safe_path);
    let path = paths::settings_path(&base);

    // Load existing settings (returns {} for missing files)
    let mut settings = config_parser::read_json_file(&path)?;

    let allowed_keys = [
        "statusline",
        "statuslineColors",
        "statuslineQuota",
        "statuslineLayout",
    ];

    if let (Value::Object(ref mut existing), Value::Object(ref incoming)) = (&mut settings, &config)
    {
        for key in &allowed_keys {
            if let Some(v) = incoming.get(*key) {
                existing.insert(key.to_string(), v.clone());
            }
        }
    } else {
        return Err("Invalid settings or config payload: expected JSON objects".to_string());
    }

    config_parser::write_json_file(&path, &settings)
}

// ---------------------------------------------------------------------------
// Global config path
// ---------------------------------------------------------------------------

/// Return the absolute path to $HOME/.claude/settings.json.
/// Returns an error if the home directory cannot be determined.
#[tauri::command]
pub fn get_global_config_path() -> Result<String, String> {
    let dir =
        paths::global_claude_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let path = paths::settings_path(&dir);
    Ok(path.to_string_lossy().into_owned())
}

/// Return the absolute path to the global .claude directory.
#[tauri::command]
pub fn get_global_config_dir() -> Result<String, String> {
    let dir =
        paths::global_claude_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Return the absolute path to the current user's home directory.
#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let dir = paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}
