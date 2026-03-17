use std::sync::Mutex;

use super::pixel_buffer::{Color, PixelBuffer};

/// A single layer in the canvas state.
pub struct Layer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
    pub buffer: PixelBuffer,
}

/// A pixel patch: position + before/after color for undo/redo.
#[derive(Clone)]
pub struct PixelPatch {
    pub x: u32,
    pub y: u32,
    pub before: [u8; 4],
    pub after: [u8; 4],
}

/// A committed stroke transaction — the unit of undo/redo.
#[derive(Clone)]
pub struct StrokeRecord {
    pub id: String,
    pub layer_id: String,
    pub tool: String,
    pub color: [u8; 4],
    pub patches: Vec<PixelPatch>,
}

impl StrokeRecord {
    pub fn is_empty(&self) -> bool {
        self.patches.is_empty()
    }
}

/// A single undoable action — either a pixel stroke or a metadata operation.
#[derive(Clone)]
pub enum UndoAction {
    Stroke(StrokeRecord),
    SliceCreate(super::slice::SliceRegion),
    SliceDelete(super::slice::SliceRegion),
}

/// In-flight stroke being built up before commit.
pub struct ActiveStroke {
    pub id: String,
    pub layer_id: String,
    pub tool: String,
    pub color: [u8; 4],
    pub patches: Vec<PixelPatch>,
    /// Track which pixels have already been touched this stroke to avoid duplicate patches.
    pub touched: std::collections::HashSet<(u32, u32)>,
}

/// A single animation frame — snapshot of all layers + undo history.
pub struct AnimationFrame {
    pub id: String,
    pub name: String,
    pub layers: Vec<Layer>,
    pub active_layer_id: Option<String>,
    pub undo_stack: Vec<UndoAction>,
    pub redo_stack: Vec<UndoAction>,
    pub layer_counter: u32,
    /// Optional per-frame duration override in milliseconds.
    /// None = use global FPS for timing.
    pub duration_ms: Option<u32>,
    /// Frame-local anchors for part-aware motion.
    pub anchors: Vec<super::anchor::Anchor>,
    /// Frame-local slice regions for sprite sheet export.
    pub slice_regions: Vec<super::slice::SliceRegion>,
}

/// Holds all pixel data for the active project. Owned by Rust, authoritative.
/// Package identity metadata for asset bundles and manifests.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageMetadata {
    #[serde(default = "default_package_name")]
    pub package_name: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_package_name() -> String { String::new() }
fn default_version() -> String { "0.1.0".to_string() }

impl Default for PackageMetadata {
    fn default() -> Self {
        Self {
            package_name: String::new(),
            version: "0.1.0".to_string(),
            author: String::new(),
            description: String::new(),
            tags: Vec::new(),
        }
    }
}

pub struct CanvasState {
    pub width: u32,
    pub height: u32,
    /// The layers/undo for the currently active frame are stored inline
    /// for zero-cost access by all existing code paths.
    pub layers: Vec<Layer>,
    pub active_layer_id: Option<String>,
    pub undo_stack: Vec<UndoAction>,
    pub redo_stack: Vec<UndoAction>,
    pub active_stroke: Option<ActiveStroke>,
    layer_counter: u32,
    /// All frames in the animation. The active frame's data lives in the
    /// top-level fields above; inactive frames are stored here.
    pub frames: Vec<AnimationFrame>,
    pub active_frame_index: usize,
    frame_counter: u32,
    /// Project-level clip definitions (named frame spans for export).
    pub clips: Vec<super::clip::Clip>,
    /// Package identity metadata (persisted with project).
    pub package_metadata: PackageMetadata,
}

impl CanvasState {
    pub fn new(width: u32, height: u32) -> Self {
        let default_layer = Layer {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Layer 1".to_string(),
            visible: true,
            locked: false,
            opacity: 1.0,
            buffer: PixelBuffer::new(width, height),
        };
        let active_id = default_layer.id.clone();
        let frame_id = uuid::Uuid::new_v4().to_string();
        Self {
            width,
            height,
            layers: vec![default_layer],
            active_layer_id: Some(active_id),
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            active_stroke: None,
            layer_counter: 1,
            frames: vec![AnimationFrame {
                id: frame_id,
                name: "Frame 1".to_string(),
                layers: Vec::new(), // active frame data lives in top-level fields
                active_layer_id: None,
                undo_stack: Vec::new(),
                redo_stack: Vec::new(),
                layer_counter: 0,
                duration_ms: None,
                anchors: Vec::new(),
                slice_regions: Vec::new(),
            }],
            active_frame_index: 0,
            frame_counter: 1,
            clips: Vec::new(),
            package_metadata: PackageMetadata::default(),
        }
    }

    /// Reconstruct canvas state from deserialized layers (used by project_io).
    /// Legacy single-frame constructor — wraps layers in one frame.
    pub fn from_layers(
        width: u32,
        height: u32,
        layers: Vec<Layer>,
        active_layer_id: Option<String>,
    ) -> Self {
        let layer_counter = layers.len() as u32;
        let frame_id = uuid::Uuid::new_v4().to_string();
        Self {
            width,
            height,
            layers,
            active_layer_id,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            active_stroke: None,
            layer_counter,
            frames: vec![AnimationFrame {
                id: frame_id,
                name: "Frame 1".to_string(),
                layers: Vec::new(),
                active_layer_id: None,
                undo_stack: Vec::new(),
                redo_stack: Vec::new(),
                layer_counter: 0,
                duration_ms: None,
                anchors: Vec::new(),
                slice_regions: Vec::new(),
            }],
            active_frame_index: 0,
            frame_counter: 1,
            clips: Vec::new(),
            package_metadata: PackageMetadata::default(),
        }
    }

    /// Reconstruct from serialized frames (multi-frame project_io).
    pub fn from_frames(
        width: u32,
        height: u32,
        frames: Vec<AnimationFrame>,
        active_frame_index: usize,
    ) -> Self {
        let idx = active_frame_index.min(frames.len().saturating_sub(1));
        let frame_counter = frames.len() as u32;

        // Extract active frame's data into top-level fields
        let mut frames = frames;
        let active = &mut frames[idx];
        let layers = std::mem::take(&mut active.layers);
        let active_layer_id = active.active_layer_id.take();
        let undo_stack = std::mem::take(&mut active.undo_stack);
        let redo_stack = std::mem::take(&mut active.redo_stack);
        let layer_counter = active.layer_counter;

        Self {
            width,
            height,
            layers,
            active_layer_id,
            undo_stack,
            redo_stack,
            active_stroke: None,
            layer_counter,
            frames,
            active_frame_index: idx,
            frame_counter,
            clips: Vec::new(),
            package_metadata: PackageMetadata::default(),
        }
    }

    // --- Layer management ---

    pub fn create_layer(&mut self, name: Option<String>) -> String {
        self.layer_counter += 1;
        let layer_name = name.unwrap_or_else(|| format!("Layer {}", self.layer_counter));
        let layer = Layer {
            id: uuid::Uuid::new_v4().to_string(),
            name: layer_name,
            visible: true,
            locked: false,
            opacity: 1.0,
            buffer: PixelBuffer::new(self.width, self.height),
        };
        let id = layer.id.clone();
        self.layers.push(layer);
        self.active_layer_id = Some(id.clone());
        id
    }

    pub fn duplicate_layer(&mut self) -> Result<String, String> {
        let source = self.active_layer_id.as_deref()
            .ok_or_else(|| "No active layer".to_string())?;
        let source_layer = self.layers.iter().find(|l| l.id == source)
            .ok_or_else(|| "Active layer not found".to_string())?;
        self.layer_counter += 1;
        let new_name = format!("{} Copy", source_layer.name);
        let new_layer = Layer {
            id: uuid::Uuid::new_v4().to_string(),
            name: new_name,
            visible: true,
            locked: false,
            opacity: source_layer.opacity,
            buffer: source_layer.buffer.clone(),
        };
        let id = new_layer.id.clone();
        self.layers.push(new_layer);
        self.active_layer_id = Some(id.clone());
        Ok(id)
    }

