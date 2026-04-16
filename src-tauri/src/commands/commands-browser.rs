use crate::core::{frontmatter::parse_frontmatter, paths};
use serde::Serialize;
use std::cmp::Ordering;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandNode {
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<CommandNode>>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandDetail {
    pub name: String,
    pub path: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[tauri::command]
pub async fn list_commands() -> Result<Vec<CommandNode>, String> {
    tauri::async_runtime::spawn_blocking(list_commands_blocking)
        .await
        .map_err(|err| format!("Failed to list commands: {err}"))?
}

#[tauri::command]
pub async fn scan_commands() -> Result<Vec<CommandNode>, String> {
    list_commands().await
}

#[tauri::command]
pub async fn get_command_detail(slug: String) -> Result<CommandDetail, String> {
    tauri::async_runtime::spawn_blocking(move || get_command_detail_blocking(&slug))
        .await
        .map_err(|err| format!("Failed to read command detail: {err}"))?
}

fn list_commands_blocking() -> Result<Vec<CommandNode>, String> {
    let commands_dir = paths::global_commands_dir()
        .ok_or_else(|| "Cannot determine commands directory".to_string())?;
    if !commands_dir.is_dir() {
        return Ok(Vec::new());
    }

    build_command_tree(&commands_dir, &commands_dir)
}

pub(crate) fn scan_commands_blocking() -> Result<Vec<CommandNode>, String> {
    list_commands_blocking()
}

fn get_command_detail_blocking(slug: &str) -> Result<CommandDetail, String> {
    let commands_dir = paths::global_commands_dir()
        .ok_or_else(|| "Cannot determine commands directory".to_string())?;
    let relative = slug_to_relative_path(slug)?;
    let mut file_path = commands_dir.join(&relative);
    if file_path.extension().and_then(|value| value.to_str()) != Some("md") {
        file_path.set_extension("md");
    }
    if !file_path.is_file() {
        return Err("Command not found".to_string());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|err| format!("Failed to read {}: {err}", file_path.display()))?;
    let parsed = parse_frontmatter(&content)?;
    let path = relative
        .with_extension("")
        .to_string_lossy()
        .replace('\\', "/");
    let name = file_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();

    Ok(CommandDetail {
        name,
        path,
        content,
        description: parsed
            .frontmatter
            .get("description")
            .and_then(|value| value.as_str())
            .map(str::to_string),
    })
}

fn build_command_tree(dir: &Path, base_dir: &Path) -> Result<Vec<CommandNode>, String> {
    let mut entries = fs::read_dir(dir)
        .map_err(|err| format!("Failed to read {}: {err}", dir.display()))?
        .flatten()
        .collect::<Vec<_>>();

    entries.sort_by(
        |left, right| match (left.path().is_dir(), right.path().is_dir()) {
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            _ => left.file_name().cmp(&right.file_name()),
        },
    );

    let mut nodes = Vec::new();
    for entry in entries {
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        let full_path = entry.path();
        let rel_path = full_path
            .strip_prefix(base_dir)
            .map(|path| path.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| file_name.to_string());

        if full_path.is_dir() {
            let children = build_command_tree(&full_path, base_dir)?;
            if !children.is_empty() {
                nodes.push(CommandNode {
                    name: file_name.to_string(),
                    path: rel_path,
                    description: None,
                    children: Some(children),
                });
            }
            continue;
        }

        if full_path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let description = fs::read_to_string(&full_path)
            .ok()
            .and_then(|content| parse_frontmatter(&content).ok())
            .and_then(|parsed| {
                parsed
                    .frontmatter
                    .get("description")
                    .and_then(|value| value.as_str())
                    .map(str::to_string)
            });

        nodes.push(CommandNode {
            name: full_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string(),
            path: rel_path,
            description,
            children: None,
        });
    }

    Ok(nodes)
}

pub(crate) fn count_command_nodes(nodes: &[CommandNode]) -> usize {
    nodes
        .iter()
        .map(|node| match &node.children {
            Some(children) => count_command_nodes(children),
            None => 1,
        })
        .sum()
}

fn slug_to_relative_path(slug: &str) -> Result<PathBuf, String> {
    if slug.is_empty() {
        return Err("Missing command path".to_string());
    }
    if slug.contains('\0') {
        return Err("Invalid path".to_string());
    }

    let decoded = slug.replace("--", "/");
    let path = Path::new(&decoded);
    let mut safe = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Normal(value) => safe.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Invalid path".to_string())
            }
        }
    }

    if safe.as_os_str().is_empty() {
        return Err("Invalid path".to_string());
    }

    Ok(safe)
}

#[cfg(test)]
mod tests {
    use super::{build_command_tree, slug_to_relative_path};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-commands-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn rejects_traversal_in_command_slug() {
        assert!(slug_to_relative_path("../evil").is_err());
        assert!(slug_to_relative_path("group--..--evil").is_err());
        assert_eq!(
            slug_to_relative_path("ck--plan")
                .expect("path should be valid")
                .to_string_lossy(),
            "ck/plan"
        );
    }

    #[test]
    fn builds_directory_first_command_tree() {
        let root = temp_dir("tree");
        fs::create_dir_all(root.join("ck")).expect("subdir should exist");
        fs::write(root.join("zeta.md"), "---\ndescription: zeta\n---\n")
            .expect("file should exist");
        fs::write(
            root.join("ck").join("plan.md"),
            "---\ndescription: plan\n---\n",
        )
        .expect("file should exist");

        let tree = build_command_tree(&root, &root).expect("tree should build");

        assert_eq!(tree.len(), 2);
        assert_eq!(tree[0].name, "ck");
        assert_eq!(tree[1].name, "zeta");
        assert_eq!(
            tree[0].children.as_ref().expect("children")[0].path,
            "ck/plan.md"
        );
    }
}
