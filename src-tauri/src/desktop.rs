use tauri::{
    Emitter, Listener, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
};

pub fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = app.emit("history-opened", ());
    }
}

fn initial_size(width: u32, height: u32, scale: f64) -> tauri::PhysicalSize<u32> {
    tauri::PhysicalSize::new(
        ((width as f64 * 0.9).round() as u32)
            .max((420.0 * scale) as u32)
            .min(width),
        ((height as f64 * 0.9).round() as u32)
            .max((380.0 * scale) as u32)
            .min(height),
    )
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.unmaximize()?;
        if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
            let area = monitor.work_area();
            let size = initial_size(area.size.width, area.size.height, monitor.scale_factor());
            window.set_min_size(Some(tauri::LogicalSize::new(
                420.0_f64.min(area.size.width as f64 / monitor.scale_factor()),
                380.0_f64.min(area.size.height as f64 / monitor.scale_factor()),
            )))?;
            window.set_size(size)?;
            // Wayland compositors decide placement; a failed centering request is harmless.
            let _ = window.center();
        }
        window.show()?;
        window.unmaximize()?;
        #[cfg(target_os = "linux")]
        {
            // Reassert once after mapping: Mutter may auto-maximize large new windows.
            let target = window.clone();
            gtk::glib::timeout_add_local_once(std::time::Duration::from_millis(250), move || {
                if let Ok(Some(monitor)) = target.current_monitor() {
                    let area = monitor.work_area();
                    let _ = target.unmaximize();
                    let _ = target.set_size(initial_size(
                        area.size.width,
                        area.size.height,
                        monitor.scale_factor(),
                    ));
                }
            });
        }
    }
    let directory = app.path().app_data_dir()?;
    let enabled = std::fs::read_to_string(directory.join("capture-preference.json"))
        .ok()
        .as_deref()
        == Some("true");
    if let Ok(mut state) = app.state::<crate::capture::Service>().0.lock() {
        state.enabled = enabled;
    }
    // GNOME requires a tray host; Zorin already provides one. Keep the window
    // reachable and let close quit when no host exists.
    #[cfg(target_os = "linux")]
    let host_available = {
        use gtk::{gio, glib::variant::ToVariant};
        gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE)
            .ok()
            .and_then(|connection| {
                connection
                    .call_sync(
                        Some("org.freedesktop.DBus"),
                        "/org/freedesktop/DBus",
                        "org.freedesktop.DBus",
                        "NameHasOwner",
                        Some(&("org.kde.StatusNotifierWatcher",).to_variant()),
                        None,
                        gio::DBusCallFlags::NONE,
                        500,
                        gio::Cancellable::NONE,
                    )
                    .ok()
            })
            .and_then(|value| value.get::<(bool,)>())
            .map(|value| value.0)
            .unwrap_or(false)
    };
    #[cfg(not(target_os = "linux"))]
    let host_available = true;
    if !host_available {
        return Ok(());
    }
    let state = app
        .state::<crate::capture::Service>()
        .0
        .lock()
        .map_err(|_| tauri::Error::Anyhow(std::io::Error::other("History unavailable").into()))?
        .clone();
    app.manage(TrayRevision(std::sync::Mutex::new(state.revision)));
    let menu = build_menu(app.handle(), &state)?;
    let mut builder = TrayIconBuilder::with_id("clipboard-tray")
        .tooltip("Tuck")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let action = event.id.as_ref();
            match action {
                "show" => show(app),
                "favorites" | "settings" | "updates" | "about" => {
                    show(app);
                    let _ = app.emit("desktop-action", action);
                }
                "toggle-capture" => {
                    let target = app.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        let enabled = target
                            .state::<crate::capture::Service>()
                            .0
                            .lock()
                            .map(|state| state.enabled)
                            .unwrap_or(false);
                        if crate::capture::set_capture_enabled(
                            target.clone(),
                            target.state(),
                            !enabled,
                        )
                        .is_err()
                        {
                            crate::capture::report_capture(
                                &target,
                                Some("Unable to change capture from the tray."),
                            );
                        }
                    });
                }
                "quit" => app.exit(0),
                action if action.starts_with("copy:") => {
                    let id = action
                        .strip_prefix("copy:")
                        .and_then(|value| value.split_once(':'))
                        .map(|(_, id)| id)
                        .unwrap_or_default()
                        .to_owned();
                    let target = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let lookup = target.clone();
                        let text = tauri::async_runtime::spawn_blocking(move || {
                            lookup
                                .state::<crate::capture::Service>()
                                .0
                                .lock()
                                .ok()
                                .and_then(|state| {
                                    state
                                        .items
                                        .iter()
                                        .find(|clip| clip.id == id)
                                        .map(|clip| clip.content.clone())
                                })
                        })
                        .await
                        .ok()
                        .flatten();
                        let result = match text {
                            Some(text) => write_tray_text(target.clone(), text).await,
                            None => Err("This item is no longer in your history.".into()),
                        };
                        tray_copy_feedback(&target, result).await;
                    });
                }
                _ => {}
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    if builder.build(app).is_ok()
        && let Ok(mut state) = app.state::<crate::capture::Service>().0.lock()
    {
        state.tray_available = true;
    }
    let target = app.handle().clone();
    app.listen("capture-changed", move |_| refresh_tray(&target));
    Ok(())
}

