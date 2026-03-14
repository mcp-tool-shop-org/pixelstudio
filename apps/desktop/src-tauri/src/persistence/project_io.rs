use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::engine::canvas_state::{AnimationFrame, CanvasState};
use crate::types::domain::ColorMode;

const SCHEMA_VERSION: u32 = 2;

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

/// A single animation frame as stored on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerializedFrame {
    pub id: String,
    pub name: String,
    pub layers: Vec<SerializedLayer>,
    pub active_layer_id: Option<String>,
    /// Optional per-frame duration override in ms. None = use global FPS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u32>,
    /// Frame-local anchors for part-aware motion.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub anchors: Vec<crate::engine::anchor::Anchor>,
}

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
    /// V1 compat: single-frame projects stored layers here.
    #[serde(default)]
    pub layers: Vec<SerializedLayer>,
    /// V1 compat: single-frame active layer.
    #[serde(default)]
    pub active_layer_id: Option<String>,
    /// V2+: multi-frame animation data.
    #[serde(default)]
    pub frames: Vec<SerializedFrame>,
    /// V2+: which frame is active.
    #[serde(default)]
    pub active_frame_index: usize,
    /// Project-level clip definitions.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub clips: Vec<crate::engine::clip::Clip>,
    /// Package identity metadata for bundles/manifests.
    #[serde(default, skip_serializing_if = "is_default_package_metadata")]
    pub package_metadata: crate::engine::canvas_state::PackageMetadata,
    pub created_at: String,
    pub updated_at: String,
}

fn is_default_package_metadata(m: &crate::engine::canvas_state::PackageMetadata) -> bool {
    m.package_name.is_empty()
        && m.version == "0.1.0"
        && m.author.is_empty()
        && m.description.is_empty()
        && m.tags.is_empty()
}

fn serialize_layers(layers: &[crate::engine::canvas_state::Layer]) -> Vec<SerializedLayer> {
    layers.iter().map(|l| SerializedLayer {
        id: l.id.clone(),
        name: l.name.clone(),
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        pixel_data: l.buffer.to_bytes(),
    }).collect()
}

fn deserialize_layers(
    serialized: &[SerializedLayer],
    width: u32,
    height: u32,
) -> Vec<crate::engine::canvas_state::Layer> {
    use crate::engine::canvas_state::Layer;
    use crate::engine::pixel_buffer::PixelBuffer;

    serialized.iter().map(|sl| Layer {
        id: sl.id.clone(),
        name: sl.name.clone(),
        visible: sl.visible,
        locked: sl.locked,
        opacity: sl.opacity,
        buffer: PixelBuffer::from_bytes(width, height, sl.pixel_data.clone()),
    }).collect()
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

        // Serialize all frames. Active frame's data is in top-level fields,
        // inactive frames have their data stashed inside the frame structs.
        let mut frames = Vec::new();
        for (i, f) in canvas.frames.iter().enumerate() {
            if i == canvas.active_frame_index {
                // Active frame: layers are in canvas top-level fields
                frames.push(SerializedFrame {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    layers: serialize_layers(&canvas.layers),
                    active_layer_id: canvas.active_layer_id.clone(),
                    duration_ms: f.duration_ms,
                    anchors: f.anchors.clone(),
                });
            } else {
                // Stashed frame: layers are inside the frame struct
                frames.push(SerializedFrame {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    layers: serialize_layers(&f.layers),
                    active_layer_id: f.active_layer_id.clone(),
                    duration_ms: f.duration_ms,
                    anchors: f.anchors.clone(),
                });
            }
        }

        Self {
            schema_version: SCHEMA_VERSION,
            project_id: project_id.to_string(),
            name: name.to_string(),
            canvas_width: canvas.width,
            canvas_height: canvas.height,
            color_mode,
            layers: Vec::new(), // V2 uses frames instead
            active_layer_id: None,
            frames,
            active_frame_index: canvas.active_frame_index,
            clips: canvas.clips.clone(),
            package_metadata: canvas.package_metadata.clone(),
            created_at: created_at.to_string(),
            updated_at: now,
        }
    }

    /// Reconstruct live canvas state from a loaded document.
    pub fn to_canvas_state(&self) -> CanvasState {
        if !self.frames.is_empty() {
            // V2 multi-frame path
            let anim_frames: Vec<AnimationFrame> = self.frames.iter().map(|sf| {
                let layers = deserialize_layers(&sf.layers, self.canvas_width, self.canvas_height);
                let layer_counter = layers.len() as u32;
                AnimationFrame {
                    id: sf.id.clone(),
                    name: sf.name.clone(),
                    layers,
                    active_layer_id: sf.active_layer_id.clone(),
                    undo_stack: Vec::new(),
                    redo_stack: Vec::new(),
                    layer_counter,
                    duration_ms: sf.duration_ms,
                    anchors: sf.anchors.clone(),
                }
            }).collect();

            let mut cs = CanvasState::from_frames(
                self.canvas_width,
                self.canvas_height,
                anim_frames,
                self.active_frame_index,
            );
            cs.clips = self.clips.clone();
            cs.package_metadata = self.package_metadata.clone();
            cs
        } else {
            // V1 migration: single-frame project, layers at top level
            let layers = deserialize_layers(&self.layers, self.canvas_width, self.canvas_height);
            CanvasState::from_layers(
                self.canvas_width,
                self.canvas_height,
                layers,
                self.active_layer_id.clone(),
            )
        }
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
