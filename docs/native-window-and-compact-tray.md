# Native window and compact tray

The current sizing/copy interaction is documented in [Initial sizing and copy feedback](click-copy-and-feedback.md). It supersedes the fixed initial dimensions and 7 px control radii below.

Current design supersedes the frameless window documented in
`floating-window-and-tray.md`. Tauri now uses `decorations: true` and
`shadow: true`; the main window's width/height and minimum sizes are unchanged.
The custom drag handle and close button were removed. Moving and closing use the
native OS titlebar. Existing close-to-tray behavior is preserved. Background
opacity remains optional; the OS frame itself retains its native appearance.

The tray retains three recent items, Favorites, Open Clipboard, Preferences and
Quit. Pause/capture controls, About/update information remain reachable through
the app rather than expanding the top-level menu. Favorites shows up to five
quick entries plus access to all favorites.

The native menu width is determined by its desktop host, not a CSS width or the
positioner plugin. Preview labels use a shorter 28-unit budget, counting wide
Unicode glyphs and wide Latin letters as two units. Links use just their domain.
Truncation affects only the label: copying preserves the full original text/URL.
Fonts and vertical spacing of the native tray menu were not modified.

## Application appearance

The frontend stylesheet was consolidated: system UI font, 14 px baseline/content,
7 px corners, quieter lavender/neutral palette, balanced spacing, two-line item
previews and per-row Favorite/Category/Copy controls. Metadata remains secondary
at 12 px. The interface uses `user-select: none`, `outline: none` and default arrow
cursors. Text selection remains enabled in editable inputs for normal editing.
The native OS window frame is outside the webview and is absent from the browser
content preview screenshot below.

## Reference plugins

The references correspond to window-vibrancy and tauri-plugin-positioner.
window-vibrancy documents Linux blur as compositor-controlled and unsupported by
its stable API. Positioner moves custom app windows relative to tray positions;
it does not resize/style the existing native context menu. No extra plugin or
GNOME extension was installed. Existing Tauri effects/opacity controls remain
subject to platform support, with native blur disabled on GNOME.

Sources:
- https://github.com/tauri-apps/window-vibrancy
- https://v2.tauri.app/plugin/positioner/

## Validation

Frontend build, Rust build, Clippy and nine Rust tests passed. Tray-label tests
cover short domains for long URLs, Unicode boundaries and whitespace reduction.
The browser preview confirmed 14 px content text, default button cursor, no CSS
outline, non-selectable interface text, no horizontal overflow at 420 px, and
copying the correct synthetic row payload. Native menu width and titlebar display
must still be inspected in the user's running GNOME session after restarting;
the browser preview cannot validate those desktop-owned surfaces.

![Preview of the app content, without its native OS frame](native-window-content.jpg)
