# Tray copying without opening the main window

The author reported on 2026-10-14 that copying from the tray briefly opened and
closed Tuck. The old Wayland path deliberately called show/focus, waited for focus,
wrote via GTK and hid the window after the notification. Failure or unavailable
notifications could also open the window. This changed window visibility despite
an action intended only to copy.

Tray copying now has an independent write path. On Linux it uses arboard 3.6.1's
X11 backend, with no Wayland data-control feature and no image feature enabled.
GNOME/Wayland uses its existing XWayland clipboard bridge; this is a write-only
adapter, not a hidden clipboard history reader. The persistent writer owns its
selection while Tuck is hidden and is explicitly dropped at app exit to allow
clipboard-manager handoff where available. No payload is read from the system
clipboard or logged by this adapter. MIT/Apache notices are preserved.

Windows/macOS keep their existing native write adapter. On every platform, success,
missing items, errors and unavailable notifications leave the main window's current
visibility/focus unchanged. This also avoids hiding a window the user opens while
an asynchronous tray write finishes. Feedback uses payload-free notification,
tray tooltip and the existing in-app event; a hidden window is never shown merely
to display feedback. Explicit Open, View all, Settings and launcher activation
still open the window normally.

Without a working X11/XWayland connection, the Linux tray writer reports failure
and asks the user to open Tuck themselves. It does not silently activate a window,
install an extension or promise clipboard bridging on every compositor. Capture
on opening/focus remains unchanged. Clipboard availability after process exit
still depends on a clipboard manager/compositor; the former GTK writer's manual
lifetime result is not evidence for this new adapter.

Verification: native compilation, existing Rust regression tests and Clippy.
No new real-session clipboard/tray or compositor-bridge test is claimed. The
visibility guarantee is enforced structurally: the tray-copy branch, its writer
and success/error feedback contain no window show/focus/hide call.

Primary API reference: [arboard Clipboard lifecycle](https://docs.rs/arboard/3.6.1/arboard/struct.Clipboard.html).
