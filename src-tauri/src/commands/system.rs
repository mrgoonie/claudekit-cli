use crate::core::{paths, project_ids};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;
use std::time::{Instant, SystemTime};

static APP_START: OnceLock<Instant> = OnceLock::new();
const DEFAULT_HOOK_LIMIT: usize = 50;
const MAX_HOOK_LIMIT: usize = 200;
const MAX_INSPECTED_LINES: usize = 2_000;
const MAX_READ_BYTES: usize = 512 * 1024;
const MAX_HOOK_PROJECT_ID_LENGTH: usize = 512;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub config_path: String,
    pub node_version: String,
    pub bun_version: Option<String>,
    pub os: String,
    pub cli_version: String,
    pub package_manager: String,
    pub install_location: String,
    pub git_version: String,
    pub gh_version: String,
    pub shell: String,
    pub home_dir: String,
    pub cpu_cores: usize,
    pub total_memory_gb: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub status: String,
    pub timestamp: String,
    pub uptime: u64,
    pub settings_exists: bool,
    pub claude_json_exists: bool,
    pub projects_registry_exists: bool,
}

#[tauri::command]
pub fn get_global_metadata() -> Result<Value, String> {
    let global_dir = paths::global_claude_dir()
        .ok_or_else(|| "Cannot determine global Claude directory".to_string())?;
    let metadata_path = global_dir.join("metadata.json");

    if !metadata_path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let raw = std::fs::read_to_string(&metadata_path)
        .map_err(|err| format!("Failed to read {}: {err}", metadata_path.display()))?;
    serde_json::from_str::<Value>(&raw)
        .map_err(|err| format!("Failed to parse {}: {err}", metadata_path.display()))
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HookDiagnosticEntry {
    pub ts: String,
    pub hook: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dur: Option<f64>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HookDiagnosticsSummary {
    pub total: usize,
    pub parse_errors: usize,
    pub last_event_at: Option<String>,
    pub inspected_lines: usize,
    pub truncated: bool,
    pub status_counts: HashMap<String, usize>,
    pub hook_counts: HashMap<String, usize>,
    pub tool_counts: HashMap<String, usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HookDiagnosticsResponse {
    pub scope: String,
    pub project_id: Option<String>,
    pub path: String,
    pub exists: bool,
    pub entries: Vec<HookDiagnosticEntry>,
    pub summary: HookDiagnosticsSummary,
}

pub fn mark_app_started() {
    let _ = APP_START.get_or_init(Instant::now);
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let home_dir =
        paths::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let config_path = paths::global_claude_dir()
        .ok_or_else(|| "Cannot determine global Claude directory".to_string())?;

    Ok(SystemInfo {
        config_path: config_path.to_string_lossy().to_string(),
        node_version: run_command(version_command("node"), "unknown"),
        bun_version: match run_command(version_command("bun"), "").trim() {
            "" => None,
            value => Some(value.to_string()),
        },
        os: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        cli_version: cli_version(),
        package_manager: detect_package_manager(None),
        install_location: run_command(which_command("ck"), "not found"),
        git_version: run_command(version_command("git"), "unknown"),
        gh_version: run_command(version_command("gh"), "unknown")
            .lines()
            .next()
            .unwrap_or("unknown")
            .to_string(),
        shell: std::env::var("SHELL")
            .or_else(|_| std::env::var("ComSpec"))
            .unwrap_or_else(|_| "unknown".to_string()),
        home_dir: home_dir.to_string_lossy().to_string(),
        cpu_cores: std::thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(1),
        total_memory_gb: format!("{:.1}", system_memory_gb()),
    })
}

#[tauri::command]
pub fn get_health() -> Result<HealthStatus, String> {
    let now = SystemTime::now();
    let started = APP_START.get_or_init(Instant::now);
    let global_dir = paths::global_claude_dir()
        .ok_or_else(|| "Cannot determine global Claude directory".to_string())?;
    let settings_exists = global_dir.join("settings.json").exists();
    let claude_json_exists = paths::global_claude_json_path()
        .map(|path| path.exists())
        .unwrap_or(false);
    let projects_registry_exists = paths::home_dir()
        .map(|path| path.join(".claudekit").join("projects.json").exists())
        .unwrap_or(false);

    Ok(HealthStatus {
        status: "ok".to_string(),
        timestamp: iso_now(now),
        uptime: started.elapsed().as_secs(),
        settings_exists,
        claude_json_exists,
        projects_registry_exists,
    })
}

#[tauri::command]
pub async fn get_hook_diagnostics(
    scope: Option<String>,
    project_id: Option<String>,
    limit: Option<u32>,
) -> Result<HookDiagnosticsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_hook_diagnostics_blocking(scope.as_deref(), project_id.as_deref(), limit)
    })
    .await
    .map_err(|err| format!("Failed to read hook diagnostics: {err}"))?
}