struct TrayRevision(std::sync::Mutex<u64>);

fn preview_label(text: &str) -> String {
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    // Preserve the literal beginning, including a URL scheme/path.
    let display = compact.as_str();
    let mut label = String::new();
    let mut width = 0;
    for character in display.chars() {
        // Bound wide Unicode glyphs too; the native menu sizes itself to its labels.
        let units = if character as u32 >= 0x1100 || matches!(character, 'W' | 'M' | 'w' | 'm') {
            2
        } else {
            1
        };
        if width + units > 28 {
            label.push('…');
            break;
        }
        width += units;
        label.push(character);
    }
    if label.is_empty() {
        label = "Blank text".into();
    }
    label
}
fn build_menu(
    app: &tauri::AppHandle,
    state: &crate::capture::Snapshot,
) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(
        app,
        "recent-label",
        "Recent",
        false,
        None::<&str>,
    )?)?;
    for clip in state.items.iter().take(3) {
        menu.append(&MenuItem::with_id(
            app,
            format!("copy:recent:{}", clip.id),
            preview_label(&clip.content),
            true,
            None::<&str>,
        )?)?;
    }
    if state.items.is_empty() {
        menu.append(&MenuItem::with_id(
            app,
            "empty",
            "No saved items",
            false,
            None::<&str>,
        )?)?;
    }
    let favorites = Submenu::new(app, "Pinned", true)?;
    let pinned: Vec<_> = state.items.iter().filter(|clip| clip.pinned).collect();
    for clip in pinned.iter().take(5) {
        favorites.append(&MenuItem::with_id(
            app,
            format!("copy:favorite:{}", clip.id),
            preview_label(&clip.content),
            true,
            None::<&str>,
        )?)?;
    }
    if pinned.is_empty() {
        favorites.append(&MenuItem::with_id(
            app,
            "no-favorites",
            "No pinned items",
            false,
            None::<&str>,
        )?)?;
    }
    favorites.append(&PredefinedMenuItem::separator(app)?)?;
    favorites.append(&MenuItem::with_id(
        app,
        "favorites",
        "View all…",
        true,
        None::<&str>,
    )?)?;
    menu.append(&favorites)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    for (id, label) in [
        ("show", "Open Tuck"),
        ("settings", "Settings…"),
        ("quit", "Quit"),
    ] {
        menu.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
    }
    Ok(menu)
}
fn refresh_tray(app: &tauri::AppHandle) {
    let target = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let snapshot = target
            .state::<crate::capture::Service>()
            .0
            .lock()
            .ok()
            .map(|state| state.clone());
        if let Some(snapshot) = snapshot {
            let owner = target.clone();
            let _ = target.run_on_main_thread(move || {
                let revision = owner.state::<TrayRevision>();
                let Ok(mut revision) = revision.0.lock() else {
                    return;
                };
                if snapshot.revision < *revision {
                    return;
                }
                if let Some(tray) = owner.tray_by_id("clipboard-tray")
                    && let Ok(menu) = build_menu(&owner, &snapshot)
                    && tray.set_menu(Some(menu)).is_ok()
                {
                    *revision = snapshot.revision;
                }
            });
        }
    });
}

async fn write_tray_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            app.state::<crate::tray_clipboard::TrayClipboard>()
                .write(text)
        })
        .await
        .map_err(|_| "Tray clipboard writer unavailable.")?
    }
    #[cfg(not(target_os = "linux"))]
    {
        crate::probe_write_text(app, text).await
    }
}

async fn tray_copy_feedback(app: &tauri::AppHandle, result: Result<(), String>) {
    // Success, errors and missing notification services must all leave window
    // visibility/focus unchanged, including a window the user opens meanwhile.
    let success = result.is_ok();
    let event = if success {
        "copy-success"
    } else {
        "copy-error"
    };
    let _ = app.emit("desktop-action", event);
    if let Some(tray) = app.tray_by_id("clipboard-tray") {
        let _ = tray.set_tooltip(Some(if success {
            "Tuck — Copied. Ready to paste."
        } else {
            "Tuck — Unable to copy. Open Tuck to retry."
        }));
    }
    let target = app.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || notify_tray_copy(&target, success)).await;
}

