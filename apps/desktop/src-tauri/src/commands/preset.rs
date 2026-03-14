use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::anchor::{Anchor, AnchorKind};
use crate::engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta};
use crate::engine::preset::{MotionPresetDocument, MotionPresetKind, MotionPresetSummary, PresetAnchor, PresetMotionSettings};
use crate::errors::AppError;
use crate::persistence::preset_io;

// ─── Override payload ────────────────────────────────────────

/// Optional overrides applied on top of a preset's motion settings.
/// Does NOT mutate the saved preset — only affects the current apply.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetApplyOverrides {
    #[serde(default)]
    pub strength: Option<f64>,
    #[serde(default)]
    pub direction: Option<String>,
    #[serde(default)]
    pub frame_count: Option<u32>,
    #[serde(default)]
    pub phase_offset: Option<f64>,
}

impl PresetApplyOverrides {
    /// Merge overrides into a PresetMotionSettings, returning the effective settings.
    pub fn merge_into(&self, base: &PresetMotionSettings) -> PresetMotionSettings {
        PresetMotionSettings {
            intent: base.intent.clone(),
            template_id: base.template_id.clone(),
            direction: self.direction.clone().or_else(|| base.direction.clone()),
            strength: Some(self.strength.unwrap_or(base.strength.unwrap_or(1.0))
                .max(0.1).min(2.0)),
            frame_count: Some(self.frame_count.unwrap_or(base.frame_count.unwrap_or(4))
                .max(2).min(8)),
            phase_offset: Some(self.phase_offset.unwrap_or(base.phase_offset.unwrap_or(0.0))
                .max(0.0).min(std::f64::consts::TAU)),
        }
    }
}

// ─── Response types ──────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetSaveResult {
    pub id: String,
    pub name: String,
}

// ─── Commands ────────────────────────────────────────────────

/// Save a new motion preset.
#[command]
pub fn save_motion_preset(
    name: String,
    kind: MotionPresetKind,
    description: Option<String>,
    anchors: Vec<PresetAnchor>,
    motion_settings: PresetMotionSettings,
    target_notes: Option<String>,
) -> Result<PresetSaveResult, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Internal("Preset name cannot be empty".to_string()));
    }

    let mut doc = MotionPresetDocument::new(name.clone(), kind);
    doc.description = description;
    doc.anchors = anchors;
    doc.motion_settings = motion_settings;
    doc.target_notes = target_notes;

    preset_io::save_preset(&doc)
        .map_err(|e| AppError::Internal(e))?;

    Ok(PresetSaveResult {
        id: doc.id,
        name: doc.name,
    })
}

/// List all saved motion presets (summaries only).
#[command]
pub fn list_motion_presets() -> Vec<MotionPresetSummary> {
    preset_io::list_presets()
        .iter()
        .map(|doc| doc.to_summary())
        .collect()
}

/// Delete a motion preset by ID.
#[command]
pub fn delete_motion_preset(preset_id: String) -> Result<(), AppError> {
    preset_io::delete_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))
}

/// Rename a motion preset.
#[command]
pub fn rename_motion_preset(preset_id: String, new_name: String) -> Result<MotionPresetSummary, AppError> {
    if new_name.trim().is_empty() {
        return Err(AppError::Internal("Preset name cannot be empty".to_string()));
    }

    let mut doc = preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))?;

    doc.name = new_name;
    // Update modified timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    doc.modified_at = format!("{}", now);

    preset_io::save_preset(&doc)
        .map_err(|e| AppError::Internal(e))?;

    Ok(doc.to_summary())
}

/// Get full preset document by ID (for apply/inspect).
#[command]
pub fn get_motion_preset(preset_id: String) -> Result<MotionPresetDocument, AppError> {
    preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))
}

// ─── Apply ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetApplyResult {
    pub created_anchors: Vec<String>,
    pub updated_anchors: Vec<String>,
    pub skipped: Vec<String>,
    pub warnings: Vec<String>,
    /// Effective motion settings after overrides (if any).
    pub applied_settings: Option<PresetMotionSettings>,
}

