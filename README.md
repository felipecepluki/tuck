# Tuck

> Copy it. Tuck it. Find it.

A local-first clipboard manager targeting Windows, Linux and macOS, designed for fast, elegant, keyboard-first desktop use. One command bar: open it, search, pick, paste.

**Status:** early development (0.0.1 feasibility build). This document is the project specification and implementation plan, plus a description of the current prototype. Features below are planned unless explicitly marked complete. No release, verified platform support, or benchmark result is claimed here. See [ROADMAP.md](ROADMAP.md) for the order of work and [Gate 0 evidence](docs/gate0-feasibility.md) for actual platform status.

**Name:** Tuck is the project name. The repository and executable/package name may still say `clipboard-manager`; the selected bundle identifier is `com.felipecepluki.tuck`. The first launch migrates legacy SQLite history from `com.felipecepluki.clipboard-manager` without deleting the original.

Built around **Tauri 2, React, TypeScript, Rust, Bun, and SQLite**, with Linux, Windows, and macOS as target platforms. Linux support is tracked by desktop session and compositor (for example GNOME/Wayland, Hyprland, X11), not by a single "Linux supported" badge.

## Current prototype

The 0.0.1 desktop app now uses an English-only cmdk search workspace with a responsive sidebar and the native OS frame, pinned-first results, TanStack Virtual rows, Query-backed history/mutations, HeroUI shortcut hints, bundled Geist and Tailwind 4. Search, favorites, user categories, adjustable opacity and the accepted compact tray remain available. Secondary actions are available from each row’s three-dot menu and `Ctrl+K`; filters/categories live in the responsive sidebar. The official shadcn/ui Base UI sidebar-01, button groups, dropdown menus, dialogs, tabs, cards, switches, sliders, selects and inputs are integrated. Text history is bounded and **SQLite-backed**. The current GNOME/Wayland mode requires no clipboard extension and is explicitly limited: it records the clipboard when the app window opens or regains focus, not every copy while hidden. One-time capture activation is remembered across launches.

Closing hides the window if a tray host is available; **Quit** exits the app. History, favorites and categories survive quitting. Copying from the tray leaves window visibility and focus unchanged; Linux uses a persistent X11 clipboard writer (through the existing XWayland bridge on GNOME/Wayland), with notification/tooltip feedback. If that backend is unavailable, report the error without opening the window. See [tray-copy fix](docs/tray-copy-without-window.md). The launcher/window remains available if the desktop has no tray host. Continuous capture on other platforms, global shortcuts and automatic paste remain planned. The browser preview uses explicitly labeled synthetic examples.

The command-bar redesign is implemented for 0.0.1. Existing history and categories remain usable through filters and actions; content is preserved exactly rather than translated. Interface labels, tray labels, native errors and copy notifications are in English. Settings includes clear-unpinned/clear-all with confirmation. Read [implementation notes](docs/command-bar-0.0.1.md).

Implementation audit on **2026-10-14**:

| Area | Implemented now | Still pending |
| --- | --- | --- |
| Text storage | SQLite transactions, exact-payload deduplication, persistent favorites/categories, individual/bulk deletion, legacy identifier migration | Configurable retention, age expiry, attachment storage |
| Limits | 500 **total** items, 1 MiB per text, 16 MiB total text payload; favorites protected from eviction, new captures rejected if favorites fill the ceiling | Proposed unpinned-item policy and configurable limits |
| Capture | Opt-in opening/focus capture on Linux; pause/resume preference saved | Hidden capture adapters; real Windows/macOS validation (their adapter is currently manual) |
| Interaction | cmdk bar, React search, Virtual rows, arrows/Enter, click-to-copy, actions, copy popup, visible focus | SQLite search/paging, full screen-reader audit |
| Desktop | Native window frame, requested 90% work-area initial sizing, compact tray with three recent items and favorites, single-instance forwarding | Real-session activation/focus/lifetime tests, configurable global shortcut, autostart |
| Tooling | Bun model tests, Rust/SQLite tests, typecheck/build, rustfmt/Clippy commands | Component/desktop suites, Biome, dependency-audit policy and CI |

