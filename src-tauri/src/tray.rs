// ClaudeKit Control Center — System tray setup and menu handlers
//
// Creates a persistent tray icon with:
//   - "Open Control Center" — shows and focuses the main window
//   - "Check for Updates" — emits "check-updates" event to frontend
//   - "Quit" — exits the application
//
// Left-click on the tray icon also shows and focuses the main window.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime,
};

/// Register the system tray icon and context menu for the given app handle.
/// Must be called from the `setup` closure in `tauri::Builder`.
pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Control Center", true, None::<&str>)?;
    let check_updates =
        MenuItem::with_id(app, "check_updates", "Check for Updates", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &check_updates, &quit])?;

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .cloned()
                .ok_or_else(|| tauri::Error::AssetNotFound("No default window icon".to_string()))?,
        )
        .menu(&menu)
        .tooltip("ClaudeKit Control Center")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "check_updates" => {
                // Delegate update check to the frontend via tauri-plugin-updater JS API.
                // Emit an event so the React/TS side can call `checkUpdate()`.
                // TODO(Phase 2): Add listen("check-updates") handler in frontend
                // once @tauri-apps/api + @tauri-apps/plugin-updater are installed
                // and the updater signing key is configured.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("check-updates", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click opens the main window (standard macOS/Windows tray behaviour)
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
