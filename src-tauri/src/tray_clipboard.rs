//! Tray-only writer: never shows, focuses or hides an application window.
//!
//! arboard's default Linux backend is X11 (Wayland data-control is not enabled).
//! On GNOME/Wayland this uses the existing XWayland clipboard bridge. It is not
//! a background history reader and cannot add a missing compositor capability.
use std::sync::Mutex;

#[derive(Default)]
pub struct TrayClipboard(Mutex<Option<arboard::Clipboard>>);

impl TrayClipboard {
    pub fn write(&self, text: String) -> Result<(), String> {
        crate::validate_text(&text)?;
        let mut writer = self.0.lock().map_err(|_| "Tray clipboard is busy.")?;
        if writer.is_none() {
            *writer = Some(arboard::Clipboard::new().map_err(
                |_| "Tray copying is unavailable in this session. Open Tuck to copy the item.",
            )?);
        }
        writer
            .as_mut()
            .ok_or("Tray clipboard unavailable.")?
            .set_text(text)
            .map_err(|_| "Unable to copy from the tray. Open Tuck and try again.".into())
    }

    pub fn shutdown(&self) {
        // Keep ownership while hidden; release explicitly at process exit so
        // arboard can hand off to an existing clipboard manager where available.
        if let Ok(mut writer) = self.0.lock() {
            writer.take();
        }
    }
}
