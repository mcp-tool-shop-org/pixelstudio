use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::engine::canvas_state::CanvasState;
use crate::types::domain::ColorMode;

const SCHEMA_VERSION: u32 = 1;

/// Serialized project document — the on-disk format for .pxs files.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDocument {
    pub schema_version: u32,
    pub project_id: String,
    pub name: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub color_mode: ColorMode,
    pub layers: Vec<SerializedLayer>,
    pub active_layer_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// A layer as stored on disk — pixel data is raw RGBA bytes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerializedLayer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
    pub pixel_data: Vec<u8>,
}

impl ProjectDocument {
    /// Build a document from live canvas state for serialization.
    pub fn from_canvas_state(
        canvas: &CanvasState,
        project_id: &str,
        name: &str,
        color_mode: ColorMode,
        created_at: &str,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            schema_version: SCHEMA_VERSION,
            project_id: project_id.to_string(),
            name: name.to_string(),
            canvas_width: canvas.width,
            canvas_height: canvas.height,
            color_mode,
            layers: canvas.layers.iter().map(|l| SerializedLayer {
                id: l.id.clone(),
                name: l.name.clone(),
                visible: l.visible,
                locked: l.locked,
                opacity: l.opacity,
                pixel_data: l.buffer.to_bytes(),
            }).collect(),
            active_layer_id: canvas.active_layer_id.clone(),
            created_at: created_at.to_string(),
            updated_at: now,
        }
    }

    /// Reconstruct live canvas state from a loaded document.
    pub fn to_canvas_state(&self) -> CanvasState {
        use crate::engine::canvas_state::Layer;
        use crate::engine::pixel_buffer::PixelBuffer;

        let layers: Vec<Layer> = self.layers.iter().map(|sl| Layer {
            id: sl.id.clone(),
            name: sl.name.clone(),
            visible: sl.visible,
            locked: sl.locked,
            opacity: sl.opacity,
            buffer: PixelBuffer::from_bytes(self.canvas_width, self.canvas_height, sl.pixel_data.clone()),
        }).collect();

        CanvasState::from_layers(
            self.canvas_width,
            self.canvas_height,
            layers,
            self.active_layer_id.clone(),
        )
    }
}

/// Save a project document to a .pxs file (JSON).
pub fn save_to_file(doc: &ProjectDocument, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(doc)
        .map_err(|e| format!("Serialization failed: {}", e))?;
    std::fs::write(path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

/// Load a project document from a .pxs file.
pub fn load_from_file(path: &Path) -> Result<ProjectDocument, String> {
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    let json = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let doc: ProjectDocument = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid project format: {}", e))?;

    if doc.schema_version > SCHEMA_VERSION {
        return Err(format!(
            "Project file version {} is newer than supported version {}",
            doc.schema_version, SCHEMA_VERSION
        ));
    }

    Ok(doc)
}
