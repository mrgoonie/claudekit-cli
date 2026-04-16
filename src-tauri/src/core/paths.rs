// core/paths.rs — Platform-aware path resolution for .claude/ directories
//
// Resolves global ($HOME/.claude/) and project-specific (.claude/) config paths.
// Uses the `dirs` crate for cross-platform home directory detection.

use std::path::PathBuf;

/// Get global Claude config directory ($HOME/.claude/)
pub fn global_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

pub fn home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

/// Get project-specific Claude config directory (<project>/.claude/)
pub fn project_claude_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".claude")
}

pub fn global_projects_dir() -> Option<PathBuf> {
    global_claude_dir().map(|dir| dir.join("projects"))
}

pub fn global_agents_dir() -> Option<PathBuf> {
    global_claude_dir().map(|dir| dir.join("agents"))
}

pub fn global_commands_dir() -> Option<PathBuf> {
    global_claude_dir().map(|dir| dir.join("commands"))
}

pub fn global_skills_dir() -> Option<PathBuf> {
    global_claude_dir().map(|dir| dir.join("skills"))
}

pub fn global_claude_json_path() -> Option<PathBuf> {
    home_dir().map(|dir| dir.join(".claude.json"))
}

pub fn global_mcp_json_path() -> Option<PathBuf> {
    global_claude_dir().map(|dir| dir.join(".mcp.json"))
}

pub fn projects_registry_path() -> Option<PathBuf> {
    home_dir().map(|dir| dir.join(".claudekit").join("projects.json"))
}

/// Get settings.json path within a given base directory
pub fn settings_path(base: &PathBuf) -> PathBuf {
    base.join("settings.json")
}

/// Get .ck.json (CK config) path within a given base directory
pub fn ck_config_path(base: &PathBuf) -> PathBuf {
    base.join(".ck.json")
}
