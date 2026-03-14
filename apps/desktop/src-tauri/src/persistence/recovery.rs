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
