//! Opt-in native test harness. Excluded from ordinary and release builds.
use tauri::{Listener, Manager};

pub fn setup(app: &mut tauri::App) {
    if std::env::var("CLIPBOARD_NATIVE_SMOKE").as_deref() != Ok("1") {
        return;
    }
    let handle = app.handle().clone();
    app.listen("native-smoke-result", move |event| {
        let passed = event.payload() == "\"passed\"";
        eprintln!("NATIVE_SMOKE {}", if passed { "PASS" } else { "FAIL" });
        handle.exit(if passed { 0 } else { 1 });
    });
    let handle = app.handle().clone();
    gtk::glib::timeout_add_local_once(std::time::Duration::from_secs(2), move || {
        if let Some(window) = handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.eval(r#"
(async () => {
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const emit = result => invoke('plugin:event|emit', {event: 'native-smoke-result', payload: result});
  try {
    await invoke('probe_write_text', {text: 'https://maccy.app/native-smoke-fixture'});
    await invoke('set_capture_enabled', {enabled: true});
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    let passed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(150);
      const snapshot = await invoke('captured_history');
      const found = snapshot.items.some(item => item.content === 'https://maccy.app/native-smoke-fixture');
      const rendered = document.querySelector('.history-list')?.textContent.includes('https://maccy.app/native-smoke-fixture');
      if (found && rendered) { passed = true; break; }
    }
    await emit(passed ? 'passed' : 'failed');
  } catch { await emit('failed'); }
})();
"#);
        }
    });
    let handle = app.handle().clone();
    gtk::glib::timeout_add_local_once(std::time::Duration::from_secs(15), move || {
        eprintln!("NATIVE_SMOKE TIMEOUT");
        handle.exit(1);
    });
}
