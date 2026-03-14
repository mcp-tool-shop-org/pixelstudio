use std::path::PathBuf;

use crate::engine::preset::MotionPresetDocument;

/// Get the presets directory (user-level, separate from projects).
pub fn presets_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("PixelStudio").join("presets")
}

/// File path for a preset by ID.
fn preset_path(id: &str) -> PathBuf {
    presets_dir().join(format!("{}.preset.json", id))
}

/// Save a preset document to disk.
pub fn save_preset(doc: &MotionPresetDocument) -> Result<(), String> {
    let dir = presets_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create presets directory: {}", e))?;

    let path = preset_path(&doc.id);
    let json = serde_json::to_string_pretty(doc)
        .map_err(|e| format!("Failed to serialize preset: {}", e))?;

    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write preset file: {}", e))?;

    Ok(())
}

/// Load a single preset by ID.
pub fn load_preset(id: &str) -> Result<MotionPresetDocument, String> {
    let path = preset_path(id);
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preset file: {}", e))?;

    serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse preset: {}", e))
}

/// List all preset documents from the presets directory.
pub fn list_presets() -> Vec<MotionPresetDocument> {
    let dir = presets_dir();
    if !dir.exists() {
        return Vec::new();
    }

    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut presets = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(json) = std::fs::read_to_string(&path) {
                if let Ok(doc) = serde_json::from_str::<MotionPresetDocument>(&json) {
                    presets.push(doc);
                }
            }
        }
    }

    // Sort by modified_at descending (most recent first)
    presets.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    presets
}

/// Delete a preset by ID.
pub fn delete_preset(id: &str) -> Result<(), String> {
    let path = preset_path(id);
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete preset: {}", e))?;
    }
    Ok(())
}
