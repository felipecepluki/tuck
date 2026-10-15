> Research notes. The default app now uses an explicitly limited no-extension
> workflow; see [current decision](no-extension-and-tray.md).

# Capturing clipboard history

Research checked on 2026-10-12.

## What is actually available

There is no shared cross-platform API to retrieve a ready-made history of everything
copied before this app started. A clipboard manager normally observes changes to
the current selection, reads allowed formats, and maintains its own history.
Windows additionally exposes a system history API, subject to availability/settings;
that is a separate integration, not a portable backend.
Source: https://devblogs.microsoft.com/oldnewthing/20230302-00/?p=107889

Clipboard changes are the relevant signal. Listening for Ctrl+C/Ctrl+V misses menu
commands, context menus, and application-generated copies. A paste event does not
create a separate clipboard entry.

## Source findings

- Maccy uses `Timer.scheduledTimer` and compares `NSPasteboard.changeCount`, then
  reads supported pasteboard items, applies exclusions, and calls its new-copy
  hooks. The timer runs in native code, independently of the history UI.
  Source: https://github.com/p0deje/Maccy/blob/master/Maccy/Clipboard.swift
- CopyQ uses a separate clipboard monitor process and OS-specific adapters. Its
  official GNOME documentation states that a bundled GNOME Shell extension is
  required for monitoring there. This provides the concrete GNOME path needed
  by this project, rather than adding another GTK polling loop.
  Sources: https://copyq.readthedocs.io/en/latest/known-issues.html
  and https://github.com/hluk/CopyQ/blob/master/docs/source-code-overview.rst
- The project's official CopyQ repository links its website to
  https://hluk.github.io/CopyQ/ . The user-supplied https://copyq.net was also read,
  but its general compatibility claims differ from the official project docs;
  platform decisions here are based on the official sources above.
- Tauri's clipboard plugin exposes read/write/clear operations. It does not supply
  a history store or a native background monitoring service.
  Source: https://v2.tauri.app/plugin/clipboard/
- Windows can register a native window with `AddClipboardFormatListener` and
  receive `WM_CLIPBOARDUPDATE` notifications.
  Source: https://learn.microsoft.com/en-us/windows/win32/dataxchg/wm-clipboardupdate

## Implementation path for this app

| Environment | Adapter | History owner |
| --- | --- | --- |
| GNOME / Wayland | Optional GNOME Shell extension, observing clipboard changes and sending bounded text through a private local interface | Rust service / SQLite |
| Other Wayland compositors | Detect and use permitted ext-data-control or wlr-data-control | Rust service / SQLite |
| Linux / X11 | XFixes notifications and bounded selection reads | Rust service / SQLite |
| macOS | NSPasteboard change counter with bounded polling | Rust service / SQLite |
| Windows | Native change notifications with retries for busy clipboard | Rust service / SQLite |

The GNOME extension must be built and tested separately for supported GNOME versions,
with explicit enablement, pause, session lock handling, size limits and restricted
local communication. Do not copy GPL-licensed CopyQ implementation into this
project without a deliberate licensing decision. Use its architecture as reference.

After this research, an original GNOME 46 extension and Rust in-memory capture
service were implemented. The extension is installed locally but the current
GNOME session has not registered it yet. Capture is opt-in in the desktop app.
See [current setup and verification](../integrations/gnome/README.md).
Other platform adapters and SQLite persistence are not implemented.

## Interface revision

The main window is now a compact search/list picker: two history/favorite filters,
original text snippets and selection actions. Preview is an on-demand dialog
(double-click or Space in the list). Capture diagnostics, manual capture, appearance
and key hints live in preferences. The small “Exemplos” label keeps simulated data
explicit without a persistent explanatory banner.
