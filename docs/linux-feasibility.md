> Historical notes. Current results and the no-extension GNOME decision are in [Gate 0](gate0-feasibility.md). The archived Shell bridge is not the default application.

# Linux feasibility — 2026-10-12

Observed development environment: Zorin / GNOME Shell 46.0, Wayland,
GTK 3.24.41, WebKitGTK 2.52.6, Bun 1.4.2, Rust 1.99.0.

## Capability probe

The read-only registry probe in `scripts/probe-wayland.c` reported:

```text
wl_data_device_manager v3
```

Neither `ext_data_control_manager_v1` nor `zwlr_data_control_manager_v1`
was advertised on this connection. D-Bus introspection of
`org.freedesktop.portal.Desktop` at `/org/freedesktop/portal/desktop`
did not expose `org.freedesktop.portal.GlobalShortcuts`.

These are observations of this session, not a universal GNOME support claim.
The standard data-device protocol does not grant unrestricted background
clipboard management. Installing wl-clipboard would not add a missing protocol.

## Prototype decision

- Start with explicitly labeled in-memory examples.
- Offer Linux GTK clipboard write and explicit, focused read commands for a
  manual feasibility test. Never read clipboard content on startup.
- No watcher, automatic collection, SQLite persistence, global shortcut,
  automatic paste, hide-on-close or single-instance forwarding yet.
- The GTK probe validates text after receiving it (1 MiB limit and timeout).
  It does not provide a bound on allocation inside GTK; it is a feasibility
  adapter, not the production capture service.
- Keep clipboard operations behind narrow Rust commands. Do not grant frontend
  shell, filesystem, SQL or unrestricted clipboard plugin APIs.
- Choose a maintained optional GNOME Shell extension bridge or explicitly
  limited GNOME support before implementing background capture on this session.
- Global activation needs a launcher/desktop shortcut fallback or a validated
  portal backend. No shortcut is registered by this prototype.

## Re-run capability checks

```sh
cc scripts/probe-wayland.c -o /tmp/clipboard-probe-wayland $(pkg-config --cflags --libs wayland-client)
/tmp/clipboard-probe-wayland
gdbus introspect --session --dest org.freedesktop.portal.Desktop --object-path /org/freedesktop/portal/desktop
```

Run from the actual desktop session. Sandbox denial is not proof of missing
protocols; this session was probed outside the sandbox. No clipboard content
was collected by the capability checks.

## Manual clipboard check

Run `bun run tauri dev`. Select a synthetic example, click **Copiar conteúdo**,
then paste in a disposable text editor. Return to the desktop app and click
**Capturar texto de teste**. It should select the existing matching example.
Then copy a different synthetic text in a native Wayland application, return
and capture manually. Test a native and an XWayland source independently.

Capture stays in memory only. Restarting restores examples. Closing quits the
prototype. Background capture, source-closure retention, cross-app paste and
activation must be recorded as separate tests; a focused read is not evidence
of background support.

## Verification recorded for this prototype

- Frontend production build and TypeScript check passed.
- Three search tests passed: accent normalization, word conjunction/favorite
  filtering, and preservation of multilingual content.
- Browser checks passed: search, keyboard selection, Ctrl+P pinning, Enter copy
  followed by Ctrl+V of the synthetic command, Delete and empty states,
  preferences/reset, and light/dark rendering.
- Rust `cargo check` and Clippy with `-D warnings` passed on Linux.
- Browser checks do not validate native GTK IPC, background capture, focus
  activation or persistence. The manual native procedure above remains separate.
- Native `cargo build --offline` passed. The built desktop executable was
  launched against the local development server without startup errors in
  its initial output. Native clipboard IPC remains a manual check; no personal
  clipboard was read automatically.
