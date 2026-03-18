use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::selection::ManagedSelectionState;
use crate::errors::AppError;

use super::canvas::{build_frame, CanvasFrame};

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameInfo {
    pub id: String,
    pub name: String,
    pub index: usize,
    pub duration_ms: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineState {
    pub frames: Vec<FrameInfo>,
    pub active_frame_index: usize,
    pub active_frame_id: String,
    pub frame: CanvasFrame,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnionSkinData {
    pub width: u32,
    pub height: u32,
    pub prev_data: Option<Vec<u8>>,
    pub next_data: Option<Vec<u8>>,
}

fn build_timeline_state(
    canvas: &crate::engine::canvas_state::CanvasState,
) -> TimelineState {
    let frames: Vec<FrameInfo> = canvas.frames.iter().enumerate().map(|(i, f)| FrameInfo {
        id: f.id.clone(),
        name: f.name.clone(),
        index: i,
        duration_ms: f.duration_ms,
    }).collect();

    TimelineState {
        frames,
        active_frame_index: canvas.active_frame_index,
        active_frame_id: canvas.active_frame_id().to_string(),
        frame: build_frame(canvas),
    }
}

/// Clear selection/transform state on frame switch to avoid ghost data.
fn clear_transient_state(sel_state: &ManagedSelectionState) {
    let mut guard = sel_state.0.lock().unwrap();
    guard.selection = None;
    guard.clipboard = None;
    guard.transform = None;
}

// --- Commands ---

/// Get current timeline state (frame list + active frame + canvas).
#[command]
pub fn get_timeline(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TimelineState, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    Ok(build_timeline_state(canvas))
}

/// Create a new blank frame and switch to it.
#[command]
pub fn create_frame(
    name: Option<String>,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.create_frame(name);
    Ok(build_timeline_state(canvas))
}

/// Duplicate the current frame (deep copy) and switch to the copy.
#[command]
pub fn duplicate_frame(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.duplicate_frame();
    Ok(build_timeline_state(canvas))
}

/// Delete a frame by id. Cannot delete the last frame.
#[command]
pub fn delete_frame(
    frame_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.delete_frame(&frame_id).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Switch to a different frame by id.
#[command]
pub fn select_frame(
    frame_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.select_frame(&frame_id).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Get composited RGBA data for onion skin (previous and/or next frame).
#[command]
pub fn get_onion_skin_frames(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<OnionSkinData, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let idx = canvas.active_frame_index;
    let prev = if idx > 0 { canvas.composite_frame_at(idx - 1) } else { None };
    let next = if idx + 1 < canvas.frames.len() { canvas.composite_frame_at(idx + 1) } else { None };

    Ok(OnionSkinData {
        width: canvas.width,
        height: canvas.height,
        prev_data: prev,
        next_data: next,
    })
}

/// Rename a frame.
#[command]
pub fn rename_frame(
    frame_id: String,
    name: String,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TimelineState, AppError> {
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.rename_frame(&frame_id, name).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Reorder a frame to a new position.
#[command]
pub fn reorder_frame(
    frame_id: String,
    new_index: usize,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.reorder_frame(&frame_id, new_index).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Insert a new blank frame at a specific position.
#[command]
pub fn insert_frame_at(
    position: usize,
    name: Option<String>,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.insert_frame_at(position, name).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Duplicate the current frame and insert at a specific position.
#[command]
pub fn duplicate_frame_at(
    position: usize,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.duplicate_frame_at(position).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Snapshot composited RGBA data for a range of frames.
/// Returns per-frame composited pixel data for comparison/checkpoint use.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameSnapshotData {
    pub frame_index: usize,
    pub frame_id: String,
    pub frame_name: String,
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

#[command]
pub fn snapshot_frame_range(
    frame_indices: Vec<usize>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<Vec<FrameSnapshotData>, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let mut snapshots = Vec::new();
    for &idx in &frame_indices {
        let data = canvas.composite_frame_at(idx)
            .ok_or_else(|| AppError::Internal(format!("Frame index {} out of range", idx)))?;
        let frame = &canvas.frames[idx];
        snapshots.push(FrameSnapshotData {
            frame_index: idx,
            frame_id: frame.id.clone(),
            frame_name: frame.name.clone(),
            width: canvas.width,
            height: canvas.height,
            data,
        });
    }
    Ok(snapshots)
}

/// Duplicate a range of frames, inserting copies right after the range.
/// Switches to the first new frame.
#[command]
pub fn duplicate_frame_range(
    frame_indices: Vec<usize>,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.duplicate_frame_range(&frame_indices)
        .map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Apply a whole-canvas transform to multiple frames at once.
/// `transform` is one of: "flip_horizontal", "flip_vertical",
/// "rotate_90_cw", "rotate_90_ccw".
/// `frame_indices` lists which frame indices to transform.
#[command]
pub fn transform_frame_range(
    frame_indices: Vec<usize>,
    transform: String,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TimelineState, AppError> {
    clear_transient_state(&selection_state);
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.transform_frames(&frame_indices, &transform)
        .map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}

/// Set per-frame duration override. Pass null/None to clear.
#[command]
pub fn set_frame_duration(
    frame_id: String,
    duration_ms: Option<u32>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TimelineState, AppError> {
    let mut guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_frame_duration(&frame_id, duration_ms).map_err(AppError::Internal)?;
    Ok(build_timeline_state(canvas))
}
