use crate::core::{frontmatter::parse_frontmatter, paths};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SkillSource {
    Local,
    Github,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillBrowserItem {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub triggers: Option<Vec<String>>,
    pub source: SkillSource,
    pub installed: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillBrowserDetail {
    #[serde(flatten)]
    pub summary: SkillBrowserItem,
    pub content: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkillSearchResult {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub score: f64,
    pub path: String,
}

#[tauri::command]
pub async fn browse_skills() -> Result<Vec<SkillBrowserItem>, String> {
    tauri::async_runtime::spawn_blocking(list_skills_blocking)
        .await
        .map_err(|err| format!("Failed to browse skills: {err}"))?
}

#[tauri::command]
pub async fn scan_skills() -> Result<Vec<SkillBrowserItem>, String> {
    browse_skills().await
}

#[tauri::command]
pub async fn get_skill_detail(name: String) -> Result<SkillBrowserDetail, String> {
    tauri::async_runtime::spawn_blocking(move || get_skill_detail_blocking(&name))
        .await
        .map_err(|err| format!("Failed to read skill detail: {err}"))?
}

#[tauri::command]
pub async fn search_skills(
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SkillSearchResult>, String> {
    tauri::async_runtime::spawn_blocking(move || search_skills_blocking(&query, limit))
        .await
        .map_err(|err| format!("Failed to search skills: {err}"))?
}

fn list_skills_blocking() -> Result<Vec<SkillBrowserItem>, String> {
    let skills_dir = skills_dir()?;
    let entries = match fs::read_dir(&skills_dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(Vec::new()),
    };

    let mut items = Vec::new();
    for entry in entries.flatten() {
        let skill_dir = entry.path();
        let skill_md = skill_dir.join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }
        let Some(name) = skill_dir.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        items.push(read_skill_summary(name, &skill_dir, &skill_md)?);
    }

    items.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(items)
}

pub(crate) fn load_skills() -> Result<Vec<SkillBrowserItem>, String> {
    list_skills_blocking()
}

fn get_skill_detail_blocking(name: &str) -> Result<SkillBrowserDetail, String> {
    if !is_valid_skill_name(name) {
        return Err("Invalid skill name".to_string());
    }

    let skills_dir = skills_dir()?;
    let skill_dir = skills_dir.join(name);
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("Skill \"{name}\" not found"));
    }

    let content = fs::read_to_string(&skill_md)
        .map_err(|err| format!("Failed to read {}: {err}", skill_md.display()))?;
    Ok(SkillBrowserDetail {
        summary: build_skill_item(name, &skill_dir, &content),
        content,
    })
}

fn search_skills_blocking(
    query: &str,
    limit: Option<u32>,
) -> Result<Vec<SkillSearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("Missing query parameter: q".to_string());
    }

    let capped_limit = limit.unwrap_or(10).clamp(1, 100) as usize;
    let terms = trimmed
        .to_lowercase()
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();

    let skills_dir = skills_dir()?;
    let mut results = Vec::new();
    for item in list_skills_blocking()? {
        let skill_path = skills_dir.join(&item.name).join("SKILL.md");
        let content = fs::read_to_string(&skill_path).unwrap_or_default();
        let parsed = parse_frontmatter(&content)?;
        let tokens = format!(
            "{} {} {}",
            item.name,
            item.description.clone().unwrap_or_default(),
            item.triggers.clone().unwrap_or_default().join(" ")
        )
        .to_lowercase();

        let mut score = 0.0;
        for term in &terms {
            if item.name.to_lowercase().contains(term) {
                score += 3.0;
            } else if tokens.contains(term) {
                score += 1.0;
            }
        }

        if score > 0.0 {
            results.push(SkillSearchResult {
                name: item.name.clone(),
                display_name: parsed
                    .frontmatter
                    .get("displayName")
                    .or_else(|| parsed.frontmatter.get("display_name"))
                    .and_then(Value::as_str)
                    .map(str::to_string),
                description: item.description.clone(),
                category: parsed
                    .frontmatter
                    .get("category")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                score,
                path: format!("{}/SKILL.md", item.name),
            });
        }
    }

    results.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(left.name.cmp(&right.name))
    });
    results.truncate(capped_limit);
    Ok(results)
}

