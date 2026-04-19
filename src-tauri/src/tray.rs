// ClaudeKit Control Center — System tray setup and menu handlers.

use crate::core::project_ids;
use crate::projects;
use serde::Serialize;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

const TRAY_ID: &str = "control-center-tray";
const RECENT_LIMIT: usize = 3;
const RECENT_PROJECT_PREFIX: &str = "recent_project:";

#[derive(Clone)]
struct TrayState {
    recent_projects: Submenu<tauri::Wry>,
    open_terminal: MenuItem<tauri::Wry>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TrayOpenPayload {
    destination: &'static str,
    project_id: Option<String>,
}

#[derive(Debug)]
struct TerminalCommand {
	command: &'static str,
	args: Vec<String>,
	cwd: Option<String>,
}

#[derive(Clone, Copy, Debug)]
enum LinuxTerminalKind {
	XTerminalEmulator,
	GnomeTerminal,
	Konsole,
	Tilix,
	Xfce4Terminal,
	Kitty,
	Alacritty,
	Wezterm,
	Terminator,
}

pub fn create_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let title = MenuItem::with_id(app, "tray_title", "ClaudeKit Control Center", false, None::<&str>)?;
    let recent_projects = Submenu::with_id(app, "recent_projects", "Recent Projects", true)?;
    let open_dashboard =
        MenuItem::with_id(app, "open_dashboard", "Open Dashboard", true, None::<&str>)?;
    let open_terminal =
        MenuItem::with_id(app, "open_terminal", "Open in Terminal", false, None::<&str>)?;
    let check_updates =
        MenuItem::with_id(app, "check_updates", "Check for Updates", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator_1 = PredefinedMenuItem::separator(app)?;
    let separator_2 = PredefinedMenuItem::separator(app)?;
    let separator_3 = PredefinedMenuItem::separator(app)?;

    refresh_recent_projects_menu(app, &recent_projects, &open_terminal)
        .map_err(|err| tauri::Error::Io(std::io::Error::other(err)))?;

    let menu = Menu::with_id_and_items(
        app,
        "control_center_tray_menu",
        &[
            &title,
            &separator_1,
            &recent_projects,
            &separator_2,
            &open_dashboard,
            &open_terminal,
            &separator_3,
            &check_updates,
            &settings,
            &quit,
        ],
    )?;

    app.manage(TrayState {
        recent_projects: recent_projects.clone(),
        open_terminal: open_terminal.clone(),
    });

    let tray_icon = load_tray_icon()?;

    let builder = TrayIconBuilder::with_id(TRAY_ID).icon(tray_icon);

    // On macOS, tray icons should be rendered as template images so the system
    // can auto-invert them for light/dark menu bars.
    #[cfg(target_os = "macos")]
    let builder = builder.icon_as_template(true);

    builder
        .menu(&menu)
        .tooltip("ClaudeKit Control Center")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_dashboard" => emit_tray_open(app, "dashboard", None),
            "open_terminal" => {
                if let Some(project) = projects::primary_recent_project().ok().flatten() {
                    if let Err(err) = open_system_terminal(&project.path) {
                        eprintln!("[tray] failed to open terminal: {err}");
                    } else if let Err(err) = projects::touch_project_path(app, &project.path) {
                        eprintln!("[tray] failed to update recent project: {err}");
                    }
                }
            }
            "check_updates" => {
                if let Some(window) = focus_main_window(app) {
                    let _ = window.emit("check-updates", ());
                }
            }
            "settings" => emit_tray_open(app, "settings", None),
            "quit" => app.exit(0),
            _ => {
                if let Some(project_id) = event.id.as_ref().strip_prefix(RECENT_PROJECT_PREFIX) {
                    handle_recent_project_click(app, project_id);
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = focus_main_window(&app);
            }
        })
        .build(app)?;

    Ok(())
}

