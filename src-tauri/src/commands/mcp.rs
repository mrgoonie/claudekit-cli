use crate::core::paths;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerEntry {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_keys: Option<Vec<String>>,
    pub source: String,
    pub source_label: String,
}

#[derive(Debug, Deserialize)]
struct ProjectsRegistry {
    projects: Vec<RegisteredProject>,
}

#[derive(Debug, Deserialize)]
struct RegisteredProject {
    path: String,
    alias: Option<String>,
}

#[tauri::command]
pub async fn list_mcp_servers() -> Result<Vec<McpServerEntry>, String> {
    tauri::async_runtime::spawn_blocking(list_mcp_servers_blocking)
        .await
        .map_err(|err| format!("Failed to list MCP servers: {err}"))?
}

#[tauri::command]
pub async fn discover_mcp_servers(
    project_path: Option<String>,
) -> Result<Vec<McpServerEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        discover_mcp_servers_blocking(project_path.as_deref())
    })
    .await
    .map_err(|err| format!("Failed to discover MCP servers: {err}"))?
}

fn list_mcp_servers_blocking() -> Result<Vec<McpServerEntry>, String> {
    let home_dir =
        paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let claude_dir = home_dir.join(".claude");
    let mut lists = Vec::new();

    if let Some(settings) = read_json(claude_dir.join("settings.json"))? {
        if let Some(servers) = settings.get("mcpServers").and_then(Value::as_object) {
            lists.push(parse_mcp_servers(
                servers,
                "settings.json".to_string(),
                "settings.json".to_string(),
            ));
        }
    }

    if let Some(claude_json) = read_json(home_dir.join(".claude.json"))? {
        if let Some(servers) = claude_json.get("mcpServers").and_then(Value::as_object) {
            lists.push(parse_mcp_servers(
                servers,
                "claude.json".to_string(),
                "~/.claude.json".to_string(),
            ));
        }
    }

    lists.push(read_mcp_json(
        claude_dir.join(".mcp.json"),
        ".mcp.json".to_string(),
        ".mcp.json".to_string(),
    )?);

    for project in registered_projects()? {
        if !is_safe_project_path(&project.path) {
            continue;
        }
        let source_label = format!(
            "Project: {}",
            project.alias.unwrap_or_else(|| {
                Path::new(&project.path)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or(&project.path)
                    .to_string()
            })
        );
        lists.push(read_mcp_json(
            Path::new(&project.path).join(".mcp.json"),
            format!("project:{}", project.path),
            source_label,
        )?);
    }

    Ok(merge_servers(lists))
}

pub(crate) fn discover_mcp_servers_blocking(
    project_path: Option<&str>,
) -> Result<Vec<McpServerEntry>, String> {
    if let Some(project_path) = project_path {
        let project_root = Path::new(project_path);
        if project_root.is_absolute() && project_root.exists() {
            let home_dir =
                paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
            let claude_dir = home_dir.join(".claude");
            let mut lists = Vec::new();

            if let Some(settings) = read_json(claude_dir.join("settings.json"))? {
                if let Some(servers) = settings.get("mcpServers").and_then(Value::as_object) {
                    lists.push(parse_mcp_servers(
                        servers,
                        "settings.json".to_string(),
                        "settings.json".to_string(),
                    ));
                }
            }

            if let Some(claude_json) = read_json(home_dir.join(".claude.json"))? {
                if let Some(servers) = claude_json.get("mcpServers").and_then(Value::as_object) {
                    lists.push(parse_mcp_servers(
                        servers,
                        "claude.json".to_string(),
                        "~/.claude.json".to_string(),
                    ));
                }
            }

            lists.push(read_mcp_json(
                claude_dir.join(".mcp.json"),
                ".mcp.json".to_string(),
                ".mcp.json".to_string(),
            )?);
            lists.push(read_mcp_json(
                project_root.join(".mcp.json"),
                format!("project:{project_path}"),
                format!(
                    "Project: {}",
                    project_root
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or(project_path)
                ),
            )?);
            lists.push(read_mcp_json(
                project_root.join(".claude.json"),
                format!("project-claude:{project_path}"),
                format!(
                    "Project Claude: {}",
                    project_root
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or(project_path)
                ),
            )?);
            return Ok(merge_servers(lists));
        }
    }

    list_mcp_servers_blocking()
}

