//! Snapshot the legacy SQLite database without deleting or modifying old data.
use rusqlite::{Connection, OpenFlags};
use std::{
    fs,
    path::Path,
    time::{Duration, Instant},
};

pub fn migrate(directory: &Path) -> Result<(), String> {
    if directory.file_name().and_then(|name| name.to_str()) != Some("com.felipecepluki.tuck") {
        return Ok(());
    }
    let legacy = directory
        .parent()
        .ok_or("Migration directory unavailable.")?
        .join("com.felipecepluki.clipboard-manager");
    let target = directory.join("history.sqlite3");
    let marker = directory.join("legacy-migration.json");
    if target.exists() || marker.exists() {
        return Ok(());
    }
    let source = legacy.join("history.sqlite3");
    if !source.exists() {
        return Ok(());
    }
    let staged = directory.join("history-migration.tmp");
    if staged.exists() {
        fs::remove_file(&staged).map_err(|_| "Unable to clean up an incomplete migration.")?;
    }
    let result = (|| {
        let original = Connection::open_with_flags(&source, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "Unable to open legacy history.")?;
        let mut copied = Connection::open(&staged).map_err(|_| "Unable to prepare migration.")?;
        {
            let backup = rusqlite::backup::Backup::new(&original, &mut copied)
                .map_err(|_| "Unable to start migration.")?;
            let deadline = Instant::now() + Duration::from_secs(5);
            loop {
                match backup
                    .step(128)
                    .map_err(|_| "Unable to copy legacy history.")?
                {
                    rusqlite::backup::StepResult::Done => break,
                    _ if Instant::now() > deadline => {
                        return Err("Legacy history is busy. Close the older app and try again."
                            .to_string());
                    }
                    _ => std::thread::sleep(Duration::from_millis(25)),
                }
            }
        }
        let integrity: String = copied
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .map_err(|_| "Unable to validate migration.")?;
        if integrity != "ok" {
            return Err("The history backup failed validation.".into());
        }
        drop(copied);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&staged, fs::Permissions::from_mode(0o600))
                .map_err(|_| "Unable to protect migrated history.")?;
        }
        let preference = legacy.join("capture-preference.json");
        if preference.exists() && !directory.join("capture-preference.json").exists() {
            fs::copy(preference, directory.join("capture-preference.json"))
                .map_err(|_| "Unable to copy capture preferences.")?;
        }
        // Hard-link publication is atomic and never overwrites an existing destination.
        fs::hard_link(&staged, &target)
            .map_err(|_| "Unable to publish migration without overwriting data.")?;
        fs::remove_file(&staged)
            .map_err(|_| "History copied; unable to remove the temporary backup.")?;
        fs::write(marker, "{\"source\":\"com.felipecepluki.clipboard-manager\",\"database\":\"history.sqlite3\",\"original_preserved\":true}\n").map_err(|_| "History copied; unable to save the migration marker.")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(staged);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migrates_committed_wal_data_and_never_overwrites_new_history() {
        let root = std::env::temp_dir().join(format!(
            "tuck-migration-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let old = root.join("com.felipecepluki.clipboard-manager");
        let new = root.join("com.felipecepluki.tuck");
        fs::create_dir_all(&old).unwrap();
        fs::create_dir_all(&new).unwrap();
        let original = Connection::open(old.join("history.sqlite3")).unwrap();
        original.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE fixture(content TEXT,pinned INTEGER,category TEXT); INSERT INTO fixture VALUES('Ação ☕ 日本語',1,'Trabalho');").unwrap();
        fs::write(old.join("capture-preference.json"), "true").unwrap();
        migrate(&new).unwrap();
        let copied = Connection::open(new.join("history.sqlite3")).unwrap();
        assert_eq!(
            copied
                .query_row("SELECT content,pinned,category FROM fixture", [], |row| Ok(
                    (
                        row.get::<_, String>(0)?,
                        row.get::<_, i32>(1)?,
                        row.get::<_, String>(2)?
                    )
                ))
                .unwrap(),
            ("Ação ☕ 日本語".into(), 1, "Trabalho".into())
        );
        assert_eq!(
            fs::read_to_string(new.join("capture-preference.json")).unwrap(),
            "true"
        );
        copied.execute("DELETE FROM fixture", []).unwrap();
        migrate(&new).unwrap();
        assert_eq!(
            copied
                .query_row("SELECT count(*) FROM fixture", [], |row| row
                    .get::<_, i32>(0))
                .unwrap(),
            0
        );
        assert_eq!(
            original
                .query_row("SELECT count(*) FROM fixture", [], |row| row
                    .get::<_, i32>(0))
                .unwrap(),
            1
        );
        drop(copied);
        drop(original);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn bad_database_preserves_original_and_does_not_publish_partial_copy() {
        let root = std::env::temp_dir().join(format!("tuck-bad-migration-{}", std::process::id()));
        let old = root.join("com.felipecepluki.clipboard-manager");
        let new = root.join("com.felipecepluki.tuck");
        fs::create_dir_all(&old).unwrap();
        fs::create_dir_all(&new).unwrap();
        fs::write(old.join("history.sqlite3"), b"not sqlite").unwrap();
        assert!(migrate(&new).is_err());
        assert!(!new.join("history.sqlite3").exists());
        assert_eq!(
            fs::read(old.join("history.sqlite3")).unwrap(),
            b"not sqlite"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
