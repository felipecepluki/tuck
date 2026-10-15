use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

const MAX_ITEMS: usize = 500;
const MAX_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone, Serialize, Deserialize)]
pub struct Clip {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) content: String,
    kind: String,
    source: String,
    time: String,
    pub(crate) pinned: bool,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    captured_at: u64,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
}
#[derive(Default, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub revision: u64,
    pub epoch: u64,
    pub enabled: bool,
    pub tray_available: bool,
    pub last_error: Option<String>,
    pub items: Vec<Clip>,
    pub categories: Vec<Category>,
}
#[derive(Default, Clone)]
pub struct Service(
    pub Arc<Mutex<Snapshot>>,
    pub Arc<Mutex<Option<rusqlite::Connection>>>,
);

impl Service {
    pub fn open(&self, path: &std::path::Path) -> Result<(), String> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            std::fs::OpenOptions::new()
                .create(true)
                .truncate(false)
                .write(true)
                .mode(0o600)
                .open(path)
                .map_err(|_| "Unable to create private history storage.")?;
        }
        let database =
            rusqlite::Connection::open(path).map_err(|_| "Unable to open local history.")?;
        database
            .busy_timeout(std::time::Duration::from_secs(2))
            .map_err(|_| "History is busy.")?;
        let version: i64 = database
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|_| "Invalid database.")?;
        if version > 1 {
            return Err("History was created by a newer version of Tuck.".into());
        }
        database.execute_batch("BEGIN; CREATE TABLE IF NOT EXISTS clips (id TEXT PRIMARY KEY, payload TEXT NOT NULL, position INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL); PRAGMA user_version=1; COMMIT;").map_err(|_| "Unable to prepare history.")?;
        let mut snapshot = self.0.lock().map_err(|_| "History unavailable.")?;
        let mut statement = database
            .prepare("SELECT payload FROM clips ORDER BY position")
            .map_err(|_| "Invalid history.")?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|_| "Invalid history.")?;
        let mut items = Vec::new();
        for row in rows {
            items.push(
                serde_json::from_str::<Clip>(&row.map_err(|_| "Invalid history.")?)
                    .map_err(|_| "Invalid history format.")?,
            );
        }
        drop(statement);
        let mut statement = database
            .prepare("SELECT id, name FROM categories ORDER BY name COLLATE NOCASE")
            .map_err(|_| "Invalid categories.")?;
        let categories = statement
            .query_map([], |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|_| "Invalid categories.")?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "Invalid categories.")?;
        drop(statement);
        snapshot.items = items;
        snapshot.categories = categories;
        snapshot.revision = snapshot
            .items
            .iter()
            .filter_map(|clip| clip.id.parse::<u64>().ok())
            .chain(snapshot.categories.iter().filter_map(|category| {
                category
                    .id
                    .strip_prefix("category-")
                    .and_then(|id| id.parse::<u64>().ok())
            }))
            .max()
            .unwrap_or(0)
            + 1;
        *self.1.lock().map_err(|_| "History unavailable.")? = Some(database);
        Ok(())
    }
    // Publish the new in-memory view only after the transaction commits.
    fn save(&self, snapshot: &Snapshot) -> Result<(), String> {
        let mut database = self.1.lock().map_err(|_| "History unavailable.")?;
        let Some(database) = database.as_mut() else {
            return Ok(());
        };
        let transaction = database
            .transaction()
            .map_err(|_| "Unable to save history.")?;
        let result = (|| -> Result<(), rusqlite::Error> {
            let ids = transaction
                .prepare("SELECT id FROM clips")?
                .query_map([], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            for id in ids {
                if !snapshot.items.iter().any(|clip| clip.id == id) {
                    transaction.execute("DELETE FROM clips WHERE id=?1", [&id])?;
                }
            }
            for (position, clip) in snapshot.items.iter().enumerate() {
                let payload = serde_json::to_string(clip).expect("serializable clip");
                transaction.execute("INSERT INTO clips(id,payload,position) VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, position=excluded.position WHERE payload!=excluded.payload OR position!=excluded.position", rusqlite::params![clip.id, payload, position as i64])?;
            }
            transaction.execute("DELETE FROM categories", [])?;
            for category in &snapshot.categories {
                transaction.execute(
                    "INSERT INTO categories(id,name) VALUES (?1,?2)",
                    rusqlite::params![category.id, category.name],
                )?;
            }
            Ok(())
        })();
        result.map_err(|_| "Unable to save. No changes were applied.")?;
        transaction
            .commit()
            .map_err(|_| "Unable to commit history.")?;
        Ok(())
    }
    fn update(
        &self,
        change: impl FnOnce(&mut Snapshot) -> Result<(), String>,
    ) -> Result<(), String> {
        let mut state = self.0.lock().map_err(|_| "History unavailable.")?;
        let mut next = state.clone();
        change(&mut next)?;
        next.revision += 1;
        self.save(&next)?;
        *state = next;
        Ok(())
    }

    pub fn insert(&self, text: String) -> Result<(), String> {
        self.insert_with_epoch(text, None)
    }

    fn insert_with_epoch(&self, text: String, epoch: Option<u64>) -> Result<(), String> {
        super::validate_text(&text)?;
        self.update(|state| {
            if let Some(epoch) = epoch
                && (!state.enabled || state.epoch != epoch)
            {
                return Err("Capture state changed".into());
            }
            if let Some(position) = state.items.iter().position(|clip| clip.content == text) {
                let mut clip = state.items.remove(position);
                clip.captured_at = now();
                state.items.insert(0, clip);
            } else {
                let bytes: usize = state.items.iter().map(|clip| clip.content.len()).sum();
                let pinned_bytes: usize = state
                    .items
                    .iter()
                    .filter(|clip| clip.pinned)
                    .map(|clip| clip.content.len())
                    .sum();
                if pinned_bytes + text.len() > MAX_BYTES
                    || state.items.iter().filter(|clip| clip.pinned).count() >= MAX_ITEMS
                {
                    return Err("Storage limit reached: unpin or delete an item.".into());
                }
                let mut remaining = bytes + text.len();
                while state.items.len() >= MAX_ITEMS || remaining > MAX_BYTES {
                    let position = state
                        .items
                        .iter()
                        .rposition(|clip| !clip.pinned)
                        .ok_or("Storage limit reached: unpin or delete an item.")?;
                    remaining -= state.items.remove(position).content.len();
                }
                state.revision += 1;
                let clip = Clip {
                    id: state.revision.to_string(),
                    title: text.lines().next().unwrap_or("").chars().take(90).collect(),
                    kind: if (text.trim().starts_with("https://")
                        || text.trim().starts_with("http://"))
                        && !text.trim().contains(char::is_whitespace)
                    {
                        "link"
                    } else {
                        "text"
                    }
                    .into(),
                    content: text,
                    source: "Clipboard".into(),
                    time: "Just now".into(),
                    pinned: false,
                    category: None,
                    captured_at: now(),
                };
                state.items.insert(0, clip);
            }
            Ok(())
        })
    }
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[tauri::command]
pub async fn captured_history(app: tauri::AppHandle) -> Result<Snapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Service>()
            .0
            .lock()
            .map(|state| state.clone())
            .map_err(|_| "History unavailable.".into())
    })
    .await
    .map_err(|_| "History unavailable.")?
}
#[tauri::command]
pub fn set_capture_enabled(
    app: tauri::AppHandle,
    service: tauri::State<'_, Service>,
    enabled: bool,
) -> Result<(), String> {
    let mut state = service.0.lock().map_err(|_| "Capture unavailable.")?;
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Preferences directory unavailable.")?;
    std::fs::create_dir_all(&directory).map_err(|_| "Unable to save preferences.")?;
    let path = directory.join("capture-preference.json");
    let temporary = directory.join("capture-preference.tmp");
    std::fs::write(&temporary, if enabled { "true" } else { "false" })
        .map_err(|_| "Unable to save preferences.")?;
    std::fs::rename(temporary, path).map_err(|_| "Unable to save preferences.")?;
    state.enabled = enabled;
    state.last_error = None;
    state.epoch += 1;
    state.revision += 1;
    drop(state);
    let _ = app.emit("capture-changed", ());
    #[cfg(target_os = "linux")]
    if enabled {
        capture_focused(app.clone());
    }
    Ok(())
}
#[tauri::command]
pub async fn delete_captured(app: tauri::AppHandle, id: String) -> Result<(), String> {
    mutate(app, move |state| {
        state.items.retain(|clip| clip.id != id);
        Ok(())
    })
    .await
}
fn clear_items(state: &mut Snapshot, include_pinned: bool) {
    state.items.retain(|clip| !include_pinned && clip.pinned);
}
#[tauri::command]
pub async fn clear_captured(app: tauri::AppHandle, include_pinned: bool) -> Result<(), String> {
    mutate(app, move |state| {
        clear_items(state, include_pinned);
        Ok(())
    })
    .await
}
#[tauri::command]
pub async fn pin_captured(app: tauri::AppHandle, id: String, pinned: bool) -> Result<(), String> {
    mutate(app, move |state| {
        state
            .items
            .iter_mut()
            .find(|clip| clip.id == id)
            .ok_or("Item not found.")?
            .pinned = pinned;
        Ok(())
    })
    .await
}
#[tauri::command]
pub async fn edit_category(
    app: tauri::AppHandle,
    id: Option<String>,
    name: String,
    remove: bool,
) -> Result<(), String> {
    mutate(app, move |state| change_category(state, id, name, remove)).await
}
fn change_category(
    state: &mut Snapshot,
    id: Option<String>,
    name: String,
    remove: bool,
) -> Result<(), String> {
    if remove {
        let id = id.ok_or("Category not found.")?;
        state.categories.retain(|category| category.id != id);
        for clip in &mut state.items {
            if clip.category.as_ref() == Some(&id) {
                clip.category = None;
            }
        }
        return Ok(());
    }
    let name = name.trim().to_string();
    if name.is_empty() || name.chars().count() > 40 {
        return Err("Use a name between 1 and 40 characters.".into());
    }
    if state.categories.iter().any(|category| {
        Some(&category.id) != id.as_ref() && category.name.to_lowercase() == name.to_lowercase()
    }) {
        return Err("This category already exists.".into());
    }
    if let Some(id) = id {
        state
            .categories
            .iter_mut()
            .find(|category| category.id == id)
            .ok_or("Category not found.")?
            .name = name;
    } else {
        if state.categories.len() >= 30 {
            return Err("The 30-category limit has been reached.".into());
        }
        state.categories.push(Category {
            id: format!("category-{}", state.revision + 1),
            name,
        });
    }
    state
        .categories
        .sort_by_key(|category| category.name.to_lowercase());
    Ok(())
}

