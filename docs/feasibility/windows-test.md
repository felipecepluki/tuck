# Gate 0 — Windows test packet

Status: prepared, not verified on Windows. No Windows support claim yet.
The user has a Windows machine available. The official Tauri clipboard plugin
2.5.0 now backs the existing Rust text commands on Windows/macOS; no frontend
clipboard-plugin permissions or browser extension are added. On Windows this is
an explicitly manual spike. A hidden watcher/global shortcut is not implemented.

## Prepare and run

Use a current WebView2 Runtime, Rust with the MSVC toolchain, Visual Studio C++
build tools and Bun. Official prerequisites:
https://v2.tauri.app/start/prerequisites/#windows

Transfer the project source and lockfiles, excluding `node_modules`, `dist`,
`src-tauri/target`, personal clipboard databases, caches and credentials. In a
PowerShell terminal at the project root:

```powershell
powershell -NoProfile -File scripts/gate0-windows.ps1
bun install --frozen-lockfile
bun run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
bun run tauri dev
```

The first command records OS/tool/runtime versions without accessing the clipboard.
An optional transient Win32 registration/conflict spike is available:

```powershell
powershell -NoProfile -File scripts/gate0-windows.ps1 -ProbeShortcut
```

It tries Ctrl+Alt+Shift+V, records registration/duplicate-registration errors and
unregisters both handles in a finally block. It does not override an occupied
binding, install a shortcut, process activation messages or certify Tauri's
shortcut plugin. Keep app-level activation/focus/conflict feedback pending.
If execution policy blocks the script, use the existing approved local execution
workflow or run its read-only commands interactively; do not disable protection
system-wide. Missing WebView2 registry/folder discovery does not certify absence.

## Synthetic end-to-end procedure

1. In Notepad type `TUCK-GATE0-A: ação ☕ 日本語`, select it, and copy it.
2. Open Tuck. Use **Capturar clipboard atual**, or the button in Preferences.
   Verify the exact string appears; source code/URL content must stay inert.
3. Click the item, then paste into a fresh Notepad document. Compare all characters.
4. Favorite it, assign a category, quit through the tray, restart and confirm both
   metadata and text persist. Delete only this synthetic test item afterward.
5. Copy `TUCK-GATE0-B`, close its source Notepad before capturing, then capture.
   Record whether it survives source closure separately from step 2.
6. Copy an item from Tuck, **quit** Tuck and paste elsewhere. Record whether the
   system still owns the text. This is different from SQLite retaining history.
7. Leave Tuck hidden. Copy A, then B, then C in Notepad. Reopen and record results.
   The current Windows spike has no watcher: mark hidden capture **not implemented**,
   not a pass because a manual read retrieves C. This is a release blocker until
   a native change listener/monitor is implemented and validated.
8. With Tuck running/hidden, run `src-tauri\target\debug\clipboard-manager.exe --show`.
   Verify the original window reopens and no second window/database writer exists.
9. Record focus behavior, DPI/monitor setup and exact errors (without clipboard
   payloads). No global shortcut is registered: registration/conflict/rebinding
   tests stay pending and cannot be inferred from internal hotkeys.

Return `gate0-windows-environment.json`, build result and pass/fail/untested for
each numbered step. Do not send your real clipboard history or database.

## Result template

```text
OS/build + WebView2:
App build/lockfile revision:
Read / write / round-trip Unicode:
Source closure:
Ownership after app quit:
Persistence / favorites / category:
--show / one instance / focus:
Hidden capture: not implemented
Global shortcut / conflict: not implemented
Notes (redacted):
```