fn parse_mcp_servers(
    raw: &Map<String, Value>,
    source: String,
    source_label: String,
) -> Vec<McpServerEntry> {
    let mut entries = Vec::new();
    for (name, value) in raw {
        let Some(config) = value.as_object() else {
            continue;
        };
        let Some(command) = config.get("command").and_then(Value::as_str) else {
            continue;
        };
        if command.is_empty() {
            continue;
        }

        let args = config
            .get("args")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let env_keys = config.get("env").and_then(Value::as_object).map(|env| {
            let mut keys = env.keys().cloned().collect::<Vec<_>>();
            keys.sort();
            keys
        });

        entries.push(McpServerEntry {
            name: name.clone(),
            command: command.to_string(),
            args,
            env_keys: env_keys.filter(|keys| !keys.is_empty()),
            source: source.clone(),
            source_label: source_label.clone(),
        });
    }

    entries
}

fn read_mcp_json(
    file_path: PathBuf,
    source: String,
    source_label: String,
) -> Result<Vec<McpServerEntry>, String> {
    let Some(value) = read_json(file_path)? else {
        return Ok(Vec::new());
    };

    let servers = value
        .get("mcpServers")
        .and_then(Value::as_object)
        .or_else(|| value.as_object())
        .cloned()
        .unwrap_or_default();

    Ok(parse_mcp_servers(&servers, source, source_label))
}

fn read_json(file_path: PathBuf) -> Result<Option<Value>, String> {
    if !file_path.is_file() {
        return Ok(None);
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|err| format!("Failed to read {}: {err}", file_path.display()))?;
    let parsed = serde_json::from_str::<Value>(&content)
        .map_err(|err| format!("Failed to parse {}: {err}", file_path.display()))?;
    Ok(Some(parsed))
}

fn registered_projects() -> Result<Vec<RegisteredProject>, String> {
    let registry_path = paths::projects_registry_path()
        .ok_or_else(|| "Cannot determine projects registry path".to_string())?;
    let Some(registry) = read_json(registry_path)? else {
        return Ok(Vec::new());
    };
    let parsed = serde_json::from_value::<ProjectsRegistry>(registry)
        .map_err(|err| format!("Failed to parse projects registry: {err}"))?;
    Ok(parsed.projects)
}

fn is_safe_project_path(project_path: &str) -> bool {
    if project_path.contains("..") {
        return false;
    }

    let Ok(canonical) = Path::new(project_path).canonicalize() else {
        return false;
    };
    canonical.is_dir()
        && !canonical.starts_with("/etc")
        && !canonical.starts_with("/proc")
        && !canonical.starts_with("/sys")
        && !canonical.starts_with("/dev")
}

fn merge_servers(lists: Vec<Vec<McpServerEntry>>) -> Vec<McpServerEntry> {
    let mut merged = Vec::new();
    let mut seen = HashSet::new();

    for list in lists {
        for server in list {
            if seen.insert(server.name.clone()) {
                merged.push(server);
            }
        }
    }

    merged
}

#[cfg(test)]
mod tests {
    use super::{merge_servers, parse_mcp_servers, read_mcp_json, McpServerEntry};
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-mcp-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn parses_command_args_and_redacted_env_keys() {
        let parsed = parse_mcp_servers(
            json!({
                "demo": {
                    "command": "node",
                    "args": ["server.js"],
                    "env": { "API_KEY": "secret", "TOKEN": "secret" }
                }
            })
            .as_object()
            .expect("object"),
            "settings.json".to_string(),
            "settings.json".to_string(),
        );

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].args, vec!["server.js".to_string()]);
        assert_eq!(
            parsed[0].env_keys.as_ref().expect("env keys"),
            &vec!["API_KEY".to_string(), "TOKEN".to_string()]
        );
    }

    #[test]
    fn standalone_mcp_json_supports_flat_and_nested_shapes() {
        let dir = temp_dir("json");
        let path = dir.join(".mcp.json");
        fs::write(&path, "{\"mcpServers\":{\"demo\":{\"command\":\"node\"}}}")
            .expect("file should exist");
        let nested =
            read_mcp_json(path.clone(), "a".to_string(), "A".to_string()).expect("nested parse");
        fs::write(&path, "{\"flat\":{\"command\":\"bun\"}}").expect("file should exist");
        let flat = read_mcp_json(path, "b".to_string(), "B".to_string()).expect("flat parse");

        assert_eq!(nested[0].name, "demo");
        assert_eq!(flat[0].command, "bun");
    }

    #[test]
    fn merge_keeps_first_server_for_duplicate_names() {
        let merged = merge_servers(vec![
            vec![McpServerEntry {
                name: "demo".to_string(),
                command: "node".to_string(),
                args: Vec::new(),
                env_keys: None,
                source: "settings.json".to_string(),
                source_label: "settings.json".to_string(),
            }],
            vec![McpServerEntry {
                name: "demo".to_string(),
                command: "bun".to_string(),
                args: Vec::new(),
                env_keys: None,
                source: ".mcp.json".to_string(),
                source_label: ".mcp.json".to_string(),
            }],
        ]);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].command, "node");
    }
}
