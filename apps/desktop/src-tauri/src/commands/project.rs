use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{command, State};
use uuid::Uuid;

use crate::engine::canvas_state::{CanvasState, ManagedCanvasState, ManagedProjectMeta, ProjectMeta};
use crate::errors::AppError;
use crate::persistence::project_io::{self, ProjectDocument};
use crate::types::api::RecentProjectItem;
use crate::types::domain::ColorMode;

use super::canvas::{build_frame, CanvasFrame};

// --- Input/Response types ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProjectInput {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub color_mode: ColorMode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub project_id: String,
    pub name: String,
    pub file_path: Option<String>,
    pub is_dirty: bool,
    pub frame: CanvasFrame,
}

// --- Commands ---

/// Create a new blank project and initialize canvas state.
#[command]
pub fn new_project(
    input: NewProjectInput,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ProjectInfo, AppError> {
    let project_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let canvas = CanvasState::new(input.width, input.height);
    let frame = build_frame(&canvas);

    *canvas_state.0.lock().unwrap() = Some(canvas);
    *project_meta.0.lock().unwrap() = Some(ProjectMeta {
        project_id: project_id.clone(),
        name: input.name.clone(),
        file_path: None,
        color_mode: input.color_mode,
        created_at: now,
        is_dirty: false,
    });

    Ok(ProjectInfo {
        project_id,
        name: input.name,
        file_path: None,
        is_dirty: false,
        frame,
    })
}

/// Save the current project to disk. If no file_path is provided, uses the existing one.
/// Returns the saved file path.
#[command]
pub fn save_project(
    file_path: Option<String>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<String, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let mut meta_guard = project_meta.0.lock().unwrap();
    let meta = meta_guard.as_mut()
        .ok_or_else(|| AppError::Internal("No project initialized".to_string()))?;

    let save_path = file_path
        .or_else(|| meta.file_path.clone())
        .ok_or_else(|| AppError::SaveFailed("No file path specified".to_string()))?;

    let doc = ProjectDocument::from_canvas_state(
        canvas,
        &meta.project_id,
        &meta.name,
        meta.color_mode,
        &meta.created_at,
    );

    let path = PathBuf::from(&save_path);
    project_io::save_to_file(&doc, &path)
        .map_err(AppError::SaveFailed)?;

    meta.file_path = Some(save_path.clone());
    meta.is_dirty = false;

    Ok(save_path)
}

/// Open a project from disk, replacing the current canvas state.
#[command]
pub fn open_project(
    file_path: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ProjectInfo, AppError> {
    let path = PathBuf::from(&file_path);
    let doc = project_io::load_from_file(&path)
        .map_err(|e| AppError::InvalidProjectFormat(e))?;

    let canvas = doc.to_canvas_state();
    let frame = build_frame(&canvas);

    let project_id = doc.project_id.clone();
    let name = doc.name.clone();

    *canvas_state.0.lock().unwrap() = Some(canvas);
    *project_meta.0.lock().unwrap() = Some(ProjectMeta {
        project_id: project_id.clone(),
        name: name.clone(),
        file_path: Some(file_path.clone()),
        color_mode: doc.color_mode,
        created_at: doc.created_at,
        is_dirty: false,
    });

    Ok(ProjectInfo {
        project_id,
        name,
        file_path: Some(file_path),
        is_dirty: false,
        frame,
    })
}

/// Get current project metadata (for frontend state sync).
#[command]
pub fn get_project_info(
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ProjectInfo, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let meta_guard = project_meta.0.lock().unwrap();
    let meta = meta_guard.as_ref()
        .ok_or_else(|| AppError::Internal("No project initialized".to_string()))?;

    Ok(ProjectInfo {
        project_id: meta.project_id.clone(),
        name: meta.name.clone(),
        file_path: meta.file_path.clone(),
        is_dirty: meta.is_dirty,
        frame: build_frame(canvas),
    })
}

/// Mark the project as dirty (called after mutations).
#[command]
pub fn mark_dirty(
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<bool, AppError> {
    let mut guard = project_meta.0.lock().unwrap();
    if let Some(meta) = guard.as_mut() {
        meta.is_dirty = true;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// List recently opened projects.
#[command]
pub fn list_recent_projects() -> Result<Vec<RecentProjectItem>, AppError> {
    let recents_path = get_recents_path();
    if !recents_path.exists() {
        return Ok(vec![]);
    }
    let json = std::fs::read_to_string(&recents_path)
        .map_err(|e| AppError::Internal(format!("Failed to read recents: {}", e)))?;
    let items: Vec<RecentProjectItem> = serde_json::from_str(&json)
        .unwrap_or_default();
    Ok(items)
}

/// Export the composited frame as PNG.
#[command]
pub fn export_png(
    file_path: String,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<String, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = canvas.composite_frame();
    let path = std::path::Path::new(&file_path);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(e))?;
    }

    let file = std::fs::File::create(path)
        .map_err(|e| AppError::Io(e))?;
    let w = std::io::BufWriter::new(file);

    let mut encoder = png::Encoder::new(w, canvas.width, canvas.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);

    let mut writer = encoder.write_header()
        .map_err(|e| AppError::Internal(format!("PNG header error: {}", e)))?;
    writer.write_image_data(&frame)
        .map_err(|e| AppError::Internal(format!("PNG write error: {}", e)))?;

    Ok(file_path)
}

/// Write a recovery snapshot of the current state.
#[command]
pub fn autosave_recovery(
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<bool, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = match canvas_guard.as_ref() {
        Some(c) => c,
        None => return Ok(false),
    };

    let meta_guard = project_meta.0.lock().unwrap();
    let meta = match meta_guard.as_ref() {
        Some(m) => m,
        None => return Ok(false),
    };

    if !meta.is_dirty {
        return Ok(false);
    }

    crate::persistence::autosave::write_recovery(canvas, meta)
        .map_err(|e| AppError::Internal(format!("Autosave failed: {}", e)))?;
    Ok(true)
}

/// Check for recoverable projects from a previous session.
#[command]
pub fn check_recovery() -> Result<Vec<crate::persistence::recovery::RecoverableProject>, AppError> {
    Ok(crate::persistence::recovery::detect_recoverable_projects())
}

/// Restore a project from a recovery file.
#[command]
pub fn restore_recovery(
    project_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ProjectInfo, AppError> {
    let recovery_path = crate::persistence::autosave::recovery_path(&project_id);
    let doc = crate::persistence::project_io::load_from_file(&recovery_path)
        .map_err(|e| AppError::InvalidProjectFormat(e))?;

    let canvas = doc.to_canvas_state();
    let frame = build_frame(&canvas);

    let name = doc.name.clone();
    let pid = doc.project_id.clone();

    *canvas_state.0.lock().unwrap() = Some(canvas);
    *project_meta.0.lock().unwrap() = Some(ProjectMeta {
        project_id: pid.clone(),
        name: name.clone(),
        file_path: None, // Recovery doesn't know original file path
        color_mode: doc.color_mode,
        created_at: doc.created_at,
        is_dirty: true, // Recovered state is unsaved
    });

    // Clear the recovery file now that it's been restored
    crate::persistence::autosave::clear_recovery(&project_id);

    Ok(ProjectInfo {
        project_id: pid,
        name,
        file_path: None,
        is_dirty: true,
        frame,
    })
}

/// Discard a recovery file without restoring it.
#[command]
pub fn discard_recovery(project_id: String) -> Result<(), AppError> {
    crate::persistence::recovery::discard_recovery(&project_id);
    Ok(())
}

/// Helper: encode RGBA data as PNG bytes.
fn encode_png(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(std::io::Cursor::new(&mut buf), width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header()
            .map_err(|e| format!("PNG header error: {}", e))?;
        writer.write_image_data(data)
            .map_err(|e| format!("PNG write error: {}", e))?;
    }
    Ok(buf)
}

/// Export all frames as numbered PNG files.
#[command]
pub fn export_frame_sequence(
    dir_path: String,
    base_name: String,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<Vec<String>, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let dir = std::path::Path::new(&dir_path);
    std::fs::create_dir_all(dir)
        .map_err(|e| AppError::Io(e))?;

    let mut paths = Vec::new();
    for i in 0..canvas.frames.len() {
        let frame_data = canvas.composite_frame_at(i)
            .ok_or_else(|| AppError::Internal(format!("Failed to composite frame {}", i)))?;
        let png_data = encode_png(&frame_data, canvas.width, canvas.height)
            .map_err(|e| AppError::Internal(e))?;
        let filename = format!("{}_{:04}.png", base_name, i + 1);
        let file_path = dir.join(&filename);
        std::fs::write(&file_path, &png_data)
            .map_err(|e| AppError::Io(e))?;
        paths.push(file_path.to_string_lossy().to_string());
    }

    Ok(paths)
}

/// Export all frames as a sprite strip PNG (horizontal or vertical).
#[command]
pub fn export_sprite_strip(
    file_path: String,
    horizontal: Option<bool>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<String, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame_count = canvas.frames.len();
    let fw = canvas.width as usize;
    let fh = canvas.height as usize;
    let is_horizontal = horizontal.unwrap_or(true);

    let (strip_w, strip_h) = if is_horizontal {
        (fw * frame_count, fh)
    } else {
        (fw, fh * frame_count)
    };

    let mut strip = vec![0u8; strip_w * strip_h * 4];

    for i in 0..frame_count {
        let frame_data = canvas.composite_frame_at(i)
            .ok_or_else(|| AppError::Internal(format!("Failed to composite frame {}", i)))?;

        let (offset_x, offset_y) = if is_horizontal {
            (i * fw, 0)
        } else {
            (0, i * fh)
        };

        for y in 0..fh {
            for x in 0..fw {
                let src_i = (y * fw + x) * 4;
                let dst_i = ((offset_y + y) * strip_w + (offset_x + x)) * 4;
                strip[dst_i..dst_i + 4].copy_from_slice(&frame_data[src_i..src_i + 4]);
            }
        }
    }

    let path = std::path::Path::new(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(e))?;
    }

    let png_data = encode_png(&strip, strip_w as u32, strip_h as u32)
        .map_err(|e| AppError::Internal(e))?;
    std::fs::write(path, &png_data)
        .map_err(|e| AppError::Io(e))?;

    Ok(file_path)
}

// --- Helpers ---

fn get_recents_path() -> PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("PixelStudio").join("recent-projects.json")
}

/// Add a project to the recents list.
pub fn update_recents(file_path: &str, name: &str) {
    let recents_path = get_recents_path();
    let mut items: Vec<RecentProjectItem> = if recents_path.exists() {
        std::fs::read_to_string(&recents_path)
            .ok()
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default()
    } else {
        vec![]
    };

    // Remove existing entry for this path
    items.retain(|i| i.file_path != file_path);

    // Add to front
    items.insert(0, RecentProjectItem {
        file_path: file_path.to_string(),
        name: name.to_string(),
        thumbnail_path: None,
        last_modified_at: chrono::Utc::now().to_rfc3339(),
    });

    // Keep only last 20
    items.truncate(20);

    if let Some(parent) = recents_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&recents_path, serde_json::to_string_pretty(&items).unwrap_or_default());
}
