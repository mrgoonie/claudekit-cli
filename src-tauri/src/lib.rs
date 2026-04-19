// ClaudeKit Control Center — Tauri v2 application entry point
//
// Integrates all Phase 1 modules:
//   - commands/config: CK config & statusline read/write
//   - projects: Multi-project management with persistent store
//   - tray: System tray icon with context menu
//   - Plugins: updater, store, dialog

mod commands;
mod core;
mod projects;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    commands::system::mark_app_started();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agent/browser commands (Phase 1B)
            commands::agents::scan_agents,
            commands::agents::get_agent_detail,
            commands::commands_browser::scan_commands,
            commands::commands_browser::get_command_detail,
            // Config commands (Phase 1B)
            commands::config::read_config,
            commands::config::write_config,
            commands::config::read_settings,
            commands::config::settings_file_exists,
            commands::config::write_settings,
            commands::config::read_statusline,
            commands::config::write_statusline,
            commands::config::get_global_config_path,
            commands::config::get_global_config_dir,
            commands::config::get_home_dir,
            // Project commands (Phase 1D)
            projects::list_projects,
            projects::add_project,
            projects::remove_project,
            projects::touch_project,
            projects::scan_for_projects,
            // Session commands (Phase 1A)
            commands::sessions::scan_sessions,
            commands::sessions::list_project_sessions,
            commands::sessions::get_session_detail,
            commands::sessions::get_session_activity,
            // System commands (Phase 1E)
            commands::system::get_system_info,
            commands::system::get_health,
            commands::system::get_global_metadata,
            commands::system::get_hook_diagnostics,
            // Skills, MCP, and dashboard commands (Phase 1B/1C/1D)
            commands::skills_browser::scan_skills,
            commands::skills_browser::get_skill_detail,
            commands::skills_browser::search_skills,
            commands::mcp::discover_mcp_servers,
            commands::dashboard::get_dashboard_stats,
            commands::dashboard::get_dashboard_agents,
            commands::dashboard::get_suggestions,
            // Plans commands (Phase 2E)
            commands::plans::list_plans,
            commands::plans::parse_plan,
            commands::plans::get_plan_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClaudeKit Control Center");
}
