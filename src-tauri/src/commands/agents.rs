use crate::core::{frontmatter::parse_frontmatter, paths};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentListItem {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub model: Option<String>,
    pub color: Option<String>,
    pub skill_count: usize,
    pub dir_label: String,
    pub relative_path: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetail {
    #[serde(flatten)]
    pub summary: AgentListItem,
    pub frontmatter: Map<String, Value>,
    pub body: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentsBrowseResponse {
    pub agents: Vec<AgentListItem>,
    pub total: usize,
}

pub async fn browse_agents() -> Result<AgentsBrowseResponse, String> {
    tauri::async_runtime::spawn_blocking(browse_agents_blocking)
        .await
        .map_err(|err| format!("Failed to browse agents: {err}"))?
}

#[tauri::command]
pub async fn scan_agents() -> Result<Vec<AgentListItem>, String> {
    browse_agents().await.map(|response| response.agents)
}

#[tauri::command]
pub async fn get_agent_detail(slug: String) -> Result<AgentDetail, String> {
    tauri::async_runtime::spawn_blocking(move || get_agent_detail_blocking(&slug))
        .await
        .map_err(|err| format!("Failed to read agent detail: {err}"))?
}

fn browse_agents_blocking() -> Result<AgentsBrowseResponse, String> {
    let home_dir =
        paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let cwd = std::env::current_dir().map_err(|err| format!("Failed to read cwd: {err}"))?;
    let mut agents = Vec::new();

    for (dir_path, dir_label) in resolve_agent_dirs(&cwd, &home_dir) {
        agents.extend(scan_agent_dir(&dir_path, &dir_label, &home_dir)?);
    }

    agents.sort_by(|left, right| left.name.cmp(&right.name).then(left.slug.cmp(&right.slug)));

    Ok(AgentsBrowseResponse {
        total: agents.len(),
        agents,
    })
}

fn get_agent_detail_blocking(slug: &str) -> Result<AgentDetail, String> {
    if !is_valid_slug(slug) {
        return Err("Invalid agent slug".to_string());
    }

    let home_dir =
        paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let cwd = std::env::current_dir().map_err(|err| format!("Failed to read cwd: {err}"))?;

    for (dir_path, dir_label) in resolve_agent_dirs(&cwd, &home_dir) {
        let file_path = dir_path.join(format!("{slug}.md"));
        if !file_path.is_file() {
            continue;
        }

        let content = fs::read_to_string(&file_path)
            .map_err(|err| format!("Failed to read {}: {err}", file_path.display()))?;
        let parsed = parse_frontmatter(&content)?;
        return Ok(AgentDetail {
            summary: build_agent_summary(
                slug.to_string(),
                dir_label,
                &file_path,
                &home_dir,
                &parsed.frontmatter,
                parsed.body.clone(),
            ),
            frontmatter: parsed.frontmatter,
            body: parsed.body,
        });
    }

    Err("Agent not found".to_string())
}

fn resolve_agent_dirs(cwd: &Path, home_dir: &Path) -> Vec<(PathBuf, String)> {
    let mut seen = HashSet::new();
    let mut dirs = Vec::new();

    let candidates = [
        (
            cwd.join(".claude").join("agents"),
            ".claude/agents".to_string(),
        ),
        (
            home_dir.join(".claude").join("agents"),
            "~/.claude/agents".to_string(),
        ),
    ];

    for (path, label) in candidates {
        let key = path.to_string_lossy().to_string();
        if seen.insert(key) {
            dirs.push((path, label));
        }
    }

    dirs
}

fn scan_agent_dir(
    dir_path: &Path,
    dir_label: &str,
    home_dir: &Path,
) -> Result<Vec<AgentListItem>, String> {
    let mut items = Vec::new();
    let entries = match fs::read_dir(dir_path) {
        Ok(entries) => entries,
        Err(_) => return Ok(items),
    };

    for entry in entries.flatten() {
        let file_path = entry.path();
        if !file_path.is_file()
            || file_path.extension().and_then(|value| value.to_str()) != Some("md")
        {
            continue;
        }

        let Ok(content) = fs::read_to_string(&file_path) else {
            continue;
        };
        let Ok(parsed) = parse_frontmatter(&content) else {
            continue;
        };
        let Some(slug) = file_path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };

        items.push(build_agent_summary(
            slug.to_string(),
            dir_label.to_string(),
            &file_path,
            home_dir,
            &parsed.frontmatter,
            parsed.body,
        ));
    }

    items.sort_by(|left, right| left.name.cmp(&right.name).then(left.slug.cmp(&right.slug)));
    Ok(items)
}

fn build_agent_summary(
    slug: String,
    dir_label: String,
    file_path: &Path,
    home_dir: &Path,
    frontmatter: &Map<String, Value>,
    body: String,
) -> AgentListItem {
    AgentListItem {
        name: frontmatter
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(&slug)
            .to_string(),
        description: frontmatter
            .get("description")
            .and_then(Value::as_str)
            .map(str::to_string)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| first_descriptive_line(&body).unwrap_or_default()),
        model: frontmatter
            .get("model")
            .and_then(Value::as_str)
            .map(str::to_string),
        color: frontmatter
            .get("color")
            .and_then(Value::as_str)
            .map(str::to_string),
        skill_count: count_skills(frontmatter.get("tools")),
        dir_label,
        relative_path: relative_to_home(file_path, home_dir),
        slug,
    }
}

fn count_skills(value: Option<&Value>) -> usize {
    value
        .and_then(Value::as_str)
        .map(|tools| {
            tools
                .split(',')
                .map(str::trim)
                .filter(|tool| !tool.is_empty())
                .count()
        })
        .unwrap_or(0)
}

fn first_descriptive_line(body: &str) -> Option<String> {
    body.lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .map(str::to_string)
}

fn relative_to_home(file_path: &Path, home_dir: &Path) -> String {
    file_path
        .strip_prefix(home_dir)
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_path.to_string_lossy().replace('\\', "/"))
}

fn is_valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

#[cfg(test)]
mod tests {
    use super::{count_skills, scan_agent_dir};
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-agents-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn counts_comma_separated_tools() {
        assert_eq!(count_skills(Some(&json!("alpha, beta, gamma"))), 3);
        assert_eq!(count_skills(Some(&json!("alpha,, beta"))), 2);
        assert_eq!(count_skills(Some(&json!(["alpha"]))), 0);
    }

    #[test]
    fn scans_agents_and_skips_invalid_files() {
        let home_dir = temp_dir("home");
        let agent_dir = home_dir.join(".claude").join("agents");
        fs::create_dir_all(&agent_dir).expect("agent dir should exist");

        fs::write(
            agent_dir.join("reviewer.md"),
            "---\nname: Reviewer\ndescription: Reviews code\nmodel: opus\ntools: one, two\n---\n# Body\n",
        )
        .expect("agent should be written");
        fs::write(agent_dir.join("broken.md"), "---\nname: bad\n")
            .expect("invalid agent should exist");

        let items =
            scan_agent_dir(&agent_dir, "~/.claude/agents", &home_dir).expect("scan should succeed");

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].slug, "reviewer");
        assert_eq!(items[0].skill_count, 2);
        assert_eq!(items[0].relative_path, ".claude/agents/reviewer.md");
    }
}