fn skills_dir() -> Result<PathBuf, String> {
    paths::global_skills_dir().ok_or_else(|| "Cannot determine skills directory".to_string())
}

fn read_skill_summary(
    name: &str,
    skill_dir: &Path,
    skill_md: &Path,
) -> Result<SkillBrowserItem, String> {
    let content = fs::read_to_string(skill_md)
        .map_err(|err| format!("Failed to read {}: {err}", skill_md.display()))?;
    Ok(build_skill_item(name, skill_dir, &content))
}

fn build_skill_item(name: &str, skill_dir: &Path, content: &str) -> SkillBrowserItem {
    let parsed = parse_frontmatter(content).ok();
    let description = parsed
        .as_ref()
        .and_then(|value| value.frontmatter.get("description"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            parsed
                .as_ref()
                .and_then(|value| first_descriptive_line(&value.body))
        });

    SkillBrowserItem {
        name: name.to_string(),
        description,
        triggers: parsed
            .as_ref()
            .and_then(|value| extract_string_list(value.frontmatter.get("triggers"))),
        source: detect_source(skill_dir),
        installed: true,
    }
}

fn detect_source(skill_dir: &Path) -> SkillSource {
    let imports = skill_dir.join(".imports.json");
    if let Ok(content) = fs::read_to_string(imports) {
        if content.contains("github") {
            return SkillSource::Github;
        }
    }

    let git_config = skill_dir.join(".git").join("config");
    if let Ok(content) = fs::read_to_string(git_config) {
        if content.contains("github.com") {
            return SkillSource::Github;
        }
    }

    SkillSource::Local
}

fn extract_string_list(value: Option<&Value>) -> Option<Vec<String>> {
    let list = match value? {
        Value::Array(items) => items
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect::<Vec<_>>(),
        Value::String(raw) => raw
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>(),
        _ => Vec::new(),
    };

    if list.is_empty() {
        None
    } else {
        Some(list)
    }
}

fn first_descriptive_line(body: &str) -> Option<String> {
    body.lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .map(str::to_string)
}

fn is_valid_skill_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains("..")
        && !name.contains('/')
        && !name.contains('\\')
        && name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

#[cfg(test)]
mod tests {
    use super::{build_skill_item, extract_string_list, search_skills_blocking, SkillSource};
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-skills-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn extracts_trigger_lists_from_arrays_and_strings() {
        assert_eq!(
            extract_string_list(Some(&json!(["one", "two"]))),
            Some(vec!["one".to_string(), "two".to_string()])
        );
        assert_eq!(
            extract_string_list(Some(&json!("one, two"))),
            Some(vec!["one".to_string(), "two".to_string()])
        );
    }

    #[test]
    fn builds_skill_item_with_description_fallback_and_github_source() {
        let skill_dir = temp_dir("item");
        fs::write(skill_dir.join(".imports.json"), "{\"source\":\"github\"}")
            .expect("imports should exist");
        let item = build_skill_item(
            "demo",
            &skill_dir,
            "---\ntriggers:\n  - search\n---\nFirst descriptive line\n# Heading\n",
        );

        assert_eq!(item.description.as_deref(), Some("First descriptive line"));
        assert_eq!(item.triggers.expect("triggers")[0], "search");
        assert_eq!(item.source, SkillSource::Github);
    }

    #[test]
    fn searches_skills_by_name_and_trigger_text() {
        let home_dir = temp_dir("home");
        let skills_dir = home_dir.join(".claude").join("skills");
        let alpha_dir = skills_dir.join("alpha");
        let beta_dir = skills_dir.join("beta");
        fs::create_dir_all(&alpha_dir).expect("alpha dir should exist");
        fs::create_dir_all(&beta_dir).expect("beta dir should exist");
        fs::write(
            alpha_dir.join("SKILL.md"),
            "---\ndescription: search docs\ntriggers:\n  - docs\n---\n",
        )
        .expect("alpha skill should exist");
        fs::write(
            beta_dir.join("SKILL.md"),
            "---\ndescription: terminal helper\n---\n",
        )
        .expect("beta skill should exist");

        let original_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &home_dir);
        let results = search_skills_blocking("docs", Some(5)).expect("search should succeed");
        if let Some(home) = original_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "alpha");
    }
}