fn get_hook_diagnostics_blocking(
    raw_scope: Option<&str>,
    raw_project_id: Option<&str>,
    limit: Option<u32>,
) -> Result<HookDiagnosticsResponse, String> {
    let scope = match raw_scope.unwrap_or("global") {
        "global" => "global",
        "project" => "project",
        _ => return Err("scope must be either 'global' or 'project'".to_string()),
    };

    if let Some(project_id) = raw_project_id {
        if project_id.len() > MAX_HOOK_PROJECT_ID_LENGTH {
            return Err(format!(
                "projectId must be {MAX_HOOK_PROJECT_ID_LENGTH} characters or fewer"
            ));
        }
    }
    if scope == "project" && raw_project_id.is_none() {
        return Err("projectId is required when scope=project".to_string());
    }

    let base_path = if scope == "global" {
        paths::global_claude_dir()
            .ok_or_else(|| "Cannot determine global Claude directory".to_string())?
    } else {
        let project_id = raw_project_id.expect("checked above");
        project_ids::resolve_project_path(project_id)?
            .ok_or_else(|| "Project not found".to_string())?
    };

    let log_path = if scope == "global" {
        base_path.join("hooks").join(".logs").join("hook-log.jsonl")
    } else {
        base_path
            .join(".claude")
            .join("hooks")
            .join(".logs")
            .join("hook-log.jsonl")
    };

    let mut summary = HookDiagnosticsSummary {
        total: 0,
        parse_errors: 0,
        last_event_at: None,
        inspected_lines: 0,
        truncated: false,
        status_counts: HashMap::new(),
        hook_counts: HashMap::new(),
        tool_counts: HashMap::new(),
    };

    if !log_path.exists() {
        return Ok(HookDiagnosticsResponse {
            scope: scope.to_string(),
            project_id: raw_project_id.map(|value| value.to_string()),
            path: log_path.to_string_lossy().to_string(),
            exists: false,
            entries: Vec::new(),
            summary,
        });
    }

    let (lines, truncated) = read_log_tail(&log_path)?;
    summary.inspected_lines = lines.len();
    summary.truncated = truncated;

    let mut parsed = Vec::new();
    for line in lines {
        match serde_json::from_str::<Value>(&line) {
            Ok(value) => {
                if let Some(entry) = parse_hook_entry(&value) {
                    parsed.push(entry);
                } else {
                    summary.parse_errors += 1;
                }
            }
            Err(_) => summary.parse_errors += 1,
        }
    }

    parsed.sort_by(|left, right| right.ts.cmp(&left.ts));
    if let Some(entry) = parsed.first() {
        summary.last_event_at = Some(entry.ts.clone());
    }
    for entry in &parsed {
        summary.total += 1;
        increment(&mut summary.status_counts, &entry.status);
        increment(&mut summary.hook_counts, &entry.hook);
        if let Some(tool) = &entry.tool {
            increment(&mut summary.tool_counts, tool);
        }
    }

    let entries = parsed
        .into_iter()
        .take(clamp_hook_limit(limit))
        .collect::<Vec<_>>();

    Ok(HookDiagnosticsResponse {
        scope: scope.to_string(),
        project_id: raw_project_id.map(|value| value.to_string()),
        path: log_path.to_string_lossy().to_string(),
        exists: true,
        entries,
        summary,
    })
}