/// Internal: apply preset anchors to a single frame, returns per-frame result.
fn apply_preset_to_frame(
    doc: &MotionPresetDocument,
    frame: &mut crate::engine::canvas_state::AnimationFrame,
    canvas_width: u32,
    canvas_height: u32,
) -> PresetApplyResult {
    let max_anchors = 8usize;
    let mut created = Vec::new();
    let mut updated = Vec::new();
    let mut skipped = Vec::new();
    let mut warnings = Vec::new();

    for preset_anchor in &doc.anchors {
        if let Some(existing) = frame.anchors.iter_mut().find(|a| a.name == preset_anchor.name) {
            existing.parent_name = preset_anchor.parent_name.clone();
            existing.falloff_weight = preset_anchor.falloff_weight;
            if let Ok(kind) = parse_anchor_kind(&preset_anchor.kind) {
                existing.kind = kind;
            }
            updated.push(preset_anchor.name.clone());
        } else if frame.anchors.len() < max_anchors {
            let kind = parse_anchor_kind(&preset_anchor.kind).unwrap_or(AnchorKind::Custom);
            let x = ((preset_anchor.hint_x * canvas_width as f32) as u32).min(canvas_width.saturating_sub(1));
            let y = ((preset_anchor.hint_y * canvas_height as f32) as u32).min(canvas_height.saturating_sub(1));
            let mut anchor = Anchor::new(preset_anchor.name.clone(), kind, x, y);
            anchor.parent_name = preset_anchor.parent_name.clone();
            anchor.falloff_weight = preset_anchor.falloff_weight;
            frame.anchors.push(anchor);
            created.push(preset_anchor.name.clone());
        } else {
            skipped.push(preset_anchor.name.clone());
            warnings.push(format!("Skipped '{}': anchor limit reached (max {})", preset_anchor.name, max_anchors));
        }
    }

    for anchor in &frame.anchors {
        if let Some(ref pname) = anchor.parent_name {
            if !frame.anchors.iter().any(|a| a.name == *pname) {
                warnings.push(format!("'{}' references parent '{}' which is not on this frame", anchor.name, pname));
            }
        }
    }

    PresetApplyResult {
        created_anchors: created,
        updated_anchors: updated,
        skipped,
        warnings,
        applied_settings: None,
    }
}

/// Apply a motion preset to the current frame.
/// Creates missing anchors, updates existing by name, skips incompatible.
/// Optional overrides modify motion settings without changing the saved preset.
#[command]
pub fn apply_motion_preset(
    preset_id: String,
    overrides: Option<PresetApplyOverrides>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<PresetApplyResult, AppError> {
    let doc = preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))?;
    let effective = overrides.as_ref()
        .map(|o| o.merge_into(&doc.motion_settings))
        .unwrap_or_else(|| doc.motion_settings.clone());

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let w = canvas.width;
    let h = canvas.height;
    let frame = &mut canvas.frames[canvas.active_frame_index];
    let mut result = apply_preset_to_frame(&doc, frame, w, h);
    result.applied_settings = Some(effective);

    let dirty = !result.created_anchors.is_empty() || !result.updated_anchors.is_empty();
    if dirty {
        if let Ok(mut meta) = project_meta.0.lock() {
            if let Some(m) = meta.as_mut() {
                m.is_dirty = true;
            }
        }
    }

    Ok(result)
}

// ─── Batch apply ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFrameResult {
    pub frame_index: usize,
    pub frame_id: String,
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchApplyResult {
    pub total_frames: usize,
    pub applied_frames: usize,
    pub skipped_frames: usize,
    pub per_frame: Vec<BatchFrameResult>,
    pub summary: Vec<String>,
    /// Effective motion settings after overrides (if any).
    pub applied_settings: Option<PresetMotionSettings>,
}

