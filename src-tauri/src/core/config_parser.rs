// core/config_parser.rs — JSON config read/write with graceful missing-file handling
//
// All operations return Result<_, String> so Tauri commands can surface errors
// directly to the frontend without panicking.

use serde_json::Value;
use std::fs;
use std::path::Path;

/// Read a JSON file from disk.
/// Returns an empty JSON object when the file does not exist (graceful default).
/// Returns `Err` on permission issues or malformed JSON.
pub fn read_json_file(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    // Empty file is treated as an empty object, not an error
    if content.trim().is_empty() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

/// Write a JSON value to disk as pretty-printed JSON.
/// Creates parent directories if they do not exist.
pub fn write_json_file(path: &Path, value: &Value) -> Result<(), String> {
    // Ensure parent directory exists before writing
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }

    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(path, content).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}