    pub fn delete_layer(&mut self, layer_id: &str) -> Result<(), String> {
        if self.layers.len() <= 1 {
            return Err("Cannot delete the last layer".to_string());
        }
        let idx = self.layers.iter().position(|l| l.id == layer_id)
            .ok_or_else(|| "Layer not found".to_string())?;
        self.layers.remove(idx);
        if self.active_layer_id.as_deref() == Some(layer_id) {
            self.active_layer_id = self.layers.last().map(|l| l.id.clone());
        }
        Ok(())
    }

    pub fn rename_layer(&mut self, layer_id: &str, name: String) -> Result<(), String> {
        let layer = self.layers.iter_mut().find(|l| l.id == layer_id)
            .ok_or_else(|| "Layer not found".to_string())?;
        layer.name = name;
        Ok(())
    }

    pub fn set_layer_visibility(&mut self, layer_id: &str, visible: bool) -> Result<(), String> {
        let layer = self.layers.iter_mut().find(|l| l.id == layer_id)
            .ok_or_else(|| "Layer not found".to_string())?;
        layer.visible = visible;
        Ok(())
    }

    pub fn set_layer_lock(&mut self, layer_id: &str, locked: bool) -> Result<(), String> {
        let layer = self.layers.iter_mut().find(|l| l.id == layer_id)
            .ok_or_else(|| "Layer not found".to_string())?;
        layer.locked = locked;
        Ok(())
    }

    pub fn set_layer_opacity(&mut self, layer_id: &str, opacity: f32) -> Result<(), String> {
        let layer = self.layers.iter_mut().find(|l| l.id == layer_id)
            .ok_or_else(|| "Layer not found".to_string())?;
        layer.opacity = opacity.clamp(0.0, 1.0);
        Ok(())
    }

    pub fn reorder_layer(&mut self, layer_id: &str, new_index: usize) -> Result<(), String> {
        let idx = self.layers.iter().position(|l| l.id == layer_id)
            .ok_or_else(|| "Layer not found".to_string())?;
        if new_index >= self.layers.len() {
            return Err("Index out of bounds".to_string());
        }
        let layer = self.layers.remove(idx);
        self.layers.insert(new_index, layer);
        Ok(())
    }

    pub fn select_layer(&mut self, layer_id: &str) -> Result<(), String> {
        if !self.layers.iter().any(|l| l.id == layer_id) {
            return Err("Layer not found".to_string());
        }
        self.active_layer_id = Some(layer_id.to_string());
        Ok(())
    }

    // --- Stroke lifecycle ---

    pub fn begin_stroke(&mut self, tool: String, color: [u8; 4]) -> Result<String, String> {
        if self.active_stroke.is_some() {
            return Err("Stroke already in progress".to_string());
        }
        let layer_id = self.active_layer_id.clone()
            .ok_or_else(|| "No active layer".to_string())?;

        // Validate layer is editable
        let layer = self.layers.iter().find(|l| l.id == layer_id)
            .ok_or_else(|| "Active layer not found".to_string())?;
        if layer.locked {
            return Err("Layer is locked".to_string());
        }
        if !layer.visible {
            return Err("Layer is not visible".to_string());
        }

        let stroke_id = uuid::Uuid::new_v4().to_string();
        self.active_stroke = Some(ActiveStroke {
            id: stroke_id.clone(),
            layer_id,
            tool,
            color,
            patches: Vec::new(),
            touched: std::collections::HashSet::new(),
        });
        Ok(stroke_id)
    }

    /// Write pixels as part of the active stroke. Records before/after patches.
    pub fn stroke_points(&mut self, points: &[(u32, u32)]) -> Result<(), String> {
        // Take the stroke out to avoid borrow conflicts with self.layers
        let mut stroke = self.active_stroke.take()
            .ok_or_else(|| "No active stroke".to_string())?;

        let color_arr = stroke.color;
        let color = Color::rgba(color_arr[0], color_arr[1], color_arr[2], color_arr[3]);

        let layer = match self.layers.iter_mut().find(|l| l.id == stroke.layer_id) {
            Some(l) => l,
            None => {
                self.active_stroke = Some(stroke);
                return Err("Layer not found".to_string());
            }
        };

        for &(x, y) in points {
            if !layer.buffer.in_bounds(x, y) {
                continue;
            }
            if stroke.touched.contains(&(x, y)) {
                continue;
            }
            stroke.touched.insert((x, y));

            let before = layer.buffer.get_pixel(x, y);
            let before_arr = [before.r, before.g, before.b, before.a];

            if before_arr != color_arr {
                stroke.patches.push(PixelPatch {
                    x,
                    y,
                    before: before_arr,
                    after: color_arr,
                });
                layer.buffer.set_pixel(x, y, &color);
            }
        }

        // Put the stroke back
        self.active_stroke = Some(stroke);
        Ok(())
    }

    /// End the active stroke and push it onto the undo stack.
    pub fn end_stroke(&mut self) -> Result<Option<StrokeRecord>, String> {
        let stroke = self.active_stroke.take()
            .ok_or_else(|| "No active stroke".to_string())?;

        if stroke.patches.is_empty() {
            return Ok(None);
        }

        let record = StrokeRecord {
            id: stroke.id,
            layer_id: stroke.layer_id,
            tool: stroke.tool,
            color: stroke.color,
            patches: stroke.patches,
        };

        self.undo_stack.push(UndoAction::Stroke(record.clone()));
        self.redo_stack.clear();

        Ok(Some(record))
    }

    /// Cancel the active stroke, reverting all patches.
    pub fn cancel_stroke(&mut self) {
        if let Some(stroke) = self.active_stroke.take() {
            let layer_id = stroke.layer_id;
            if let Some(layer) = self.layers.iter_mut().find(|l| l.id == layer_id) {
                for patch in stroke.patches.iter().rev() {
                    let color = Color::rgba(patch.before[0], patch.before[1], patch.before[2], patch.before[3]);
                    layer.buffer.set_pixel(patch.x, patch.y, &color);
                }
            }
        }
    }

    // --- Undo/Redo ---

    pub fn undo(&mut self) -> Result<bool, String> {
        let action = match self.undo_stack.pop() {
            Some(a) => a,
            None => return Ok(false),
        };

        match &action {
            UndoAction::Stroke(record) => {
                let layer = self.layers.iter_mut().find(|l| l.id == record.layer_id)
                    .ok_or_else(|| "Layer from undo record not found".to_string())?;
                for patch in record.patches.iter().rev() {
                    let color = Color::rgba(patch.before[0], patch.before[1], patch.before[2], patch.before[3]);
                    layer.buffer.set_pixel(patch.x, patch.y, &color);
                }
            }
            UndoAction::SliceCreate(region) => {
                let frame = &mut self.frames[self.active_frame_index];
                frame.slice_regions.retain(|r| r.id != region.id);
            }
            UndoAction::SliceDelete(region) => {
                let frame = &mut self.frames[self.active_frame_index];
                frame.slice_regions.push(region.clone());
            }
        }

        self.redo_stack.push(action);
        Ok(true)
    }