Implemented means present in the prototype, not certified across platforms. The [Gate 0 record](docs/gate0-feasibility.md) distinguishes author confirmation, synthetic tests, failed attempts and pending native tests. No updater endpoint is configured; the settings button reports that state.

Run `bun install --frozen-lockfile`, then `bun run tauri dev` for the desktop app, or `bun run dev` for the browser demo. Internal shortcuts use TanStack Hotkeys; OS-wide activation is separate.

Historical implementation notes (each describes its own iteration, not the target design): [Search palette and local storage](docs/search-palette.md), [Native window and compact tray](docs/native-window-and-compact-tray.md), [Initial sizing, click to copy and feedback](docs/click-copy-and-feedback.md), [No-extension mode and tray](docs/no-extension-and-tray.md). Research: [Capturing clipboard history](docs/clipboard-capture.md).

## Why Tuck exists

Copying something should not mean losing what you copied a moment earlier. Tuck makes recent clipboard content, including screenshots, easy to find and reuse without an account, a cloud service, or a heavyweight interface.

The intended experience: copy normally, open the bar with a shortcut or from the tray, type to search, navigate with the arrow keys, press `Enter`, and carry on.

### Product principles

- **Local-first:** capture, storage, search and reuse work offline. No account, no telemetry.
- **Fast by measurement:** optimize activation latency, search latency, memory, CPU and wakeups using real desktop builds.
- **Keyboard complete:** every essential action is available without a pointer.
- **Simple and calm:** only what helps *open, find, paste* is on screen; everything else lives behind `Ctrl+K`. Clear typography, visible focus, restrained motion.
- **Privacy controls first:** collection is visible, pausable, bounded and removable.
- **Optional, open AI:** off by default; local models or your own API key; nothing leaves the machine without you knowing.
- **Honest platform support:** restrictions and degraded modes are part of the product experience.
- **Small maintenance surface:** add dependencies for a concrete need and keep OS-specific behavior behind narrow interfaces.

### Scope

**First useful release (text):** capture, deduplication, local persistence, search, copy-back, pinning, individual deletion, clear history, pause/resume, retention settings, and configurable activation where supported.

**Planned next, in this order:**

- Images and screenshots: thumbnails, deduplication, storage limits, a watched screenshots folder, and local OCR so screenshots can be found by their text.
- Smart item types (links, colors, JSON, code) with context-aware actions, and a paste stack.
- A CLI and an opt-in MCP server so scripts and AI agents can read clipboard history with your permission.
- Local semantic search and "paste as..." actions, using local models or your own API key.

**Outside the plan for now:** accounts, cloud sync, mobile apps, team collaboration, plugin scripting. Optional end-to-end encrypted sync may be considered after 1.0.

## Design direction

- **Search-first workspace** opened by a global shortcut (or the tray/launcher): search field on top, results below, with a quiet Notion-inspired sidebar for views and collections (requested by the author on 2026-10-14). The animated sidebar can close completely; compact windows use the shadcn Sheet drawer. No history tabs; each row has a discreet three-dot action group. Keep the native OS window frame requested for the current app; custom chrome is not a prerequisite for this redesign.
- **Rows** show the content and time; the selected row shows `Enter`. Images get a thumbnail, sensitive items are masked. Actions (copy, pin, preview, move to a collection, delete) are available through the three-dot menu and `Ctrl+K`. Type-specific transformations remain planned.
- **Tray as status indicator:** a short menu (Recent, Favorites, Open, Preferences, Quit); the icon shows paused state, paste-stack count and copy confirmation.
- **Look:** dark and calm, semantic tokens for background, surface, text, accent, border, danger and focus; Geist as a bundled font (no remote fonts); 18 px radius for app-owned surfaces, roughly 44 px single-line rows with room for larger text, and 120 to 150 ms transitions that respect reduced motion. Native frame corners remain OS-controlled. Prioritize the dark design; retain the existing light-theme preference, with full light-theme polish deferred until after 1.0.
- **Focus and text:** replace the prototype's blanket `outline: none` with a visible focus treatment. Prevent accidental selection on chrome, but allow selection/editing in search, settings inputs and a full-text preview.
- **Accessibility acceptance:** all essential actions by keyboard, visible focus, WCAG AA contrast, capture state conveyed by text and not color alone, listbox semantics, virtualization that preserves position/count information, and testing with NVDA, VoiceOver and Orca on supported combinations.

