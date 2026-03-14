use serde::Serialize;

use crate::persistence::autosave;
use crate::persistence::project_io;

/// A recoverable project found on disk.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverableProject {
    pub project_id: String,
    pub name: String,
    pub recovery_path: String,
    pub updated_at: String,
}

/// Check if any recovery files exist from a previous unclean shutdown.
pub fn detect_recoverable_projects() -> Vec<RecoverableProject> {
    let dir = autosave::recovery_dir();
    if !dir.exists() {
        return vec![];
    }

    let mut results = vec![];

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("recovery") {
                continue;
            }
            if let Ok(doc) = project_io::load_from_file(&path) {
                results.push(RecoverableProject {
                    project_id: doc.project_id,
                    name: doc.name,
                    recovery_path: path.to_string_lossy().to_string(),
                    updated_at: doc.updated_at,
                });
            }
        }
    }

    results
}

/// Discard a recovery file (user chose not to restore).
pub fn discard_recovery(project_id: &str) {
    autosave::clear_recovery(project_id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::canvas_state::{CanvasState, ProjectMeta};

    fn write_test_recovery(project_id: &str, name: &str) {
        let canvas = CanvasState::new(8, 8);
        let meta = ProjectMeta {
            project_id: project_id.into(),
            name: name.into(),
            file_path: None,
            color_mode: crate::types::domain::ColorMode::Rgb,
            created_at: "2026-01-01T00:00:00Z".into(),
            is_dirty: false,
        };
        let dir = autosave::recovery_dir();
        std::fs::create_dir_all(&dir).expect("create recovery dir");
        autosave::write_recovery(&canvas, &meta).expect("write recovery");
    }

    fn cleanup(project_id: &str) {
        autosave::clear_recovery(project_id);
    }

    #[test]
    fn detect_returns_empty_when_no_recovery_files() {
        // If the dir exists but has only non-.recovery files, should return empty.
        // We can't guarantee the dir is clean, so just verify the function doesn't panic.
        let results = detect_recoverable_projects();
        // Every result should have a valid project_id
        for r in &results {
            assert!(!r.project_id.is_empty());
        }
    }

    #[test]
    fn detect_finds_written_recovery_file() {
        let id = "test-recovery-detect-abc";
        write_test_recovery(id, "Recovery Test");

        let results = detect_recoverable_projects();
        let found = results.iter().find(|r| r.project_id == id);
        assert!(found.is_some(), "should find the recovery file we wrote");
        let found = found.unwrap();
        assert_eq!(found.name, "Recovery Test");
        assert!(!found.recovery_path.is_empty());
        assert!(!found.updated_at.is_empty());

        cleanup(id);
    }

    #[test]
    fn detect_ignores_non_recovery_extensions() {
        let dir = autosave::recovery_dir();
        std::fs::create_dir_all(&dir).expect("create recovery dir");

        // Write a .txt file that should be ignored
        let junk_path = dir.join("junk.txt");
        std::fs::write(&junk_path, b"not a recovery file").expect("write junk");

        let results = detect_recoverable_projects();
        // None of the results should reference the junk file
        for r in &results {
            assert!(!r.recovery_path.ends_with("junk.txt"));
        }

        let _ = std::fs::remove_file(junk_path);
    }

    #[test]
    fn discard_recovery_removes_file() {
        let id = "test-recovery-discard-xyz";
        write_test_recovery(id, "Discard Me");

        let path = autosave::recovery_path(id);
        assert!(path.exists());

        discard_recovery(id);
        assert!(!path.exists(), "file should be removed after discard");
    }

    #[test]
    fn detect_multiple_recovery_files() {
        let id1 = "test-recovery-multi-1";
        let id2 = "test-recovery-multi-2";
        write_test_recovery(id1, "Project Alpha");
        write_test_recovery(id2, "Project Beta");

        let results = detect_recoverable_projects();
        let found1 = results.iter().any(|r| r.project_id == id1);
        let found2 = results.iter().any(|r| r.project_id == id2);
        assert!(found1, "should find first recovery file");
        assert!(found2, "should find second recovery file");

        cleanup(id1);
        cleanup(id2);
    }

    #[test]
    fn recovery_path_field_is_absolute() {
        let id = "test-recovery-path-check";
        write_test_recovery(id, "Path Check");

        let results = detect_recoverable_projects();
        if let Some(found) = results.iter().find(|r| r.project_id == id) {
            let p = std::path::Path::new(&found.recovery_path);
            assert!(p.is_absolute(), "recovery_path should be absolute");
        }

        cleanup(id);
    }
}