#[tauri::command]
pub async fn categorize_captured(
    app: tauri::AppHandle,
    id: String,
    category: Option<String>,
) -> Result<(), String> {
    mutate(app, move |state| {
        if category
            .as_ref()
            .is_some_and(|id| !state.categories.iter().any(|category| &category.id == id))
        {
            return Err("Category not found.".into());
        }
        state
            .items
            .iter_mut()
            .find(|clip| clip.id == id)
            .ok_or("Item not found.")?
            .category = category;
        Ok(())
    })
    .await
}
async fn mutate(
    app: tauri::AppHandle,
    change: impl FnOnce(&mut Snapshot) -> Result<(), String> + Send + 'static,
) -> Result<(), String> {
    let target = app.clone();
    tauri::async_runtime::spawn_blocking(move || target.state::<Service>().update(change))
        .await
        .map_err(|_| "History unavailable.")??;
    let _ = app.emit("capture-changed", ());
    Ok(())
}

pub fn report_capture(app: &tauri::AppHandle, error: Option<&str>) {
    if let Ok(mut state) = app.state::<Service>().0.lock() {
        state.last_error = error.map(String::from);
        state.revision += 1;
    }
    let _ = app.emit("capture-changed", ());
}

#[cfg(target_os = "linux")]
pub fn capture_focused(app: tauri::AppHandle) {
    // GTK/Wayland clipboard offers can arrive after the window focus event.
    // These bounded retries are tied to activation, not a background polling loop.
    let target = app.clone();
    let _ = app.run_on_main_thread(move || {
        for delay in [150, 450] {
            let target = target.clone();
            gtk::glib::timeout_add_local_once(std::time::Duration::from_millis(delay), move || {
                read_focused(target)
            });
        }
    });
}