## Platform feasibility comes first

**Tauri provides an application shell; it does not remove operating-system restrictions.** A clipboard read/write API is not a complete background history watcher, and a clipboard write is not automatic paste into another application. The official [clipboard plugin](https://v2.tauri.app/plugin/clipboard/) exposes clipboard operations; monitoring remains a separate architecture decision.

The matrix describes intended strategies and risks, not tested support.

| Environment | Capture strategy to validate | Activation strategy to validate | Important limitation |
| --- | --- | --- | --- |
| Windows | Native clipboard change notifications; bounded retries when access is busy | Tauri global shortcut backend | Elevated apps and secure desktops limit automation; avoid reserved OS shortcuts |
| macOS | `NSPasteboard.changeCount` checks with measured, bounded polling | Tauri global shortcut backend | Paste automation may need Accessibility permission; test per macOS version |
| Linux X11 | XFixes selection notifications plus clipboard reads | Tauri global shortcut backend | Selection ownership, source lifetime and competing managers need testing |
| Linux Wayland, data-control available (for example wlroots-style compositors such as Hyprland) | Native data-control adapter, or a supervised helper during feasibility work | Compositor keybinding that runs a `--show` command, or the GlobalShortcuts portal | Availability depends on compositor and version; validate on the real session |
| GNOME/Wayland | Dedicated feasibility gate for actual Mutter/GNOME versions; consider a separately maintained Shell extension bridge only if necessary | Detect portal support; launcher/desktop shortcut fallback | Unrestricted background history must not be assumed; focused clipboard access is not background capture |

Omarchy already ships its own clipboard history (`Super + Ctrl + V` in its manual), so on Omarchy Tuck should use a different shortcut.

### Wayland and GNOME

The ordinary Wayland clipboard model does not grant every background application unrestricted access. The [ext-data-control protocol](https://wayland.app/protocols/ext-data-control-v1) describes privileged clipboard management. Detect the actual protocol and policy in the running session; do not infer them only from `XDG_SESSION_TYPE` or desktop names.

The default Linux backend of [arboard](https://docs.rs/crate/arboard/latest) uses X11; Wayland data-control support is feature-gated. That does not prove the official Tauri plugin enables it or that the compositor permits it, so inspect the resolved dependency configuration and test the adapter. [wl-clipboard](https://github.com/bugaevc/wl-clipboard/releases) includes ext-data-control support, but it cannot make a missing compositor protocol appear; a helper is useful for a spike, not a universal fix.

For GNOME/Wayland, test capture while the app is hidden, unfocused, and after the source application closes. If no suitable mechanism exists, choose explicitly: a clearly labeled limited mode (the current one), an optional GNOME Shell extension bridge with a constrained local interface and a version-compatibility policy, or publish the environment as unsupported for background capture. Do not claim XWayland observes every native Wayland copy, and do not require users to switch to an X11 session.

### Global shortcuts, focus, tray and paste

The backend used by Tauri's [global shortcut plugin](https://v2.tauri.app/plugin/global-shortcut/) documents **Linux X11 only** ([global-hotkey](https://github.com/tauri-apps/global-hotkey)). Native Wayland needs a separate path: the [GlobalShortcuts portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html) where available, otherwise a desktop-configured launcher shortcut. Provide a single-instance `--show` activation path: a second process forwards the request and exits. On Wayland, showing a window does not guarantee focus or placement.

A tray entry is optional convenience. GNOME may not display traditional tray icons without extra integration, so the app must stay reachable from its launcher and activation path ([Tauri system tray](https://v2.tauri.app/learn/system-tray/)). Closing, hiding and quitting must have distinct, documented behavior.

**MVP action: copy the selected item to the system clipboard.** Users paste with the destination application's normal paste action. Automatic paste (`Enter` pastes into the previous app) is an opt-in, per-platform feature with a copy-only fallback: Windows [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput) is subject to integrity restrictions, and macOS and Wayland need their own permission paths. Never request administrator/root privileges to work around this.

### Keyboard (proposed, not implemented guarantees)

| Action | Binding | Scope |
| --- | --- | --- |
| Show the bar | `Ctrl+Shift+V` / `Cmd+Shift+V`, configurable | Global where supported; may conflict with "paste as plain text", so detect conflicts. Avoid `Win+V` |
| Search | Just type | Search field is focused on open |
| Navigate | Up / Down | Preserve normal text editing in the search field |
| Copy selected (paste where supported) | Enter | Selection |
| Actions panel | `Ctrl+K` / `Cmd+K` | Selection |
| Pin / unpin | `Ctrl+P` / `Cmd+P` | Selection |
| Delete | Delete | Selection only, never while typing |
| Close panel, then hide | Escape | Innermost surface first |
| Settings | `Ctrl+,` / `Cmd+,` | App window |

Handle registration failure visibly, offer rebinding and reset, and handle keyboard layouts, IME composition and key repeat deliberately.

## Technology decisions

Target stack, not a list of dependencies already installed. Validate compatibility, licenses and maintenance before adding a dependency; commit lockfiles.

**Installed:** Tauri 2, React 19, TypeScript, Vite, Bun, Rust, rusqlite, arboard (Linux tray writer), Lucide, TanStack Hotkeys/Query/Virtual, cmdk, Tailwind 4 with the Vite plugin, bundled Geist and HeroUI 3 Kbd; single-instance and the Windows/macOS clipboard test plugin. `plugin-opener` is present in the scaffold but unused; review removal before distribution.

**Current UI:** cmdk, Tailwind, Geist, Query, Virtual and HeroUI Kbd are integrated. History uses compact text-only rows; official shadcn/ui components provide the sidebar, row actions, dialogs and settings controls. Older native webview compatibility remains unverified. **Formatting:** Biome is configured with `format`/`format:check`; lint rules are not enabled yet. **Later tooling:** Vitest/Testing Library, WebdriverIO, audit/deny and CI. None of these planned dependencies should be treated as configured checks yet.

| Area | Choice | Reason and boundary |
| --- | --- | --- |
| Desktop shell | Tauri 2, `@tauri-apps/api`, `@tauri-apps/cli` | System webview and Rust integration; resource savings still require measurement |
| UI | React + TypeScript, Vite | Fast iteration on a polished interface; static client bundle |
| Tooling | Bun | Package management and scripts; not an embedded runtime |
| Native core | Rust | Clipboard adapters, persistence, lifecycle, permissions, background work |
| Styling | Tailwind CSS v4 + `@tailwindcss/vite` | Shared design tokens; verify target webview compatibility |
| Command bar | [`cmdk`](https://github.com/dip/cmdk) (the base of shadcn/ui's Command) | Input, list and keyboard navigation; Native SQLite search is the target; 0.0.1 uses bounded React filtering |
| Components | A small, consistent shadcn/ui selection | Owned source for dialogs, menus, switches and inputs; [Attachment](https://ui.shadcn.com/docs/components/base/attachment) is the visual reference for item media, content and metadata |
| Shortcut hints | [HeroUI Kbd](https://heroui.com/en/docs/react/components/kbd) | Actual Kbd component, styled to Tuck tokens; display only, not shortcut registration |
| Icons and font | [`lucide-react`](https://lucide.dev/guide/react/); [Geist](https://fontsource.org/fonts/geist) via `@fontsource-variable/geist` | Individual icon imports; bundled font, no remote assets |
| Async data | [`@tanstack/react-query`](https://tanstack.com/query/latest) | Cache and mutation lifecycle for asynchronous Rust commands |
| Long lists | [`@tanstack/react-virtual`](https://tanstack.com/virtual/latest) | Bounded rendered rows as history grows |
| Shortcuts (in window) | [`@tanstack/react-hotkeys`](https://tanstack.com/hotkeys/latest) | App-window shortcuts only; OS-wide activation is separate |
| Persistence | SQLite through Rust `rusqlite` (bundled) | One database owner and narrow domain commands |
| Search | SQLite FTS5 after correctness tests | Define Unicode, token, prefix and substring semantics |
| Later (images, OCR, AI) | `image`, `blake3`/`sha2`, `keyring`; native OCR or Tesseract; `fastembed` + `sqlite-vec`; `clap`; Rust MCP SDK | Added when the feature starts, each behind a narrow interface |
| UI tests | Vitest + React Testing Library + `user-event` | Behavior and keyboard interaction |
| Desktop tests | WebdriverIO + `@wdio/tauri-service` | Test builds with an embedded driver; exclude driver and privileged test plugins from distribution |
| Lint/format | Biome (frontend); `rustfmt` + Clippy (Rust) | One formatting authority per language |
| Dependency checks | Cargo audit/deny plus frontend review | Advisories, sources and license policy |
| Automation | GitHub Actions + `tauri-apps/tauri-action` | Native OS build matrix and draft release artifacts |

TanStack: **Query and Virtual are integrated in 0.0.1**; **Router, Form and DB** deferred until a recorded problem warrants them. React state is enough for transient UI state, and Rust/SQLite is the persistent source of truth. The prototype currently sends a bounded full snapshot to React. Replace it with paged summaries and fetch the original payload only for preview/copy; loading the whole history into a second frontend store would undermine the memory goal. Query caches native results and invalidates them on committed revision events; it does not become a second persistent database. Disable cmdk's own filtering when native search supplies results, and validate its keyboard/selection behavior with virtualized rows before adopting the combination.

**Component integration:** use cmdk inline as the main window surface, rather than putting a full-window modal inside the native window. Its item values must be stable item IDs, never the original clipboard text (cmdk trims values); copying must never use the trimmed cmdk value. 0.0.1 copies the original payload from the native snapshot; on-demand native reads by ID are planned with paging. Virtual does not come built into cmdk: verify offscreen keyboard selection, scroll-to-index and announced active items explicitly. HeroUI Kbd should show the effective binding and correct OS modifiers; do not copy the glyph display into another shortcut handler. Review the required HeroUI package/styles and share one Tailwind/token setup instead of importing two complete design systems. Use Attachment's visual hierarchy for rows/preview, keeping row actions in Ctrl+K; do not introduce upload behavior or remote example assets into this local clipboard UI. Preserve dependency notices and Geist's OFL-1.1 license.

Plugins: add only what the app uses (`global-shortcut`, `single-instance`, `autostart` opt-in, `updater` later). Prefer Rust domain commands over exposing broad plugin APIs to the webview, and do not add shell, filesystem, HTTP or SQL permissions because a template includes them. Use one database access layer (`rusqlite` first).

## Architecture

```text
OS clipboard / activation / session signals
                 |
       Rust platform adapters
                 |
       capture + policy service
                 |
       database worker -> SQLite
                 |
       narrow Tauri commands + revision events
                 |
       React bridge -> Query cache -> virtualized UI
```

**Target architecture:** the Query/Virtual bridge is implemented. A dedicated database worker and paged native commands are still pending. The current Rust service uses a shared SQLite connection on blocking workers and publishes bounded snapshots; background clipboard monitoring is still pending.

The Rust process must own capture and storage even when the window is hidden. React owns presentation and transient state. The release app must not depend on a dev server or a Bun/Node service.

Target repository layout (not a claim that these paths already exist):

```text
crates/
  tuck-core/              # capture, storage, search, item types (no Tauri dependency)
  tuck-cli/  tuck-mcp/    # later: thin clients of the core
src/
  app/  components/ui/    # composition and owned UI primitives
  features/bar/           # command bar, results, actions panel
  features/settings/      # privacy, retention, shortcuts, appearance
  lib/native/             # typed commands, events, mock adapter
  styles/                 # theme and design tokens
src-tauri/
  src/commands/           # narrow validated IPC surface
  src/platform/           # activation, tray, session integration
  capabilities/  migrations/
docs/  tests/  .github/workflows/
```

The core split into `crates/tuck-core` can wait until the CLI and MCP work starts, as long as capture, storage and search stay behind module boundaries that do not depend on Tauri.

**Capture and persistence:** detect clipboard revisions with OS signals where possible; apply pause and sensitivity policy before persisting; read with byte and time limits and bounded retries; keep the original payload and derive a separate bounded preview and search text; deduplicate by type and payload digest; commit history, retention and the search index consistently; emit compact change events after commit (never full clipboard bodies). When restoring an item, suppress only that self-generated capture using a revision and payload check, never a blanket time window. Use a dedicated database worker, transactions, migrations and the platform app-data directory.

**Native boundary:** expose domain commands (`list_history`, `get_item`, `copy_item`, `set_pinned`, `delete_item`, `clear_history`, `set_capture_enabled`, `get_settings`, `update_settings`), validate everything in Rust, and return typed errors. Define `PlatformCapabilities` that separates *supported*, *available*, *permission denied* and *temporarily failed*, and show those states in settings and diagnostics. Use per-window capabilities and a restrictive CSP ([Tauri capabilities](https://v2.tauri.app/security/capabilities/)). The prototype currently has `csp: null`; enabling and testing a production CSP is a release prerequisite, not a completed security feature.

## Privacy and security

Clipboard content can include passwords, tokens, personal information and private documents. Local storage is still sensitive storage, and screenshots deserve the same care as text.

- No account, telemetry, analytics, cloud sync or remote clipboard processing in the initial product.
- Explain capture before enabling it; show capture state; offer immediate pause and resume.
- Autostart and automatic update checks are opt-in.
- Proposed text defaults: at most 500 unpinned items, seven-day retention, 1 MiB per item. Image limits (pixels, bytes, total storage) are set when images land. Pinned items survive age and count retention but still count toward a storage ceiling. These are proposed defaults; the prototype has the fixed total-item/byte limits listed above and no age expiry. Changing retention must explain impending deletion and preserve pins within the byte ceiling.
- Offer individual deletion, clear-unpinned and clear-all. Deleting app history does not erase another application's current clipboard.
- Honor "do not store" and sensitive-content hints where adapters expose them (password-manager items are masked or ignored). Detection and app exclusions are best-effort; never promise that every secret is detected or that the clipboard origin is known.
- Never log clipboard bodies, raw search queries or full payload hashes. Render content as inert text: no execution, automatic URL fetching or raw HTML insertion.
- **CLI and MCP (later) are opt-in,** never expose sensitive or private items, and keep a bounded audit of item IDs, caller and time without clipboard bodies or raw search queries.
- **AI features (later) are opt-in,** use local models or the user's own key stored in the OS credential store, never send items marked private, and show where an item will go before it is sent.

**Storage threat model:** the baseline uses ordinary SQLite and does **not** claim encryption at rest. OS disk encryption and user-directory permissions reduce some exposure; malware running as the same user may still read data. If encryption becomes a requirement, design it separately (key lifecycle, locked state, backups, search-index exposure). Deletion must clear caches, rows, search data and owned attachments, but WAL files, freed pages, backups and SSD behavior may retain data, so document logical deletion and do not advertise forensic erasure. The identifier migration deliberately preserves the old database; clearing the new history will not erase that legacy copy. Document its location and an explicit user-controlled cleanup path. Handle session lock and suspend explicitly where the OS gives reliable signals.

## Development

### Prerequisites

Bun and a Rust toolchain compatible with the selected Tauri and plugin versions (a tested `rust-toolchain.toml` still needs to be added), plus the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS: Linux build tools with GTK/WebKitGTK development packages; Windows C++ build tools and WebView2; macOS Xcode command-line tools (and signing prerequisites for distribution). Keep a compatible Node.js available for tools that need it, such as the desktop test runner.

### Run

```sh
bun install --frozen-lockfile
bun run tauri dev     # desktop app
bun run dev           # browser demo with labeled synthetic data
bun run tauri build   # desktop build
```

The scaffold came from `bun create tauri-app` (React, TypeScript, Bun). The identifier is already selected and migrated. Keep it stable: changing it again can affect app-data paths, OS permissions, signing identity and update continuity. Align the remaining visible `Clipboard`/package branding with Tuck before release without resetting history.

### Frontend dependencies

These dependencies are already installed and locked in 0.0.1. Use `bun install --frozen-lockfile` to reproduce the stack; the commands below document how it was added.

```sh
bun add @tanstack/react-query @tanstack/react-virtual cmdk @fontsource-variable/geist @heroui/react
bun add -D tailwindcss@^4 @tailwindcss/vite@^4
```

Add `tailwindcss()` next to the React plugin in `vite.config.ts` (keep Tauri's generated server settings) and import Tailwind with `@import "tailwindcss";` from the main stylesheet. Tailwind v4's documented browser floor (Safari 16.4, Chrome 111, Firefox 128) does not certify WebKitGTK or WKWebView, so validate the oldest supported OS ([installation](https://tailwindcss.com/docs/installation/using-vite), [compatibility](https://tailwindcss.com/docs/compatibility)).

### Checks

Currently available frontend scripts: `bun run format:check`, `bun run typecheck`, `bun test` (also `bun run test`) and `bun run build`. `bun run format` applies formatting. Existing Bun tests cover history/filter behavior and the archived GNOME bridge; that bridge is not required by the app. Rust/SQLite tests and rustfmt/Clippy commands also exist. Vitest/Testing Library coverage is planned for component interactions; decide the runner migration explicitly rather than silently treating Bun tests as that suite.

The commands below are available now. A `lint` script/rule policy and CI remain pending:

```sh
bun run format:check && bun run typecheck && bun run test && bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Testing and performance

Test layers: Rust unit tests (deduplication, retention, self-write suppression, validation); SQLite integration tests (migrations, FTS consistency, pagination, crash and reopen); React behavior tests (keyboard, focus, stale responses); browser preview tests with a deterministic mock bridge; packaged-app tests with WebdriverIO and `@wdio/tauri-service` ([Tauri WebDriver](https://v2.tauri.app/develop/tests/webdriver/)); and manual OS/session tests (background capture, shortcuts, permissions, lock and resume, screen readers). The service's embedded driver supports Windows, Linux and macOS; direct upstream `tauri-driver` supports Windows/Linux only. Select and prove the provider on each target, compile all driver/IPC-mocking plugins only into isolated synthetic test builds, and do not mistake browser-only tests for native capture tests ([driver options](https://v2.tauri.app/develop/tests/webdriver/)). Synthetic CI displays do not replace real Wayland sessions; never collect a developer's personal clipboard in tests.

Proposed performance budgets (goals, not results; measure release builds on frozen reference hardware):

| Metric | Initial target |
| --- | --- |
| Warm activation to interactive bar | p95 <= 150 ms |
| Cold launch to interactive bar | p95 <= 1 s |
| Search over 10,000 bounded text fixtures | p95 <= 100 ms after submission |
| Idle CPU, unchanged clipboard | average < 0.5% of one logical CPU over five minutes |
| Memory | investigate > 100 MiB idle or > 150 MiB with the bar open |
| Rendering | bounded mounted rows; smooth scrolling at the display refresh rate |
| Storage | enforced count, age, payload and total-byte limits |

The 10,000-item fixture is a scalability benchmark, not the current 500-item retention default. Record hardware, OS/webview versions, build profile and sample count. Report polling interval, wakeups, detection delay and burst drops separately; polling cannot guarantee seeing every intermediate copy.

## Roadmap

| Version | Focus |
| --- | --- |
| 0.0.1 | Personal build: text capture, SQLite, tray, picker, copy-back. Feasibility gate for Wayland and GNOME |
| 0.1.0 | First public release: command bar, native search/paging, pins, privacy and retention; bounded image capture; installers for validated targets |
| 0.2.0 | Screenshots folder and local OCR first, then smart types, contextual actions, living tray icon and paste stack; optional automatic-paste feasibility |
| 0.3.0 | CLI and opt-in MCP server |
| 0.4.0 | Local semantic search, "paste as...", AI providers (local or your own key) |
| 1.0.0 | Stable: accessibility review, updates, export and import |

Details, exit gates and the release checklist are in [ROADMAP.md](ROADMAP.md). The GNOME decision is already made: no required extension, with an honest limited mode. The author has paused further manual testing and prioritized the working 0.0.1 command bar, now implemented. Preserve the recorded [GNOME results](docs/feasibility/gnome-test.md); Windows testing remains deferred. Native paging/search and retention come before expanding into images, OCR or AI. Windows, Linux and macOS remain targets; release support is limited to recorded passing environments.

## CI, packaging and updates

Separate PR-check and protected-release workflows; native builds on each OS with locked dependencies and documented toolchains; third-party Actions pinned to reviewed commit SHAs with least-privilege permissions; no release credentials in untrusted PR jobs ([Tauri GitHub pipelines](https://v2.tauri.app/distribute/pipelines/github/)). An AppImage does not guarantee it works on every distribution, and Flatpak is a separate milestone. OS code signing and the Tauri [updater](https://v2.tauri.app/plugin/updater/) signatures solve different problems: protect the updater private key (never commit it), ship the public key, and never disable verification. Update checks and user-opened links create network traffic; describe destinations and consent honestly.

## Contributing

Tuck is a personal open-source project. Before a large change, open an issue describing the user problem, affected platforms and tradeoffs. Use synthetic clipboard examples; never post real secrets, private clipboard history or raw databases. Useful early contributions: platform feasibility reports (record exact OS, session or compositor, webview and app versions), accessibility improvements, Unicode and search fixtures, resource measurements, and packaging checks. A `SECURITY.md` with a private reporting channel will exist before the first release.

## License

**MIT**, selected by the author on 2026-10-14. See [LICENSE](LICENSE). Commercial use and redistribution are permitted under its conditions. Dependency licenses remain separate; keep notices and review bundled assets/helpers before distribution.

Platform research began on 2026-10-12; Gate 0 measurements and the WebDriver provider review were updated on 2026-10-14. External documentation can change; the implementation must record tested versions and observed support instead of treating that date as a compatibility guarantee.

Current visual iteration: [full-width workspace, sidebar and tray prefixes](docs/workspace-visual-refresh.md). Native tray font/hover styling remains owned by the desktop shell, not the webview.

Latest interaction iteration: [sidebar and per-item menus](docs/sidebar-and-item-menus.md). Automatic app hover previews were removed; native tray hover previews remain a separate platform/UI limitation.

Official component integration: [shadcn sidebar-01 and tabbed settings](docs/shadcn-integration.md). The native Linux tray cannot emit the hover coordinates required for a pointer-positioned full-text popover.
