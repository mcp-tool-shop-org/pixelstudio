use std::path::PathBuf;

use crate::engine::canvas_state::{CanvasState, ProjectMeta};
use crate::persistence::project_io::{self, ProjectDocument};

/// Get the recovery directory for autosaves (separate from manual saves).
pub fn recovery_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("PixelStudio").join("recovery")
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