#[cfg(target_os = "linux")]
fn copy_notification_parameters() -> gtk::glib::Variant {
    use gtk::glib::{self, variant::ToVariant};
    let hints = std::collections::HashMap::<String, glib::Variant>::new();
    (
        "Tuck",
        0u32,
        "edit-copy",
        "Copied",
        "Ready to paste.",
        Vec::<String>::new(),
        hints,
        2500i32,
    )
        .to_variant()
}

fn notify_tray_copy(app: &tauri::AppHandle, success: bool) -> bool {
    #[cfg(target_os = "linux")]
    {
        use gtk::gio;
        let _ = app;
        let parameters = if success {
            copy_notification_parameters()
        } else {
            use gtk::glib::variant::ToVariant;
            (
                "Tuck",
                0u32,
                "edit-copy",
                "Unable to copy",
                "Open Tuck to copy the item. The window was kept unchanged.",
                Vec::<String>::new(),
                std::collections::HashMap::<String, gtk::glib::Variant>::new(),
                4500i32,
            )
                .to_variant()
        };
        gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE)
            .ok()
            .and_then(|connection| {
                connection
                    .call_sync(
                        Some("org.freedesktop.Notifications"),
                        "/org/freedesktop/Notifications",
                        "org.freedesktop.Notifications",
                        "Notify",
                        Some(&parameters),
                        None,
                        gio::DBusCallFlags::NONE,
                        1000,
                        gio::Cancellable::NONE,
                    )
                    .ok()
            })
            .is_some()
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, success);
        false
    }
}

#[derive(serde::Serialize)]
pub struct EffectStatus {
    pub supported: bool,
    pub applied: bool,
    pub message: String,
}
#[tauri::command]
pub fn configure_blur(app: tauri::AppHandle, enabled: bool) -> Result<EffectStatus, String> {
    #[cfg(target_os = "linux")]
    {
        let _ = (app, enabled);
        Ok(EffectStatus {
            supported: false,
            applied: false,
            message:
                "This Linux session supports transparency, but Tauri does not provide native background blur."
                    .into(),
        })
    }
    #[cfg(not(target_os = "linux"))]
    {
        use tauri::window::{Effect, EffectsBuilder};
        let window = app
            .get_webview_window("main")
            .ok_or("Window unavailable.")?;
        #[cfg(target_os = "macos")]
        let effect = Effect::Popover;
        #[cfg(target_os = "windows")]
        let effect = Effect::Blur;
        let result = if enabled {
            window.set_effects(EffectsBuilder::new().effect(effect).build())
        } else {
            window.set_effects(None)
        };
        result.map_err(|_| "The system could not apply the background effect.")?;
        Ok(EffectStatus {
            supported: true,
            applied: enabled,
            message: "Native blur strength is controlled by the operating system.".into(),
        })
    }
}
#[tauri::command]
pub fn check_updates() -> String {
    "Updates are not configured yet: no signed release server has been set up.".into()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn startup_size_tracks_work_area_and_scale_without_exceeding_screen() {
        assert_eq!(
            initial_size(1920, 1080, 1.0),
            tauri::PhysicalSize::new(1728, 972)
        );
        assert_eq!(
            initial_size(3840, 2160, 2.0),
            tauri::PhysicalSize::new(3456, 1944)
        );
        let small = initial_size(400, 300, 1.0);
        assert_eq!(small, tauri::PhysicalSize::new(400, 300));
    }
    #[cfg(target_os = "linux")]
    #[test]
    fn copy_notification_matches_freedesktop_notify_signature() {
        assert_eq!(
            copy_notification_parameters().type_().as_str(),
            "(susssasa{sv}i)"
        );
    }
    #[test]
    fn tray_preview_is_bounded_unicode_safe_and_single_line() {
        assert_eq!(preview_label("  Ação\n 日本語\t☕ "), "Ação 日本語 ☕");
        assert_eq!(preview_label(&"é".repeat(60)).chars().count(), 29);
        let original = "https://macmagazine.com.br/wp-content/uploads/a-very-long-file";
        let label = preview_label(original);
        assert!(label.starts_with("https://"));
        assert!(original.starts_with(label.strip_suffix('…').unwrap()));
        assert!(preview_label(&"日本語".repeat(20)).chars().count() <= 15);
        assert_eq!(preview_label("  "), "Blank text");
    }
}

#[tauri::command]
pub fn dismiss_history(app: tauri::AppHandle) {
    if app
        .state::<crate::capture::Service>()
        .0
        .lock()
        .map(|state| state.tray_available)
        .unwrap_or(false)
        && let Some(window) = app.get_webview_window("main")
    {
        let _ = window.hide();
    }
}
