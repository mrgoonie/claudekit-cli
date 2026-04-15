use crate::core::{frontmatter::parse_frontmatter, paths};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentEntry {
    pub name: String,
    pub model: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelDistribution {
    pub opus: usize,
    pub sonnet: usize,
    pub haiku: usize,
    pub unset: usize,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub agents: usize,
    pub commands: usize,
    pub skills: usize,
    pub mcp_servers: usize,
    pub model_distribution: ModelDistribution,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSuggestion {
    pub r#type: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectsRegistry {
    projects: Vec<RegisteredProject>,
}

#[derive(Debug, Deserialize)]
struct RegisteredProject {
    path: String,
}

#[tauri::command]
pub async fn get_dashboard_stats() -> Result<DashboardStats, String> {
    tauri::async_runtime::spawn_blocking(get_dashboard_stats_blocking)
        .await
        .map_err(|err| format!("Failed to load dashboard stats: {err}"))?
}

pub async fn list_dashboard_agents(limit: Option<u32>) -> Result<Vec<AgentEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut agents = read_agents()?;
        agents.truncate(limit.unwrap_or(6) as usize);
        Ok(agents)
    })
    .await
    .map_err(|err| format!("Failed to load dashboard agents: {err}"))?
}

#[tauri::command]
pub async fn get_dashboard_agents() -> Result<Vec<AgentEntry>, String> {
    list_dashboard_agents(Some(6)).await
}

pub async fn list_dashboard_suggestions() -> Result<Vec<DashboardSuggestion>, String> {
    tauri::async_runtime::spawn_blocking(list_dashboard_suggestions_blocking)
        .await
        .map_err(|err| format!("Failed to load dashboard suggestions: {err}"))?
}

#[tauri::command]
pub async fn get_suggestions() -> Result<Vec<DashboardSuggestion>, String> {
    list_dashboard_suggestions().await
}

fn get_dashboard_stats_blocking() -> Result<DashboardStats, String> {
    let agents = read_agents()?;
    let mut model_distribution = ModelDistribution::default();
    for agent in &agents {
        match classify_model(&agent.model) {
            "opus" => model_distribution.opus += 1,
            "sonnet" => model_distribution.sonnet += 1,
            "haiku" => model_distribution.haiku += 1,
            _ => model_distribution.unset += 1,
        }
    }

    Ok(DashboardStats {
        agents: agents.len(),
        commands: count_markdown_files(paths::global_commands_dir().as_deref()),
        skills: count_installed_skills(paths::global_skills_dir().as_deref()),
        mcp_servers: count_mcp_servers()?,
        model_distribution,
    })
}

fn list_dashboard_suggestions_blocking() -> Result<Vec<DashboardSuggestion>, String> {
    let agents = read_agents()?;
    let mut suggestions = Vec::new();

    let unset_count = agents
        .iter()
        .filter(|agent| classify_model(&agent.model) == "unset")
        .count();
    if unset_count > 0 {
        suggestions.push(DashboardSuggestion {
            r#type: "warning".to_string(),
            message: format!(
                "{unset_count} agent{} have no model set",
                if unset_count > 1 { "s" } else { "" }
            ),
            target: Some("agents".to_string()),
        });
    }

    if count_installed_skills(paths::global_skills_dir().as_deref()) == 0 {
        suggestions.push(DashboardSuggestion {
            r#type: "info".to_string(),
            message: "No skills installed — browse the Skills Marketplace".to_string(),
            target: Some("skills".to_string()),
        });
    }

    let settings_exists = paths::global_claude_dir()
        .map(|dir| dir.join("settings.json").is_file())
        .unwrap_or(false);
    if !settings_exists {
        suggestions.push(DashboardSuggestion {
            r#type: "warning".to_string(),
            message: "No ~/.claude/settings.json found — run ck init to create one".to_string(),
            target: None,
        });
    }

    if agents.is_empty() {
        suggestions.push(DashboardSuggestion {
            r#type: "info".to_string(),
            message: "No agents configured in ~/.claude/agents/".to_string(),
            target: Some("agents".to_string()),
        });
    }

    if suggestions.is_empty() {
        suggestions.push(DashboardSuggestion {
            r#type: "success".to_string(),
            message: "Everything looks good!".to_string(),
            target: None,
        });
    }

    Ok(suggestions)
}

