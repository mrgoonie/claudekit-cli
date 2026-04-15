use crate::core::{paths, project_ids};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

const MAX_PROJECT_SESSION_LIMIT: usize = 100;
const DEFAULT_PROJECT_SESSION_LIMIT: usize = 10;
const DEFAULT_DETAIL_LIMIT: usize = 50;
const MAX_DETAIL_LIMIT: usize = 500;
const MAX_TOOL_TEXT_CHARS: usize = 8192;
const MAX_SESSION_FILE_BYTES: u64 = 50 * 1024 * 1024;
const SYSTEM_TAGS: [&str; 5] = [
    "system-reminder",
    "task-notification",
    "local-command-stdout",
    "local-command-caveat",
    "antml:thinking",
];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSessionSummary {
    pub id: String,
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub last_active: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub id: String,
    pub timestamp: String,
    pub duration: String,
    pub summary: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectActivity {
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub last_active: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyCount {
    pub date: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityMetrics {
    pub total_sessions: usize,
    pub projects: Vec<ProjectActivity>,
    pub daily_counts: Vec<DailyCount>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContentBlock {
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    pub content_blocks: Vec<ContentBlock>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub message_count: usize,
    pub tool_call_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub messages: Vec<SessionMessage>,
    pub summary: SessionSummary,
}

#[tauri::command]
pub async fn scan_sessions() -> Result<Vec<ProjectSessionSummary>, String> {
    tauri::async_runtime::spawn_blocking(scan_sessions_blocking)
        .await
        .map_err(|err| format!("Failed to scan sessions: {err}"))?
}

#[tauri::command]
pub async fn list_project_sessions(
    project_id: String,
    limit: Option<u32>,
) -> Result<Vec<SessionMeta>, String> {
    tauri::async_runtime::spawn_blocking(move || list_project_sessions_blocking(&project_id, limit))
        .await
        .map_err(|err| format!("Failed to list project sessions: {err}"))?
}

#[tauri::command]
pub async fn get_session_detail(
    project_id: String,
    session_id: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<SessionDetail, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_session_detail_blocking(&project_id, &session_id, limit, offset)
    })
    .await
    .map_err(|err| format!("Failed to read session detail: {err}"))?
}

#[tauri::command]
pub async fn get_session_activity(period: Option<String>) -> Result<ActivityMetrics, String> {
    tauri::async_runtime::spawn_blocking(move || get_session_activity_blocking(period.as_deref()))
        .await
        .map_err(|err| format!("Failed to scan activity metrics: {err}"))?
}

fn scan_sessions_blocking() -> Result<Vec<ProjectSessionSummary>, String> {
    let Some(projects_dir) = paths::global_projects_dir() else {
        return Ok(Vec::new());
    };
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();
    for entry in fs::read_dir(&projects_dir)
        .map_err(|err| format!("Failed to read {}: {err}", projects_dir.display()))?
        .flatten()
    {
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }

        let jsonl_files = session_files_in_dir(&entry_path);
        if jsonl_files.is_empty() {
            continue;
        }

        let mut last_active = std::time::SystemTime::UNIX_EPOCH;
        for file_path in jsonl_files.iter().rev().take(5) {
            if let Ok(metadata) = fs::metadata(file_path) {
                if let Ok(modified) = metadata.modified() {
                    if modified > last_active {
                        last_active = modified;
                    }
                }
            }
        }

        let encoded = entry.file_name().to_string_lossy().to_string();
        let resolved_path = project_ids::project_path_from_session_dir(&entry_path, &encoded)
            .unwrap_or_else(|_| PathBuf::from(encoded.clone()));
        let decoded_path = resolved_path.to_string_lossy().to_string();
        let name = Path::new(&decoded_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(&decoded_path)
            .to_string();

        projects.push(ProjectSessionSummary {
            id: project_ids::discovered_project_id(&decoded_path),
            name,
            path: decoded_path,
            session_count: jsonl_files.len(),
            last_active: to_iso_string(last_active),
        });
    }

    projects.sort_by(|left, right| right.last_active.cmp(&left.last_active));
    Ok(projects)
}

fn list_project_sessions_blocking(
    project_id: &str,
    limit: Option<u32>,
) -> Result<Vec<SessionMeta>, String> {
    if project_id.contains("..") {
        return Err("Invalid project ID".to_string());
    }

    let project_dir =
        resolve_session_dir(project_id)?.ok_or_else(|| "Project not found".to_string())?;
    let allowed_base = paths::global_projects_dir()
        .ok_or_else(|| "Cannot determine projects directory".to_string())?;
    if !project_dir.starts_with(&allowed_base) {
        return Err("Access denied".to_string());
    }

    let mut entries = session_files_in_dir(&project_dir)
        .into_iter()
        .map(|path| {
            let mtime = fs::metadata(&path)
                .and_then(|metadata| metadata.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            (path, mtime)
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.1.cmp(&left.1));

    let clamped_limit = limit
        .map(|value| value.max(1) as usize)
        .unwrap_or(DEFAULT_PROJECT_SESSION_LIMIT)
        .min(MAX_PROJECT_SESSION_LIMIT);

    let mut sessions = Vec::new();
    for (path, _) in entries.into_iter().take(clamped_limit) {
        if let Some(parsed) = parse_session_meta(&path) {
            sessions.push(parsed);
        }
    }
    Ok(sessions)
}

fn get_session_detail_blocking(
    project_id: &str,
    session_id: &str,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<SessionDetail, String> {
    if project_id.contains("..")
        || session_id.contains("..")
        || session_id.contains('/')
        || session_id.contains('\\')
    {
        return Err("Invalid session path".to_string());
    }

    let project_dir =
        resolve_session_dir(project_id)?.ok_or_else(|| "Project not found".to_string())?;
    let session_path = project_dir.join(format!("{session_id}.jsonl"));
    if !session_path.exists() {
        return Err("Session not found".to_string());
    }

    parse_session_detail(
        &session_path,
        limit.unwrap_or(DEFAULT_DETAIL_LIMIT as u32) as usize,
        offset.unwrap_or(0) as usize,
    )
}

fn get_session_activity_blocking(period: Option<&str>) -> Result<ActivityMetrics, String> {
    let Some(projects_dir) = paths::global_projects_dir() else {
        return Ok(empty_activity_metrics(period_days(period)));
    };
    if !projects_dir.exists() {
        return Ok(empty_activity_metrics(period_days(period)));
    }

    let days = period_days(period);
    let mut daily_counts = build_daily_buckets(days);
    let cutoff = chrono_like_cutoff(days);
    let mut projects = Vec::new();
    let mut total_sessions = 0usize;

    for entry in fs::read_dir(&projects_dir)
        .map_err(|err| format!("Failed to read {}: {err}", projects_dir.display()))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let encoded = entry.file_name().to_string_lossy().to_string();
        let resolved_path = project_ids::project_path_from_session_dir(&path, &encoded)
            .unwrap_or_else(|_| PathBuf::from(encoded.clone()));
        let decoded_path = resolved_path.to_string_lossy().to_string();
        let name = resolved_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(&decoded_path)
            .to_string();
        let session_files = session_files_in_dir(&path);
        if session_files.is_empty() {
            continue;
        }

        let mut last_active: Option<String> = None;
        let mut latest_mtime = std::time::SystemTime::UNIX_EPOCH;
        let mut period_count = 0usize;

        for session_file in session_files {
            if let Ok(metadata) = fs::metadata(&session_file) {
                if let Ok(modified) = metadata.modified() {
                    if modified >= cutoff {
                        period_count += 1;
                        let date_key = local_date_string(modified);
                        if let Some(count) = daily_counts.get_mut(&date_key) {
                            *count += 1;
                        }
                    }
                    if modified > latest_mtime {
                        latest_mtime = modified;
                        last_active = Some(to_iso_string(modified));
                    }
                }
            }
        }

        if period_count == 0 {
            continue;
        }

        total_sessions += period_count;
        projects.push(ProjectActivity {
            name,
            path: decoded_path,
            session_count: period_count,
            last_active,
        });
    }

    projects.sort_by(|left, right| right.session_count.cmp(&left.session_count));
    let mut daily_counts_vec = daily_counts
        .into_iter()
        .map(|(date, count)| DailyCount { date, count })
        .collect::<Vec<_>>();
    daily_counts_vec.sort_by(|left, right| left.date.cmp(&right.date));

    Ok(ActivityMetrics {
        total_sessions,
        projects,
        daily_counts: daily_counts_vec,
    })
}

fn resolve_session_dir(project_id: &str) -> Result<Option<PathBuf>, String> {
    if project_id.starts_with("discovered-") {
        return project_ids::resolve_discovered_session_dir(project_id);
    }
    let project_path = project_ids::resolve_project_path(project_id)?;
    project_path
        .as_deref()
        .map(project_ids::session_dir_for_project)
        .transpose()
}

fn session_files_in_dir(dir: &Path) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("jsonl"))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn parse_session_meta(path: &Path) -> Option<SessionMeta> {
    let metadata = fs::metadata(path).ok()?;
    if metadata.len() > MAX_SESSION_FILE_BYTES {
        return None;
    }

    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    let mut summary = String::new();
    let mut session_id = String::new();
    let mut first_timestamp: Option<std::time::SystemTime> = None;
    let mut last_timestamp: Option<std::time::SystemTime> = None;

    for line in reader.lines() {
        let Ok(line) = line else {
            continue;
        };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(event) = serde_json::from_str::<Value>(&line) else {
            continue;
        };

        if summary.is_empty() {
            if let Some(text) = event.get("summary").and_then(|value| value.as_str()) {
                summary = text.to_string();
            }
        }
        if session_id.is_empty() {
            if let Some(value) = event.get("sessionId").and_then(|value| value.as_str()) {
                session_id = value.to_string();
            }
        }

        if let Some(timestamp) = event.get("timestamp").and_then(|value| value.as_str()) {
            if let Ok(parsed) = timestamp.parse::<chrono_like::Timestamp>() {
                let system_time = parsed.to_system_time();
                if first_timestamp.is_none() {
                    first_timestamp = Some(system_time);
                }
                last_timestamp = Some(system_time);
            }
        }

        if summary.is_empty() && event.get("type").and_then(|value| value.as_str()) == Some("user")
        {
            if let Some(message) = event.get("message") {
                let text = extract_message_text(message.get("content"));
                if !text.is_empty() {
                    summary = truncate_summary(&text);
                }
            }
        }
    }

    let first_timestamp = first_timestamp?;
    if session_id.is_empty() {
        session_id = path.file_stem()?.to_string_lossy().to_string();
    }

    Some(SessionMeta {
        id: session_id,
        timestamp: format_timestamp(first_timestamp),
        duration: format_duration(first_timestamp, last_timestamp.unwrap_or(first_timestamp)),
        summary: if summary.is_empty() {
            "No summary available".to_string()
        } else {
            summary
        },
    })
}

fn parse_session_detail(path: &Path, limit: usize, offset: usize) -> Result<SessionDetail, String> {
    let metadata =
        fs::metadata(path).map_err(|err| format!("Failed to stat {}: {err}", path.display()))?;
    if metadata.len() > MAX_SESSION_FILE_BYTES {
        return Ok(SessionDetail {
            messages: vec![SessionMessage {
                role: "system".to_string(),
                timestamp: None,
                content_blocks: vec![ContentBlock {
                    r#type: "text".to_string(),
                    text: Some(format!(
                        "Session file too large ({:.1} MB, limit 50 MB). Showing summary only.",
                        metadata.len() as f64 / 1024.0 / 1024.0
                    )),
                    tool_name: None,
                    tool_input: None,
                    tool_use_id: None,
                    result: None,
                    is_error: None,
                }],
            }],
            summary: SessionSummary {
                message_count: 0,
                tool_call_count: 0,
                duration: None,
            },
        });
    }

    let mut tool_results = HashMap::new();
    for_each_jsonl_line(path, |line| {
        let Ok(event) = serde_json::from_str::<Value>(&line) else {
            return;
        };
        let Some(content) = event
            .get("message")
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_array())
        else {
            return;
        };

        for block in content {
            if block.get("type").and_then(|value| value.as_str()) != Some("tool_result") {
                continue;
            }
            let Some(tool_use_id) = block.get("tool_use_id").and_then(|value| value.as_str())
            else {
                continue;
            };
            let result = extract_tool_result_content(block);
            if result.is_none() {
                continue;
            }
            tool_results.insert(
                tool_use_id.to_string(),
                (
                    result.unwrap_or_default(),
                    block
                        .get("is_error")
                        .and_then(|value| value.as_bool())
                        .unwrap_or(false),
                ),
            );
        }
    })?;

    let mut messages = Vec::new();
    let mut first_timestamp: Option<std::time::SystemTime> = None;
    let mut last_timestamp: Option<std::time::SystemTime> = None;
    let mut tool_call_count = 0usize;

    for_each_jsonl_line(path, |line| {
        let Ok(event) = serde_json::from_str::<Value>(&line) else {
            return;
        };
        let event_type = event.get("type").and_then(|value| value.as_str());
        if event_type != Some("user") && event_type != Some("assistant") {
            return;
        }

        if let Some(timestamp) = event.get("timestamp").and_then(|value| value.as_str()) {
            if let Ok(parsed) = timestamp.parse::<chrono_like::Timestamp>() {
                let system_time = parsed.to_system_time();
                if first_timestamp.is_none() {
                    first_timestamp = Some(system_time);
                }
                last_timestamp = Some(system_time);
            }
        }

        let Some(message) = event.get("message") else {
            return;
        };
        let Some(role) = message.get("role").and_then(|value| value.as_str()) else {
            return;
        };

        let mut content_blocks = Vec::new();
        match message.get("content") {
            Some(Value::String(text)) => {
                let (system_blocks, remaining) = extract_system_tags(text);
                content_blocks.extend(system_blocks);
                if !remaining.is_empty() {
                    content_blocks.push(text_block(remaining));
                }
            }
            Some(Value::Array(blocks)) => {
                for block in blocks {
                    match block.get("type").and_then(|value| value.as_str()) {
                        Some("text") => {
                            let text = block
                                .get("text")
                                .and_then(|value| value.as_str())
                                .unwrap_or("");
                            let (system_blocks, remaining) = extract_system_tags(text);
                            content_blocks.extend(system_blocks);
                            if !remaining.is_empty() {
                                content_blocks.push(text_block(remaining));
                            }
                        }
                        Some("thinking") => {
                            let text = block
                                .get("thinking")
                                .or_else(|| block.get("text"))
                                .and_then(|value| value.as_str())
                                .unwrap_or("");
                            if !text.is_empty() {
                                content_blocks.push(ContentBlock {
                                    r#type: "thinking".to_string(),
                                    text: Some(text.to_string()),
                                    tool_name: None,
                                    tool_input: None,
                                    tool_use_id: None,
                                    result: None,
                                    is_error: None,
                                });
                            }
                        }
                        Some("tool_use") => {
                            let tool_name = block
                                .get("name")
                                .and_then(|value| value.as_str())
                                .unwrap_or("");
                            if tool_name.is_empty() {
                                continue;
                            }
                            let tool_use_id = block
                                .get("id")
                                .and_then(|value| value.as_str())
                                .map(|value| value.to_string());
                            let mut tool_block = ContentBlock {
                                r#type: "tool_use".to_string(),
                                text: None,
                                tool_name: Some(tool_name.to_string()),
                                tool_input: stringify_input(block.get("input")),
                                tool_use_id: tool_use_id.clone(),
                                result: None,
                                is_error: None,
                            };
                            if let Some(tool_use_id) = &tool_use_id {
                                if let Some((result, is_error)) = tool_results.get(tool_use_id) {
                                    tool_block.result = Some(result.clone());
                                    tool_block.is_error = Some(*is_error);
                                }
                            }
                            content_blocks.push(tool_block);
                            tool_call_count += 1;
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }

        if !content_blocks.is_empty() {
            messages.push(SessionMessage {
                role: role.to_string(),
                timestamp: event
                    .get("timestamp")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string()),
                content_blocks,
            });
        }
    })?;

    let total_messages = messages.len();
    let clamped_limit = limit.max(1).min(MAX_DETAIL_LIMIT);
    let paged_messages = messages
        .into_iter()
        .skip(offset)
        .take(clamped_limit)
        .collect::<Vec<_>>();

    Ok(SessionDetail {
        messages: paged_messages,
        summary: SessionSummary {
            message_count: total_messages,
            tool_call_count,
            duration: match (first_timestamp, last_timestamp) {
                (Some(start), Some(end)) if end > start => Some(format_duration(start, end)),
                _ => None,
            },
        },
    })
}

fn period_days(period: Option<&str>) -> usize {
    match period.unwrap_or("7d") {
        "24h" => 1,
        "30d" => 30,
        _ => 7,
    }
}

fn empty_activity_metrics(days: usize) -> ActivityMetrics {
    let mut daily_counts = build_daily_buckets(days)
        .into_iter()
        .map(|(date, count)| DailyCount { date, count })
        .collect::<Vec<_>>();
    daily_counts.sort_by(|left, right| left.date.cmp(&right.date));
    ActivityMetrics {
        total_sessions: 0,
        projects: Vec::new(),
        daily_counts,
    }
}

fn build_daily_buckets(days: usize) -> HashMap<String, usize> {
    let mut buckets = HashMap::new();
    let now = std::time::SystemTime::now();
    for day_offset in 0..days {
        let timestamp = now
            .checked_sub(std::time::Duration::from_secs(
                (day_offset as u64) * 24 * 60 * 60,
            ))
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        buckets.insert(local_date_string(timestamp), 0);
    }
    buckets
}

fn chrono_like_cutoff(days: usize) -> std::time::SystemTime {
    std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs((days as u64) * 24 * 60 * 60))
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
}

fn for_each_jsonl_line<F>(path: &Path, mut callback: F) -> Result<(), String>
where
    F: FnMut(String),
{
    let file =
        File::open(path).map_err(|err| format!("Failed to open {}: {err}", path.display()))?;
    let reader = BufReader::new(file);
    for line in reader.lines() {
        let line = line.map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
        if line.trim().is_empty() {
            continue;
        }
        callback(line);
    }
    Ok(())
}

fn extract_message_text(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(text)) => text.to_string(),
        Some(Value::Array(blocks)) => blocks
            .iter()
            .find_map(|block| block.get("text").and_then(|value| value.as_str()))
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

fn truncate_summary(text: &str) -> String {
    let cleaned = text.replace(['\n', '\r'], " ");
    let without_tags = strip_angle_tags(&cleaned);
    if without_tags.chars().count() <= 100 {
        return without_tags;
    }
    format!("{}...", without_tags.chars().take(100).collect::<String>())
}

fn strip_angle_tags(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut inside_tag = false;
    for character in text.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }
    output.trim().to_string()
}

fn extract_system_tags(text: &str) -> (Vec<ContentBlock>, String) {
    let mut remaining = text.to_string();
    let mut blocks = Vec::new();

    loop {
        let mut next_match: Option<(usize, &str)> = None;
        for tag in SYSTEM_TAGS {
            let open = format!("<{tag}>");
            if let Some(index) = remaining.find(&open) {
                match next_match {
                    Some((best_index, _)) if best_index <= index => {}
                    _ => next_match = Some((index, tag)),
                }
            }
        }

        let Some((start, tag)) = next_match else {
            break;
        };
        let open = format!("<{tag}>");
        let close = format!("</{tag}>");
        let content_start = start + open.len();
        let Some(relative_close) = remaining[content_start..].find(&close) else {
            break;
        };
        let content_end = content_start + relative_close;
        let content = remaining[content_start..content_end].trim().to_string();
        blocks.push(ContentBlock {
            r#type: "system".to_string(),
            text: Some(format!("[{tag}]\n{content}")),
            tool_name: None,
            tool_input: None,
            tool_use_id: None,
            result: None,
            is_error: None,
        });
        remaining.replace_range(start..content_end + close.len(), "");
    }

    (blocks, remaining.trim().to_string())
}

fn text_block(text: String) -> ContentBlock {
    ContentBlock {
        r#type: "text".to_string(),
        text: Some(text),
        tool_name: None,
        tool_input: None,
        tool_use_id: None,
        result: None,
        is_error: None,
    }
}

fn stringify_input(input: Option<&Value>) -> Option<String> {
    let input = input?;
    let raw = if let Some(text) = input.as_str() {
        text.to_string()
    } else {
        serde_json::to_string_pretty(input).ok()?
    };
    Some(cap_string(raw))
}

fn extract_tool_result_content(block: &Value) -> Option<String> {
    match block.get("content") {
        Some(Value::String(text)) => Some(cap_string(text.to_string())),
        Some(Value::Array(parts)) => parts
            .iter()
            .find_map(|part| part.get("text").and_then(|value| value.as_str()))
            .map(|text| cap_string(text.to_string())),
        _ => None,
    }
}

fn cap_string(text: String) -> String {
    if text.chars().count() <= MAX_TOOL_TEXT_CHARS {
        return text;
    }
    format!(
        "{}...",
        text.chars().take(MAX_TOOL_TEXT_CHARS).collect::<String>()
    )
}

fn format_timestamp(timestamp: std::time::SystemTime) -> String {
    let now = std::time::SystemTime::now();
    let now_date = local_date_string(now);
    let timestamp_date = local_date_string(timestamp);
    let time = local_time_string(timestamp);
    if now_date == timestamp_date {
        return format!("Today {time}");
    }
    format!("{} {time}", local_month_day_string(timestamp))
}

fn format_duration(start: std::time::SystemTime, end: std::time::SystemTime) -> String {
    let Ok(duration) = end.duration_since(start) else {
        return "0min".to_string();
    };
    let minutes = duration.as_secs() / 60;
    let hours = minutes / 60;
    let remaining = minutes % 60;
    if hours == 0 {
        format!("{remaining}min")
    } else {
        format!("{hours}h {remaining}min")
    }
}

fn to_iso_string(timestamp: std::time::SystemTime) -> String {
    chrono_like::Timestamp::from_system_time(timestamp).to_iso_string()
}

fn local_date_string(timestamp: std::time::SystemTime) -> String {
    // Phase 1 limitation: these helpers format UTC-derived calendar values.
    chrono_like::Timestamp::from_system_time(timestamp).local_date_string()
}

fn local_time_string(timestamp: std::time::SystemTime) -> String {
    // Phase 1 limitation: these helpers format UTC-derived clock values.
    chrono_like::Timestamp::from_system_time(timestamp).local_time_string()
}

fn local_month_day_string(timestamp: std::time::SystemTime) -> String {
    // Phase 1 limitation: these helpers format UTC-derived month/day values.
    chrono_like::Timestamp::from_system_time(timestamp).local_month_day_string()
}

mod chrono_like {
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    pub struct Timestamp {
        seconds: i64,
    }

    impl Timestamp {
        pub fn to_system_time(&self) -> SystemTime {
            if self.seconds <= 0 {
                return UNIX_EPOCH;
            }
            UNIX_EPOCH + Duration::from_secs(self.seconds as u64)
        }

        pub fn from_system_time(timestamp: SystemTime) -> Self {
            let seconds = timestamp
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs() as i64)
                .unwrap_or_default();
            Self { seconds }
        }

        pub fn to_iso_string(&self) -> String {
            // Enough for parity in Phase 1: UTC second precision.
            let timestamp = self.to_system_time();
            let datetime = timestamp
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs())
                .unwrap_or_default();
            let tm = civil_from_unix(datetime as i64);
            format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                tm.year, tm.month, tm.day, tm.hour, tm.minute, tm.second
            )
        }

        pub fn local_date_string(&self) -> String {
            let tm = civil_from_unix(self.seconds);
            format!("{:04}-{:02}-{:02}", tm.year, tm.month, tm.day)
        }

        pub fn local_time_string(&self) -> String {
            let tm = civil_from_unix(self.seconds);
            format!("{:02}:{:02}", tm.hour, tm.minute)
        }

        pub fn local_month_day_string(&self) -> String {
            const MONTHS: [&str; 12] = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ];
            let tm = civil_from_unix(self.seconds);
            format!("{} {}", MONTHS[(tm.month - 1) as usize], tm.day)
        }
    }

    impl std::str::FromStr for Timestamp {
        type Err = String;

        fn from_str(value: &str) -> Result<Self, Self::Err> {
            // Accept RFC3339-ish strings by trimming fractional seconds and Z/offset.
            let core = value
                .split(['Z', '+'])
                .next()
                .unwrap_or(value)
                .split('.')
                .next()
                .unwrap_or(value);
            let parts = core
                .split(['-', 'T', ':'])
                .map(|segment| {
                    segment
                        .parse::<i64>()
                        .map_err(|_| "invalid timestamp".to_string())
                })
                .collect::<Result<Vec<_>, _>>()?;
            if parts.len() < 6 {
                return Err("invalid timestamp".to_string());
            }
            let seconds =
                unix_from_civil(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]);
            Ok(Self { seconds })
        }
    }

    struct CivilTime {
        year: i64,
        month: i64,
        day: i64,
        hour: i64,
        minute: i64,
        second: i64,
    }

    fn unix_from_civil(
        year: i64,
        month: i64,
        day: i64,
        hour: i64,
        minute: i64,
        second: i64,
    ) -> i64 {
        let days = days_from_civil(year, month, day);
        days * 86_400 + hour * 3_600 + minute * 60 + second
    }

    fn civil_from_unix(seconds: i64) -> CivilTime {
        let days = seconds.div_euclid(86_400);
        let secs_of_day = seconds.rem_euclid(86_400);
        let (year, month, day) = civil_from_days(days);
        CivilTime {
            year,
            month,
            day,
            hour: secs_of_day / 3_600,
            minute: (secs_of_day % 3_600) / 60,
            second: secs_of_day % 60,
        }
    }

    fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
        let year = year - (month <= 2) as i64;
        let era = if year >= 0 { year } else { year - 399 } / 400;
        let yoe = year - era * 400;
        let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        era * 146_097 + doe - 719_468
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
}

