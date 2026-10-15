# Roadmap

The plan for Tuck, in the order it will be built. Versions beyond the next milestone are direction, not promises. No dates are given until platform feasibility is known. The [README](README.md) defines the product and target architecture; this file tracks delivery and acceptance.

**Audit: 2026-10-14.** `[x]` means implemented or a recorded decision in the current prototype, not certified on every OS. `[ ]` means remaining work, including validation where specified. Historical iteration notes are evidence, not the current design specification. Release checklists stay open until a particular release is verified.

**Versioning:** [SemVer](https://semver.org/) `0.y.z` while the app is changing. `0.0.1` is the personal feasibility build, `0.1.0` the first public release, and `1.0.0` introduces a documented compatibility, migration and platform-support policy. Stability does not mean a promise of no bugs or no future changes.

**Principles:** local-first, no account or cloud in v1, keyboard complete, measured performance, calm UI, optional AI. The primary workflow is *open, find, copy, paste in the destination*. Secondary item actions live behind `Ctrl+K`. Merging an adapter or building an installer is not a platform support claim.

## Gate 0: Feasibility (before public support claims)

Runs alongside early UI work. **In progress; exit not met.** See the [evidence matrix and decisions](docs/gate0-feasibility.md) and [GNOME manual procedure](docs/feasibility/gnome-test.md). The [Windows test packet](docs/feasibility/windows-test.md) is prepared; execution is deferred at the author's request, not marked complete.

### Decisions and evidence already available

- [x] Run the Tauri/React/Rust stack as a real desktop window on the primary OS — author screenshots and copy-to-list confirmation on GNOME 46
- [x] Choose GNOME limited mode without a required Shell extension — capture current text on opening/focus, not the hidden sequence of copies
- [x] Choose `com.felipecepluki.tuck` and implement non-destructive legacy SQLite migration, including committed WAL data, favorites, categories and capture preference
- [x] Apply MIT, with explicit author approval, and SPDX metadata; complete dependency notices remain pending
- [x] Record current GNOME protocols, portal versions/failures, tray host, notification service and exact environment versions
- [x] Probe CSS features in a real native-Wayland WebKitGTK 2.52.6 window — not a Tailwind or oldest-engine certification
- [x] Launch Tuck and both GTK fixtures with requested Wayland commands; author confirms helper-to-helper copy/paste; actual backend type and full lifecycle remain pending
- [x] Prepare synthetic Windows procedures and read-only inventory/optional Win32 hotkey probe — not passing app tests

- [x] Validate basic source → Tuck → destination copy-back and tray copy-back in the requested GNOME Wayland round — manual author confirmation; detailed fidelity/feedback/Enter and lifecycle tests remain pending

- [x] Validate GNOME pause/resume, favorite persistence after quit/reopen, and pasting after Tuck quits — manual author confirmation in the requested Wayland round

### Remaining validation

- [ ] Record the actual Tauri GTK backend; isolate native Wayland and XWayland copy-back tests on GNOME
- [ ] Verify detailed Unicode/whitespace fidelity and source closure; basic copy-back and ownership after Tuck quits passed in the current GNOME round, other targets remain pending
- [ ] Compile and run the Windows manual adapter on the author's other machine; record restart, tray, pause and copy-back results
- [ ] Obtain macOS test access and verify read/write and lifecycle behavior
- [ ] Spike hidden capture on Windows, macOS and a real X11 session; record burst behavior and busy-clipboard retries
- [ ] Test another real Wayland compositor (Hyprland/Sway/etc.), recording data-control availability and failure states independently
- [ ] Verify single-instance `--show`, focus, shortcut conflicts and permission failure in each proposed support mode
- [ ] Choose minimum OS/webview versions; validate the adopted Tailwind v4 stylesheet on the oldest proposed native engines before advertising support

**Exit:** passing native round-trip, persistence and activation results for each environment proposed for release; continuous capture tested wherever it is promised; explicit limited/unsupported classifications elsewhere; a verified webview floor for the chosen styling stack. The full cross-platform feasibility gate remains open while its target tests are missing. A narrower public release can ship only for independently verified environments, with remaining targets explicitly deferred. A written matrix alone is not a pass.

## v0.0.1: First tuck (personal use)

Goal: replace the author's text clipboard workflow and validate the native foundation.

### Implemented prototype

- [x] Local SQLite text history with transactional writes, exact-payload deduplication and reopen/rollback/schema tests
- [x] Fixed limits: 500 total items, 1 MiB per text and 16 MiB total text payload; evict oldest unpinned items, reject capture if pins fill the ceiling
- [x] Persist favorites, individual deletion and user categories (create, rename, remove, assign)
- [x] Linux opening/focus capture with saved opt-in and pause/resume; guard against late callbacks after pause
- [x] Single-instance activation forwarding in code — real-session `--show`/focus checks remain in Gate 0
- [x] Compact optional tray: three recent items, favorites, Open, Preferences, Quit; launcher access without a tray
- [x] Native OS frame, requested 90% initial work-area sizing and adjustable opacity; actual placement remains compositor-controlled
- [x] Prototype search, arrows/Enter, click-to-copy, preview and `Ctrl+K` actions; redundant footer Copy button removed
- [x] Success popup after app copy; payload-free tray notification/tooltip feedback, without showing, focusing or hiding the main window during tray copies
- [x] Synthetic browser demo, Bun model tests, Rust/SQLite tests and native/frontend build checks

### Remaining for personal acceptance

- [x] Clear-unpinned and clear-all with confirmation, transactional persistence and Query cache refresh; synthetic reopen test covers both modes
- [ ] Complete remaining real-session checks: feedback, Enter, category/deletion persistence, source closure and launcher activation; basic app/tray copy-back, pause/resume, favorite reopen and paste after quit have passed
- [ ] Complete background capture for the first environment that can support it, keeping GNOME's limited mode explicit
- [ ] Add configurable global activation where supported and verify the launcher fallback elsewhere
- [ ] Complete a full week of daily use; record missed copies, failures, storage behavior and resource measurements

**Done when:** the native workflow behaves as documented for the chosen personal environment for a full week. GNOME acceptance does not require an extension or imply continuous hidden capture. Hyprland/Windows/macOS results are tracked separately.

## v0.1.0: First public release

Finish the text workflow before image expansion. Work below is ordered by dependency; UI work can proceed alongside Gate 0, but public support claims depend on its evidence.

### 1. Command bar and design foundation

- [x] Integrate Tailwind v4, semantic tokens and bundled Geist with license notices in 0.0.1; oldest-native-webview validation remains open
- [x] Integrate cmdk; replace history tabs with sidebar filters and pinned-first results; item actions in `Ctrl+K` plus per-row three-dot menus, subsequently requested by the author
- [x] Install official shadcn/ui Base UI components and sidebar-01; integrate off-canvas navigation, dropdown actions, dialogs, tabbed settings, cards and form controls (2026-10-14)
- [x] Preserve existing categories/history and saved appearance preferences during the redesign; categories remain accessible through filters/actions
- [x] Use HeroUI Kbd for effective shortcut hints, with OS-aware labels and shared design tokens; use shadcn Attachment as the visual reference for media/content/metadata without adding per-row actions or upload features
- [x] Keep the native OS frame; refine app-owned rounded surfaces, typography, spacing and empty/loading/error states
- [x] Preserve click/Enter copy and success feedback; restore visible keyboard focus, input/preview text selection and reduced-motion behavior
- [ ] Validate cmdk plus Virtual navigation, offscreen selection, IME and screen-reader semantics; choose an alternative integration if they do not compose reliably

### 2. Native data flow and search

- [ ] Move storage behind one dedicated database worker; version schema migrations and stop safely on unknown newer schemas
- [ ] Replace full-body snapshots with paged summaries, stable IDs and on-demand payload reads; retain compact post-commit revision events
- [ ] Implement SQLite search and deterministic cursor paging (recency plus a unique tie-breaker); define Unicode/accent, prefix and substring behavior before choosing FTS5 fallbacks
- [ ] Keep history/search index changes transactional; test migration, deletion, retention and index consistency
- [x] Add TanStack Query for native snapshot/mutation caching and Virtual for bounded mounted rows; disable cmdk filtering and conflicting Vim bindings
- [ ] Replace bounded React filtering/full snapshots with paged native search; Query/Virtual alone do not implement it
- [ ] Test stale search responses, query changes, selection across pages and event-driven invalidation without duplicating the full history in frontend state

### 3. Capture, privacy and accessibility

- [ ] Finish first advertised native capture adapters and ownership/self-write behavior; prove only the restored item is suppressed, not unrelated rapid copies
- [ ] Add `PlatformCapabilities` states (supported, available, denied, temporarily failed) and actionable limited-mode diagnostics
- [ ] Configure retention by count, age and bytes; proposed defaults are 500 unpinned/seven days, distinct from current 500-total/no-expiry limits
- [ ] Explain destructive retention changes; pins survive count/age rules but remain within the storage ceiling
- [ ] Complete first-run capture explanation, visible pause/resume, bulk deletion and reliable session lock/suspend behavior
- [ ] Honor sensitivity hints per adapter; add masked previews/private flags and app exclusions only where origin is reliable, with honest limitations
- [ ] Test all essential actions by keyboard, visible focus, contrast, list semantics, zoom and relevant screen readers before public release
- [ ] Add shortcut rebinding, conflict feedback and reset; keep launcher activation available
- [ ] Add opt-in launch at login with one watcher per process and tested shutdown
- [ ] Enable/test a restrictive production CSP, review capabilities and remove unused scaffold dependencies
- [ ] Document logical deletion and preserved legacy migration data; provide an explicit cleanup procedure without silently deleting the original

### 4. Bounded image capture

- [ ] Validate image clipboard formats on each advertised environment; preserve copy-back payload and use bounded thumbnails
- [ ] Add image digest deduplication and limits for dimensions, decoded memory, per-item bytes and total storage
- [ ] Store owned attachments with transactional metadata, safe paths and orphan cleanup; integrate retention/deletion and privacy policy
- [ ] Benchmark image capture/preview memory without decoding the whole image history; defer unsupported adapters explicitly

### 5. Verification and distribution

- [ ] Add Vitest/Testing Library interaction tests; decide whether to migrate existing Bun model tests or retain their separate role
- [x] Configure Biome formatting and `format`/`format:check` scripts
- [ ] Configure lint rules, pin a tested Rust toolchain, add dependency/license audit policy and CI for Linux/Windows/macOS builds
- [ ] Configure WebdriverIO/Tauri service in isolated synthetic test builds; exclude embedded drivers, IPC mocks and privileged test plugins from shipped artifacts
- [ ] Measure README budgets on release builds; use 10,000 synthetic search items as a scalability fixture, not a retention default
- [ ] Verify fresh install, restart, upgrade/migration and uninstall on each advertised OS/session; document installer signing status
- [x] Align product name, window/browser title, tray tooltip and English interface with Tuck while preserving identifier/data
- [ ] Verify final installer branding on advertised OSes
- [ ] Prepare release destinations, screenshots of the new design, platform/minimum-version matrix, full dependency/font notices and `SECURITY.md` with a real private reporting channel

**Done when:** an independent user can install and use the documented copy-only workflow without setup help on each advertised combination. Unverified OSes remain targets, not supported badges. Images ship only for validated adapters; incomplete image work must be explicitly deferred rather than silently claimed.

## v0.2.0: Screenshots and smart workflows

Build on stable text/image capture and bounded storage. Complete searchable screenshots before expanding contextual actions.

- [ ] Opt-in watched screenshots folder with constrained paths, deduplication and no arbitrary file execution
- [ ] Local OCR with cancelable bounded jobs, language/model installation consent and searchable derived text; benchmark/licensing review before choosing an engine
- [ ] Smart types: links, colors, JSON, code; basic text/link classification already exists, rich actions do not
- [ ] Contextual `Ctrl+K` actions: plain text, format JSON, color swatch, reveal owned file; link titles must not trigger undisclosed automatic network fetching
- [ ] Paste stack: ordered items, cancellation, privacy and a copy-only fallback
- [ ] Living tray icon: paused state, stack count and transient confirmation; existing menu and copy notification are already implemented
- [ ] Separate opt-in automatic-paste spike: previous-app focus, permissions and failure on Windows/macOS/Wayland; retain normal copy and never request elevation as a workaround

**Done when:** screenshots can be found and reused with bounded resource use, and each added workflow has predictable keyboard behavior and explicit permissions. Automatic paste is optional and cannot block the base copy workflow.

## v0.3.0: Tuck for scripts and AI agents

- [ ] Extract `crates/tuck-core` only when needed; keep capture/storage/search boundaries Tauri-independent in earlier work
- [ ] Define one authorized local service/database owner; CLI and MCP do not bypass retention/privacy or open competing writable databases
- [ ] CLI: `tuck last`, `tuck search`, piped input, explicit machine-readable output and bounded results
- [ ] Opt-in MCP server with constrained local transport/authentication, no unauthenticated network history endpoint
- [ ] Exclude private/sensitive items, bound agent queries and log item IDs/caller/time without bodies or raw queries; provide audit retention and deletion controls
- [ ] Verify untrusted clients, disabled-service behavior and permission revocation with synthetic data

**Done when:** a user can deliberately grant and revoke access without silently exposing clipboard history.

## v0.4.0: Intelligence

- [ ] Local semantic search with incremental embeddings, bounded/cancelable work and index cleanup on deletion
- [ ] Deterministic "paste as..." transformations first; translated/summarized output separately opts into a model
- [ ] Benchmark and review licenses for embedding/vector/model candidates before committing to them
- [ ] Local provider (such as Ollama) or BYOK stored in the OS credential store; show destination/data before sending, exclude private items
- [ ] Explicit consent for model downloads, network requests and provider costs; usable text search without AI
- [ ] Visual screenshot search only if measured usefulness and resource budgets justify it

**Done when:** optional intelligence improves retrieval/reuse without changing offline defaults or silently uploading content.

## v1.0.0: Stable

- [ ] Complete accessibility regression review with NVDA, VoiceOver and Orca; core accessibility was already required for 0.1
- [ ] Signed installers and opt-in updater: real release endpoint, HTTPS, artifact signatures, key backup, rollback/failure handling and consent
- [ ] Checksums, maintained dependency/license notices and SBOM
- [ ] Export/import with validation, explicit sensitive-data handling, size limits and migration tests
- [ ] Compatibility/migration policy, translations, documentation and maintained support matrix
- [ ] Optional end-to-end encrypted sync may be evaluated after 1.0; it is not an exit requirement

**Done when:** support and upgrade behavior are documented and sustained, with no unresolved release-blocking privacy, security or data-loss defects.

## Release checklist (repeat for every public release)

- [ ] Advertised combinations pass capture, reopen, search, copy-back, pause, delete, restart and upgrade tests; unsupported/denied cases have actionable explanations
- [ ] Hidden capture, limited capture, source closure and shutdown behave as documented; no duplicate watcher
- [ ] Retention, pins, limits, index/attachment cleanup, migrations and cache invalidation pass integration tests
- [ ] No unresolved release-blocking privacy, data-loss or security issue; lesser known issues disclosed
- [ ] Core UI is keyboard complete and checked with relevant screen readers
- [ ] Release benchmarks meet README budgets or a documented reviewed exception
- [ ] CI passes; shipped artifacts exclude mock modes, test servers, drivers and debug privileges; CSP/capabilities reviewed
- [ ] Fresh install, upgrade and uninstall verified; signing status, checksums and dependency notices included
- [ ] README, support matrix, release notes, license and private security reporting current

## Immediate next steps

The author ended further manual GNOME testing and prioritized implementation on
2026-10-14. The 0.0.1 command bar and requested UI stack are now implemented;
[delivery/verification notes](docs/command-bar-0.0.1.md) distinguish automated checks
from the earlier manual clipboard confirmations. Windows remains deferred.

Next work: native paging/search and retention/privacy. Keep remaining Gate 0 items
open for future platform validation; do not require another manual test round to
continue local implementation. License and identifier decisions remain settled.

## Not planned for now

Accounts, cloud features in v1, mobile apps, team collaboration, plugin scripting. A required GNOME extension is outside the chosen product direction.