// Loads the tray icon. macOS menu bars are typically Retina, so we embed the
// 64x64 @2x asset there; other platforms use the 32x32 base image.
// On macOS the caller also marks this as a template image so the menu bar can
// auto-tint it for light/dark mode.
fn load_tray_icon() -> tauri::Result<Image<'static>> {
    #[cfg(target_os = "macos")]
    const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray-icon@2x.png");
    #[cfg(not(target_os = "macos"))]
    const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray-icon.png");
    Image::from_bytes(TRAY_ICON_BYTES)
}

pub fn refresh_tray(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(state) = app.try_state::<TrayState>() else {
        return Ok(());
    };

    refresh_recent_projects_menu(app, &state.recent_projects, &state.open_terminal)
}

fn refresh_recent_projects_menu(
    app: &tauri::AppHandle,
    recent_projects_menu: &Submenu<tauri::Wry>,
    open_terminal: &MenuItem<tauri::Wry>,
) -> Result<(), String> {
    while recent_projects_menu
        .remove_at(0)
        .map_err(|err| err.to_string())?
        .is_some()
    {}

	let recent_projects = projects::list_recent_projects(RECENT_LIMIT)?;
	open_terminal
		.set_enabled(!recent_projects.is_empty() && system_terminal_supported())
		.map_err(|err| err.to_string())?;

    if recent_projects.is_empty() {
        let empty = MenuItem::with_id(
            app,
            "recent_projects_empty",
            "No recent projects",
            false,
            None::<&str>,
        )
        .map_err(|err| err.to_string())?;
        recent_projects_menu
            .append(&empty)
            .map_err(|err| err.to_string())?;
        return Ok(());
    }

    for project in recent_projects {
        let item = MenuItem::with_id(
            app,
            format!("{RECENT_PROJECT_PREFIX}{}", project.project_id),
            project.name,
            true,
            None::<&str>,
        )
        .map_err(|err| err.to_string())?;
        recent_projects_menu
            .append(&item)
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn handle_recent_project_click(app: &tauri::AppHandle, project_id: &str) {
    let Ok(path) = project_ids::decode_discovered_project_id(project_id) else {
        eprintln!("[tray] failed to decode project id: {project_id}");
        return;
    };
    let Ok(project) = projects::touch_project_path(app, &path) else {
        eprintln!("[tray] failed to update recent project for path: {path}");
        return;
    };
    emit_tray_open(app, "project", Some(project.project_id));
}

fn emit_tray_open(app: &tauri::AppHandle, destination: &'static str, project_id: Option<String>) {
    if let Some(window) = focus_main_window(app) {
        let _ = window.emit(
            "tray-open",
            TrayOpenPayload {
                destination,
                project_id,
            },
        );
    }
}

fn focus_main_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    let window = app.get_webview_window("main")?;
    let _ = window.show();
    let _ = window.set_focus();
    Some(window)
}

fn open_system_terminal(path: &str) -> Result<(), String> {
    let command = build_system_terminal_command(path)?;
    let mut process = Command::new(command.command);
    process
        .args(command.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(cwd) = command.cwd {
        process.current_dir(cwd);
    }

    process
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("Failed to open system terminal: {err}"))
}

fn build_system_terminal_command(path: &str) -> Result<TerminalCommand, String> {
    if !std::path::Path::new(path).is_dir() {
        return Err(format!("Project path does not exist: {path}"));
    }

    if cfg!(target_os = "macos") {
        return Ok(TerminalCommand {
            command: "open",
            args: vec!["-a".to_string(), "Terminal".to_string(), path.to_string()],
            cwd: None,
        });
    }

	if cfg!(target_os = "windows") {
		return Ok(TerminalCommand {
            command: "cmd.exe",
            args: vec![
                "/c".to_string(),
                "start".to_string(),
                "cmd".to_string(),
                "/k".to_string(),
            ],
            cwd: Some(path.to_string()),
		});
	}

	match cached_linux_terminal_kind() {
		Some(LinuxTerminalKind::XTerminalEmulator) => Ok(TerminalCommand {
			command: "x-terminal-emulator",
			args: vec!["--working-directory".to_string(), path.to_string()],
			cwd: None,
		}),
		Some(LinuxTerminalKind::GnomeTerminal) => Ok(TerminalCommand {
			command: "gnome-terminal",
			args: vec![format!("--working-directory={path}")],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Konsole) => Ok(TerminalCommand {
			command: "konsole",
			args: vec!["--workdir".to_string(), path.to_string()],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Tilix) => Ok(TerminalCommand {
			command: "tilix",
			args: vec![format!("--working-directory={path}")],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Xfce4Terminal) => Ok(TerminalCommand {
			command: "xfce4-terminal",
			args: vec![format!("--working-directory={path}")],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Kitty) => Ok(TerminalCommand {
			command: "kitty",
			args: vec!["--directory".to_string(), path.to_string()],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Alacritty) => Ok(TerminalCommand {
			command: "alacritty",
			args: vec!["--working-directory".to_string(), path.to_string()],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Wezterm) => Ok(TerminalCommand {
			command: "wezterm",
			args: vec!["start".to_string(), "--cwd".to_string(), path.to_string()],
			cwd: Some(path.to_string()),
		}),
		Some(LinuxTerminalKind::Terminator) => Ok(TerminalCommand {
			command: "terminator",
			args: vec![format!("--working-directory={path}")],
			cwd: Some(path.to_string()),
		}),
		None => Err("No supported system terminal was found on PATH".to_string()),
	}
}

fn command_exists(command: &str) -> bool {
    let checker = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    Command::new(checker)
        .arg(command)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
		.status()
		.is_ok_and(|status| status.success())
}

fn system_terminal_supported() -> bool {
	if cfg!(target_os = "macos") || cfg!(target_os = "windows") {
		return true;
	}
	cached_linux_terminal_kind().is_some()
}

fn cached_linux_terminal_kind() -> Option<LinuxTerminalKind> {
	static LINUX_TERMINAL_KIND: OnceLock<Option<LinuxTerminalKind>> = OnceLock::new();
	*LINUX_TERMINAL_KIND.get_or_init(detect_linux_terminal_kind)
}

fn detect_linux_terminal_kind() -> Option<LinuxTerminalKind> {
	for candidate in [
		(LinuxTerminalKind::XTerminalEmulator, "x-terminal-emulator"),
		(LinuxTerminalKind::GnomeTerminal, "gnome-terminal"),
		(LinuxTerminalKind::Konsole, "konsole"),
		(LinuxTerminalKind::Tilix, "tilix"),
		(LinuxTerminalKind::Xfce4Terminal, "xfce4-terminal"),
		(LinuxTerminalKind::Kitty, "kitty"),
		(LinuxTerminalKind::Alacritty, "alacritty"),
		(LinuxTerminalKind::Wezterm, "wezterm"),
		(LinuxTerminalKind::Terminator, "terminator"),
	] {
		if command_exists(candidate.1) {
			return Some(candidate.0);
		}
	}
	None
}

#[cfg(test)]
mod tests {
    use super::build_system_terminal_command;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ck-tray-{name}-{unique}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    #[test]
    fn rejects_missing_terminal_paths() {
        let error = build_system_terminal_command("/tmp/ck-tray-missing")
            .expect_err("missing path should fail");
        assert!(error.contains("does not exist"));
    }

	#[test]
	fn builds_platform_terminal_command() {
		let dir = temp_dir("terminal");
		let result = build_system_terminal_command(&dir.to_string_lossy());

		#[cfg(target_os = "macos")]
		assert_eq!(result.expect("command should build").command, "open");
		#[cfg(target_os = "windows")]
		assert_eq!(result.expect("command should build").command, "cmd.exe");
		#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
		match result {
			Ok(command) => assert!(!command.command.is_empty(), "should resolve a Linux terminal"),
			Err(error) => assert!(
				error.contains("No supported system terminal was found on PATH"),
				"unexpected Linux terminal error: {error}",
			),
		}
	}
}