fn parse_hook_entry(value: &Value) -> Option<HookDiagnosticEntry> {
    Some(HookDiagnosticEntry {
        ts: value.get("ts")?.as_str()?.to_string(),
        hook: value.get("hook")?.as_str()?.to_string(),
        event: value
            .get("event")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string()),
        tool: value
            .get("tool")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string()),
        target: value
            .get("target")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string()),
        note: value
            .get("note")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string()),
        dur: value.get("dur").and_then(|item| item.as_f64()),
        status: value.get("status")?.as_str()?.to_string(),
        exit: value.get("exit").and_then(|item| item.as_i64()),
        error: value
            .get("error")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string()),
    })
}

fn clamp_hook_limit(limit: Option<u32>) -> usize {
    match limit {
        Some(value) if value > 0 => usize::try_from(value)
            .unwrap_or(DEFAULT_HOOK_LIMIT)
            .min(MAX_HOOK_LIMIT),
        _ => DEFAULT_HOOK_LIMIT,
    }
}

fn read_log_tail(path: &Path) -> Result<(Vec<String>, bool), String> {
    let mut file =
        File::open(path).map_err(|err| format!("Failed to open {}: {err}", path.display()))?;
    let metadata = file
        .metadata()
        .map_err(|err| format!("Failed to stat {}: {err}", path.display()))?;
    if metadata.len() == 0 {
        return Ok((Vec::new(), false));
    }

    let bytes_to_read = usize::try_from(metadata.len())
        .unwrap_or(MAX_READ_BYTES)
        .min(MAX_READ_BYTES);
    let start = metadata.len().saturating_sub(bytes_to_read as u64);
    let mut buffer = vec![0u8; bytes_to_read];
    file.seek(SeekFrom::Start(start))
        .map_err(|err| format!("Failed to seek {}: {err}", path.display()))?;
    file.read_exact(&mut buffer)
        .map_err(|err| format!("Failed to read {}: {err}", path.display()))?;

    let mut raw = String::from_utf8_lossy(&buffer).to_string();
    let mut truncated = start > 0;
    if truncated {
        if let Some(newline_index) = raw.find('\n') {
            raw = raw[(newline_index + 1)..].to_string();
        } else {
            raw.clear();
        }
    }

    let mut lines = raw
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect::<Vec<_>>();
    if lines.len() > MAX_INSPECTED_LINES {
        lines = lines.split_off(lines.len() - MAX_INSPECTED_LINES);
        truncated = true;
    }
    Ok((lines, truncated))
}

fn increment(map: &mut HashMap<String, usize>, key: &str) {
    *map.entry(key.to_string()).or_insert(0) += 1;
}

