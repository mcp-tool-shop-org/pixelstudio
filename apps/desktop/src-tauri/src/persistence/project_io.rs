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

// ==========================================================================
// Tests
// ==========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::canvas_state::CanvasState;
    use crate::types::domain::ColorMode;

    fn roundtrip(canvas: &CanvasState) -> CanvasState {
        let doc = ProjectDocument::from_canvas_state(
            canvas, "test-proj", "Test", ColorMode::Rgb, "2025-01-01T00:00:00Z",
        );
        doc.to_canvas_state()
    }

    // --- V2 round-trip ---

    #[test]
    fn roundtrip_preserves_dimensions() {
        let cs = CanvasState::new(16, 24);
        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.width, 16);
        assert_eq!(cs2.height, 24);
    }

    #[test]
    fn roundtrip_preserves_layer_count() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_layer(Some("Layer 2".into()));
        cs.create_layer(Some("Layer 3".into()));
        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.layers.len(), 3);
    }

    #[test]
    fn roundtrip_preserves_pixel_data() {
        let mut cs = CanvasState::new(4, 4);
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0), (1, 1)]).unwrap();
        cs.end_stroke().unwrap();

        let cs2 = roundtrip(&cs);
        let layer = &cs2.layers[0];
        let c = layer.buffer.get_pixel(0, 0);
        assert_eq!([c.r, c.g, c.b, c.a], [255, 0, 0, 255]);
        let c2 = layer.buffer.get_pixel(1, 1);
        assert_eq!([c2.r, c2.g, c2.b, c2.a], [255, 0, 0, 255]);
        // Untouched pixel stays transparent
        let c3 = layer.buffer.get_pixel(3, 3);
        assert_eq!([c3.r, c3.g, c3.b, c3.a], [0, 0, 0, 0]);
    }

    #[test]
    fn roundtrip_preserves_layer_properties() {
        let mut cs = CanvasState::new(4, 4);
        let id = cs.active_layer_id.clone().unwrap();
        cs.rename_layer(&id, "My Layer".to_string()).unwrap();
        cs.set_layer_opacity(&id, 0.5).unwrap();
        cs.set_layer_lock(&id, true).unwrap();

        let cs2 = roundtrip(&cs);
        let layer = &cs2.layers[0];
        assert_eq!(layer.name, "My Layer");
        assert!((layer.opacity - 0.5).abs() < 0.01);
        assert!(layer.locked);
    }

    #[test]
    fn roundtrip_preserves_frame_count() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_frame(None);
        cs.create_frame(None);
        assert_eq!(cs.frames.len(), 3);

        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.frames.len(), 3);
    }

    #[test]
    fn roundtrip_preserves_multiframe_pixels() {
        let mut cs = CanvasState::new(4, 4);

        // Draw red on frame 1
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Create and draw green on frame 2
        cs.create_frame(None);
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(1, 1)]).unwrap();
        cs.end_stroke().unwrap();

        let cs2 = roundtrip(&cs);

        // Should be on frame 2 (active_frame_index=1)
        let c = cs2.layers[0].buffer.get_pixel(1, 1);
        assert_eq!([c.r, c.g, c.b, c.a], [0, 255, 0, 255]);

        // Switch to frame 1 and check red pixel
        let mut cs2 = cs2;
        let f1_id = cs2.frames[0].id.clone();
        cs2.select_frame(&f1_id).unwrap();
        let c2 = cs2.layers[0].buffer.get_pixel(0, 0);
        assert_eq!([c2.r, c2.g, c2.b, c2.a], [255, 0, 0, 255]);
    }

    #[test]
    fn roundtrip_preserves_active_frame_index() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_frame(None);
        // active_frame_index should be 1 (the new frame)
        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.active_frame_index, 1);
    }

    #[test]
    fn roundtrip_preserves_package_metadata() {
        let mut cs = CanvasState::new(4, 4);
        cs.package_metadata.package_name = "my-sprite".to_string();
        cs.package_metadata.version = "1.2.3".to_string();
        cs.package_metadata.author = "tester".to_string();
        cs.package_metadata.description = "a test sprite".to_string();
        cs.package_metadata.tags = vec!["tag1".into(), "tag2".into()];

        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.package_metadata.package_name, "my-sprite");
        assert_eq!(cs2.package_metadata.version, "1.2.3");
        assert_eq!(cs2.package_metadata.author, "tester");
        assert_eq!(cs2.package_metadata.tags, vec!["tag1", "tag2"]);
    }

    #[test]
    fn roundtrip_clears_undo_redo_stacks() {
        let mut cs = CanvasState::new(4, 4);
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();
        assert_eq!(cs.undo_stack.len(), 1);

        let cs2 = roundtrip(&cs);
        // Undo/redo should not survive serialization
        assert!(cs2.undo_stack.is_empty());
        assert!(cs2.redo_stack.is_empty());
    }

    #[test]
    fn roundtrip_preserves_frame_duration() {
        let mut cs = CanvasState::new(4, 4);
        cs.frames[0].duration_ms = Some(200);
        cs.create_frame(None);
        cs.frames[1].duration_ms = Some(100);

        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.frames[0].duration_ms, Some(200));
        assert_eq!(cs2.frames[1].duration_ms, Some(100));
    }

    // --- V1 migration ---

    #[test]
    fn v1_migration_creates_single_frame() {
        // Simulate a V1 document: layers at top level, no frames
        let doc = ProjectDocument {
            schema_version: 1,
            project_id: "v1-proj".into(),
            name: "V1 Test".into(),
            canvas_width: 4,
            canvas_height: 4,
            color_mode: ColorMode::Rgb,
            layers: vec![SerializedLayer {
                id: "l1".into(),
                name: "Layer 1".into(),
                visible: true,
                locked: false,
                opacity: 1.0,
                pixel_data: vec![0u8; 4 * 4 * 4],
            }],
            active_layer_id: Some("l1".into()),
            frames: Vec::new(), // V1: no frames field
            active_frame_index: 0,
            clips: Vec::new(),
            package_metadata: Default::default(),
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-01T00:00:00Z".into(),
        };

        let cs = doc.to_canvas_state();
        assert_eq!(cs.width, 4);
        assert_eq!(cs.height, 4);
        assert_eq!(cs.frames.len(), 1);
        assert_eq!(cs.layers.len(), 1);
    }

    // --- JSON serialization ---

    #[test]
    fn json_roundtrip() {
        let mut cs = CanvasState::new(4, 4);
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(2, 2)]).unwrap();
        cs.end_stroke().unwrap();

        let doc = ProjectDocument::from_canvas_state(
            &cs, "json-test", "JSON Test", ColorMode::Rgb, "2025-01-01T00:00:00Z",
        );

        let json = serde_json::to_string(&doc).unwrap();
        let doc2: ProjectDocument = serde_json::from_str(&json).unwrap();
        let cs2 = doc2.to_canvas_state();

        let c = cs2.layers[0].buffer.get_pixel(2, 2);
        assert_eq!([c.r, c.g, c.b, c.a], [255, 0, 0, 255]);
    }

    #[test]
    fn schema_version_is_current() {
        let cs = CanvasState::new(4, 4);
        let doc = ProjectDocument::from_canvas_state(
            &cs, "v-test", "Version", ColorMode::Rgb, "2025-01-01T00:00:00Z",
        );
        assert_eq!(doc.schema_version, SCHEMA_VERSION);
        assert_eq!(doc.schema_version, 2);
    }

    // --- File I/O ---

    #[test]
    fn save_and_load_roundtrip() {
        let mut cs = CanvasState::new(8, 8);
        cs.begin_stroke("brush".into(), [100, 200, 50, 255]).unwrap();
        cs.stroke_points(&[(3, 3)]).unwrap();
        cs.end_stroke().unwrap();

        let doc = ProjectDocument::from_canvas_state(
            &cs, "io-test", "IO Test", ColorMode::Rgb, "2025-01-01T00:00:00Z",
        );

        let dir = std::env::temp_dir().join("pixelstudio_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("save_load_test.pxs");

        save_to_file(&doc, &path).unwrap();
        let loaded = load_from_file(&path).unwrap();
        let cs2 = loaded.to_canvas_state();

        let c = cs2.layers[0].buffer.get_pixel(3, 3);
        assert_eq!([c.r, c.g, c.b, c.a], [100, 200, 50, 255]);

        // Cleanup
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn load_nonexistent_file_fails() {
        let result = load_from_file(Path::new("/tmp/nonexistent_pixelstudio_test.pxs"));
        assert!(result.is_err());
    }

    // --- Anchor serialization ---

    #[test]
    fn roundtrip_preserves_anchors() {
        use crate::engine::anchor::{Anchor, AnchorKind};

        let mut cs = CanvasState::new(8, 8);
        let anchor = Anchor::new("Head".to_string(), AnchorKind::Head, 4, 2);
        cs.frames[0].anchors.push(anchor);

        let cs2 = roundtrip(&cs);
        assert_eq!(cs2.frames[0].anchors.len(), 1);
        assert_eq!(cs2.frames[0].anchors[0].name, "Head");
        assert_eq!(cs2.frames[0].anchors[0].kind, AnchorKind::Head);
        assert_eq!(cs2.frames[0].anchors[0].x, 4);
        assert_eq!(cs2.frames[0].anchors[0].y, 2);
    }
}