    pub fn redo(&mut self) -> Result<bool, String> {
        let action = match self.redo_stack.pop() {
            Some(a) => a,
            None => return Ok(false),
        };

        match &action {
            UndoAction::Stroke(record) => {
                let layer = self.layers.iter_mut().find(|l| l.id == record.layer_id)
                    .ok_or_else(|| "Layer from redo record not found".to_string())?;
                for patch in &record.patches {
                    let color = Color::rgba(patch.after[0], patch.after[1], patch.after[2], patch.after[3]);
                    layer.buffer.set_pixel(patch.x, patch.y, &color);
                }
            }
            UndoAction::SliceCreate(region) => {
                let frame = &mut self.frames[self.active_frame_index];
                frame.slice_regions.push(region.clone());
            }
            UndoAction::SliceDelete(region) => {
                let frame = &mut self.frames[self.active_frame_index];
                frame.slice_regions.retain(|r| r.id != region.id);
            }
        }

        self.undo_stack.push(action);
        Ok(true)
    }

    // --- Frame management ---

    /// Save current top-level state back into the active frame slot.
    fn stash_active_frame(&mut self) {
        let frame = &mut self.frames[self.active_frame_index];
        frame.layers = std::mem::take(&mut self.layers);
        frame.active_layer_id = self.active_layer_id.take();
        frame.undo_stack = std::mem::take(&mut self.undo_stack);
        frame.redo_stack = std::mem::take(&mut self.redo_stack);
        frame.layer_counter = self.layer_counter;
    }

    /// Load a frame slot into the top-level state.
    fn restore_frame(&mut self, index: usize) {
        let frame = &mut self.frames[index];
        self.layers = std::mem::take(&mut frame.layers);
        self.active_layer_id = frame.active_layer_id.take();
        self.undo_stack = std::mem::take(&mut frame.undo_stack);
        self.redo_stack = std::mem::take(&mut frame.redo_stack);
        self.layer_counter = frame.layer_counter;
        self.active_frame_index = index;
    }

    /// Create a new blank frame with one transparent layer.
    pub fn create_frame(&mut self, name: Option<String>) -> String {
        // Stash current frame first
        self.stash_active_frame();

        self.frame_counter += 1;
        let frame_name = name.unwrap_or_else(|| format!("Frame {}", self.frame_counter));
        let frame_id = uuid::Uuid::new_v4().to_string();
        let layer_id = uuid::Uuid::new_v4().to_string();

        let new_frame = AnimationFrame {
            id: frame_id.clone(),
            name: frame_name,
            layers: Vec::new(),
            active_layer_id: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            layer_counter: 0,
            duration_ms: None,
            anchors: Vec::new(),
            slice_regions: Vec::new(),
        };
        self.frames.push(new_frame);

        let new_index = self.frames.len() - 1;

        // Set top-level state for the new frame
        self.layers = vec![Layer {
            id: layer_id.clone(),
            name: "Layer 1".to_string(),
            visible: true,
            locked: false,
            opacity: 1.0,
            buffer: PixelBuffer::new(self.width, self.height),
        }];
        self.active_layer_id = Some(layer_id);
        self.undo_stack = Vec::new();
        self.redo_stack = Vec::new();
        self.layer_counter = 1;
        self.active_frame_index = new_index;

        frame_id
    }

    /// Duplicate the current frame (deep copy of all layers).
    pub fn duplicate_frame(&mut self) -> String {
        self.frame_counter += 1;
        let frame_id = uuid::Uuid::new_v4().to_string();
        let frame_name = format!("Frame {}", self.frame_counter);

        // Deep copy current layers with new IDs mapped
        let mut id_map = std::collections::HashMap::new();
        let dup_layers: Vec<Layer> = self.layers.iter().map(|l| {
            let new_id = uuid::Uuid::new_v4().to_string();
            id_map.insert(l.id.clone(), new_id.clone());
            Layer {
                id: new_id,
                name: l.name.clone(),
                visible: l.visible,
                locked: l.locked,
                opacity: l.opacity,
                buffer: PixelBuffer::from_bytes(self.width, self.height, l.buffer.to_bytes()),
            }
        }).collect();

        let dup_active_layer = self.active_layer_id.as_ref()
            .and_then(|id| id_map.get(id))
            .cloned();

        // Stash current frame
        self.stash_active_frame();

        // Copy duration from source frame
        let source_duration = self.frames[self.active_frame_index].duration_ms;

        let new_frame = AnimationFrame {
            id: frame_id.clone(),
            name: frame_name,
            layers: Vec::new(),
            active_layer_id: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            layer_counter: 0,
            duration_ms: source_duration,
            anchors: Vec::new(),
            slice_regions: Vec::new(),
        };
        self.frames.push(new_frame);

        let new_index = self.frames.len() - 1;

        // Set top-level state for the duplicated frame
        self.layers = dup_layers;
        self.active_layer_id = dup_active_layer;
        self.undo_stack = Vec::new(); // Fresh undo for new frame
        self.redo_stack = Vec::new();
        self.layer_counter = self.layers.len() as u32;
        self.active_frame_index = new_index;

        frame_id
    }

    /// Delete a frame by index. Cannot delete the last frame.
    pub fn delete_frame(&mut self, frame_id: &str) -> Result<(), String> {
        if self.frames.len() <= 1 {
            return Err("Cannot delete the last frame".to_string());
        }

        let del_idx = self.frames.iter().position(|f| f.id == frame_id)
            .ok_or_else(|| "Frame not found".to_string())?;

        let is_active = del_idx == self.active_frame_index;

        if is_active {
            // Switch to adjacent frame first
            let new_idx = if del_idx > 0 { del_idx - 1 } else { 1 };
            // Don't stash — we're about to delete the active frame
            // Instead, load the target frame
            self.layers = Vec::new();
            self.active_layer_id = None;
            self.undo_stack = Vec::new();
            self.redo_stack = Vec::new();
            self.restore_frame(new_idx);
        }

        // Remove the frame
        self.frames.remove(del_idx);

        // Adjust active_frame_index if needed
        if !is_active && del_idx < self.active_frame_index {
            self.active_frame_index -= 1;
        }
        // If we deleted before the restored index, adjust
        if is_active && del_idx <= self.active_frame_index && self.active_frame_index > 0 {
            self.active_frame_index = self.active_frame_index.min(self.frames.len() - 1);
        }

        Ok(())
    }

    /// Switch to a different frame by id.
    pub fn select_frame(&mut self, frame_id: &str) -> Result<(), String> {
        let target_idx = self.frames.iter().position(|f| f.id == frame_id)
            .ok_or_else(|| "Frame not found".to_string())?;

        if target_idx == self.active_frame_index {
            return Ok(()); // Already active
        }

        // Cancel any in-flight stroke
        self.cancel_stroke();

        self.stash_active_frame();
        self.restore_frame(target_idx);

        Ok(())
    }

    /// Move a frame to a new position in the frame list.
    pub fn reorder_frame(&mut self, frame_id: &str, new_index: usize) -> Result<(), String> {
        let old_idx = self.frames.iter().position(|f| f.id == frame_id)
            .ok_or_else(|| "Frame not found".to_string())?;

        if new_index >= self.frames.len() {
            return Err("Index out of bounds".to_string());
        }
        if old_idx == new_index {
            return Ok(());
        }

        // Cancel any in-flight stroke
        self.cancel_stroke();

        // Stash active frame data before moving
        self.stash_active_frame();

        let frame = self.frames.remove(old_idx);
        self.frames.insert(new_index, frame);

        // Update active_frame_index to track the same frame
        let active_id = self.frames[self.active_frame_index].id.clone();
        self.active_frame_index = self.frames.iter().position(|f| f.id == active_id)
            .unwrap_or(0);

        // Restore active frame data
        self.restore_frame(self.active_frame_index);

        Ok(())
    }