fn run_command((command, args): (&str, Vec<&str>), fallback: &str) -> String {
    Command::new(command)
        .args(args)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|output| !output.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn version_command(command: &str) -> (&str, Vec<&str>) {
    (command, vec!["--version"])
}

pub(crate) fn cli_version() -> String {
    let output = run_command(version_command("ck"), "unknown");
    parse_ck_version(&output)
}

fn parse_ck_version(raw: &str) -> String {
    raw.split_whitespace()
        .find(|token| token.chars().any(|c| c.is_ascii_digit()) && token.contains('.'))
        .map(|token| token.trim_start_matches('v').to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn which_command(binary: &str) -> (&str, Vec<&str>) {
    if cfg!(target_os = "windows") {
        ("where", vec![binary])
    } else {
        ("which", vec![binary])
    }
}

fn detect_package_manager(agent_override: Option<&str>) -> String {
    let agent = agent_override
        .map(str::to_string)
        .unwrap_or_else(|| std::env::var("npm_config_user_agent").unwrap_or_default());
    if agent.contains("bun/") {
        "bun".to_string()
    } else if agent.contains("pnpm/") {
        "pnpm".to_string()
    } else if agent.contains("yarn/") {
        "yarn".to_string()
    } else if agent.contains("npm/") {
        "npm".to_string()
    } else {
        "npm".to_string()
    }
}

fn system_memory_gb() -> f64 {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    let bytes = system.total_memory();
    if bytes == 0 {
        return 0.0;
    }
    bytes as f64 / 1024.0 / 1024.0 / 1024.0
}

fn iso_now(now: SystemTime) -> String {
    let seconds = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let (year, month, day, hour, minute, second) = civil_from_unix(seconds as i64);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_from_unix(seconds: i64) -> (i64, i64, i64, i64, i64, i64) {
    let days = seconds.div_euclid(86_400);
    let secs_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    (
        year,
        month,
        day,
        secs_of_day / 3_600,
        (secs_of_day % 3_600) / 60,
        secs_of_day % 60,
    )
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = y + (month <= 2) as i64;
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::{
        clamp_hook_limit, cli_version, detect_package_manager, parse_ck_version, parse_hook_entry,
        read_log_tail, system_memory_gb,
    };
    use serde_json::json;
    use std::fs;

    #[test]
    fn parses_hook_entry_shape() {
        let entry = parse_hook_entry(&json!({
            "ts": "2026-04-15T10:00:00Z",
            "hook": "pre-commit",
            "status": "ok",
            "tool": "bash"
        }))
        .expect("hook entry should parse");
        assert_eq!(entry.hook, "pre-commit");
        assert_eq!(entry.status, "ok");
        assert_eq!(entry.tool.as_deref(), Some("bash"));
    }

    #[test]
    fn clamps_hook_limit() {
        assert_eq!(clamp_hook_limit(None), 50);
        assert_eq!(clamp_hook_limit(Some(500)), 200);
        assert_eq!(clamp_hook_limit(Some(5)), 5);
    }

    #[test]
    fn reads_log_tail_without_empty_lines() {
        let dir = std::env::temp_dir().join("claudekit-control-center-tests");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let path = dir.join("hook-log.jsonl");
        fs::write(&path, "\nline1\nline2\n").expect("fixture should be written");
        let (lines, truncated) = read_log_tail(&path).expect("tail should read");
        assert!(!truncated);
        assert_eq!(lines, vec!["line1".to_string(), "line2".to_string()]);
    }

    #[test]
    fn detects_package_manager_from_env() {
        assert_eq!(detect_package_manager(Some("bun/1.3.11")), "bun");
    }

    #[test]
    fn system_memory_gb_returns_positive() {
        let gb = system_memory_gb();
        assert!(
            gb > 0.0,
            "expected > 0 GB, got {gb} on {}",
            std::env::consts::OS
        );
        assert!(gb < 10_000.0, "implausibly large memory: {gb} GB");
    }

    #[test]
    fn cli_version_is_not_cargo_pkg_version_placeholder() {
        let v = cli_version();
        assert!(
            v == "unknown" || v != env!("CARGO_PKG_VERSION"),
            "cli_version() returned the Tauri crate version {v}; should shell out to `ck --version`"
        );
    }

    #[test]
    fn cli_version_shape_is_semver_or_unknown() {
        let v = cli_version();
        if v == "unknown" {
            return;
        }
        let re_semverish = v.chars().any(|c| c.is_ascii_digit()) && v.contains('.');
        assert!(
            re_semverish,
            "cli_version() {v} is neither 'unknown' nor semver-shaped"
        );
    }

    #[test]
    fn parse_ck_version_extracts_semver() {
        assert_eq!(parse_ck_version("ck version 3.41.4-dev.31"), "3.41.4-dev.31");
        assert_eq!(parse_ck_version("3.41.4"), "3.41.4");
        assert_eq!(parse_ck_version("v3.41.4"), "3.41.4");
        assert_eq!(parse_ck_version(""), "unknown");
        assert_eq!(parse_ck_version("not a version"), "unknown");
    }
}
