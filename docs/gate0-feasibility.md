# Gate 0 — feasibility record

Status on 2026-10-14: **IN PROGRESS; exit criteria not met.** This is an evidence
matrix, not an advertised platform-support matrix. Public support claims remain
blocked by missing real-system tests. Checked source code and unit tests are not
substitutes for operating-system end-to-end results.

## Decisions implemented

- GNOME: **limited mode, without a required Shell extension**, as requested by the
  author. Record current text on opening/focus; do not promise all copies while
  hidden. The archived bridge is not activated or shipped as a requirement.
- Bundle identifier: **com.felipecepluki.tuck**, explicitly selected by the author.
  Legacy `com.felipecepluki.clipboard-manager` data is preserved. A bounded SQLite
  backup snapshots even committed WAL data, validates it, and publishes without
  overwriting existing new history. Text, favorites, categories and the capture
  boolean migrate. Webview-private storage (theme/opacity/cache) is not migrated.
  The actual development session has a migration marker in the new directory;
  no personal clipboard payload was read or logged to verify that marker.
- License: **MIT**, explicitly selected by the author after explaining commercial
  use and third-party redistribution. LICENSE plus Cargo/npm SPDX metadata added.
  Dependency notices are separate and remain required. The clipboard plugin's
  MIT notice is preserved in `docs/licenses/`.
- Personal feasibility version: **0.0.1**, aligned with ROADMAP. Executable/package
  name remains `clipboard-manager`; changing identifier does not rename the binary.
- Styling: Tailwind v4 and the requested command-bar stack were integrated into
  0.0.1 at the author's request. Production CSS compiles; oldest-supported native
  webview validation is still pending. No minimum OS/browser floor has
  been approved yet; that checklist item remains open.

## Current environment measurements

Fresh read-only probes outside the execution sandbox recorded:
Zorin OS 18.1, GNOME Shell 46.0, GTK 3.24.41, WebKitGTK 2.52.6,
Wayland client 1.22.0, XWayland 23.2.6, Bun 1.4.2, Rust 1.99.0.

- Wayland registry: `wl_data_device_manager v3`; neither ext-data-control nor
  wlr-data-control advertised on this connection.
- Portal Clipboard **v1 exists**. It does not create a standalone clipboard-manager
  session: access extends an authorized Remote Desktop/Input Capture session and
  can have further activity restrictions. Mere presence is not permission to watch
  every copy. No such session was created by the probe.
- GlobalShortcuts portal is **not exposed**. Reading its version returns the exact
  missing-interface failure, preserved in the report.
- The existing StatusNotifierWatcher is present, as is the notification service.
- Tool environment forces `GDK_BACKEND=x11`. The actual desktop session is Wayland;
  this is not proof of a real X11 session or of the production app's GTK backend.

Raw report: [GNOME capabilities](feasibility/gnome-2026-10-14.json).
The report reads no clipboard, database contents, user profiles or application
history. A sandbox connection denial is kept distinct from a missing capability.

A separate real native-Wayland WebKitGTK window tested CSS parsing/features in
2.52.6: oklch, color-mix, CSS.registerProperty, dialog, backdrop-filter and grid all
returned true. This proves only those features on this version; it does not prove
Tailwind stylesheet rendering, older engines or desktop-background blur.
[Feature report](feasibility/webkit-current-2026-10-14.json).

## Evidence matrix

| Environment | Real desktop window | Text read / copy-back | Hidden history | Source closure / owner lifetime | Global activation | Classification |
|---|---|---|---|---|---|---|
| Current GNOME 46 / Wayland session, app backend not yet recorded | Author screenshots confirm Tauri UI/tray | Author confirms opening capture, source → Tuck → destination and tray copy-back in requested Wayland round; exact backend/fidelity checks pending | Limited-mode design, not a continuous watcher | Copy survives Tuck quit: manual pass; source closure pending | Portal absent; no global binding; `--show` reopen test pending | Personal limited-mode candidate; no public support claim |
| Same GNOME, native Wayland test clients | Read-only registry + actual WebKit feature window completed | Author confirms source → Tuck → destination and tray copy-back with requested Wayland commands; actual backend type pending; earlier automated smoke timed out | Archived bridge result does not validate default app | Copy survives Tuck quit: manual pass; source closure pending | Pending | Manual copy-back, pause/resume and favorite reopen passed; other lifecycle checks pending |
| GNOME XWayland | Server/version and tool backend recorded | Current app's XWayland round-trip not isolated/recorded | Not assumed reliable | Pending | Pending | Unverified |
| Real X11 session | Unavailable on this host | Pending | Pending | Pending | Pending | Unverified; XWayland does not count as X11 |
| Another Wayland compositor (Hyprland/Sway/etc.) | Not installed/available here | Pending | Pending | Pending | Pending | Unverified; protocol presence will need its own tests |
| Windows | Author has a machine; packet prepared | Official Tauri-plugin adapter added, **not compiled or executed on Windows here** | Watcher not implemented | Pending user tests | Optional Win32 registration/conflict probe prepared; Tauri global shortcut not implemented | Test candidate only |
| macOS | No machine available | Same plugin adapter prepared, **not compiled or executed on macOS** | Watcher not implemented | Pending | Pending | Deferred verification; not certified support |

