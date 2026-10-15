> Archived optional integration prototype, not used by the default app as of
> 2026-10-14. Do not install it for the current no-extension workflow.
> See [current mode](../../docs/no-extension-and-tray.md).

# GNOME clipboard bridge

This is an original implementation based on GNOME/GJS APIs. No CopyQ or Maccy
source has been copied. The extension's own source is MIT-licensed in its
subdirectory; this does not select a license for the entire app.

Targets GNOME 46 only. Other versions must be tested before adding them to
metadata. It observes clipboard ownership changes through Meta.Selection,
checks capture state, reads supported text via St.Clipboard, and sends text by
an addressed method call to the app's unique D-Bus owner. It does not broadcast
clipboard text, persist data, use the network, or keep a clipboard history.

The Rust receiver accepts bridge calls only from the unique session-bus owner
of `org.gnome.Shell`. It validates payload size and capture epoch, deduplicates
exact content, and enforces 500 items / 16 MiB of in-memory payloads. Pinned
items are exempt from ordinary eviction; collection refuses an item if all
remaining items are pinned and the limit cannot be met. Same-user malware is
outside this boundary's protection.

Capture starts paused on every app launch. Without the extension, Linux also
supports a limited focused mode: enabling capture or focusing the app requests
the current GTK clipboard. This does not observe every copy made in the background. The extension does not read on
activation: after enabling capture, copy again. It skips recognized sensitive
hints and cancels pending requests on disable/lock. Hint detection is best-effort;
it does not identify every password. GJS/GTK may allocate before size validation,
so this remains an initial native adapter, not a hardened untrusted-source service.
Rapid changes may invalidate earlier in-flight reads; lossless burst capture
has not been established. Restarting the app clears history; no SQLite yet.

## Install / enable

The extension has been installed locally for this development session. GNOME
reported that it was not yet registered, which requires logging out and back in
on this Wayland session. Save your work first; the app never logs you out.

After signing back in:

```sh
gnome-extensions enable clipboard-capture@clipboard-manager.local
```

Reopen the freshly built desktop app. In Preferences turn on **Captura automática**.
Copy `https://maccy.app` again. It should appear in **Histórico**, with a blank search.
While waiting to reload GNOME, turn on **Captura automática** and return to the
app after copying. The status **Captura ao focar** identifies this limited mode.
**Capturar clipboard atual** remains available for a one-time explicit read.

To stop, turn capture off in the app, close the app, or run:

```sh
gnome-extensions disable clipboard-capture@clipboard-manager.local
```

To package a fresh installation, zip `metadata.json`, `extension.js` and `LICENSE`
at the archive root, then use `gnome-extensions install <archive.zip>`. Do not
replace or restart the running GNOME Shell in a Wayland session.

## Verification

Bun tests cover the original extension through API mocks: opt-in handshake,
private recipient, pause before clipboard read, lock/disable invalidation,
and sensitive-format hints. Rust tests cover deduplication, pin preservation,
size/count limits, and stale capture epochs. These do not replace a real session
capture check. Native GNOME test results are recorded separately below.

### Recorded result — 2026-10-12

- Seven Bun tests and four Rust tests passed; frontend build and Rust Clippy
  (`-D warnings`) passed.
- A nested GNOME 46 / Wayland session loaded the extension. A synthetic native
  Wayland GTK window copied `https://maccy.app`; the extension forwarded that
  exact text and the capture epoch to a private D-Bus fixture receiver.
- The initial nested attempts inherited `GDK_BACKEND=x11` from the tooling
  environment and did not exercise the isolated Wayland selection. The successful
  run explicitly set the fixture writer to `GDK_BACKEND=wayland` and the nested
  socket. No personal clipboard content was read by these tests.
- This verifies the extension against real GNOME APIs, separately from the Rust
  receiver tests. A complete capture-to-UI test in the user's normal session
  remains pending extension loading / re-login.
- Close older prototype windows before launching this build. Single-instance
  forwarding is not yet implemented, so only one desktop process should run
  when using the background bridge.
