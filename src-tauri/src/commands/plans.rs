// commands/plans.rs — Tauri commands for reading and parsing ClaudeKit plans

use crate::core::frontmatter::parse_frontmatter;
use serde::Serialize;
use serde_json::{Map, Value};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanSummary {
    pub plan_file: String,
    pub plan_dir: String,
    pub name: String,
    pub slug: String,
    pub frontmatter: Map<String, Value>,
    pub progress_pct: u32,
    pub status: String,
    pub total_tasks: u32,
    pub completed_tasks: u32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanDetail {
    pub file: String,
    pub frontmatter: Map<String, Value>,
    pub phases: Vec<Value>,
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanListResponse {
    pub dir: String,
    pub total: usize,
    pub plans: Vec<PlanSummary>,
}

#[tauri::command]
pub async fn list_plans(dir: String, limit: Option<usize>, offset: Option<usize>) -> Result<PlanListResponse, String> {
    let p = Path::new(&dir);
    if !p.is_absolute() {
        return Err(format!("Plan directory must be absolute: {dir}"));
    }
    if !p.is_dir() {
        return Err(format!("Plan directory not found: {dir}"));
    }

    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let mut plans = Vec::new();
    for entry in WalkDir::new(p).max_depth(2).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.file_name().and_then(|v| v.to_str()) == Some("plan.md") {
            if let Ok(summary) = build_plan_summary(path) {
                plans.push(summary);
            }
        }
    }

    let total = plans.len();
    let paged_plans = plans.into_iter().skip(offset).take(limit).collect();

    Ok(PlanListResponse {
        dir,
        total,
        plans: paged_plans,
    })
}

#[tauri::command]
pub async fn parse_plan(file: String) -> Result<PlanDetail, String> {
    let p = Path::new(&file);
    if !p.is_absolute() {
        return Err(format!("Plan file path must be absolute: {file}"));
    }
    if !p.is_file() {
        return Err(format!("Plan file not found: {file}"));
    }

    let content = fs::read_to_string(p).map_err(|e| format!("Failed to read {file}: {e}"))?;
    let parsed = parse_frontmatter(&content)?;

    // Improved phase parsing (match ## Phase N, ### Phase N, or H1 with Phase)
    let mut phases = Vec::new();
    for line in parsed.body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("## Phase")
            || trimmed.starts_with("### Phase")
            || (trimmed.starts_with("# ") && trimmed.contains("Phase"))
        {
            phases.push(Value::String(trimmed.to_string()));
        }
    }

    Ok(PlanDetail {
        file,
        frontmatter: parsed.frontmatter,
        phases,
        content: parsed.body,
    })
}

#[tauri::command]
pub async fn get_plan_summary(file: String) -> Result<PlanSummary, String> {
    let p = Path::new(&file);
    if !p.is_absolute() {
        return Err(format!("Plan file path must be absolute: {file}"));
    }
    build_plan_summary(p)
}

fn build_plan_summary(path: &Path) -> Result<PlanSummary, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
    let parsed = parse_frontmatter(&content)?;

    let plan_dir = path
        .parent()
        .unwrap_or(Path::new("."))
        .to_string_lossy()
        .to_string();
    let name = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|v| v.to_str())
        .unwrap_or("unknown")
        .to_string();

    let status = parsed
        .frontmatter
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("open")
        .to_string();

    // Compute basic metrics from checkboxes
    let mut total_tasks = 0;
    let mut completed_tasks = 0;
    for line in parsed.body.lines() {
        let trimmed = line.trim();
        if trimmed.contains("[ ]") || trimmed.contains("[x]") || trimmed.contains("[X]") {
            total_tasks += 1;
            if trimmed.contains("[x]") || trimmed.contains("[X]") {
                completed_tasks += 1;
            }
        }
    }

    let progress_pct = if total_tasks > 0 {
        (completed_tasks * 100) / total_tasks
    } else {
        0
    };

    Ok(PlanSummary {
        plan_file: path.to_string_lossy().to_string(),
        plan_dir,
        slug: name.clone(),
        name,
        frontmatter: parsed.frontmatter,
        progress_pct,
        status,
        total_tasks,
        completed_tasks,
    })
}