fn read_agents() -> Result<Vec<AgentEntry>, String> {
    let Some(agents_dir) = paths::global_agents_dir() else {
        return Ok(Vec::new());
    };
    let entries = match fs::read_dir(&agents_dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(Vec::new()),
    };

    let mut agents = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(parsed) = parse_frontmatter(&content) else {
            continue;
        };
        let file_stem = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        agents.push(AgentEntry {
            name: parsed
                .frontmatter
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or(file_stem)
                .to_string(),
            model: parsed
                .frontmatter
                .get("model")
                .and_then(Value::as_str)
                .unwrap_or("unset")
                .to_string(),
            description: parsed
                .frontmatter
                .get("description")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            color: parsed
                .frontmatter
                .get("color")
                .and_then(Value::as_str)
                .map(str::to_string),
        });
    }

    agents.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(agents)
}

fn count_markdown_files(dir: Option<&Path>) -> usize {
    let Some(dir) = dir else {
        return 0;
    };
    if !dir.is_dir() {
        return 0;
    }

    WalkDir::new(dir)
        .max_depth(10)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_file())
        .filter(|entry| entry.path().extension().and_then(|value| value.to_str()) == Some("md"))
        .count()
}

fn count_installed_skills(dir: Option<&Path>) -> usize {
    let Some(dir) = dir else {
        return 0;
    };
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return 0,
    };
    entries
        .flatten()
        .filter(|entry| entry.path().join("SKILL.md").is_file())
        .count()
}

fn count_mcp_servers() -> Result<usize, String> {
    let home_dir =
        paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let claude_dir = home_dir.join(".claude");
    let mut seen = HashSet::new();

    collect_mcp_names(
        read_json(claude_dir.join("settings.json"))?.as_ref(),
        &mut seen,
        true,
    );
    collect_mcp_names(
        read_json(home_dir.join(".claude.json"))?.as_ref(),
        &mut seen,
        true,
    );
    collect_mcp_names(
        read_json(claude_dir.join(".mcp.json"))?.as_ref(),
        &mut seen,
        false,
    );

    for project in registered_projects(&home_dir)? {
        let path = Path::new(&project.path);
        if project.path.contains("..") || !path.exists() || !path.starts_with(&home_dir) {
            continue;
        }
        collect_mcp_names(
            read_json(path.join(".mcp.json"))?.as_ref(),
            &mut seen,
            false,
        );
    }

    Ok(seen.len())
}

fn collect_mcp_names(value: Option<&Value>, seen: &mut HashSet<String>, nested: bool) {
    let Some(value) = value else {
        return;
    };
    let servers = if nested {
        value.get("mcpServers").and_then(Value::as_object)
    } else {
        value
            .get("mcpServers")
            .and_then(Value::as_object)
            .or_else(|| value.as_object())
    };

    if let Some(servers) = servers {
        for key in servers.keys() {
            seen.insert(key.clone());
        }
    }
}

fn read_json(path: impl AsRef<Path>) -> Result<Option<Value>, String> {
    let path = path.as_ref();
    if !path.is_file() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)
        .map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
    let parsed = serde_json::from_str(&content)
        .map_err(|err| format!("Failed to parse {}: {err}", path.display()))?;
    Ok(Some(parsed))
}

fn registered_projects(home_dir: &Path) -> Result<Vec<RegisteredProject>, String> {
    let Some(value) = read_json(home_dir.join(".claudekit").join("projects.json"))? else {
        return Ok(Vec::new());
    };
    let parsed = serde_json::from_value::<ProjectsRegistry>(value)
        .map_err(|err| format!("Failed to parse projects registry: {err}"))?;
    Ok(parsed.projects)
}

fn classify_model(model: &str) -> &'static str {
    let lower = model.to_lowercase();
    if lower.is_empty() || lower == "unset" {
        "unset"
    } else if lower.contains("opus") {
        "opus"
    } else if lower.contains("haiku") {
        "haiku"
    } else if lower.contains("sonnet") {
        "sonnet"
    } else {
        "unset"
    }
}

#[cfg(test)]
mod tests {
    use super::{classify_model, count_installed_skills};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-dashboard-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn classifies_known_model_tiers() {
        assert_eq!(classify_model("claude-3-opus"), "opus");
        assert_eq!(classify_model("Claude 3.5 Sonnet"), "sonnet");
        assert_eq!(classify_model("haiku"), "haiku");
        assert_eq!(classify_model(""), "unset");
    }

    #[test]
    fn counts_skill_directories_with_skill_md_only() {
        let root = temp_dir("skills");
        fs::create_dir_all(root.join("one")).expect("dir should exist");
        fs::create_dir_all(root.join("two")).expect("dir should exist");
        fs::write(root.join("one").join("SKILL.md"), "# skill").expect("skill should exist");
        fs::write(root.join("two").join("README.md"), "# nope").expect("file should exist");

        assert_eq!(count_installed_skills(Some(&root)), 1);
    }
}
