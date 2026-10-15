mod capture;
mod desktop;
mod migration;
#[cfg(all(feature = "native-smoke", debug_assertions, target_os = "linux"))]
mod smoke;
#[cfg(target_os = "linux")]
mod tray_clipboard;
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct SessionInfo {
    session: String,
    desktop: String,
    capture: String,
    activation: String,
    capture_on_focus: bool,
}

#[tauri::command]
fn session_info() -> SessionInfo {
    SessionInfo {
        session: std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| std::env::consts::OS.into()),
        desktop: std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_else(|_| std::env::consts::OS.into()),
        capture: if cfg!(target_os = "linux") { "No extension required. Saves the current clipboard when the window opens or regains focus. GNOME/Wayland does not capture every copy while hidden." } else { "Manual capture adapter. Background capture is not implemented on this platform yet." }.into(),
        capture_on_focus: cfg!(target_os = "linux"),
        activation: "In-window shortcuts enabled. Global shortcuts are not configured.".into(),
    }
}

const MAX_TEXT_BYTES: usize = 1024 * 1024;

fn validate_text(text: &str) -> Result<(), String> {
    if text.is_empty() {
        return Err("No text is available on the clipboard.".into());
    }
    if text.len() > MAX_TEXT_BYTES {
        return Err("Text exceeds the 1 MiB limit.".into());
    }
    Ok(())
}

// Feasibility adapter, using GTK's focused clipboard access on Linux.
// It is intentionally not a watcher and does not claim background capture.
#[tauri::command]
async fn probe_write_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    validate_text(&text)?;
    #[cfg(target_os = "linux")]
    {
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            let clipboard = gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD);
            clipboard.set_text(&text);
            // Remain alive to serve selection data; persistence after exit is not claimed.
            let _ = send.send(());
        })
        .map_err(|_| "Unable to access the desktop thread.".to_string())?;
        tauri::async_runtime::spawn_blocking(move || {
            receive
                .recv_timeout(std::time::Duration::from_secs(2))
                .map_err(|_| "Clipboard write timed out.".to_string())
        })
        .await
        .map_err(|_| "Clipboard write failed.".to_string())?
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        use tauri_plugin_clipboard_manager::ClipboardExt;
        tauri::async_runtime::spawn_blocking(move || {
            app.clipboard()
                .write_text(text)
                .map_err(|_| "Unable to write to the system clipboard.".to_string())
        })
        .await
        .map_err(|_| "Clipboard write unavailable.".to_string())?
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = (app, text);
        Err("This platform is not implemented yet.".into())
    }
}

#[tauri::command]
async fn probe_read_text(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD).request_text(move |_, text| {
                let result = match text {
                    Some(text) => validate_text(text).map(|_| text.to_owned()),
                    None => Err("No text is available on the clipboard.".into()),
                };
                let _ = send.send(result);
            });
        })
        .map_err(|_| "Unable to access the desktop thread.".to_string())?;
        let text = tauri::async_runtime::spawn_blocking(move || {
            receive
                .recv_timeout(std::time::Duration::from_secs(2))
                .map_err(|_| "Clipboard read timed out.".to_string())?
        })
        .await
        .map_err(|_| "Clipboard read failed.".to_string())??;
        use tauri::Emitter;
        let target = app.clone();
        let content = text.clone();
        tauri::async_runtime::spawn_blocking(move || {
            target.state::<capture::Service>().insert(content)
        })
        .await
        .map_err(|_| "History unavailable.")??;
        let _ = app.emit("capture-changed", ());
        Ok(text)
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        use tauri::Emitter;
        use tauri_plugin_clipboard_manager::ClipboardExt;
        let target = app.clone();
        let text = tauri::async_runtime::spawn_blocking(move || {
            let text = target
                .clipboard()
                .read_text()
                .map_err(|_| "No text is available on the system clipboard.")?;
            validate_text(&text)?;
            target.state::<capture::Service>().insert(text.clone())?;
            Ok::<_, String>(text)
        })
        .await
        .map_err(|_| "Clipboard read unavailable.")??;
        let _ = app.emit("capture-changed", ());
        Ok(text)
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = app;
        Err("This platform is not implemented yet.".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            desktop::show(app)
        }))
        .manage(capture::Service::default());
    #[cfg(target_os = "linux")]
    let builder = builder.manage(tray_clipboard::TrayClipboard::default());
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let builder = builder.plugin(tauri_plugin_clipboard_manager::init());
    builder
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700))?;
            }
            migration::migrate(&directory).map_err(std::io::Error::other)?;
            app.state::<capture::Service>()
                .open(&directory.join("history.sqlite3"))
                .map_err(std::io::Error::other)?;
            desktop::setup(app)?;
            #[cfg(all(feature = "native-smoke", debug_assertions, target_os = "linux"))]
            smoke::setup(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event
                && window
                    .app_handle()
                    .state::<capture::Service>()
                    .0
                    .lock()
                    .map(|state| state.tray_available)
                    .unwrap_or(false)
            {
                api.prevent_close();
                let _ = window.hide();
            }
            #[cfg(target_os = "linux")]
            if let tauri::WindowEvent::Focused(true) = event {
                capture::capture_focused(window.app_handle().clone());
            }
        })
        .invoke_handler(tauri::generate_handler![
            session_info,
            probe_write_text,
            probe_read_text,
            capture::captured_history,
            capture::set_capture_enabled,
            capture::delete_captured,
            capture::clear_captured,
            capture::pin_captured,
            capture::edit_category,
            capture::categorize_captured,
            desktop::configure_blur,
            desktop::check_updates,
            desktop::dismiss_history
        ])
        .build(tauri::generate_context!())
        .expect("error while building Tuck")
        .run(|app, event| {
            #[cfg(target_os = "linux")]
            if let tauri::RunEvent::Exit = event {
                app.state::<tray_clipboard::TrayClipboard>().shutdown();
            }
            #[cfg(not(target_os = "linux"))]
            let _ = (app, event);
        });
}
