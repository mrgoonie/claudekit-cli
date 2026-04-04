// core/paths.rs — Platform-aware path resolution for .claude/ directories
//
// Resolves global ($HOME/.claude/) and project-specific (.claude/) config paths.
// Uses the `dirs` crate for cross-platform home directory detection.

use std::path::PathBuf;

/// Get global Claude config directory ($HOME/.claude/)
pub fn global_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// Get project-specific Claude config directory (<project>/.claude/)
pub fn project_claude_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".claude")
}

/// Get settings.json path within a given base directory
pub fn settings_path(base: &PathBuf) -> PathBuf {
    base.join("settings.json")
}

/// Get .ck.json (CK config) path within a given base directory
pub fn ck_config_path(base: &PathBuf) -> PathBuf {
    base.join(".ck.json")
}
