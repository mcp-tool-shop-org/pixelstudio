use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta};
use crate::engine::clip::{Clip, ClipPivot, PivotMode, PivotPoint};
use crate::errors::AppError;

// --- Response types ---

/// Clip validity tier.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClipValidity {
    Valid,
    Warning,
    Invalid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipInfo {
    pub id: String,
    pub name: String,
    pub start_frame: usize,
    pub end_frame: usize,
    pub frame_count: usize,
    pub loop_clip: bool,
    pub fps_override: Option<u32>,
    pub tags: Vec<String>,
    pub pivot: Option<ClipPivot>,
    pub warnings: Vec<String>,
    pub validity: ClipValidity,
}

/// Structured validation result for all clips.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipValidationResult {
    pub total_clips: usize,
    pub valid_count: usize,
    pub warning_count: usize,
    pub invalid_count: usize,
    pub clips: Vec<ClipInfo>,
}

fn clip_to_info(clip: &Clip, total_frames: usize) -> ClipInfo {
    let warnings = clip.validate(total_frames);
    let validity = if clip.start_frame > clip.end_frame
        || clip.start_frame >= total_frames
        || clip.end_frame >= total_frames
    {
        ClipValidity::Invalid
    } else if !warnings.is_empty() {
        ClipValidity::Warning
    } else {
        ClipValidity::Valid
    };
    ClipInfo {
        id: clip.id.clone(),
        name: clip.name.clone(),
        start_frame: clip.start_frame,
        end_frame: clip.end_frame,
        frame_count: clip.frame_count(),
        loop_clip: clip.loop_clip,
        fps_override: clip.fps_override,
        tags: clip.tags.clone(),
        pivot: clip.pivot.clone(),
        warnings,
        validity,
    }
}

// --- Commands ---

/// Create a new clip spanning the given frame range.
#[command]
pub fn create_clip(
    name: String,
    start_frame: usize,
    end_frame: usize,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let total = canvas.frames.len();
    if start_frame >= total || end_frame >= total {
        return Err(AppError::Internal(format!(
            "Frame index out of range (total frames: {})",
            total
        )));
    }
    if start_frame > end_frame {
        return Err(AppError::Internal(
            "Start frame must be <= end frame".to_string(),
        ));
    }

    let clip_name = if name.trim().is_empty() {
        format!("Clip {}", canvas.clips.len() + 1)
    } else {
        name.trim().to_string()
    };

    let clip = Clip::new(clip_name, start_frame, end_frame);
    let info = clip_to_info(&clip, total);
    canvas.clips.push(clip);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// List all clips in the project.
#[command]
pub fn list_clips(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<Vec<ClipInfo>, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    Ok(canvas
        .clips
        .iter()
        .map(|c| clip_to_info(c, total))
        .collect())
}

/// Update a clip's properties.
#[command]
pub fn update_clip(
    clip_id: String,
    name: Option<String>,
    start_frame: Option<usize>,
    end_frame: Option<usize>,
    loop_clip: Option<bool>,
    fps_override: Option<Option<u32>>,
    tags: Option<Vec<String>>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clip = canvas
        .clips
        .iter_mut()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    if let Some(n) = name {
        if !n.trim().is_empty() {
            clip.name = n.trim().to_string();
        }
    }

    // Apply range changes — warn but don't silently clamp
    if let Some(s) = start_frame {
        clip.start_frame = s;
    }
    if let Some(e) = end_frame {
        clip.end_frame = e;
    }
    if let Some(l) = loop_clip {
        clip.loop_clip = l;
    }
    if let Some(f) = fps_override {
        clip.fps_override = f;
    }
    if let Some(t) = tags {
        clip.tags = t;
    }

    let info = clip_to_info(clip, total);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Delete a clip by ID.
#[command]
pub fn delete_clip(
    clip_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<(), AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let idx = canvas
        .clips
        .iter()
        .position(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    canvas.clips.remove(idx);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(())
}

/// Validate all clips against current frame topology.
/// Returns structured validity result without modifying anything.
#[command]
pub fn validate_clips(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<ClipValidationResult, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clips: Vec<ClipInfo> = canvas.clips.iter().map(|c| clip_to_info(c, total)).collect();

    let valid_count = clips.iter().filter(|c| matches!(c.validity, ClipValidity::Valid)).count();
    let warning_count = clips.iter().filter(|c| matches!(c.validity, ClipValidity::Warning)).count();
    let invalid_count = clips.iter().filter(|c| matches!(c.validity, ClipValidity::Invalid)).count();

    Ok(ClipValidationResult {
        total_clips: clips.len(),
        valid_count,
        warning_count,
        invalid_count,
        clips,
    })
}

/// Set or update a clip's pivot/origin point.
#[command]
pub fn set_clip_pivot(
    clip_id: String,
    mode: PivotMode,
    custom_x: Option<f64>,
    custom_y: Option<f64>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clip = canvas
        .clips
        .iter_mut()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    let custom_point = if mode == PivotMode::Custom {
        Some(PivotPoint {
            x: custom_x.unwrap_or(canvas.width as f64 / 2.0),
            y: custom_y.unwrap_or(canvas.height as f64 / 2.0),
        })
    } else {
        None
    };

    clip.pivot = Some(ClipPivot {
        mode,
        custom_point,
    });

    let info = clip_to_info(clip, total);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Clear a clip's pivot (revert to no pivot).
#[command]
pub fn clear_clip_pivot(
    clip_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clip = canvas
        .clips
        .iter_mut()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    clip.pivot = None;
    let info = clip_to_info(clip, total);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Replace all tags on a clip (normalized and deduped).
#[command]
pub fn set_clip_tags(
    clip_id: String,
    tags: Vec<String>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clip = canvas
        .clips
        .iter_mut()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    clip.tags = tags;
    clip.normalize_tags();
    let info = clip_to_info(clip, total);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Add a single tag to a clip (normalized, deduped, respects max).
#[command]
pub fn add_clip_tag(
    clip_id: String,
    tag: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clip = canvas
        .clips
        .iter_mut()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    let normalized = Clip::normalize_tag(&tag)
        .ok_or_else(|| AppError::Internal("Tag is empty after normalization".to_string()))?;

    if clip.tags.len() >= Clip::MAX_TAGS {
        return Err(AppError::Internal(format!(
            "Clip already has {} tags (max {})",
            clip.tags.len(),
            Clip::MAX_TAGS
        )));
    }

    if !clip.tags.iter().any(|t| t == &normalized) {
        clip.tags.push(normalized);
    }

    let info = clip_to_info(clip, total);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Remove a single tag from a clip by value.
#[command]
pub fn remove_clip_tag(
    clip_id: String,
    tag: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ClipInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    let total = canvas.frames.len();

    let clip = canvas
        .clips
        .iter_mut()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    let normalized = tag.trim().to_lowercase();
    clip.tags.retain(|t| t != &normalized);
    let info = clip_to_info(clip, total);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}