/// Apply a motion preset to a span of frames (inclusive range, 0-based).
#[command]
pub fn apply_motion_preset_to_span(
    preset_id: String,
    start_index: usize,
    end_index: usize,
    overrides: Option<PresetApplyOverrides>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<BatchApplyResult, AppError> {
    let doc = preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))?;
    let effective = overrides.as_ref()
        .map(|o| o.merge_into(&doc.motion_settings))
        .unwrap_or_else(|| doc.motion_settings.clone());

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let total = canvas.frames.len();
    if start_index >= total || end_index >= total || start_index > end_index {
        return Err(AppError::Internal(format!(
            "Invalid span {}..{} for {} frames", start_index, end_index, total
        )));
    }
    // Limit batch size
    let span_len = end_index - start_index + 1;
    if span_len > 64 {
        return Err(AppError::Internal("Batch span cannot exceed 64 frames".to_string()));
    }

    let w = canvas.width;
    let h = canvas.height;
    let mut per_frame = Vec::new();
    let mut any_dirty = false;

    for i in start_index..=end_index {
        let frame = &mut canvas.frames[i];
        let fid = frame.id.clone();
        let r = apply_preset_to_frame(&doc, frame, w, h);
        if !r.created_anchors.is_empty() || !r.updated_anchors.is_empty() {
            any_dirty = true;
        }
        per_frame.push(BatchFrameResult {
            frame_index: i,
            frame_id: fid,
            created: r.created_anchors.len(),
            updated: r.updated_anchors.len(),
            skipped: r.skipped.len(),
            warnings: r.warnings,
        });
    }

    if any_dirty {
        if let Ok(mut meta) = project_meta.0.lock() {
            if let Some(m) = meta.as_mut() {
                m.is_dirty = true;
            }
        }
    }

    let applied = per_frame.iter().filter(|f| f.created > 0 || f.updated > 0).count();
    let skipped = per_frame.iter().filter(|f| f.created == 0 && f.updated == 0).count();
    let total_created: usize = per_frame.iter().map(|f| f.created).sum();
    let total_updated: usize = per_frame.iter().map(|f| f.updated).sum();
    let total_skipped: usize = per_frame.iter().map(|f| f.skipped).sum();

    let mut summary = Vec::new();
    summary.push(format!("{} of {} frames modified", applied, span_len));
    if total_created > 0 { summary.push(format!("{} anchors created", total_created)); }
    if total_updated > 0 { summary.push(format!("{} anchors updated", total_updated)); }
    if total_skipped > 0 { summary.push(format!("{} anchors skipped (limit)", total_skipped)); }

    Ok(BatchApplyResult {
        total_frames: span_len,
        applied_frames: applied,
        skipped_frames: skipped,
        per_frame,
        summary,
        applied_settings: Some(effective),
    })
}

/// Apply a motion preset to all frames.
#[command]
pub fn apply_motion_preset_to_all_frames(
    preset_id: String,
    overrides: Option<PresetApplyOverrides>,
    canvas_state: State<'_, ManagedCanvasState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<BatchApplyResult, AppError> {
    let doc = preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))?;
    let effective = overrides.as_ref()
        .map(|o| o.merge_into(&doc.motion_settings))
        .unwrap_or_else(|| doc.motion_settings.clone());

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let total = canvas.frames.len();
    let w = canvas.width;
    let h = canvas.height;
    let mut per_frame = Vec::new();
    let mut any_dirty = false;

    for i in 0..total {
        let frame = &mut canvas.frames[i];
        let fid = frame.id.clone();
        let r = apply_preset_to_frame(&doc, frame, w, h);
        if !r.created_anchors.is_empty() || !r.updated_anchors.is_empty() {
            any_dirty = true;
        }
        per_frame.push(BatchFrameResult {
            frame_index: i,
            frame_id: fid,
            created: r.created_anchors.len(),
            updated: r.updated_anchors.len(),
            skipped: r.skipped.len(),
            warnings: r.warnings,
        });
    }

    if any_dirty {
        if let Ok(mut meta) = project_meta.0.lock() {
            if let Some(m) = meta.as_mut() {
                m.is_dirty = true;
            }
        }
    }

    let applied = per_frame.iter().filter(|f| f.created > 0 || f.updated > 0).count();
    let skipped_count = per_frame.iter().filter(|f| f.created == 0 && f.updated == 0).count();
    let total_created: usize = per_frame.iter().map(|f| f.created).sum();
    let total_updated: usize = per_frame.iter().map(|f| f.updated).sum();
    let total_skipped: usize = per_frame.iter().map(|f| f.skipped).sum();

    let mut summary = Vec::new();
    summary.push(format!("{} of {} frames modified", applied, total));
    if total_created > 0 { summary.push(format!("{} anchors created", total_created)); }
    if total_updated > 0 { summary.push(format!("{} anchors updated", total_updated)); }
    if total_skipped > 0 { summary.push(format!("{} anchors skipped (limit)", total_skipped)); }

    Ok(BatchApplyResult {
        total_frames: total,
        applied_frames: applied,
        skipped_frames: skipped_count,
        per_frame,
        summary,
        applied_settings: Some(effective),
    })
}

