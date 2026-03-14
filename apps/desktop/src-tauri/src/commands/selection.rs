use serde::Deserialize;
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::pixel_buffer::Color;
use crate::engine::selection::{ClipboardPayload, ManagedSelectionState, SelectionRect};
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