#[cfg(target_os = "linux")]
fn read_focused(target: tauri::AppHandle) {
    if !target
        .get_webview_window("main")
        .and_then(|window| window.is_focused().ok())
        .unwrap_or(false)
    {
        return;
    }
    let service = target.state::<Service>();
    let Some(epoch) = service
        .0
        .try_lock()
        .ok()
        .and_then(|state| state.enabled.then_some(state.epoch))
    else {
        return;
    };
    let clipboard = gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD);
    let timeout_app = target.clone();
    let pending = std::rc::Rc::new(std::cell::Cell::new(true));
    let timeout_pending = pending.clone();
    gtk::glib::timeout_add_local_once(std::time::Duration::from_secs(2), move || {
        if timeout_pending.replace(false) {
            report_capture(
                &timeout_app,
                Some("The clipboard did not respond. Try capturing again."),
            );
        }
    });
    clipboard.request_contents(&gdk::Atom::intern("TARGETS"), move |clipboard, data| {
        if !pending.get() { return; }
        let Some(targets) = data.targets() else {
            pending.set(false);
            report_capture(&target, Some("Clipboard formats are unavailable."));
            return;
        };
        if targets.iter().any(|atom| matches!(atom.name().as_str(), "x-kde-passwordManagerHint" | "org.nspasteboard.ConcealedType" | "org.nspasteboard.TransientType" | "org.nspasteboard.AutoGeneratedType")) {
            pending.set(false);
            report_capture(&target, Some("Sensitive clipboard content was not saved."));
            return;
        }
        clipboard.request_text(move |_, text| {
            if !pending.replace(false) { return; }
            let text = text.map(str::to_owned);
            tauri::async_runtime::spawn_blocking(move || {
            let result = text.as_deref().ok_or("No text is available on the clipboard.").and_then(|text| {
                target.state::<Service>().insert_with_epoch(text.to_owned(), Some(epoch)).map_err(|_| "Unable to save text: capture is paused or the storage limit was reached.")
            });
            match result {
                Ok(()) => report_capture(&target, None),
                Err(error) => report_capture(&target, Some(error)),
            }
            });
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temporary_database() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "clipboard-test-{}-{}.sqlite3",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }
    #[test]
    fn sqlite_reopen_preserves_original_favorite_category_and_deletions() {
        let path = temporary_database();
        {
            let service = Service::default();
            service.open(&path).unwrap();
            service
                .insert("Ação ☕ 日本語\nsecond line".into())
                .unwrap();
            service
                .update(|state| {
                    state.categories.push(Category {
                        id: "category-90".into(),
                        name: "Trabalho".into(),
                    });
                    state.items[0].pinned = true;
                    state.items[0].category = Some("category-90".into());
                    Ok(())
                })
                .unwrap();
            service.insert("discard".into()).unwrap();
            service
                .update(|state| {
                    state.items.retain(|clip| clip.content != "discard");
                    Ok(())
                })
                .unwrap();
        }
        {
            let service = Service::default();
            service.open(&path).unwrap();
            let state = service.0.lock().unwrap();
            assert_eq!(state.items.len(), 1);
            assert_eq!(state.items[0].content, "Ação ☕ 日本語\nsecond line");
            assert!(state.items[0].pinned);
            assert_eq!(state.items[0].category.as_deref(), Some("category-90"));
            assert_eq!(state.categories[0].name, "Trabalho");
            assert!(state.revision > 90);
            drop(state);
            service
                .insert("Ação ☕ 日本語\nsecond line".into())
                .unwrap();
            assert_eq!(service.0.lock().unwrap().items.len(), 1);
        }
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn clear_history_preserves_pins_then_clears_all_across_reopens() {
        let path = temporary_database();
        {
            let service = Service::default();
            service.open(&path).unwrap();
            service.insert("pinned fixture".into()).unwrap();
            service
                .update(|state| {
                    state.items[0].pinned = true;
                    state.categories.push(Category {
                        id: "keep-category".into(),
                        name: "Work".into(),
                    });
                    Ok(())
                })
                .unwrap();
            service.insert("unpinned fixture".into()).unwrap();
            service
                .update(|state| {
                    clear_items(state, false);
                    Ok(())
                })
                .unwrap();
        }
        {
            let service = Service::default();
            service.open(&path).unwrap();
            let state = service.0.lock().unwrap();
            assert_eq!(state.items.len(), 1);
            assert_eq!(state.items[0].content, "pinned fixture");
            assert!(state.items[0].pinned);
            assert_eq!(state.categories.len(), 1);
            drop(state);
            service
                .update(|state| {
                    clear_items(state, true);
                    Ok(())
                })
                .unwrap();
        }
        {
            let service = Service::default();
            service.open(&path).unwrap();
            let state = service.0.lock().unwrap();
            assert!(state.items.is_empty());
            assert_eq!(state.categories.len(), 1);
        }
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn categories_validate_rename_and_remove_without_losing_text() {
        let path = temporary_database();
        {
            let service = Service::default();
            service.open(&path).unwrap();
            service.insert("keep me".into()).unwrap();
            service
                .update(|state| change_category(state, None, "  Trabalho  ".into(), false))
                .unwrap();
            let id = service.0.lock().unwrap().categories[0].id.clone();
            assert!(
                service
                    .update(|state| change_category(state, None, "trabalho".into(), false))
                    .is_err()
            );
            assert!(
                service
                    .update(|state| change_category(state, None, " ".into(), false))
                    .is_err()
            );
            service
                .update(|state| {
                    state.items[0].category = Some(id.clone());
                    state.items[0].pinned = true;
                    change_category(state, Some(id.clone()), "Referências".into(), false)
                })
                .unwrap();
            assert_eq!(service.0.lock().unwrap().categories[0].name, "Referências");
            service
                .update(|state| change_category(state, Some(id), String::new(), true))
                .unwrap();
        }
        let service = Service::default();
        service.open(&path).unwrap();
        let state = service.0.lock().unwrap();
        assert!(state.categories.is_empty());
        assert_eq!(state.items[0].content, "keep me");
        assert!(state.items[0].pinned);
        assert!(state.items[0].category.is_none());
        drop(state);
        drop(service);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn failed_sqlite_write_does_not_publish_memory_changes() {
        let path = temporary_database();
        {
            let service = Service::default();
            service.open(&path).unwrap();
            service.insert("keep".into()).unwrap();
            service
                .1
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .execute_batch("PRAGMA query_only=ON")
                .unwrap();
            assert!(service.insert("reject".into()).is_err());
            assert_eq!(service.0.lock().unwrap().items.len(), 1);
        }
        let service = Service::default();
        service.open(&path).unwrap();
        assert_eq!(service.0.lock().unwrap().items[0].content, "keep");
        drop(service);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn newer_database_is_left_intact() {
        let path = temporary_database();
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection.execute_batch("PRAGMA user_version=99; CREATE TABLE future(value TEXT); INSERT INTO future VALUES('keep');").unwrap();
        assert!(Service::default().open(&path).is_err());
        assert_eq!(
            connection
                .query_row("SELECT value FROM future", [], |row| row
                    .get::<_, String>(0))
                .unwrap(),
            "keep"
        );
        drop(connection);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn duplicate_preserves_pin_and_original_text() {
        let service = Service::default();
        let text = "https://maccy.app";
        service.insert(text.into()).unwrap();
        service.0.lock().unwrap().items[0].pinned = true;
        service.insert("outro".into()).unwrap();
        service.insert(text.into()).unwrap();
        let state = service.0.lock().unwrap();
        assert_eq!(state.items.len(), 2);
        assert_eq!(state.items[0].content, text);
        assert!(state.items[0].pinned);
    }
    #[test]
    fn stale_payload_after_pause_is_rejected() {
        let service = Service::default();
        {
            let mut state = service.0.lock().unwrap();
            state.enabled = true;
            state.epoch = 2;
        }
        assert!(service.insert_with_epoch("old".into(), Some(1)).is_err());
        service.0.lock().unwrap().enabled = false;
        assert!(service.insert_with_epoch("paused".into(), Some(2)).is_err());
        assert!(service.0.lock().unwrap().items.is_empty());
    }
    #[test]
    fn oversized_text_is_rejected() {
        let service = Service::default();
        assert!(
            service
                .insert("x".repeat(super::super::MAX_TEXT_BYTES + 1))
                .is_err()
        );
        assert!(service.0.lock().unwrap().items.is_empty());
    }
    #[test]
    fn count_is_bounded_without_dropping_pins() {
        let service = Service::default();
        service.insert("fixed".into()).unwrap();
        service.0.lock().unwrap().items[0].pinned = true;
        for i in 0..600 {
            service.insert(format!("fixture {i}")).unwrap();
        }
        let state = service.0.lock().unwrap();
        assert_eq!(state.items.len(), MAX_ITEMS);
        assert!(state.items.iter().any(|clip| clip.content == "fixed"));
    }
}
