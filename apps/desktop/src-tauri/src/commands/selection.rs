use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::pixel_buffer::Color;
use crate::engine::selection::{ClipboardPayload, ManagedSelectionState, SelectionRect, TransformSession};
use crate::errors::AppError;

use super::canvas::{build_frame, CanvasFrame};

// --- Input types ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetSelectionInput {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

// --- Commands ---

/// Set rectangular selection bounds.
#[command]
pub fn set_selection_rect(
    input: SetSelectionInput,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<SelectionRect, AppError> {
    let rect = SelectionRect {
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
    };
    let mut guard = selection_state.0.lock().unwrap();
    guard.selection = Some(rect.clone());
    Ok(rect)
}

/// Clear the current selection.
#[command]
pub fn clear_selection(
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<(), AppError> {
    let mut guard = selection_state.0.lock().unwrap();
    guard.selection = None;
    Ok(())
}

/// Get current selection bounds.
#[command]
pub fn get_selection(
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<Option<SelectionRect>, AppError> {
    let guard = selection_state.0.lock().unwrap();
    Ok(guard.selection.clone())
}

/// Copy pixels within the selection from the active layer.
#[command]
pub fn copy_selection(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<bool, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let mut sel_guard = selection_state.0.lock().unwrap();
    let sel = sel_guard.selection.as_ref()
        .ok_or_else(|| AppError::Internal("No selection".to_string()))?;

    let layer = canvas.active_layer()
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let mut data = vec![0u8; (sel.width as usize) * (sel.height as usize) * 4];

    for dy in 0..sel.height {
        for dx in 0..sel.width {
            let px = sel.x + dx;
            let py = sel.y + dy;
            let color = layer.buffer.get_pixel(px, py);
            let i = ((dy as usize) * (sel.width as usize) + (dx as usize)) * 4;
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
    }

    sel_guard.clipboard = Some(ClipboardPayload {
        width: sel.width,
        height: sel.height,
        layer_id: layer.id.clone(),
        data,
    });

    Ok(true)
}

/// Cut pixels within the selection (copy then clear to transparent).
#[command]
pub fn cut_selection(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<CanvasFrame, AppError> {
    // First copy
    {
        let canvas_guard = canvas_state.0.lock().unwrap();
        let canvas = canvas_guard.as_ref()
            .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

        let mut sel_guard = selection_state.0.lock().unwrap();
        let sel = sel_guard.selection.as_ref()
            .ok_or_else(|| AppError::Internal("No selection".to_string()))?;

        let layer = canvas.active_layer()
            .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

        if layer.locked {
            return Err(AppError::Internal("Layer is locked".to_string()));
        }

        let mut data = vec![0u8; (sel.width as usize) * (sel.height as usize) * 4];
        for dy in 0..sel.height {
            for dx in 0..sel.width {
                let px = sel.x + dx;
                let py = sel.y + dy;
                let color = layer.buffer.get_pixel(px, py);
                let i = ((dy as usize) * (sel.width as usize) + (dx as usize)) * 4;
                data[i] = color.r;
                data[i + 1] = color.g;
                data[i + 2] = color.b;
                data[i + 3] = color.a;
            }
        }

        sel_guard.clipboard = Some(ClipboardPayload {
            width: sel.width,
            height: sel.height,
            layer_id: layer.id.clone(),
            data,
        });
    }

    // Then clear the selected area on the active layer
    {
        let mut canvas_guard = canvas_state.0.lock().unwrap();
        let canvas = canvas_guard.as_mut()
            .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

        let sel_guard = selection_state.0.lock().unwrap();
        let sel = sel_guard.selection.as_ref()
            .ok_or_else(|| AppError::Internal("No selection".to_string()))?;

        let layer = canvas.active_layer_mut()
            .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

        let transparent = Color::rgba(0, 0, 0, 0);
        for dy in 0..sel.height {
            for dx in 0..sel.width {
                layer.buffer.set_pixel(sel.x + dx, sel.y + dy, &transparent);
            }
        }

        Ok(build_frame(canvas))
    }
}

/// Paste clipboard contents at the selection origin (or top-left if no selection).
#[command]
pub fn paste_selection(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<CanvasFrame, AppError> {
    let sel_guard = selection_state.0.lock().unwrap();
    let clipboard = sel_guard.clipboard.as_ref()
        .ok_or_else(|| AppError::Internal("Clipboard is empty".to_string()))?;

    let paste_x = sel_guard.selection.as_ref().map(|s| s.x).unwrap_or(0);
    let paste_y = sel_guard.selection.as_ref().map(|s| s.y).unwrap_or(0);

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let layer = canvas.active_layer_mut()
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }

    for dy in 0..clipboard.height {
        for dx in 0..clipboard.width {
            let px = paste_x + dx;
            let py = paste_y + dy;
            if layer.buffer.in_bounds(px, py) {
                let i = ((dy as usize) * (clipboard.width as usize) + (dx as usize)) * 4;
                let color = Color::rgba(
                    clipboard.data[i],
                    clipboard.data[i + 1],
                    clipboard.data[i + 2],
                    clipboard.data[i + 3],
                );
                layer.buffer.set_pixel(px, py, &color);
            }
        }
    }

    Ok(build_frame(canvas))
}

/// Delete pixels within the selection (clear to transparent).
#[command]
pub fn delete_selection(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<CanvasFrame, AppError> {
    let sel_guard = selection_state.0.lock().unwrap();
    let sel = sel_guard.selection.as_ref()
        .ok_or_else(|| AppError::Internal("No selection".to_string()))?;

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let layer = canvas.active_layer_mut()
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }

    let transparent = Color::rgba(0, 0, 0, 0);
    for dy in 0..sel.height {
        for dx in 0..sel.width {
            layer.buffer.set_pixel(sel.x + dx, sel.y + dy, &transparent);
        }
    }

    Ok(build_frame(canvas))
}

// --- Transform commands ---

/// Response for transform preview (includes payload dimensions + offset for overlay rendering).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformPreview {
    pub source_x: u32,
    pub source_y: u32,
    pub payload_width: u32,
    pub payload_height: u32,
    pub offset_x: i32,
    pub offset_y: i32,
    pub payload_data: Vec<u8>,
    pub frame: CanvasFrame,
}

/// Begin a transform session: extract selected pixels, clear source region.
#[command]
pub fn begin_selection_transform(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();

    if sel_guard.transform.is_some() {
        return Err(AppError::Internal("Transform already active".to_string()));
    }

    let sel = sel_guard.selection.as_ref()
        .ok_or_else(|| AppError::Internal("No selection".to_string()))?.clone();

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let layer = canvas.active_layer()
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }

    let layer_id = layer.id.clone();
    let w = sel.width as usize;
    let h = sel.height as usize;

    // Snapshot selected pixels + original backup
    let mut payload_data = vec![0u8; w * h * 4];
    let mut original_data = vec![0u8; w * h * 4];
    for dy in 0..sel.height {
        for dx in 0..sel.width {
            let px = sel.x + dx;
            let py = sel.y + dy;
            let color = layer.buffer.get_pixel(px, py);
            let i = ((dy as usize) * w + (dx as usize)) * 4;
            payload_data[i] = color.r;
            payload_data[i + 1] = color.g;
            payload_data[i + 2] = color.b;
            payload_data[i + 3] = color.a;
            original_data[i] = color.r;
            original_data[i + 1] = color.g;
            original_data[i + 2] = color.b;
            original_data[i + 3] = color.a;
        }
    }

    // Clear source region on canvas
    let layer_mut = canvas.active_layer_mut().unwrap();
    let transparent = Color::rgba(0, 0, 0, 0);
    for dy in 0..sel.height {
        for dx in 0..sel.width {
            layer_mut.buffer.set_pixel(sel.x + dx, sel.y + dy, &transparent);
        }
    }

    let preview = TransformPreview {
        source_x: sel.x,
        source_y: sel.y,
        payload_width: sel.width,
        payload_height: sel.height,
        offset_x: 0,
        offset_y: 0,
        payload_data: payload_data.clone(),
        frame: build_frame(canvas),
    };

    sel_guard.transform = Some(TransformSession {
        layer_id,
        source_rect: sel,
        payload_width: preview.payload_width,
        payload_height: preview.payload_height,
        payload_data,
        original_data,
        offset_x: 0,
        offset_y: 0,
    });

    Ok(preview)
}

/// Move the transform preview to an absolute offset from the source origin.
#[command]
pub fn move_selection_preview(
    offset_x: i32,
    offset_y: i32,
    selection_state: State<'_, ManagedSelectionState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.as_mut()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    session.offset_x = offset_x;
    session.offset_y = offset_y;

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    Ok(build_transform_preview(session, canvas))
}

/// Nudge the transform by a relative delta.
#[command]
pub fn nudge_selection(
    dx: i32,
    dy: i32,
    selection_state: State<'_, ManagedSelectionState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.as_mut()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    session.offset_x += dx;
    session.offset_y += dy;

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    Ok(build_transform_preview(session, canvas))
}

/// Commit the transform: stamp payload at final position, end session.
#[command]
pub fn commit_selection_transform(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<CanvasFrame, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.take()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == session.layer_id)
        .ok_or_else(|| AppError::Internal("Transform layer not found".to_string()))?;

    // Stamp payload at source + offset
    let base_x = session.source_rect.x as i32 + session.offset_x;
    let base_y = session.source_rect.y as i32 + session.offset_y;

    for dy in 0..session.payload_height {
        for dx in 0..session.payload_width {
            let px = base_x + dx as i32;
            let py = base_y + dy as i32;
            if px >= 0 && py >= 0 {
                let ux = px as u32;
                let uy = py as u32;
                if layer.buffer.in_bounds(ux, uy) {
                    let i = ((dy as usize) * (session.payload_width as usize) + (dx as usize)) * 4;
                    let color = Color::rgba(
                        session.payload_data[i],
                        session.payload_data[i + 1],
                        session.payload_data[i + 2],
                        session.payload_data[i + 3],
                    );
                    layer.buffer.set_pixel(ux, uy, &color);
                }
            }
        }
    }

    // Update selection bounds to new position
    sel_guard.selection = Some(SelectionRect {
        x: base_x.max(0) as u32,
        y: base_y.max(0) as u32,
        width: session.payload_width,
        height: session.payload_height,
    });

    Ok(build_frame(canvas))
}

/// Cancel the transform: restore original pixels, end session.
#[command]
pub fn cancel_selection_transform(
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<CanvasFrame, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.take()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == session.layer_id)
        .ok_or_else(|| AppError::Internal("Transform layer not found".to_string()))?;

    // Restore original pixels to source rect
    let w = session.source_rect.width as usize;
    for dy in 0..session.source_rect.height {
        for dx in 0..session.source_rect.width {
            let i = ((dy as usize) * w + (dx as usize)) * 4;
            let color = Color::rgba(
                session.original_data[i],
                session.original_data[i + 1],
                session.original_data[i + 2],
                session.original_data[i + 3],
            );
            layer.buffer.set_pixel(session.source_rect.x + dx, session.source_rect.y + dy, &color);
        }
    }

    Ok(build_frame(canvas))
}

/// Helper to build a transform preview from the current session state.
fn build_transform_preview(
    session: &TransformSession,
    canvas: &crate::engine::canvas_state::CanvasState,
) -> TransformPreview {
    TransformPreview {
        source_x: session.source_rect.x,
        source_y: session.source_rect.y,
        payload_width: session.payload_width,
        payload_height: session.payload_height,
        offset_x: session.offset_x,
        offset_y: session.offset_y,
        payload_data: session.payload_data.clone(),
        frame: build_frame(canvas),
    }
}

/// Flip the transform payload horizontally.
#[command]
pub fn flip_selection_horizontal(
    selection_state: State<'_, ManagedSelectionState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.as_mut()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    session.flip_horizontal();

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    Ok(build_transform_preview(session, canvas))
}

/// Flip the transform payload vertically.
#[command]
pub fn flip_selection_vertical(
    selection_state: State<'_, ManagedSelectionState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.as_mut()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    session.flip_vertical();

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    Ok(build_transform_preview(session, canvas))
}

/// Rotate the transform payload 90° clockwise.
#[command]
pub fn rotate_selection_90_cw(
    selection_state: State<'_, ManagedSelectionState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.as_mut()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    session.rotate_90_cw();

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    Ok(build_transform_preview(session, canvas))
}

/// Rotate the transform payload 90° counter-clockwise.
#[command]
pub fn rotate_selection_90_ccw(
    selection_state: State<'_, ManagedSelectionState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<TransformPreview, AppError> {
    let mut sel_guard = selection_state.0.lock().unwrap();
    let session = sel_guard.transform.as_mut()
        .ok_or_else(|| AppError::Internal("No active transform".to_string()))?;

    session.rotate_90_ccw();

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    Ok(build_transform_preview(session, canvas))
}
