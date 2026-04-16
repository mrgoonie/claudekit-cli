use crate::core::paths;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscoveredProject {
    pub path: PathBuf,
    pub session_dir: PathBuf,
}

#[derive(Deserialize)]
struct ProjectsRegistry {
    projects: Vec<RegisteredProject>,
}

#[derive(Deserialize)]
struct RegisteredProject {
    id: String,
    path: String,
}

pub fn encode_claude_project_path(project_path: &str) -> String {
    project_path.replace('\\', "/").replace('/', "-")
}

/// Decode Claude's session-directory naming convention.
///
/// NOTE: This decode is lossy because raw hyphens in path segments are
/// indistinguishable from path separators after flattening. Prefer
/// `extract_project_path_from_session_dir()` or discovered base64 ids when an
/// exact project path is required.
pub fn decode_claude_project_path(encoded: &str) -> Result<String, String> {
    let decoded = encoded.replacen('-', "/", 1).replace('-', "/");
    if decoded.contains("..") {
        return Err("Invalid encoded project path".to_string());
    }
    Ok(decoded)
}

pub fn discovered_project_id(project_path: &str) -> String {
    format!(
        "discovered-{}",
        URL_SAFE_NO_PAD.encode(project_path.as_bytes())
    )
}

pub fn decode_discovered_project_id(project_id: &str) -> Result<String, String> {
    let encoded = project_id
        .strip_prefix("discovered-")
        .ok_or_else(|| "Invalid discovered project id".to_string())?;
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|err| format!("Failed to decode project id: {err}"))?;
    String::from_utf8(bytes).map_err(|err| format!("Invalid UTF-8 in project id: {err}"))
}

pub fn resolve_project_path(project_id: &str) -> Result<Option<PathBuf>, String> {
    match project_id {
        "current" => {
            let cwd = env::current_dir().map_err(|err| format!("Failed to read cwd: {err}"))?;
            return Ok(Some(cwd));
        }
        "global" => {
            return Ok(paths::global_claude_dir());
        }
        _ => {}
    }

    if project_id.starts_with("discovered-") {
        let expected = PathBuf::from(decode_discovered_project_id(project_id)?);
        let expected_canonical = normalize_existing_path(&expected);
        let discovered = scan_discovered_projects()?;
        return Ok(discovered
            .into_iter()
            .find(|project| normalize_existing_path(&project.path) == expected_canonical)
            .map(|project| project.path));
    }

    lookup_registered_project(project_id)
}

pub fn resolve_discovered_session_dir(project_id: &str) -> Result<Option<PathBuf>, String> {
    let expected = PathBuf::from(decode_discovered_project_id(project_id)?);
    let expected_canonical = normalize_existing_path(&expected);
    let discovered = scan_discovered_projects()?;
    Ok(discovered
        .into_iter()
        .find(|project| normalize_existing_path(&project.path) == expected_canonical)
        .map(|project| project.session_dir))
}

pub fn session_dir_for_project(project_path: &Path) -> Result<PathBuf, String> {
    let projects_dir = paths::global_projects_dir()
        .ok_or_else(|| "Cannot determine projects directory".to_string())?;
    Ok(projects_dir.join(encode_claude_project_path(&project_path.to_string_lossy())))
}

pub fn project_path_from_session_dir(
    session_dir: &Path,
    encoded_dir_name: &str,
) -> Result<PathBuf, String> {
    if let Some(path) = extract_project_path_from_session_dir(session_dir)? {
        return Ok(path);
    }

    decode_claude_project_path(encoded_dir_name).map(PathBuf::from)
}

pub fn scan_discovered_projects() -> Result<Vec<DiscoveredProject>, String> {
    let Some(projects_dir) = paths::global_projects_dir() else {
        return Ok(Vec::new());
    };
    if !projects_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut discovered = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    for entry in fs::read_dir(&projects_dir)
        .map_err(|err| format!("Failed to read {}: {err}", projects_dir.display()))?
        .flatten()
    {
        let session_dir = entry.path();
        if !session_dir.is_dir() {
            continue;
        }

        let encoded_dir_name = entry.file_name().to_string_lossy().to_string();
        let Some(path) = extract_project_path_from_session_dir(&session_dir)?.or_else(|| {
            decode_claude_project_path(&encoded_dir_name)
                .ok()
                .map(PathBuf::from)
        }) else {
            continue;
        };

        let normalized = normalize_existing_path(&path).to_string_lossy().to_string();
        if seen_paths.insert(normalized) {
            discovered.push(DiscoveredProject { path, session_dir });
        }
    }

    Ok(discovered)
}

fn projects_registry_path() -> Result<PathBuf, String> {
    paths::projects_registry_path()
        .ok_or_else(|| "Cannot determine projects registry path".to_string())
}

fn lookup_registered_project(project_id: &str) -> Result<Option<PathBuf>, String> {
    let registry_path = projects_registry_path()?;
    if !registry_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&registry_path)
        .map_err(|err| format!("Failed to read {}: {err}", registry_path.display()))?;
    let parsed: ProjectsRegistry = serde_json::from_str(&content)
        .map_err(|err| format!("Failed to parse projects registry: {err}"))?;

    Ok(parsed
        .projects
        .into_iter()
        .find(|project| project.id == project_id)
        .map(|project| PathBuf::from(project.path)))
}

fn extract_project_path_from_session_dir(session_dir: &Path) -> Result<Option<PathBuf>, String> {
    let entries = match fs::read_dir(session_dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(None),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") {
            continue;
        }

        let file = fs::File::open(&path)
            .map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
        let reader = BufReader::new(file);
        for line in reader.lines().take(10) {
            let line = line.map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
            if line.trim().is_empty() {
                continue;
            }
            let Ok(value) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if let Some(cwd) = value.get("cwd").and_then(|value| value.as_str()) {
                if !cwd.trim().is_empty() {
                    return Ok(Some(PathBuf::from(cwd)));
                }
            }
        }
    }

    Ok(None)
}

fn normalize_existing_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::{
        decode_claude_project_path, decode_discovered_project_id, discovered_project_id,
        encode_claude_project_path, extract_project_path_from_session_dir,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-project-ids-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn discovered_project_ids_round_trip() {
        let original = "/Users/kai/demo-project";
        let project_id = discovered_project_id(original);
        let decoded = decode_discovered_project_id(&project_id).expect("decode should succeed");
        assert_eq!(decoded, original);
    }

    #[test]
    fn preserves_hyphens_in_encoded_session_dir_names() {
        assert_eq!(
            encode_claude_project_path("/Users/kai/demo-project"),
            "-Users-kai-demo-project"
        );
    }

    #[test]
    fn decode_is_lossy_for_hyphenated_directory_names() {
        let decoded =
            decode_claude_project_path("-Users-kai-demo-project").expect("decode should succeed");
        assert_eq!(decoded, "/Users/kai/demo/project");
        assert_ne!(decoded, "/Users/kai/demo-project");
    }

    #[test]
    fn extracts_project_path_from_session_cwd() {
        let root = temp_dir("session-dir");
        let session_dir = root.join("-Users-kai-demo-project");
        fs::create_dir_all(&session_dir).expect("session dir should exist");
        fs::write(
            session_dir.join("session.jsonl"),
            "{\"cwd\":\"/Users/kai/demo-project\"}\n",
        )
        .expect("fixture should be written");

        let path =
            extract_project_path_from_session_dir(&session_dir).expect("extract should succeed");
        assert_eq!(
            path.expect("cwd should be found"),
            PathBuf::from("/Users/kai/demo-project")
        );
    }
}