#[cfg(test)]
mod tests {
    use super::{extract_system_tags, parse_session_detail, text_block};
    use std::fs;
    use std::path::PathBuf;

    fn write_fixture(name: &str, content: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("claudekit-control-center-tests");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let path = dir.join(name);
        fs::write(&path, content).expect("fixture should be written");
        path
    }

    #[test]
    fn extracts_system_tags_from_text() {
        let (blocks, remaining) =
            extract_system_tags("hello <system-reminder>pay attention</system-reminder> world");
        assert_eq!(remaining, "hello  world".trim().to_string());
        assert_eq!(blocks.len(), 1);
        assert_eq!(
            blocks[0].text.as_deref(),
            Some("[system-reminder]\npay attention")
        );
    }

    #[test]
    fn parses_session_detail_with_tool_results() {
        let path = write_fixture(
            "session-detail.jsonl",
            "{\"type\":\"assistant\",\"timestamp\":\"2026-04-15T10:00:00Z\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"tool_use\",\"name\":\"Read\",\"id\":\"tool_1\",\"input\":{\"path\":\"/tmp/demo\"}}]}}\n\
             {\"type\":\"assistant\",\"timestamp\":\"2026-04-15T10:01:00Z\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"tool_1\",\"content\":\"done\",\"is_error\":false}]}}\n",
        );
        let detail = parse_session_detail(&path, 50, 0).expect("detail should parse");
        assert_eq!(detail.summary.tool_call_count, 1);
        assert_eq!(detail.messages.len(), 1);
        assert_eq!(
            detail.messages[0].content_blocks[0].tool_name.as_deref(),
            Some("Read")
        );
        assert_eq!(
            detail.messages[0].content_blocks[0].result.as_deref(),
            Some("done")
        );
    }

    #[test]
    fn text_block_helper_sets_text_type() {
        let block = text_block("demo".to_string());
        assert_eq!(block.r#type, "text");
        assert_eq!(block.text.as_deref(), Some("demo"));
    }
}
