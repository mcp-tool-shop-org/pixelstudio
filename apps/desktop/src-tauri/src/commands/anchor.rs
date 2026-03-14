use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::anchor::{Anchor, AnchorKind};
use crate::engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta};
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorInfo {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub x: u32,
    pub y: u32,
    pub bounds: Option<AnchorBoundsInfo>,
    pub parent_name: Option<String>,
    pub falloff_weight: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorBoundsInfo {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

fn anchor_to_info(a: &Anchor) -> AnchorInfo {
    AnchorInfo {
        id: a.id.clone(),
        name: a.name.clone(),
        kind: serde_json::to_value(&a.kind)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("custom")
            .to_string(),
        x: a.x,
        y: a.y,
        bounds: a.bounds.map(|b| AnchorBoundsInfo {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
        }),
        parent_name: a.parent_name.clone(),
        falloff_weight: a.falloff_weight,
    }
}

// --- Commands ---

/// Create an anchor on the active frame.
#[command]
pub fn create_anchor(
    kind: AnchorKind,
    x: u32,
    y: u32,
    name: Option<String>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    // Validate position is within canvas bounds
    if x >= canvas.width || y >= canvas.height {
        return Err(AppError::Internal("Anchor position is out of canvas bounds".to_string()));
    }

    // Check anchor count limit (soft cap at 8)
    let frame = &canvas.frames[canvas.active_frame_index];
    if frame.anchors.len() >= 8 {
        return Err(AppError::Internal(
            "Maximum 8 anchors per frame — remove one before adding more".to_string(),
        ));
    }

    let anchor_name = name.unwrap_or_else(|| Anchor::default_name(kind));
    let anchor = Anchor::new(anchor_name, kind, x, y);
    let info = anchor_to_info(&anchor);

    canvas.frames[canvas.active_frame_index].anchors.push(anchor);

    // Mark dirty
    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Update an anchor's position, name, or kind.
#[command]
pub fn update_anchor(
    anchor_id: String,
    x: Option<u32>,
    y: Option<u32>,
    name: Option<String>,
    kind: Option<AnchorKind>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame
        .anchors
        .iter_mut()
        .find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    if let Some(new_x) = x {
        if new_x >= canvas.width {
            return Err(AppError::Internal("X position out of bounds".to_string()));
        }
        anchor.x = new_x;
    }
    if let Some(new_y) = y {
        if new_y >= canvas.height {
            return Err(AppError::Internal("Y position out of bounds".to_string()));
        }
        anchor.y = new_y;
    }
    // Track old name before rename to update child parent refs
    let old_name = anchor.name.clone();
    if let Some(new_name) = name {
        anchor.name = new_name;
    }
    if let Some(new_kind) = kind {
        anchor.kind = new_kind;
    }

    let new_name_ref = anchor.name.clone();
    let info = anchor_to_info(anchor);

    // If name changed, update any children that reference the old name
    if old_name != new_name_ref {
        for child in frame.anchors.iter_mut() {
            if child.parent_name.as_deref() == Some(old_name.as_str()) {
                child.parent_name = Some(new_name_ref.clone());
            }
        }
    }

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Delete an anchor from the active frame.
#[command]
pub fn delete_anchor(
    anchor_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<(), AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let pos = frame
        .anchors
        .iter()
        .position(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    // Capture deleted anchor's name to clear child references
    let deleted_name = frame.anchors[pos].name.clone();
    frame.anchors.remove(pos);

    // Clear parent_name on any children that referenced the deleted anchor
    for child in frame.anchors.iter_mut() {
        if child.parent_name.as_deref() == Some(deleted_name.as_str()) {
            child.parent_name = None;
        }
    }

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(())
}

/// List all anchors on the active frame.
#[command]
pub fn list_anchors(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<Vec<AnchorInfo>, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    Ok(frame.anchors.iter().map(anchor_to_info).collect())
}

/// Bind the current selection rectangle to an anchor as its target region.
#[command]
pub fn bind_anchor_to_selection(
    anchor_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, crate::engine::selection::ManagedSelectionState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let sel_guard = selection_state.0.lock().unwrap();
    let sel = sel_guard
        .selection
        .as_ref()
        .ok_or_else(|| AppError::Internal("No active selection".to_string()))?;

    // Validate non-empty region
    if sel.width < 2 || sel.height < 2 {
        return Err(AppError::Internal("Selection is too small to bind".to_string()));
    }

    let bounds = crate::engine::anchor::AnchorBounds {
        x: sel.x,
        y: sel.y,
        width: sel.width,
        height: sel.height,
    };

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame
        .anchors
        .iter_mut()
        .find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    anchor.bounds = Some(bounds);

    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Clear the bound region from an anchor.
#[command]
pub fn clear_anchor_binding(
    anchor_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame
        .anchors
        .iter_mut()
        .find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    anchor.bounds = None;

    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Move an anchor to a new position (used for drag operations).
#[command]
pub fn move_anchor(
    anchor_id: String,
    x: u32,
    y: u32,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    if x >= canvas.width || y >= canvas.height {
        return Err(AppError::Internal("Position out of canvas bounds".to_string()));
    }

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame
        .anchors
        .iter_mut()
        .find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    anchor.x = x;
    anchor.y = y;

    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Resize an anchor's bound region.
#[command]
pub fn resize_anchor_bounds(
    anchor_id: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    if width < 2 || height < 2 {
        return Err(AppError::Internal("Bounds too small (minimum 2×2)".to_string()));
    }
    if x + width > canvas.width || y + height > canvas.height {
        return Err(AppError::Internal("Bounds extend outside canvas".to_string()));
    }

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame
        .anchors
        .iter_mut()
        .find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    anchor.bounds = Some(crate::engine::anchor::AnchorBounds { x, y, width, height });

    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

// --- Validation ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorValidationResult {
    pub total: u32,
    pub bound: u32,
    pub unbound: u32,
    pub issues: Vec<String>,
    pub kinds_present: Vec<String>,
}

/// Validate anchors on the active frame, reporting issues.
#[command]
pub fn validate_anchors(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<AnchorValidationResult, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    let anchors = &frame.anchors;

    let mut issues = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    let mut bound = 0u32;
    let mut unbound = 0u32;
    let mut kinds_present = Vec::new();

    for a in anchors {
        // Duplicate names
        if !seen_names.insert(&a.name) {
            issues.push(format!("Duplicate anchor name: \"{}\"", a.name));
        }
        // Out-of-canvas position
        if a.x >= canvas.width || a.y >= canvas.height {
            issues.push(format!("\"{}\" position ({}, {}) is outside canvas", a.name, a.x, a.y));
        }
        // Bounds validation
        if let Some(b) = &a.bounds {
            if b.width < 2 || b.height < 2 {
                issues.push(format!("\"{}\" has empty or too-small bounds ({}x{})", a.name, b.width, b.height));
            }
            if b.x + b.width > canvas.width || b.y + b.height > canvas.height {
                issues.push(format!("\"{}\" bounds extend outside canvas", a.name));
            }
            bound += 1;
        } else {
            unbound += 1;
        }

        let kind_str = serde_json::to_value(&a.kind)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("custom")
            .to_string();
        if !kinds_present.contains(&kind_str) {
            kinds_present.push(kind_str);
        }
    }

    Ok(AnchorValidationResult {
        total: anchors.len() as u32,
        bound,
        unbound,
        issues,
        kinds_present,
    })
}

// --- Propagation ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnchorConflictPolicy {
    Skip,
    Replace,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorPropagateResult {
    pub copied: u32,
    pub skipped: u32,
    pub replaced: u32,
    pub target_frame_count: u32,
}

/// Copy anchors from the active frame to a specific target frame.
/// Matching is by name: if a target frame already has an anchor with the same name,
/// the conflict policy determines whether it is skipped or replaced.
#[command]
pub fn copy_anchors_to_frame(
    target_frame_index: usize,
    conflict_policy: AnchorConflictPolicy,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorPropagateResult, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let active_idx = canvas.active_frame_index;
    if target_frame_index >= canvas.frames.len() {
        return Err(AppError::Internal("Target frame index out of range".to_string()));
    }
    if target_frame_index == active_idx {
        return Err(AppError::Internal("Cannot copy anchors to the same frame".to_string()));
    }

    let source_anchors: Vec<Anchor> = canvas.frames[active_idx].anchors.clone();
    let result = propagate_anchors_to_frame(
        &source_anchors,
        &mut canvas.frames[target_frame_index],
        conflict_policy,
    );

    if result.copied > 0 || result.replaced > 0 {
        if let Ok(mut meta) = project_meta.0.lock() {
            if let Some(m) = meta.as_mut() {
                m.is_dirty = true;
            }
        }
    }

    Ok(AnchorPropagateResult {
        copied: result.copied,
        skipped: result.skipped,
        replaced: result.replaced,
        target_frame_count: 1,
    })
}

/// Copy anchors from the active frame to ALL other frames.
#[command]
pub fn copy_anchors_to_all_frames(
    conflict_policy: AnchorConflictPolicy,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorPropagateResult, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let active_idx = canvas.active_frame_index;
    let source_anchors: Vec<Anchor> = canvas.frames[active_idx].anchors.clone();

    let mut total_copied = 0u32;
    let mut total_skipped = 0u32;
    let mut total_replaced = 0u32;
    let mut target_count = 0u32;

    for i in 0..canvas.frames.len() {
        if i == active_idx { continue; }
        let r = propagate_anchors_to_frame(&source_anchors, &mut canvas.frames[i], conflict_policy);
        total_copied += r.copied;
        total_skipped += r.skipped;
        total_replaced += r.replaced;
        target_count += 1;
    }

    if total_copied > 0 || total_replaced > 0 {
        if let Ok(mut meta) = project_meta.0.lock() {
            if let Some(m) = meta.as_mut() {
                m.is_dirty = true;
            }
        }
    }

    Ok(AnchorPropagateResult {
        copied: total_copied,
        skipped: total_skipped,
        replaced: total_replaced,
        target_frame_count: target_count,
    })
}

/// Propagate a single anchor's updates (position, kind, bounds) to all frames that
/// have an anchor with the same name.
#[command]
pub fn propagate_anchor_updates(
    anchor_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorPropagateResult, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let active_idx = canvas.active_frame_index;
    let source_anchor = canvas.frames[active_idx]
        .anchors
        .iter()
        .find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?
        .clone();

    let mut updated = 0u32;
    let mut target_count = 0u32;

    for i in 0..canvas.frames.len() {
        if i == active_idx { continue; }
        if let Some(target_anchor) = canvas.frames[i]
            .anchors
            .iter_mut()
            .find(|a| a.name == source_anchor.name)
        {
            target_anchor.kind = source_anchor.kind;
            target_anchor.x = source_anchor.x;
            target_anchor.y = source_anchor.y;
            target_anchor.bounds = source_anchor.bounds;
            target_anchor.parent_name = source_anchor.parent_name.clone();
            target_anchor.falloff_weight = source_anchor.falloff_weight;
            updated += 1;
        }
        target_count += 1;
    }

    if updated > 0 {
        if let Ok(mut meta) = project_meta.0.lock() {
            if let Some(m) = meta.as_mut() {
                m.is_dirty = true;
            }
        }
    }

    Ok(AnchorPropagateResult {
        copied: 0,
        skipped: 0,
        replaced: updated,
        target_frame_count: target_count,
    })
}

/// Internal helper: propagate a set of anchors onto a target frame, matching by name.
struct PropagateStats {
    copied: u32,
    skipped: u32,
    replaced: u32,
}

fn propagate_anchors_to_frame(
    source_anchors: &[Anchor],
    target_frame: &mut crate::engine::canvas_state::AnimationFrame,
    policy: AnchorConflictPolicy,
) -> PropagateStats {
    let mut copied = 0u32;
    let mut skipped = 0u32;
    let mut replaced = 0u32;

    for src in source_anchors {
        if let Some(pos) = target_frame.anchors.iter().position(|a| a.name == src.name) {
            match policy {
                AnchorConflictPolicy::Skip => {
                    skipped += 1;
                }
                AnchorConflictPolicy::Replace => {
                    target_frame.anchors[pos] = Anchor::new(src.name.clone(), src.kind, src.x, src.y);
                    target_frame.anchors[pos].bounds = src.bounds;
                    target_frame.anchors[pos].parent_name = src.parent_name.clone();
                    target_frame.anchors[pos].falloff_weight = src.falloff_weight;
                    replaced += 1;
                }
            }
        } else {
            if target_frame.anchors.len() < 8 {
                let mut new_anchor = Anchor::new(src.name.clone(), src.kind, src.x, src.y);
                new_anchor.bounds = src.bounds;
                new_anchor.parent_name = src.parent_name.clone();
                new_anchor.falloff_weight = src.falloff_weight;
                target_frame.anchors.push(new_anchor);
                copied += 1;
            } else {
                skipped += 1;
            }
        }
    }

    PropagateStats { copied, skipped, replaced }
}

// ─── Hierarchy commands ──────────────────────────────────────

/// Set the parent of an anchor (by name). Validates against cycles, self-parenting,
/// missing parent, and depth > 4.
#[command]
pub fn set_anchor_parent(
    anchor_id: String,
    parent_name: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];

    // Find the anchor
    let anchor_name = {
        let anchor = frame.anchors.iter().find(|a| a.id == anchor_id)
            .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;
        anchor.name.clone()
    };

    // Self-parenting check
    if anchor_name == parent_name {
        return Err(AppError::Internal("An anchor cannot be its own parent".to_string()));
    }

    // Check parent exists on this frame
    if !frame.anchors.iter().any(|a| a.name == parent_name) {
        return Err(AppError::Internal(format!("Parent anchor '{}' not found on this frame", parent_name)));
    }

    // Cycle check
    if Anchor::would_cycle(&anchor_name, &parent_name, &frame.anchors) {
        return Err(AppError::Internal("Setting this parent would create a cycle".to_string()));
    }

    // Set the parent
    {
        let anchor = frame.anchors.iter_mut().find(|a| a.id == anchor_id).unwrap();
        anchor.parent_name = Some(parent_name);
    }

    // Build info after mutable borrow is released
    let anchor = frame.anchors.iter().find(|a| a.id == anchor_id).unwrap();
    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Clear the parent of an anchor, making it a root.
#[command]
pub fn clear_anchor_parent(
    anchor_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame.anchors.iter_mut().find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    anchor.parent_name = None;
    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}

/// Set the falloff weight for an anchor (clamped to 0.1–3.0).
#[command]
pub fn set_anchor_falloff(
    anchor_id: String,
    falloff_weight: f32,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<AnchorInfo, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &mut canvas.frames[canvas.active_frame_index];
    let anchor = frame.anchors.iter_mut().find(|a| a.id == anchor_id)
        .ok_or_else(|| AppError::Internal("Anchor not found".to_string()))?;

    anchor.falloff_weight = falloff_weight.clamp(0.1, 3.0);
    let info = anchor_to_info(anchor);

    if let Ok(mut meta) = project_meta.0.lock() {
        if let Some(m) = meta.as_mut() {
            m.is_dirty = true;
        }
    }

    Ok(info)
}
