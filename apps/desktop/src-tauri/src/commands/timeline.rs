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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineState {
    pub frames: Vec<FrameInfo>,
    pub active_frame_index: usize,
    pub active_frame_id: String,
    pub frame: CanvasFrame,
}

fn build_timeline_state(
    canvas: &crate::engine::canvas_state::CanvasState,
) -> TimelineState {
    let frames: Vec<FrameInfo> = canvas.frames.iter().enumerate().map(|(i, f)| FrameInfo {
        id: f.id.clone(),
        name: f.name.clone(),
        index: i,
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