    /// Insert a new blank frame at a specific position.
    pub fn insert_frame_at(&mut self, position: usize, name: Option<String>) -> Result<String, String> {
        if position > self.frames.len() {
            return Err("Position out of bounds".to_string());
        }

        self.cancel_stroke();
        self.stash_active_frame();

        self.frame_counter += 1;
        let frame_name = name.unwrap_or_else(|| format!("Frame {}", self.frame_counter));
        let frame_id = uuid::Uuid::new_v4().to_string();
        let layer_id = uuid::Uuid::new_v4().to_string();

        let new_frame = AnimationFrame {
            id: frame_id.clone(),
            name: frame_name,
            layers: Vec::new(),
            active_layer_id: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            layer_counter: 0,
            duration_ms: None,
            anchors: Vec::new(),
            slice_regions: Vec::new(),
        };
        self.frames.insert(position, new_frame);

        // Adjust active_frame_index if insertion was before it
        if position <= self.active_frame_index {
            self.active_frame_index += 1;
        }

        // Restore the previously-stashed frame first so it's valid
        self.restore_frame(self.active_frame_index);

        // Now stash it again and switch to the new frame
        self.stash_active_frame();

        // Set top-level state for the new frame
        self.layers = vec![Layer {
            id: layer_id.clone(),
            name: "Layer 1".to_string(),
            visible: true,
            locked: false,
            opacity: 1.0,
            buffer: PixelBuffer::new(self.width, self.height),
        }];
        self.active_layer_id = Some(layer_id);
        self.undo_stack = Vec::new();
        self.redo_stack = Vec::new();
        self.layer_counter = 1;
        self.active_frame_index = position;

        Ok(frame_id)
    }

    /// Duplicate the current frame and insert the copy at a specific position.
    pub fn duplicate_frame_at(&mut self, position: usize) -> Result<String, String> {
        if position > self.frames.len() {
            return Err("Position out of bounds".to_string());
        }

        self.frame_counter += 1;
        let frame_id = uuid::Uuid::new_v4().to_string();
        let frame_name = format!("Frame {}", self.frame_counter);

        // Deep copy current layers with new IDs
        let mut id_map = std::collections::HashMap::new();
        let dup_layers: Vec<Layer> = self.layers.iter().map(|l| {
            let new_id = uuid::Uuid::new_v4().to_string();
            id_map.insert(l.id.clone(), new_id.clone());
            Layer {
                id: new_id,
                name: l.name.clone(),
                visible: l.visible,
                locked: l.locked,
                opacity: l.opacity,
                buffer: PixelBuffer::from_bytes(self.width, self.height, l.buffer.to_bytes()),
            }
        }).collect();

        let dup_active_layer = self.active_layer_id.as_ref()
            .and_then(|id| id_map.get(id))
            .cloned();

        // Copy duration from source
        let source_duration = self.frames[self.active_frame_index].duration_ms;

        self.cancel_stroke();
        self.stash_active_frame();

        let new_frame = AnimationFrame {
            id: frame_id.clone(),
            name: frame_name,
            layers: Vec::new(),
            active_layer_id: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            layer_counter: 0,
            duration_ms: source_duration,
            anchors: Vec::new(),
            slice_regions: Vec::new(),
        };
        self.frames.insert(position, new_frame);

        // Adjust active_frame_index if insertion was before or at it
        if position <= self.active_frame_index {
            self.active_frame_index += 1;
        }

        // Restore the previously-stashed frame first
        self.restore_frame(self.active_frame_index);

        // Now stash it again and switch to the new frame
        self.stash_active_frame();

        // Set top-level state for the duplicated frame
        self.layers = dup_layers;
        self.active_layer_id = dup_active_layer;
        self.undo_stack = Vec::new();
        self.redo_stack = Vec::new();
        self.layer_counter = self.layers.len() as u32;
        self.active_frame_index = position;

        Ok(frame_id)
    }

    /// Set per-frame duration override. None = use global FPS.
    pub fn set_frame_duration(&mut self, frame_id: &str, duration_ms: Option<u32>) -> Result<(), String> {
        let frame = self.frames.iter_mut().find(|f| f.id == frame_id)
            .ok_or_else(|| "Frame not found".to_string())?;
        frame.duration_ms = duration_ms;
        Ok(())
    }

    /// Rename a frame.
    pub fn rename_frame(&mut self, frame_id: &str, name: String) -> Result<(), String> {
        let frame = self.frames.iter_mut().find(|f| f.id == frame_id)
            .ok_or_else(|| "Frame not found".to_string())?;
        frame.name = name;
        Ok(())
    }

    /// Get info about all frames.
    pub fn frame_count(&self) -> usize {
        self.frames.len()
    }

    pub fn active_frame_id(&self) -> &str {
        &self.frames[self.active_frame_index].id
    }

    pub fn active_frame_name(&self) -> &str {
        &self.frames[self.active_frame_index].name
    }

    /// Composite a frame by index. For the active frame, uses top-level layers.
    /// For stashed frames, uses the frame's stored layers.
    pub fn composite_frame_at(&self, index: usize) -> Option<Vec<u8>> {
        if index >= self.frames.len() {
            return None;
        }
        if index == self.active_frame_index {
            return Some(self.composite_frame());
        }
        // Composite from stashed frame layers
        let frame = &self.frames[index];
        let size = (self.width as usize) * (self.height as usize) * 4;
        let mut result = vec![0u8; size];

        for layer in &frame.layers {
            if !layer.visible { continue; }
            let src = layer.buffer.as_bytes();
            let opacity = layer.opacity;
            for i in (0..size).step_by(4) {
                let sa = (src[i + 3] as f32 / 255.0) * opacity;
                if sa == 0.0 { continue; }
                let da = result[i + 3] as f32 / 255.0;
                let out_a = sa + da * (1.0 - sa);
                if out_a > 0.0 {
                    result[i] = ((src[i] as f32 * sa + result[i] as f32 * da * (1.0 - sa)) / out_a) as u8;
                    result[i + 1] = ((src[i + 1] as f32 * sa + result[i + 1] as f32 * da * (1.0 - sa)) / out_a) as u8;
                    result[i + 2] = ((src[i + 2] as f32 * sa + result[i + 2] as f32 * da * (1.0 - sa)) / out_a) as u8;
                    result[i + 3] = (out_a * 255.0) as u8;
                }
            }
        }
        Some(result)
    }

    /// Apply uniform timing to a span of frames. Returns prior durations for undo.
    pub fn apply_span_timing(
        &mut self,
        start_index: usize,
        end_index: usize,
        duration_ms: Option<u32>,
    ) -> Result<Vec<(String, Option<u32>)>, String> {
        if start_index >= self.frames.len() || end_index >= self.frames.len() {
            return Err("Frame index out of range".to_string());
        }
        if start_index > end_index {
            return Err("Start must be <= end".to_string());
        }
        let mut prior: Vec<(String, Option<u32>)> = Vec::new();
        for idx in start_index..=end_index {
            let frame = &mut self.frames[idx];
            prior.push((frame.id.clone(), frame.duration_ms));
            frame.duration_ms = duration_ms;
        }
        Ok(prior)
    }

    /// Restore prior durations (for undo of apply_span_timing).
    pub fn restore_span_timing(&mut self, prior: &[(String, Option<u32>)]) {
        for (frame_id, dur) in prior {
            if let Some(frame) = self.frames.iter_mut().find(|f| f.id == *frame_id) {
                frame.duration_ms = *dur;
            }
        }
    }

