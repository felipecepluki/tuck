# No-extension mode and tray decision — 2026-10-14

## Platform boundary

The official CopyQ documentation requires its GNOME Shell extension for native
GNOME/Wayland background capture. Its XWayland workaround is explicitly documented
as unreliable when hidden. A tray icon and choosing Tauri instead of Qt/Electron
do not change this permission model.

Source: https://copyq.readthedocs.io/en/latest/known-issues.html

The earlier extension prototype remains in `integrations/gnome/` as original
MIT-licensed research code, but is no longer connected to the default application.
No extension installation/activation is required by the current app.

Current GNOME mode records the clipboard **when the history window is opened or
focused**. It misses intermediate copies while hidden. This is explicitly labeled
“Registro ao abrir”. Capture is opt-in once; the boolean preference is saved. Clipboard history, favorites and categories
are now stored in local SQLite. Errors are shown in preferences.
GTK reads are retried after focus settles, with sensitive-format checks and a
bounded text-response timeout. Size checks happen after GTK allocation; production
hardening remains separate.

## Tray behavior

The app creates a Tauri tray entry when a host is present. In the observed Zorin
session `org.kde.StatusNotifierWatcher` is already available, so no new extension
is needed for the icon. Stock GNOME may lack a tray host; the launcher/window stays
usable there. Tray support does not imply background clipboard access.

- First launch shows the history window and an explicit activation action.
- Tray menu: recent items, favorites, open, preferences and quit. Capture controls are in preferences.
- Closing hides the window when a tray host is available; otherwise closing quits.
- Copying in the app keeps the window visible with a popup; tray copies use a native notification and can hide the app after success.
- Escape clears search first, then hides the window where tray access exists.
- Opening a second instance shows the existing window through the official
  single-instance plugin, avoiding independent histories.
- GNOME/Wayland global shortcut and arbitrary tray-anchored window positioning
  are not claimed. The launcher remains the fallback.

Source: https://v2.tauri.app/learn/system-tray/
Source: https://v2.tauri.app/plugin/single-instance/

## Video reference

The Rocketseat tutorial demonstrates a macOS upload widget, not a Linux clipboard
monitor. At 2:30 it describes tray usage; later it demonstrates a compact window,
native styling, macOS vibrancy and tray-relative positioning. Its author explicitly
states that the widget targets macOS. These are useful interaction references,
not evidence of background clipboard capture on GNOME. The older SystemTray API
shown there must be translated to Tauri 2's TrayIconBuilder APIs.

Source: https://www.youtube.com/watch?v=IN1zI7C8ER4&t=154s

## Product direction

Use a compact picker for frequently reused text: search, original-text preview,
favorites, clear capture state and quick return to the destination. Keep source
formatting intact and later add an explicit plain-text action. Prioritize reliable
capture, durable local storage, launcher/shortcut integration and measured resource
usage. The compact palette now includes one optional user category per item; AI,
cloud sync and complex organization remain deferred.

A v1 that requires zero GNOME extensions must advertise GNOME/Wayland as limited
mode, or target other validated platforms for continuous history. Bundling a
GNOME integration can remove a separate installation step, but still uses a Shell
extension at runtime and is a different product decision.

## Native verification harness

`native-smoke` is an opt-in Linux debug feature and is excluded from ordinary and
release builds. It writes only a synthetic fixture in an isolated desktop session,
activates capture via real Tauri IPC, and checks the rendered React history.
No personal clipboard contents are logged. Test settings use a disposable app data
directory. Production builds must omit this feature.

### Verification result

On 2026-10-14 the user confirmed that copied text now appears in the actual open
application. The local activation preference was also confirmed saved/enabled;
no clipboard payload was inspected by that check. Rust build, Clippy and frontend
build passed. Existing Rust history and Bun search/bridge tests passed (the bridge
suite covers the archived integration, not a dependency of the current app).

The automated native smoke attempt in a nested Wayland session timed out before
producing its verification result. It is not counted as a successful end-to-end
automated test. User confirmation establishes the real copy-to-list flow; tray
appearance and all hide/reopen paths still need separate actual-session checks.
Background collection on GNOME/Wayland is not claimed.

The new search palette and SQLite checks are documented in [Search palette](search-palette.md). The earlier nested smoke timeout remains a separate limitation.
