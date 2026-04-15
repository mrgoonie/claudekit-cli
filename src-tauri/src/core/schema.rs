// core/schema.rs — Config schema types matching ClaudeKit config shape
//
// Rust structs derived from ck-config.schema.json. Top-level fields are typed;
// complex nested objects use serde_json::Value for flexibility without rigidity.
// All structs implement Default so missing fields are handled gracefully.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Top-level ClaudeKit config (.ck.json)
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CkConfig {
    #[serde(rename = "$schema", skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub coding_level: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub privacy_block: Option<bool>,

    /// "full" | "compact" | "minimal" | "none"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statusline: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub statusline_colors: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub statusline_quota: Option<bool>,

    /// Advanced layout config — see StatuslineLayout
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statusline_layout: Option<StatuslineLayout>,

    /// docs, plan, paths, locale, trust, project, gemini, skills, hooks, etc.
    /// Captured as dynamic Value to avoid losing unknown fields on round-trip.
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

/// statuslineLayout object from the schema
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatuslineLayout {
    /// Starting template mode: "full" | "compact" | "minimal" | "none"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_mode: Option<String>,

    /// Lines of section IDs, each inner vec is one terminal row
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<Vec<String>>>,

    /// Per-section visual customization
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section_config: Option<Value>,

    /// Color theme overrides
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<StatuslineTheme>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub responsive_breakpoint: Option<f64>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_agent_rows: Option<u32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub todo_truncation: Option<u32>,
}

/// Color theme inside statuslineLayout
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatuslineTheme {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_low: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_mid: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_high: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub accent: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub muted: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub separator: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub quota_low: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub quota_high: Option<String>,
}