    /// Duplicate a contiguous span of frames and insert copies after the span.
    /// Returns (first_new_frame_id, new_frame_ids, insert_position).
    /// Copies layers, anchors, and duration metadata. New IDs throughout.
    pub fn duplicate_span(
        &mut self,
        start_index: usize,
        end_index: usize,
    ) -> Result<(String, Vec<String>, usize), String> {
        if start_index >= self.frames.len() || end_index >= self.frames.len() {
            return Err("Frame index out of range".to_string());
        }
        if start_index > end_index {
            return Err("Start must be <= end".to_string());
        }

        self.cancel_stroke();
        self.stash_active_frame();

        let insert_pos = end_index + 1;
        let mut new_ids: Vec<String> = Vec::new();

        // Collect frame data first to avoid borrow issues
        let span_data: Vec<(String, Vec<(String, String, bool, bool, f32, Vec<u8>)>, Option<String>, Option<u32>, Vec<super::anchor::Anchor>, Vec<super::slice::SliceRegion>)> = (start_index..=end_index)
            .map(|idx| {
                let frame = &self.frames[idx];
                let layers: Vec<_> = frame.layers.iter().map(|l| {
                    (l.id.clone(), l.name.clone(), l.visible, l.locked, l.opacity, l.buffer.to_bytes())
                }).collect();
                let active_lid = frame.active_layer_id.clone();
                let dur = frame.duration_ms;
                let anchors = frame.anchors.clone();
                let slices = frame.slice_regions.clone();
                (frame.name.clone(), layers, active_lid, dur, anchors, slices)
            })
            .collect();

        for (i, (name, layers, active_lid, dur, anchors, slices)) in span_data.into_iter().enumerate() {
            self.frame_counter += 1;
            let frame_id = uuid::Uuid::new_v4().to_string();
            let frame_name = format!("{} (copy)", name);

            // Deep copy layers with new IDs
            let mut lid_map = std::collections::HashMap::new();
            let new_layers: Vec<Layer> = layers.iter().map(|(old_id, lname, vis, locked, opacity, bytes)| {
                let new_lid = uuid::Uuid::new_v4().to_string();
                lid_map.insert(old_id.clone(), new_lid.clone());
                Layer {
                    id: new_lid,
                    name: lname.clone(),
                    visible: *vis,
                    locked: *locked,
                    opacity: *opacity,
                    buffer: PixelBuffer::from_bytes(self.width, self.height, bytes.clone()),
                }
            }).collect();

            let new_active_lid = active_lid.as_ref().and_then(|id| lid_map.get(id)).cloned();

            // Copy anchors with new IDs
            let new_anchors: Vec<super::anchor::Anchor> = anchors.iter().map(|a| {
                let mut dup = a.clone();
                dup.id = uuid::Uuid::new_v4().to_string();
                dup
            }).collect();

            // Copy slice regions with new IDs
            let new_slices: Vec<super::slice::SliceRegion> = slices.iter().map(|s| {
                let mut dup = s.clone();
                dup.id = uuid::Uuid::new_v4().to_string();
                dup
            }).collect();

            let new_frame = AnimationFrame {
                id: frame_id.clone(),
                name: frame_name,
                layers: new_layers,
                active_layer_id: new_active_lid,
                undo_stack: Vec::new(),
                redo_stack: Vec::new(),
                layer_counter: layers.len() as u32,
                duration_ms: dur,
                anchors: new_anchors,
                slice_regions: new_slices,
            };

            let actual_pos = insert_pos + i;
            self.frames.insert(actual_pos, new_frame);
            new_ids.push(frame_id);

            // Adjust active_frame_index if insertion was before or at it
            if actual_pos <= self.active_frame_index {
                self.active_frame_index += 1;
            }
        }

        // Restore the active frame
        self.restore_frame(self.active_frame_index);

        let first_id = new_ids[0].clone();
        Ok((first_id, new_ids, insert_pos))
    }

    /// Remove frames by their IDs (for undo of duplicate_span).
    pub fn remove_frames_by_ids(&mut self, ids: &[String]) -> Result<(), String> {
        if self.frames.len() <= ids.len() {
            return Err("Cannot remove all frames".to_string());
        }
        self.cancel_stroke();
        self.stash_active_frame();

        let active_id = self.frames[self.active_frame_index].id.clone();

        self.frames.retain(|f| !ids.contains(&f.id));

        // Restore active frame index
        self.active_frame_index = self.frames.iter()
            .position(|f| f.id == active_id)
            .unwrap_or(0);

        self.restore_frame(self.active_frame_index);
        Ok(())
    }

    /// Public wrapper for stash_active_frame (used by motion commit).
    pub fn stash_active_frame_pub(&mut self) {
        self.stash_active_frame();
    }

    /// Public wrapper for restore_frame (used by motion commit).
    pub fn restore_frame_pub(&mut self, index: usize) {
        self.restore_frame(index);
    }

    // --- Helpers ---

    pub fn active_layer_mut(&mut self) -> Option<&mut Layer> {
        let id = self.active_layer_id.as_ref()?;
        self.layers.iter_mut().find(|l| &l.id == id)
    }

    pub fn active_layer(&self) -> Option<&Layer> {
        let id = self.active_layer_id.as_ref()?;
        self.layers.iter().find(|l| &l.id == id)
    }

    pub fn layer_by_id(&self, id: &str) -> Option<&Layer> {
        self.layers.iter().find(|l| l.id == id)
    }

    /// Composite all visible layers into a single RGBA frame, bottom to top.
    pub fn composite_frame(&self) -> Vec<u8> {
        let size = (self.width as usize) * (self.height as usize) * 4;
        let mut frame = vec![0u8; size];

        for layer in &self.layers {
            if !layer.visible {
                continue;
            }
            let src = layer.buffer.as_bytes();
            let opacity = layer.opacity;

            for i in (0..size).step_by(4) {
                let sa = (src[i + 3] as f32 / 255.0) * opacity;
                if sa == 0.0 {
                    continue;
                }

                let da = frame[i + 3] as f32 / 255.0;
                let out_a = sa + da * (1.0 - sa);

                if out_a > 0.0 {
                    frame[i] = ((src[i] as f32 * sa + frame[i] as f32 * da * (1.0 - sa)) / out_a) as u8;
                    frame[i + 1] = ((src[i + 1] as f32 * sa + frame[i + 1] as f32 * da * (1.0 - sa)) / out_a) as u8;
                    frame[i + 2] = ((src[i + 2] as f32 * sa + frame[i + 2] as f32 * da * (1.0 - sa)) / out_a) as u8;
                    frame[i + 3] = (out_a * 255.0) as u8;
                }
            }
        }

        frame
    }
}

/// App-wide managed canvas state (one active project at a time for now).
pub struct ManagedCanvasState(pub Mutex<Option<CanvasState>>);

/// Tracks project metadata alongside the canvas (file path, dirty state, etc.).
pub struct ProjectMeta {
    pub project_id: String,
    pub name: String,
    pub file_path: Option<String>,
    pub color_mode: crate::types::domain::ColorMode,
    pub created_at: String,
    pub is_dirty: bool,
}

/// App-wide managed project metadata.
pub struct ManagedProjectMeta(pub Mutex<Option<ProjectMeta>>);