// ─── Compatibility ───────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetCompatibility {
    /// "compatible", "partial", "incompatible"
    pub tier: String,
    pub matching_anchors: Vec<String>,
    pub missing_anchors: Vec<String>,
    pub extra_anchors: Vec<String>,
    pub would_exceed_limit: bool,
    pub notes: Vec<String>,
}

/// Check how well a preset matches the current frame's anchor setup.
#[command]
pub fn check_motion_preset_compatibility(
    preset_id: String,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<PresetCompatibility, AppError> {
    let doc = preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))?;

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    let frame_anchor_names: Vec<&str> = frame.anchors.iter().map(|a| a.name.as_str()).collect();
    let max_anchors = 8usize;

    let mut matching = Vec::new();
    let mut missing = Vec::new();

    for pa in &doc.anchors {
        if frame_anchor_names.contains(&pa.name.as_str()) {
            matching.push(pa.name.clone());
        } else {
            missing.push(pa.name.clone());
        }
    }

    let extra: Vec<String> = frame.anchors.iter()
        .filter(|a| !doc.anchors.iter().any(|pa| pa.name == a.name))
        .map(|a| a.name.clone())
        .collect();

    let new_total = frame.anchors.len() + missing.len();
    let would_exceed = new_total > max_anchors;

    let mut notes = Vec::new();
    if !missing.is_empty() {
        notes.push(format!("{} anchor(s) will be created", missing.len()));
    }
    if !matching.is_empty() {
        notes.push(format!("{} anchor(s) will be updated", matching.len()));
    }
    if would_exceed {
        notes.push(format!("Would exceed {} anchor limit — some may be skipped", max_anchors));
    }

    let tier = if missing.is_empty() && !matching.is_empty() {
        "compatible"
    } else if would_exceed && matching.is_empty() {
        "incompatible"
    } else {
        "partial"
    };

    Ok(PresetCompatibility {
        tier: tier.to_string(),
        matching_anchors: matching,
        missing_anchors: missing,
        extra_anchors: extra,
        would_exceed_limit: would_exceed,
        notes,
    })
}

// ─── Preview (non-mutating) ──────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetAnchorDiff {
    pub name: String,
    pub action: String, // "create", "update", "skip"
    /// Changes that would be applied (only for "update").
    pub changes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetPreviewResult {
    pub preset_name: String,
    pub preset_kind: MotionPresetKind,
    pub anchor_diffs: Vec<PresetAnchorDiff>,
    pub effective_settings: PresetMotionSettings,
    pub warnings: Vec<String>,
    pub scope_frames: usize,
}

