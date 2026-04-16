// commands/mod.rs — Tauri command module declarations
//
// Each sub-module maps to a domain area. Register commands from these modules
// in lib.rs via tauri::generate_handler!.

pub mod agents;
#[path = "commands-browser.rs"]
pub mod commands_browser;
pub mod config;
pub mod dashboard;
pub mod mcp;
pub mod plans;
pub mod sessions;
#[path = "skills-browser.rs"]
pub mod skills_browser;
pub mod system;