// ==========================================================================
// Tests
// ==========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn red() -> Color { Color::rgba(255, 0, 0, 255) }
    fn green() -> Color { Color::rgba(0, 255, 0, 255) }

    fn pixel_at(canvas: &CanvasState, layer_id: &str, x: u32, y: u32) -> [u8; 4] {
        let layer = canvas.layers.iter().find(|l| l.id == layer_id).unwrap();
        let c = layer.buffer.get_pixel(x, y);
        [c.r, c.g, c.b, c.a]
    }

    // --- PixelBuffer ---

    #[test]
    fn pixel_buffer_new_is_transparent() {
        let buf = PixelBuffer::new(4, 4);
        let c = buf.get_pixel(0, 0);
        assert_eq!([c.r, c.g, c.b, c.a], [0, 0, 0, 0]);
    }

    #[test]
    fn pixel_buffer_set_get_roundtrip() {
        let mut buf = PixelBuffer::new(8, 8);
        buf.set_pixel(3, 5, &Color::rgba(10, 20, 30, 255));
        let c = buf.get_pixel(3, 5);
        assert_eq!([c.r, c.g, c.b, c.a], [10, 20, 30, 255]);
    }

    #[test]
    fn pixel_buffer_out_of_bounds_returns_transparent() {
        let buf = PixelBuffer::new(4, 4);
        let c = buf.get_pixel(100, 100);
        assert_eq!([c.r, c.g, c.b, c.a], [0, 0, 0, 0]);
    }

    #[test]
    fn pixel_buffer_set_out_of_bounds_is_noop() {
        let mut buf = PixelBuffer::new(4, 4);
        buf.set_pixel(100, 100, &red()); // should not panic
        assert!(buf.in_bounds(0, 0));
        assert!(!buf.in_bounds(4, 4));
    }

    #[test]
    fn pixel_buffer_bytes_roundtrip() {
        let mut buf = PixelBuffer::new(2, 2);
        buf.set_pixel(0, 0, &red());
        buf.set_pixel(1, 1, &green());
        let bytes = buf.to_bytes();
        let buf2 = PixelBuffer::from_bytes(2, 2, bytes);
        let c00 = buf2.get_pixel(0, 0);
        assert_eq!([c00.r, c00.g, c00.b, c00.a], [255, 0, 0, 255]);
        let c11 = buf2.get_pixel(1, 1);
        assert_eq!([c11.r, c11.g, c11.b, c11.a], [0, 255, 0, 255]);
        let c10 = buf2.get_pixel(1, 0);
        assert_eq!([c10.r, c10.g, c10.b, c10.a], [0, 0, 0, 0]);
    }

    // --- Undo/Redo laws ---

    #[test]
    fn undo_reverts_stroke() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();

        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0), (1, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Pixel is now red
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);

        // Undo
        assert!(cs.undo().unwrap());
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [0, 0, 0, 0]);
    }

    #[test]
    fn redo_restores_stroke() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();

        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        cs.undo().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [0, 0, 0, 0]);

        cs.redo().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn undo_redo_multiple_strokes() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();

        // Stroke 1: red at (0,0)
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Stroke 2: green at (1,0)
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(1, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Undo stroke 2
        cs.undo().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 1, 0), [0, 0, 0, 0]);
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);

        // Undo stroke 1
        cs.undo().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [0, 0, 0, 0]);

        // Redo both
        cs.redo().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);
        cs.redo().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 1, 0), [0, 255, 0, 255]);
    }

    #[test]
    fn new_stroke_clears_redo_stack() {
        let mut cs = CanvasState::new(4, 4);

        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        cs.undo().unwrap();
        assert_eq!(cs.redo_stack.len(), 1);

        // New stroke should clear redo
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(1, 0)]).unwrap();
        cs.end_stroke().unwrap();

        assert!(cs.redo_stack.is_empty());
        assert!(!cs.redo().unwrap()); // nothing to redo
    }

    #[test]
    fn undo_empty_returns_false() {
        let mut cs = CanvasState::new(4, 4);
        assert!(!cs.undo().unwrap());
    }

    #[test]
    fn redo_empty_returns_false() {
        let mut cs = CanvasState::new(4, 4);
        assert!(!cs.redo().unwrap());
    }

    #[test]
    fn stroke_same_pixel_twice_only_patches_once() {
        let mut cs = CanvasState::new(4, 4);

        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0), (0, 0), (0, 0)]).unwrap();
        let record = cs.end_stroke().unwrap().unwrap();

        // Only one patch despite drawing same pixel 3 times
        assert_eq!(record.patches.len(), 1);
    }

    #[test]
    fn stroke_same_color_as_existing_creates_no_patch() {
        let mut cs = CanvasState::new(4, 4);

        // Draw transparent on transparent = no change
        cs.begin_stroke("brush".into(), [0, 0, 0, 0]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        let record = cs.end_stroke().unwrap();

        assert!(record.is_none()); // empty stroke
    }

    #[test]
    fn cancel_stroke_reverts_pixels() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();

        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0), (1, 0)]).unwrap();
        // Verify pixels are red during stroke
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);
        // Cancel
        cs.cancel_stroke();
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [0, 0, 0, 0]);
        assert!(cs.active_stroke.is_none());
    }

    #[test]
    fn stroke_on_locked_layer_fails() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();
        cs.set_layer_lock(&layer_id, true).unwrap();
        let result = cs.begin_stroke("brush".into(), [255, 0, 0, 255]);
        assert!(result.is_err());
    }

    #[test]
    fn stroke_on_hidden_layer_fails() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();
        cs.set_layer_visibility(&layer_id, false).unwrap();
        let result = cs.begin_stroke("brush".into(), [255, 0, 0, 255]);
        assert!(result.is_err());
    }

    // --- Frame stashing ---

    #[test]
    fn frame_switch_preserves_pixel_data() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.active_layer_id.clone().unwrap();

        // Draw red on frame 1
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);

        // Create frame 2
        let _frame2_id = cs.create_frame(None);

        // Draw green on frame 2
        let _layer2_id = cs.active_layer_id.clone().unwrap();
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(1, 1)]).unwrap();
        cs.end_stroke().unwrap();

        // Switch back to frame 1
        let frame1_id = cs.frames[0].id.clone();
        cs.select_frame(&frame1_id).unwrap();

        // Frame 1 pixel data should be intact
        let layer1_id = cs.active_layer_id.clone().unwrap();
        assert_eq!(pixel_at(&cs, &layer1_id, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn frame_switch_preserves_undo_stacks() {
        let mut cs = CanvasState::new(4, 4);

        // Do a stroke on frame 1
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();
        assert_eq!(cs.undo_stack.len(), 1);

        // Create frame 2
        let _frame2 = cs.create_frame(None);
        assert_eq!(cs.undo_stack.len(), 0); // new frame has clean undo

        // Switch back to frame 1
        let frame1_id = cs.frames[0].id.clone();
        cs.select_frame(&frame1_id).unwrap();
        assert_eq!(cs.undo_stack.len(), 1); // undo stack restored
    }

    #[test]
    fn duplicate_frame_deep_copies_pixels() {
        let mut cs = CanvasState::new(4, 4);

        // Draw on frame 1
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Duplicate
        let _dup_id = cs.duplicate_frame();

        // Verify duplicate has the pixel
        let dup_layer = cs.active_layer_id.clone().unwrap();
        assert_eq!(pixel_at(&cs, &dup_layer, 0, 0), [255, 0, 0, 255]);

        // Modify duplicate — original should be unaffected
        cs.begin_stroke("brush".into(), [0, 0, 255, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        let frame1_id = cs.frames[0].id.clone();
        cs.select_frame(&frame1_id).unwrap();
        let layer1 = cs.active_layer_id.clone().unwrap();
        // Original is still red, not blue
        assert_eq!(pixel_at(&cs, &layer1, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn delete_last_frame_fails() {
        let mut cs = CanvasState::new(4, 4);
        let frame_id = cs.frames[0].id.clone();
        assert!(cs.delete_frame(&frame_id).is_err());
    }

    #[test]
    fn delete_last_layer_fails() {
        let mut cs = CanvasState::new(4, 4);
        let layer_id = cs.layers[0].id.clone();
        assert!(cs.delete_layer(&layer_id).is_err());
    }

    // --- Layer management ---

    #[test]
    fn create_layer_activates_it() {
        let mut cs = CanvasState::new(4, 4);
        let new_id = cs.create_layer(Some("Test".into()));
        assert_eq!(cs.active_layer_id.as_deref(), Some(new_id.as_str()));
        assert_eq!(cs.layers.len(), 2);
    }

    #[test]
    fn delete_active_layer_selects_another() {
        let mut cs = CanvasState::new(4, 4);
        let id1 = cs.layers[0].id.clone();
        let id2 = cs.create_layer(None);
        cs.delete_layer(&id2).unwrap();
        assert_eq!(cs.active_layer_id.as_deref(), Some(id1.as_str()));
    }

    #[test]
    fn layer_opacity_clamped() {
        let mut cs = CanvasState::new(4, 4);
        let id = cs.active_layer_id.clone().unwrap();
        cs.set_layer_opacity(&id, 2.0).unwrap();
        assert_eq!(cs.layers[0].opacity, 1.0);
        cs.set_layer_opacity(&id, -1.0).unwrap();
        assert_eq!(cs.layers[0].opacity, 0.0);
    }

    // --- Composite ---

    #[test]
    fn composite_transparent_canvas_is_all_zero() {
        let cs = CanvasState::new(2, 2);
        let result = cs.composite_frame();
        assert!(result.iter().all(|&b| b == 0));
    }

    #[test]
    fn composite_single_opaque_pixel() {
        let mut cs = CanvasState::new(2, 2);
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();
        let comp = cs.composite_frame();
        assert_eq!(&comp[0..4], &[255, 0, 0, 255]);
        assert_eq!(&comp[4..8], &[0, 0, 0, 0]); // other pixel still transparent
    }

    #[test]
    fn composite_hidden_layer_is_ignored() {
        let mut cs = CanvasState::new(2, 2);
        let id = cs.active_layer_id.clone().unwrap();
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();
        cs.set_layer_visibility(&id, false).unwrap();
        let comp = cs.composite_frame();
        assert!(comp.iter().all(|&b| b == 0));
    }

    // --- Span timing ---

    #[test]
    fn apply_and_restore_span_timing() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_frame(None);
        cs.create_frame(None);
        // Now we have 3 frames
        assert_eq!(cs.frames.len(), 3);

        let prior = cs.apply_span_timing(0, 2, Some(100)).unwrap();
        assert_eq!(prior.len(), 3);
        // All should have been None before
        for (_, dur) in &prior {
            assert_eq!(*dur, None);
        }
        // All frames should now be 100ms
        for f in &cs.frames {
            assert_eq!(f.duration_ms, Some(100));
        }

        // Restore
        cs.restore_span_timing(&prior);
        for f in &cs.frames {
            assert_eq!(f.duration_ms, None);
        }
    }

    // --- Layer reordering ---

    #[test]
    fn reorder_layer_moves_to_new_position() {
        let mut cs = CanvasState::new(4, 4);
        let id1 = cs.layers[0].id.clone();
        let id2 = cs.create_layer(None);
        let id3 = cs.create_layer(None);

        // Order: [id1, id2, id3]. Move id3 to front.
        cs.reorder_layer(&id3, 0).unwrap();
        assert_eq!(cs.layers[0].id, id3);
        assert_eq!(cs.layers[1].id, id1);
        assert_eq!(cs.layers[2].id, id2);
    }

    #[test]
    fn reorder_layer_out_of_bounds_fails() {
        let mut cs = CanvasState::new(4, 4);
        let id = cs.layers[0].id.clone();
        assert!(cs.reorder_layer(&id, 5).is_err());
    }

    #[test]
    fn reorder_layer_unknown_id_fails() {
        let mut cs = CanvasState::new(4, 4);
        assert!(cs.reorder_layer("nonexistent", 0).is_err());
    }

    // --- Frame reordering ---

    #[test]
    fn reorder_frame_moves_to_new_position() {
        let mut cs = CanvasState::new(4, 4);
        let f1_id = cs.frames[0].id.clone();
        cs.create_frame(None);
        let f2_id = cs.frames[1].id.clone();
        cs.create_frame(None);
        let f3_id = cs.frames[2].id.clone();

        // Move frame 1 to end: [f1,f2,f3] → [f2,f3,f1]
        cs.reorder_frame(&f1_id, 2).unwrap();
        assert_eq!(cs.frames[0].id, f2_id);
        assert_eq!(cs.frames[1].id, f3_id);
        assert_eq!(cs.frames[2].id, f1_id);
        // active_frame_index should still be in bounds
        assert!(cs.active_frame_index < cs.frames.len());
    }

    #[test]
    fn reorder_frame_out_of_bounds_fails() {
        let mut cs = CanvasState::new(4, 4);
        let id = cs.frames[0].id.clone();
        assert!(cs.reorder_frame(&id, 10).is_err());
    }

    // --- duplicate_span ---

    #[test]
    fn duplicate_span_copies_frames() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_frame(None);
        cs.create_frame(None);
        // 3 frames. Duplicate [0..1] (first two)
        let (first_new, new_ids, insert_pos) = cs.duplicate_span(0, 1).unwrap();
        assert_eq!(new_ids.len(), 2);
        assert_eq!(insert_pos, 2);
        assert_eq!(cs.frames.len(), 5); // 3 original + 2 copies
        assert_eq!(first_new, new_ids[0]);
    }

    #[test]
    fn duplicate_span_deep_copies_pixels() {
        let mut cs = CanvasState::new(4, 4);
        // Draw on frame 1
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Duplicate single frame
        let (_, new_ids, _) = cs.duplicate_span(0, 0).unwrap();
        assert_eq!(cs.frames.len(), 2);

        // Select the copy
        cs.select_frame(&new_ids[0]).unwrap();
        let layer_id = cs.active_layer_id.clone().unwrap();
        // Copy should have the red pixel
        assert_eq!(pixel_at(&cs, &layer_id, 0, 0), [255, 0, 0, 255]);

        // Modify the copy
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Switch back to original — should still be red
        let orig_id = cs.frames[0].id.clone();
        cs.select_frame(&orig_id).unwrap();
        let orig_layer = cs.active_layer_id.clone().unwrap();
        assert_eq!(pixel_at(&cs, &orig_layer, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn duplicate_span_assigns_fresh_ids() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_frame(None);
        let orig_ids: Vec<String> = cs.frames.iter().map(|f| f.id.clone()).collect();
        let (_, new_ids, _) = cs.duplicate_span(0, 1).unwrap();
        for new_id in &new_ids {
            assert!(!orig_ids.contains(new_id));
        }
    }

    #[test]
    fn duplicate_span_invalid_range_fails() {
        let mut cs = CanvasState::new(4, 4);
        assert!(cs.duplicate_span(5, 10).is_err());
        cs.create_frame(None);
        assert!(cs.duplicate_span(1, 0).is_err()); // inverted
    }

    // --- remove_frames_by_ids ---

    #[test]
    fn remove_frames_deletes_specified() {
        let mut cs = CanvasState::new(4, 4);
        cs.create_frame(None);
        cs.create_frame(None);
        let to_remove = vec![cs.frames[1].id.clone()];
        cs.remove_frames_by_ids(&to_remove).unwrap();
        assert_eq!(cs.frames.len(), 2);
    }

    #[test]
    fn remove_all_frames_fails() {
        let mut cs = CanvasState::new(4, 4);
        let all_ids = vec![cs.frames[0].id.clone()];
        assert!(cs.remove_frames_by_ids(&all_ids).is_err());
    }

    // --- Multi-step editing sequences ---

    #[test]
    fn draw_undo_switch_frame_switch_back_draw() {
        // This tests a realistic multi-step editing sequence:
        // 1. Draw on frame 1
        // 2. Undo the draw
        // 3. Switch to frame 2
        // 4. Draw on frame 2
        // 5. Switch back to frame 1
        // 6. Redo the original draw
        let mut cs = CanvasState::new(4, 4);

        // Step 1: Draw red on frame 1
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();
        let f1_layer = cs.active_layer_id.clone().unwrap();
        assert_eq!(pixel_at(&cs, &f1_layer, 0, 0), [255, 0, 0, 255]);

        // Step 2: Undo
        cs.undo().unwrap();
        assert_eq!(pixel_at(&cs, &f1_layer, 0, 0), [0, 0, 0, 0]);

        // Step 3: Create and switch to frame 2
        let _f2 = cs.create_frame(None);
        let f2_layer = cs.active_layer_id.clone().unwrap();

        // Step 4: Draw green on frame 2
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(1, 1)]).unwrap();
        cs.end_stroke().unwrap();
        assert_eq!(pixel_at(&cs, &f2_layer, 1, 1), [0, 255, 0, 255]);

        // Step 5: Switch back to frame 1
        let f1_id = cs.frames[0].id.clone();
        cs.select_frame(&f1_id).unwrap();
        let f1_layer = cs.active_layer_id.clone().unwrap();

        // Frame 1 should still be blank (undo was applied)
        assert_eq!(pixel_at(&cs, &f1_layer, 0, 0), [0, 0, 0, 0]);

        // Step 6: Redo should bring back the red pixel
        cs.redo().unwrap();
        assert_eq!(pixel_at(&cs, &f1_layer, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn layer_create_draw_delete_undo_sequence() {
        let mut cs = CanvasState::new(4, 4);
        let base_layer = cs.layers[0].id.clone();

        // Draw on base layer
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Create new layer, draw on it
        let new_layer = cs.create_layer(Some("Overlay".into()));
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(1, 1)]).unwrap();
        cs.end_stroke().unwrap();

        // Delete the overlay layer
        cs.delete_layer(&new_layer).unwrap();
        assert_eq!(cs.layers.len(), 1);

        // Base layer should still have its pixel
        assert_eq!(pixel_at(&cs, &base_layer, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn begin_stroke_reentrant_fails() {
        let mut cs = CanvasState::new(4, 4);
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        // Second begin while first is active should fail
        let result = cs.begin_stroke("brush".into(), [0, 255, 0, 255]);
        assert!(result.is_err());
    }

    #[test]
    fn select_unknown_layer_fails() {
        let mut cs = CanvasState::new(4, 4);
        assert!(cs.select_layer("nonexistent").is_err());
    }

    #[test]
    fn select_layer_changes_active() {
        let mut cs = CanvasState::new(4, 4);
        let id1 = cs.layers[0].id.clone();
        let id2 = cs.create_layer(None);
        assert_eq!(cs.active_layer_id.as_deref(), Some(id2.as_str()));
        cs.select_layer(&id1).unwrap();
        assert_eq!(cs.active_layer_id.as_deref(), Some(id1.as_str()));
    }

    // --- Composite with multiple layers ---

    #[test]
    fn composite_respects_layer_order() {
        let mut cs = CanvasState::new(2, 2);
        // Draw red on bottom layer
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Create top layer, draw green at same pixel
        let _top = cs.create_layer(None);
        cs.begin_stroke("brush".into(), [0, 255, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        let comp = cs.composite_frame();
        // Top layer (green) should win
        assert_eq!(&comp[0..4], &[0, 255, 0, 255]);
    }

    // --- Slice region undo/redo ---

    #[test]
    fn slice_create_stores_in_active_frame() {
        let mut cs = CanvasState::new(16, 16);
        let region = super::super::slice::SliceRegion::new("head".into(), 0, 0, 8, 8);
        cs.frames[cs.active_frame_index].slice_regions.push(region.clone());
        cs.undo_stack.push(UndoAction::SliceCreate(region));
        cs.redo_stack.clear();
        assert_eq!(cs.frames[0].slice_regions.len(), 1);
        assert_eq!(cs.frames[0].slice_regions[0].name, "head");
    }

    #[test]
    fn slice_create_undo_removes_region() {
        let mut cs = CanvasState::new(16, 16);
        let region = super::super::slice::SliceRegion::new("head".into(), 0, 0, 8, 8);
        let _rid = region.id.clone();
        cs.frames[cs.active_frame_index].slice_regions.push(region.clone());
        cs.undo_stack.push(UndoAction::SliceCreate(region));
        cs.redo_stack.clear();

        let undone = cs.undo().unwrap();
        assert!(undone);
        assert_eq!(cs.frames[0].slice_regions.len(), 0);
        assert_eq!(cs.redo_stack.len(), 1);
    }

    #[test]
    fn slice_create_undo_redo_restores_region() {
        let mut cs = CanvasState::new(16, 16);
        let region = super::super::slice::SliceRegion::new("head".into(), 2, 3, 4, 5);
        cs.frames[cs.active_frame_index].slice_regions.push(region.clone());
        cs.undo_stack.push(UndoAction::SliceCreate(region));
        cs.redo_stack.clear();

        cs.undo().unwrap();
        assert_eq!(cs.frames[0].slice_regions.len(), 0);

        cs.redo().unwrap();
        assert_eq!(cs.frames[0].slice_regions.len(), 1);
        assert_eq!(cs.frames[0].slice_regions[0].name, "head");
        assert_eq!(cs.frames[0].slice_regions[0].x, 2);
    }

    #[test]
    fn slice_delete_undo_restores_region() {
        let mut cs = CanvasState::new(16, 16);
        let region = super::super::slice::SliceRegion::new("torso".into(), 0, 8, 16, 8);
        let _rid = region.id.clone();
        // Simulate: region exists, then user deletes it
        cs.undo_stack.push(UndoAction::SliceDelete(region));
        cs.redo_stack.clear();

        // Undo should restore it
        cs.undo().unwrap();
        assert_eq!(cs.frames[0].slice_regions.len(), 1);
        assert_eq!(cs.frames[0].slice_regions[0].name, "torso");
    }

    #[test]
    fn slice_undo_interleaves_with_stroke_undo() {
        let mut cs = CanvasState::new(4, 4);
        let lid = cs.active_layer_id.clone().unwrap();

        // Draw a red pixel
        cs.begin_stroke("brush".into(), [255, 0, 0, 255]).unwrap();
        cs.stroke_points(&[(0, 0)]).unwrap();
        cs.end_stroke().unwrap();

        // Create a slice
        let region = super::super::slice::SliceRegion::new("s1".into(), 0, 0, 2, 2);
        cs.frames[cs.active_frame_index].slice_regions.push(region.clone());
        cs.undo_stack.push(UndoAction::SliceCreate(region));
        cs.redo_stack.clear();

        assert_eq!(cs.undo_stack.len(), 2);
        assert_eq!(cs.frames[0].slice_regions.len(), 1);

        // Undo slice create
        cs.undo().unwrap();
        assert_eq!(cs.frames[0].slice_regions.len(), 0);
        // Pixel should still be red
        assert_eq!(pixel_at(&cs, &lid, 0, 0), [255, 0, 0, 255]);

        // Undo stroke
        cs.undo().unwrap();
        assert_eq!(pixel_at(&cs, &lid, 0, 0), [0, 0, 0, 0]);

        // Redo stroke
        cs.redo().unwrap();
        assert_eq!(pixel_at(&cs, &lid, 0, 0), [255, 0, 0, 255]);

        // Redo slice create
        cs.redo().unwrap();
        assert_eq!(cs.frames[0].slice_regions.len(), 1);
    }

    #[test]
    fn slice_regions_survive_frame_switch() {
        let mut cs = CanvasState::new(8, 8);
        let region = super::super::slice::SliceRegion::new("s1".into(), 0, 0, 4, 4);
        cs.frames[cs.active_frame_index].slice_regions.push(region);

        // Create a new frame and switch to it
        let new_fid = cs.create_frame(None);
        cs.select_frame(&new_fid).unwrap();
        assert_eq!(cs.frames[cs.active_frame_index].slice_regions.len(), 0);

        // Switch back to frame 0
        let first_fid = cs.frames[0].id.clone();
        cs.select_frame(&first_fid).unwrap();
        assert_eq!(cs.frames[cs.active_frame_index].slice_regions.len(), 1);
        assert_eq!(cs.frames[cs.active_frame_index].slice_regions[0].name, "s1");
    }
}