/// Preview what applying a preset would do — NO mutation.
#[command]
pub fn preview_motion_preset_apply(
    preset_id: String,
    scope: String,
    start_index: Option<usize>,
    end_index: Option<usize>,
    overrides: Option<PresetApplyOverrides>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<PresetPreviewResult, AppError> {
    let doc = preset_io::load_preset(&preset_id)
        .map_err(|e| AppError::Internal(e))?;

    let effective = overrides.as_ref()
        .map(|o| o.merge_into(&doc.motion_settings))
        .unwrap_or_else(|| doc.motion_settings.clone());

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    // Determine scope
    let frame_range: std::ops::RangeInclusive<usize> = match scope.as_str() {
        "span" => {
            let s = start_index.unwrap_or(0);
            let e = end_index.unwrap_or(s);
            s..=e.min(canvas.frames.len().saturating_sub(1))
        }
        "all" => 0..=(canvas.frames.len().saturating_sub(1)),
        _ => canvas.active_frame_index..=canvas.active_frame_index,
    };
    let scope_frames = frame_range.end() - frame_range.start() + 1;

    // Diff against the first frame in scope (representative preview)
    let fi = *frame_range.start();
    let frame = &canvas.frames[fi.min(canvas.frames.len().saturating_sub(1))];
    let max_anchors = 8usize;

    let mut diffs = Vec::new();
    let mut warnings = Vec::new();
    let mut would_create = 0usize;

    for pa in &doc.anchors {
        if let Some(existing) = frame.anchors.iter().find(|a| a.name == pa.name) {
            // Diff changes
            let mut changes = Vec::new();
            if let Ok(pk) = parse_anchor_kind(&pa.kind) {
                if pk != existing.kind {
                    changes.push(format!("kind: {:?} -> {:?}", existing.kind, pk));
                }
            }
            if pa.parent_name != existing.parent_name {
                changes.push(format!("parent: {:?} -> {:?}",
                    existing.parent_name.as_deref().unwrap_or("none"),
                    pa.parent_name.as_deref().unwrap_or("none")));
            }
            if (pa.falloff_weight - existing.falloff_weight).abs() > 0.01 {
                changes.push(format!("falloff: {:.1} -> {:.1}", existing.falloff_weight, pa.falloff_weight));
            }
            diffs.push(PresetAnchorDiff {
                name: pa.name.clone(),
                action: "update".to_string(),
                changes,
            });
        } else if frame.anchors.len() + would_create < max_anchors {
            would_create += 1;
            diffs.push(PresetAnchorDiff {
                name: pa.name.clone(),
                action: "create".to_string(),
                changes: vec![
                    format!("kind: {}", pa.kind),
                    format!("at ({:.0}, {:.0})", pa.hint_x * canvas.width as f32, pa.hint_y * canvas.height as f32),
                ],
            });
        } else {
            diffs.push(PresetAnchorDiff {
                name: pa.name.clone(),
                action: "skip".to_string(),
                changes: vec!["anchor limit reached".to_string()],
            });
            warnings.push(format!("'{}' would be skipped (limit {})", pa.name, max_anchors));
        }
    }

    // Parent ref warnings
    for pa in &doc.anchors {
        if let Some(ref pname) = pa.parent_name {
            let exists = frame.anchors.iter().any(|a| a.name == *pname)
                || doc.anchors.iter().any(|a| a.name == *pname && a.name != pa.name);
            if !exists {
                warnings.push(format!("'{}' references parent '{}' not present", pa.name, pname));
            }
        }
    }

    if scope_frames > 1 {
        warnings.push(format!("Preview based on frame {} — other frames may differ", fi));
    }

    Ok(PresetPreviewResult {
        preset_name: doc.name,
        preset_kind: doc.kind,
        anchor_diffs: diffs,
        effective_settings: effective,
        warnings,
        scope_frames,
    })
}

fn parse_anchor_kind(s: &str) -> Result<AnchorKind, ()> {
    match s {
        "head" => Ok(AnchorKind::Head),
        "torso" => Ok(AnchorKind::Torso),
        "arm_left" => Ok(AnchorKind::ArmLeft),
        "arm_right" => Ok(AnchorKind::ArmRight),
        "leg_left" => Ok(AnchorKind::LegLeft),
        "leg_right" => Ok(AnchorKind::LegRight),
        "custom" => Ok(AnchorKind::Custom),
        _ => Err(()),
    }
}
