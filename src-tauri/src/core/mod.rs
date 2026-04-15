// core/mod.rs — Core module declarations
//
// Business logic modules: path resolution, config parsing, schema types.
// These are pure Rust — no Tauri-specific APIs here.

pub mod config_parser;
pub mod frontmatter;
pub mod paths;
pub mod project_ids;
pub mod schema;
