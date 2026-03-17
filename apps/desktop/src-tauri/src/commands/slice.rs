use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta, UndoAction};
use crate::engine::slice::SliceRegion;
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SliceRegionInfo {
    pub id: String,
    pub name: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

fn region_to_info(r: &SliceRegion) -> SliceRegionInfo {
    SliceRegionInfo {
        id: r.id.clone(),
        name: r.name.clone(),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
    }
}

// --- Commands ---

/// Create a slice region on the active frame. Participates in undo/redo.
#[command]
pub fn create_slice_region(
    name: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<SliceRegionInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    // Validate bounds
    if x + width > canvas.width || y + height > canvas.height {
        return Err(AppError::Internal(
            "Slice region extends beyond canvas bounds".to_string(),
        ));
    }
    if width == 0 || height == 0 {
        return Err(AppError::Internal(
            "Slice region must have non-zero dimensions".to_string(),
        ));
    }

    let region = SliceRegion::new(name, x, y, width, height);
    let info = region_to_info(&region);

    // Push to undo stack (undo will remove it)
    canvas.undo_stack.push(UndoAction::SliceCreate(region.clone()));
    canvas.redo_stack.clear();

    let frame = &mut canvas.frames[canvas.active_frame_index];
    frame.slice_regions.push(region);

    // Mark project dirty
    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Delete a slice region by ID from the active frame. Participates in undo/redo.
#[command]
pub fn delete_slice_region(
    region_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<(), AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let idx = frame
        .slice_regions
        .iter()
        .position(|r| r.id == region_id)
        .ok_or_else(|| AppError::Internal("Slice region not found".to_string()))?;

    let removed = frame.slice_regions.remove(idx);

    // Push to undo stack (undo will restore it)
    canvas.undo_stack.push(UndoAction::SliceDelete(removed));
    canvas.redo_stack.clear();

    // Mark project dirty
    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(())
}

/// List all slice regions on the active frame.
#[command]
pub fn list_slice_regions(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<Vec<SliceRegionInfo>, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    Ok(frame.slice_regions.iter().map(region_to_info).collect())
}

/// Clear all slice regions from the active frame. Each removal is individually undoable.
#[command]
pub fn clear_slice_regions(
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<(), AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    if frame.slice_regions.is_empty() {
        return Ok(());
    }

    // Push each removal as individual undo actions (last removed = first undone)
    let regions: Vec<SliceRegion> = frame.slice_regions.drain(..).collect();
    for region in regions {
        canvas.undo_stack.push(UndoAction::SliceDelete(region));
    }
    canvas.redo_stack.clear();

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(())
}
