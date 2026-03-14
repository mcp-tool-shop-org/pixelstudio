use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::canvas_state::{CanvasState, ManagedCanvasState};
use crate::engine::pixel_buffer::Color;
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasFrame {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
    pub layers: Vec<LayerInfo>,
    pub active_layer_id: Option<String>,
    pub can_undo: bool,
    pub can_redo: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerInfo {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelValue {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

// --- Input types ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritePixelInput {
    pub x: u32,
    pub y: u32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    pub layer_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginStrokeInput {
    pub tool: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrokePointsInput {
    pub points: Vec<[u32; 2]>,
}

// --- Canvas lifecycle ---

#[command]
pub fn init_canvas(
    width: u32,
    height: u32,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let canvas = CanvasState::new(width, height);
    let frame = build_frame(&canvas);
    *state.0.lock().unwrap() = Some(canvas);
    Ok(frame)
}

#[command]
pub fn get_canvas_state(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    Ok(build_frame(canvas))
}

// --- Pixel read (for color picker) ---

#[command]
pub fn read_pixel(
    x: u32,
    y: u32,
    layer_id: Option<String>,
    state: State<'_, ManagedCanvasState>,
) -> Result<PixelValue, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    match layer_id {
        Some(id) => {
            let layer = canvas.layer_by_id(&id)
                .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;
            let c = layer.buffer.get_pixel(x, y);
            Ok(PixelValue { r: c.r, g: c.g, b: c.b, a: c.a })
        }
        None => {
            let frame = canvas.composite_frame();
            let idx = ((y as usize) * (canvas.width as usize) + (x as usize)) * 4;
            if idx + 3 >= frame.len() {
                return Ok(PixelValue { r: 0, g: 0, b: 0, a: 0 });
            }
            Ok(PixelValue {
                r: frame[idx],
                g: frame[idx + 1],
                b: frame[idx + 2],
                a: frame[idx + 3],
            })
        }
    }
}

// --- Legacy single-pixel write (still useful outside strokes) ---

#[command]
pub fn write_pixel(
    input: WritePixelInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let color = Color::rgba(input.r, input.g, input.b, input.a);
    let target_id = input.layer_id
        .or_else(|| canvas.active_layer_id.clone())
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == target_id)
        .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }
    if !layer.buffer.in_bounds(input.x, input.y) {
        return Err(AppError::Internal(format!(
            "Pixel ({}, {}) out of bounds", input.x, input.y
        )));
    }

    layer.buffer.set_pixel(input.x, input.y, &color);
    Ok(build_frame(canvas))
}

// --- Stroke lifecycle ---

#[command]
pub fn begin_stroke(
    input: BeginStrokeInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<String, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.begin_stroke(input.tool, [input.r, input.g, input.b, input.a])
        .map_err(AppError::Internal)
}

#[command]
pub fn stroke_points(
    input: StrokePointsInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let points: Vec<(u32, u32)> = input.points.iter().map(|p| (p[0], p[1])).collect();
    canvas.stroke_points(&points)
        .map_err(AppError::Internal)?;

    Ok(build_frame(canvas))
}

#[command]
pub fn end_stroke(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.end_stroke().map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

// --- Undo/Redo ---

#[command]
pub fn undo(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.undo().map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn redo(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.redo().map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

// --- Layer management ---

#[command]
pub fn create_layer(
    name: Option<String>,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.create_layer(name);
    Ok(build_frame(canvas))
}

#[command]
pub fn delete_layer(
    layer_id: String,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.delete_layer(&layer_id).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn rename_layer(
    layer_id: String,
    name: String,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.rename_layer(&layer_id, name).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn select_layer(
    layer_id: String,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.select_layer(&layer_id).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn set_layer_visibility(
    layer_id: String,
    visible: bool,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_layer_visibility(&layer_id, visible).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn set_layer_lock(
    layer_id: String,
    locked: bool,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_layer_lock(&layer_id, locked).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn set_layer_opacity(
    layer_id: String,
    opacity: f32,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_layer_opacity(&layer_id, opacity).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn reorder_layer(
    layer_id: String,
    new_index: usize,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.reorder_layer(&layer_id, new_index).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

// --- Helpers ---

fn build_frame(canvas: &CanvasState) -> CanvasFrame {
    CanvasFrame {
        width: canvas.width,
        height: canvas.height,
        data: canvas.composite_frame(),
        layers: canvas.layers.iter().map(|l| LayerInfo {
            id: l.id.clone(),
            name: l.name.clone(),
            visible: l.visible,
            locked: l.locked,
            opacity: l.opacity,
        }).collect(),
        active_layer_id: canvas.active_layer_id.clone(),
        can_undo: !canvas.undo_stack.is_empty(),
        can_redo: !canvas.redo_stack.is_empty(),
    }
}
