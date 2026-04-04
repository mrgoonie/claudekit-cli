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
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands (Phase 1B)
            commands::config::read_config,
            commands::config::write_config,
            commands::config::read_settings,
            commands::config::write_settings,
            commands::config::read_statusline,
            commands::config::write_statusline,
            commands::config::get_global_config_path,
            // Project commands (Phase 1D)
            projects::list_projects,
            projects::add_project,
            projects::remove_project,
            projects::scan_for_projects,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClaudeKit Control Center");
}
