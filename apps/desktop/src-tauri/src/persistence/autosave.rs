use std::path::PathBuf;

use crate::engine::canvas_state::{CanvasState, ProjectMeta};
use crate::persistence::project_io::{self, ProjectDocument};

/// Get the recovery directory for autosaves (separate from manual saves).
pub fn recovery_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("GlyphStudio").join("recovery")
}

/// Recovery file path for a given project.
pub fn recovery_path(project_id: &str) -> PathBuf {
    recovery_dir().join(format!("{}.pxs.recovery", project_id))
}

/// Write a recovery snapshot of the current canvas state.
pub fn write_recovery(canvas: &CanvasState, meta: &ProjectMeta) -> Result<(), String> {
    let doc = ProjectDocument::from_canvas_state(
        canvas,
        &meta.project_id,
        &meta.name,
        meta.color_mode,
        &meta.created_at,
    );
    let path = recovery_path(&meta.project_id);
    project_io::save_to_file(&doc, &path)
}

/// Remove the recovery file for a project (called after clean save or discard).
pub fn clear_recovery(project_id: &str) {
    let path = recovery_path(project_id);
    let _ = std::fs::remove_file(path);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_dir_ends_with_expected_segments() {
        let dir = recovery_dir();
        let components: Vec<_> = dir.components().collect();
        let last_two: Vec<_> = components.iter().rev().take(2).collect();
        // Last segment is "recovery", second-to-last is "GlyphStudio"
        assert_eq!(
            last_two[0].as_os_str().to_str().unwrap(),
            "recovery"
        );
        assert_eq!(
            last_two[1].as_os_str().to_str().unwrap(),
            "GlyphStudio"
        );
    }

    #[test]
    fn recovery_path_appends_correct_filename() {
        let path = recovery_path("proj-123");
        assert_eq!(
            path.file_name().unwrap().to_str().unwrap(),
            "proj-123.pxs.recovery"
        );
    }

    #[test]
    fn recovery_path_is_inside_recovery_dir() {
        let dir = recovery_dir();
        let path = recovery_path("some-id");
        assert!(path.starts_with(&dir));
    }

    #[test]
    fn clear_recovery_nonexistent_does_not_panic() {
        // Clearing a project that was never saved should silently succeed
        clear_recovery("nonexistent-project-id-that-surely-does-not-exist");
    }

    #[test]
    fn write_recovery_creates_readable_file() {
        let canvas = CanvasState::new(16, 16);
        let meta = ProjectMeta {
            project_id: "test-autosave-roundtrip".into(),
            name: "Test Project".into(),
            file_path: None,
            color_mode: crate::types::domain::ColorMode::Rgb,
            created_at: "2026-01-01T00:00:00Z".into(),
            is_dirty: false,
        };

        // Ensure recovery dir exists
        let dir = recovery_dir();
        std::fs::create_dir_all(&dir).expect("create recovery dir");

        // Write
        write_recovery(&canvas, &meta).expect("write_recovery should succeed");

        // Verify file exists and is loadable
        let path = recovery_path("test-autosave-roundtrip");
        assert!(path.exists(), "recovery file should exist on disk");

        let doc = project_io::load_from_file(&path).expect("load recovery file");
        assert_eq!(doc.project_id, "test-autosave-roundtrip");
        assert_eq!(doc.name, "Test Project");
        assert_eq!(doc.canvas_width, 16);
        assert_eq!(doc.canvas_height, 16);

        // Clean up
        clear_recovery("test-autosave-roundtrip");
        assert!(!path.exists(), "recovery file should be removed after clear");
    }
}
