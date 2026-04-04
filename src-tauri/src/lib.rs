// ClaudeKit Control Center — Tauri v2 command registration
//
// Phase 1A: Scaffold only. Commands are wired in Phase 1B when
// @tauri-apps/api is added and the frontend calls invoke().
//
// To add a command:
//   1. Define the function with #[tauri::command]
//   2. Register it in the builder below: .invoke_handler(tauri::generate_handler![my_cmd])

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        // No commands registered yet — add them in Phase 1B
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running ClaudeKit Control Center");
}