The first Gate checkbox is supported by the author's real desktop screenshots and
copy-to-list confirmation. Internal/browser copy tests cannot certify copying back
to another native application. The earlier nested native smoke timeout remains a
failed/incomplete attempt, not a passing result.

## Manual follow-up — 2026-10-14

The author reports successful startup of Tuck and both GTK fixture windows using
the three prescribed `GDK_BACKEND=wayland` commands. After first confirming direct
helper-to-helper copy/paste, the author also confirmed source → Tuck history →
Tuck copy → destination, and tray copy-back. These basic native copy paths passed
by manual author confirmation. Actual GDK display types, exact Unicode/whitespace
fidelity, Enter, feedback, source closure and activation remain individually pending.
The author subsequently confirmed pause/resume, favorite A surviving quit/reopen,
and successful destination paste after copying in Tuck and quitting it. These
three scoped manual tests passed; category/deletion persistence, remembered pause,
source closure and backend-crossing behavior were not included in that report.
This does not convert the earlier automated smoke timeout into a pass or certify
the complete lifecycle. See the
[manual record](feasibility/gnome-test.md#confirmação-recebida--2026-10-14).

## Reproducible next tests

Further manual tests are paused at the author's request. The 0.0.1 command bar is implemented; recorded tests remain available in the [GNOME procedure](feasibility/gnome-test.md). Windows execution is deferred at the author's request; its prepared packet and pending classification remain unchanged.

Capabilities (Linux, run from the real session):

```sh
python3 scripts/gate0-diagnostics.py --output gate0-environment.json
GDK_BACKEND=wayland python3 scripts/probe-webkit-css.py --output webkit-native.json
```

Do not interpret sandbox denial as absence of protocols. Run the probes with normal
session permissions; they do not install extensions or enable remote access.
The existing Wayland C probe also works independently as documented in the old
Linux feasibility notes.

Windows setup, read/write, source closure, quit ownership, persistence and
single-instance checks: [Windows packet](feasibility/windows-test.md).
The PowerShell inventory is read-only by default. Its opt-in hotkey probe creates
and immediately removes a transient Win32 binding; it does not install a shortcut
or claim app activation is verified.

Linux native versus XWayland procedure:

1. Use only disposable fixtures such as `TUCK-GATE0-A: ação ☕ 日本語`.
2. Run a GTK writer/client with `GDK_BACKEND=wayland` and repeat with
   `GDK_BACKEND=x11` on the same Wayland session. Record each backend explicitly.
3. Copy A from the client while Tuck is hidden, then B and C. Reopen Tuck. The
   limited GNOME design can retrieve the current offer, not the lost sequence.
4. Repeat read/write with the source still open, after source closure, and after
   Tuck itself quits. Record clipboard ownership separately from saved SQLite data.
5. Hide Tuck, execute `sh scripts/tuck-show.sh` (or the installed binary with
   `--show`), and verify the original window regains focus with a single instance.
   Existing single-instance forwarding already accepts this launcher invocation;
   a real-session fallback/focus test is still pending.
6. On a real X11 session and another Wayland compositor, rerun all steps plus
   capability reports. Do not apply GNOME's result to those environments.

Record OS/compositor/webview/app versions, backend, exact redacted failure and each
pass/fail/untested result. Never attach real clipboard history or raw databases.

## Webview / Tailwind gate

Tailwind v4 documents Chrome 111, Safari 16.4 and Firefox 128 as its core browser
floor. That does not map automatically to WebView2, WKWebView or WebKitGTK versions.
Tailwind is now installed for 0.0.1. Before claiming broad support, pick the oldest intended OS/webview for each platform
and render an actual compiled fixture on those native engines. Current WebKit
feature checks are an intermediate spike; the Gate item stays unchecked.

## Remaining blockers to exit

Windows results; macOS hardware/testing; a real X11 session; another Wayland
compositor; independent native/XWayland capture/lifetime results; app-level global
shortcut registration/conflict/focus checks; oldest-webview/Tailwind validation.
These require real environments or implementation spikes, not another license or
bundle-identifier decision. Do not mark Gate 0 closed from the current matrix.

## Primary references

- https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Clipboard.html
- https://tailwindcss.com/docs/compatibility
- https://v2.tauri.app/plugin/clipboard/
- https://v2.tauri.app/plugin/global-shortcut/
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey
- https://opensource.org/license/mit
- https://www.apache.org/licenses/LICENSE-2.0
