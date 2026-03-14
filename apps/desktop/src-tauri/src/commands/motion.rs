use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta};
use crate::engine::motion::{
    ManagedMotionState, MotionCommitRecord, MotionDirection, MotionIntent, MotionSession,
    MotionTargetMode, MotionTemplate, MotionTemplateId,
};
use crate::engine::selection::ManagedSelectionState;
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionProposalInfo {
    pub id: String,
    pub label: String,
    pub description: String,
    pub preview_frames: Vec<Vec<u8>>,
    pub preview_width: u32,
    pub preview_height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionSessionInfo {
    pub session_id: String,
    pub intent: String,
    pub direction: Option<String>,
    pub target_mode: String,
    pub output_frame_count: u32,
    pub source_frame_id: String,
    pub anchor_kind: Option<String>,
    pub proposals: Vec<MotionProposalInfo>,
    pub selected_proposal_id: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionCommitResult {
    pub inserted_frame_ids: Vec<String>,
    pub active_frame_id: String,
    pub active_frame_index: usize,
}

fn build_session_info(session: &MotionSession) -> MotionSessionInfo {
    MotionSessionInfo {
        session_id: session.id.clone(),
        intent: serde_json::to_value(&session.intent)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
        direction: session.direction.map(|d| {
            serde_json::to_value(&d)
                .unwrap_or_default()
                .as_str()
                .unwrap_or("unknown")
                .to_string()
        }),
        target_mode: serde_json::to_value(&session.target_mode)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
        output_frame_count: session.output_frame_count,
        source_frame_id: session.source_frame_id.clone(),
        anchor_kind: session.anchor_kind.map(|k| {
            serde_json::to_value(&k)
                .unwrap_or_default()
                .as_str()
                .unwrap_or("custom")
                .to_string()
        }),
        proposals: session
            .proposals
            .iter()
            .map(|p| MotionProposalInfo {
                id: p.id.clone(),
                label: p.label.clone(),
                description: p.description.clone(),
                preview_frames: p.preview_frames.clone(),
                preview_width: p.preview_width,
                preview_height: p.preview_height,
            })
            .collect(),
        selected_proposal_id: session.selected_proposal_id.clone(),
        status: serde_json::to_value(&session.status)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
    }
}

// --- Commands ---

/// Begin a new motion session. Captures source pixels from the active frame/selection.
/// Fails if a stroke or transform is active.
/// Target priority: active selection > anchor binding (if anchor_id provided) > whole frame.
#[command]
pub fn begin_motion_session(
    intent: MotionIntent,
    direction: Option<MotionDirection>,
    target_mode: MotionTargetMode,
    output_frame_count: u32,
    anchor_id: Option<String>,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    // Block if stroke is active
    if canvas.active_stroke.is_some() {
        return Err(AppError::Internal(
            "Cannot start motion session during active stroke".to_string(),
        ));
    }

    // Block if transform is active
    let sel_guard = selection_state.0.lock().unwrap();
    if sel_guard.transform.is_some() {
        return Err(AppError::Internal(
            "Cannot start motion session during active transform".to_string(),
        ));
    }

    // Resolve selection for target (takes precedence over anchor)
    let selection = match target_mode {
        MotionTargetMode::ActiveSelection => sel_guard.selection.as_ref(),
        _ => None,
    };

    // Resolve anchor binding (only used when no selection)
    let frame = &canvas.frames[canvas.active_frame_index];
    let anchor = if selection.is_none() {
        if let Some(ref aid) = anchor_id {
            frame.anchors.iter().find(|a| a.id == *aid)
        } else {
            None
        }
    } else {
        None
    };

    let session = MotionSession::begin(canvas, selection, anchor, intent, direction, output_frame_count)
        .map_err(|e| AppError::Internal(e))?;

    let info = build_session_info(&session);

    let mut motion_guard = motion_state.0.lock().unwrap();
    motion_guard.session = Some(session);

    Ok(info)
}

/// Generate motion proposals for the active session.
#[command]
pub fn generate_motion_proposals(
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let mut guard = motion_state.0.lock().unwrap();
    let session = guard
        .session
        .as_mut()
        .ok_or_else(|| AppError::Internal("No active motion session".to_string()))?;

    session
        .generate_proposals()
        .map_err(|e| AppError::Internal(e))?;

    Ok(build_session_info(session))
}

/// Get the current motion session state.
#[command]
pub fn get_motion_session(
    motion_state: State<'_, ManagedMotionState>,
) -> Result<Option<MotionSessionInfo>, AppError> {
    let guard = motion_state.0.lock().unwrap();
    Ok(guard.session.as_ref().map(build_session_info))
}

/// Accept a motion proposal — selects it for later commit.
#[command]
pub fn accept_motion_proposal(
    proposal_id: String,
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let mut guard = motion_state.0.lock().unwrap();
    let session = guard
        .session
        .as_mut()
        .ok_or_else(|| AppError::Internal("No active motion session".to_string()))?;

    session
        .select_proposal(&proposal_id)
        .map_err(|e| AppError::Internal(e))?;

    Ok(build_session_info(session))
}

/// Reject/deselect the current proposal selection.
#[command]
pub fn reject_motion_proposal(
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let mut guard = motion_state.0.lock().unwrap();
    let session = guard
        .session
        .as_mut()
        .ok_or_else(|| AppError::Internal("No active motion session".to_string()))?;

    session.selected_proposal_id = None;
    Ok(build_session_info(session))
}

/// Cancel the motion session entirely. Project is left unchanged.
#[command]
pub fn cancel_motion_session(
    motion_state: State<'_, ManagedMotionState>,
) -> Result<(), AppError> {
    let mut guard = motion_state.0.lock().unwrap();
    guard.session = None;
    Ok(())
}

/// Commit the selected motion proposal into the timeline as real animation frames.
/// Inserts generated frames after the active frame and switches to the first inserted frame.
/// Stores a MotionCommitRecord for one-step undo.
#[command]
pub fn commit_motion_proposal(
    canvas_state: State<'_, ManagedCanvasState>,
    motion_state: State<'_, ManagedMotionState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<MotionCommitResult, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let mut motion_guard = motion_state.0.lock().unwrap();
    let session = motion_guard
        .session
        .take()
        .ok_or_else(|| AppError::Internal("No active motion session".to_string()))?;

    let proposal = session
        .selected_proposal()
        .ok_or_else(|| AppError::Internal("No proposal selected".to_string()))?
        .clone();

    // Verify source frame still exists (stale session guard)
    if !canvas.frames.iter().any(|f| f.id == session.source_frame_id) {
        // Put session back and fail — don't silently commit stale data
        motion_guard.session = Some(session);
        return Err(AppError::Internal(
            "Source frame no longer exists — session is stale".to_string(),
        ));
    }

    let original_active_frame_index = canvas.active_frame_index;
    let insert_after = canvas.active_frame_index;

    // Build AnimationFrame entries from proposal preview frames
    let mut inserted_frame_ids = Vec::new();
    let mut stashed_frames = Vec::new();

    // Intent-aware frame naming
    let base_name = match session.intent {
        crate::engine::motion::MotionIntent::IdleBob => "Idle",
        crate::engine::motion::MotionIntent::WalkCycleStub => "Walk",
        crate::engine::motion::MotionIntent::RunCycleStub => "Run",
        crate::engine::motion::MotionIntent::Hop => "Hop",
    };
    let n = proposal.preview_frames.len();

    // For region-based sessions (anchor or selection), compose onto full-canvas background
    let needs_compose = session.target_mode != MotionTargetMode::WholeFrame
        && (proposal.preview_width != canvas.width || proposal.preview_height != canvas.height);

    // Get full-canvas composited background for region compositing
    let canvas_bg = if needs_compose {
        Some(canvas.composite_frame())
    } else {
        None
    };

    // Find the region offset for compositing (from the source frame's selection/anchor)
    let region_offset = if needs_compose {
        // For anchor bindings, look up the anchor's bounds
        if session.target_mode == MotionTargetMode::AnchorBinding {
            // Try to find the source anchor on the source frame
            let source_frame = canvas.frames.iter().find(|f| f.id == session.source_frame_id);
            if let Some(sf) = source_frame {
                sf.anchors.iter()
                    .find(|a| a.bounds.is_some() && a.bounds.unwrap().width == proposal.preview_width && a.bounds.unwrap().height == proposal.preview_height)
                    .and_then(|a| a.bounds.map(|b| (b.x, b.y)))
            } else {
                None
            }
        } else {
            // For active selection, we stored the selection rect — but we don't keep it
            // in the session. Use source dimensions to infer position isn't possible
            // cleanly, so for selection mode the preview IS the full output.
            None
        }
    } else {
        None
    };

    // Copy anchors from source frame to propagate to generated frames
    let source_anchors: Vec<crate::engine::anchor::Anchor> = canvas.frames
        .iter()
        .find(|f| f.id == session.source_frame_id)
        .map(|f| f.anchors.clone())
        .unwrap_or_default();

    for (i, frame_data) in proposal.preview_frames.iter().enumerate() {
        let frame_id = uuid::Uuid::new_v4().to_string();
        let layer_id = uuid::Uuid::new_v4().to_string();
        let frame_name = if n <= 4 {
            let suffix = (b'A' + i as u8) as char;
            format!("{} {}", base_name, suffix)
        } else {
            format!("{} {}", base_name, i + 1)
        };

        // Compose region onto full-canvas or use as-is
        let (buf_w, buf_h, final_pixels) = if let (Some(ref bg), Some((ox, oy))) = (&canvas_bg, region_offset) {
            // Start with a copy of the canvas background
            let mut full = bg.clone();
            let cw = canvas.width as usize;
            let pw = proposal.preview_width as usize;
            let ph = proposal.preview_height as usize;
            // Blit the region pixels onto the background
            for row in 0..ph {
                let dy = oy as usize + row;
                if dy >= canvas.height as usize { continue; }
                for col in 0..pw {
                    let dx = ox as usize + col;
                    if dx >= canvas.width as usize { continue; }
                    let src_idx = (row * pw + col) * 4;
                    let dst_idx = (dy * cw + dx) * 4;
                    let alpha = frame_data[src_idx + 3];
                    if alpha > 0 {
                        full[dst_idx..dst_idx + 4].copy_from_slice(&frame_data[src_idx..src_idx + 4]);
                    }
                }
            }
            (canvas.width, canvas.height, full)
        } else {
            (proposal.preview_width, proposal.preview_height, frame_data.clone())
        };

        let buffer = crate::engine::pixel_buffer::PixelBuffer::from_bytes(buf_w, buf_h, final_pixels);

        let layer = crate::engine::canvas_state::Layer {
            id: layer_id.clone(),
            name: "Layer 1".to_string(),
            visible: true,
            locked: false,
            opacity: 1.0,
            buffer,
        };

        let anim_frame = crate::engine::canvas_state::AnimationFrame {
            id: frame_id.clone(),
            name: frame_name,
            layers: vec![layer],
            active_layer_id: Some(layer_id),
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            layer_counter: 1,
            duration_ms: None,
            anchors: source_anchors.clone(),
        };

        inserted_frame_ids.push(frame_id);
        stashed_frames.push(anim_frame);
    }

    // Cancel any in-flight stroke
    canvas.cancel_stroke();
    // Stash active frame before inserting
    canvas.stash_active_frame_pub();

    // Insert frames after the active frame
    for (i, frame) in stashed_frames.into_iter().enumerate() {
        let pos = insert_after + 1 + i;
        canvas.frames.insert(pos, frame);
    }

    // Switch to first inserted frame
    let first_inserted_idx = insert_after + 1;
    canvas.restore_frame_pub(first_inserted_idx);

    // Store commit record for undo
    let commit_record = MotionCommitRecord {
        session_id: session.id.clone(),
        intent: session.intent,
        direction: session.direction,
        output_frame_count: session.output_frame_count,
        inserted_frame_ids: inserted_frame_ids.clone(),
        original_active_frame_index,
        stashed_frames: Vec::new(), // Populated on undo
    };
    motion_guard.last_commit = Some(commit_record);

    // Mark project dirty
    if let Ok(mut meta_guard) = project_meta.0.lock() {
        if let Some(meta) = meta_guard.as_mut() {
            meta.is_dirty = true;
        }
    }

    let active_frame_id = canvas.active_frame_id().to_string();
    let active_frame_index = canvas.active_frame_index;

    Ok(MotionCommitResult {
        inserted_frame_ids,
        active_frame_id,
        active_frame_index,
    })
}

/// Undo the last motion commit — removes inserted frames, restores original active frame.
#[command]
pub fn undo_motion_commit(
    canvas_state: State<'_, ManagedCanvasState>,
    motion_state: State<'_, ManagedMotionState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<MotionCommitResult, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let mut motion_guard = motion_state.0.lock().unwrap();
    let commit = motion_guard
        .last_commit
        .as_mut()
        .ok_or_else(|| AppError::Internal("No motion commit to undo".to_string()))?;

    // Stash any current frame data first
    canvas.cancel_stroke();
    canvas.stash_active_frame_pub();

    // Collect the frames to stash for redo, removing them from the timeline
    let mut stashed = Vec::new();
    for frame_id in &commit.inserted_frame_ids {
        if let Some(pos) = canvas.frames.iter().position(|f| f.id == *frame_id) {
            stashed.push(canvas.frames.remove(pos));
        }
    }
    commit.stashed_frames = stashed;

    // Restore original active frame
    let restore_idx = commit
        .original_active_frame_index
        .min(canvas.frames.len().saturating_sub(1));
    canvas.restore_frame_pub(restore_idx);

    // Mark project dirty
    if let Ok(mut meta_guard) = project_meta.0.lock() {
        if let Some(meta) = meta_guard.as_mut() {
            meta.is_dirty = true;
        }
    }

    let active_frame_id = canvas.active_frame_id().to_string();

    Ok(MotionCommitResult {
        inserted_frame_ids: Vec::new(),
        active_frame_id,
        active_frame_index: canvas.active_frame_index,
    })
}

/// Redo the last undone motion commit — re-inserts the stashed frames.
#[command]
pub fn redo_motion_commit(
    canvas_state: State<'_, ManagedCanvasState>,
    motion_state: State<'_, ManagedMotionState>,
    project_meta: State<'_, ManagedProjectMeta>,
) -> Result<MotionCommitResult, AppError> {
    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let mut motion_guard = motion_state.0.lock().unwrap();
    let commit = motion_guard
        .last_commit
        .as_mut()
        .ok_or_else(|| AppError::Internal("No motion commit to redo".to_string()))?;

    let stashed = std::mem::take(&mut commit.stashed_frames);
    if stashed.is_empty() {
        return Err(AppError::Internal("No stashed frames to redo".to_string()));
    }

    canvas.cancel_stroke();
    canvas.stash_active_frame_pub();

    // Re-insert at original position (after original active frame)
    let insert_after = commit
        .original_active_frame_index
        .min(canvas.frames.len().saturating_sub(1));

    let mut inserted_ids = Vec::new();
    for (i, frame) in stashed.into_iter().enumerate() {
        inserted_ids.push(frame.id.clone());
        let pos = insert_after + 1 + i;
        canvas.frames.insert(pos, frame);
    }
    commit.inserted_frame_ids = inserted_ids.clone();

    // Switch to first re-inserted frame
    let first_idx = insert_after + 1;
    canvas.restore_frame_pub(first_idx);

    // Mark project dirty
    if let Ok(mut meta_guard) = project_meta.0.lock() {
        if let Some(meta) = meta_guard.as_mut() {
            meta.is_dirty = true;
        }
    }

    let active_frame_id = canvas.active_frame_id().to_string();

    Ok(MotionCommitResult {
        inserted_frame_ids: inserted_ids,
        active_frame_id,
        active_frame_index: canvas.active_frame_index,
    })
}

// --- Motion Templates ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionTemplateInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub anchor_requirements: Vec<MotionTemplateAnchorReqInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionTemplateAnchorReqInfo {
    pub kind: String,
    pub required: bool,
    pub role: String,
}

/// List all available motion templates.
#[command]
pub fn list_motion_templates() -> Vec<MotionTemplateInfo> {
    MotionTemplate::all()
        .into_iter()
        .map(|t| MotionTemplateInfo {
            id: serde_json::to_value(&t.id)
                .unwrap_or_default()
                .as_str()
                .unwrap_or("unknown")
                .to_string(),
            name: t.name,
            description: t.description,
            anchor_requirements: t
                .anchor_requirements
                .into_iter()
                .map(|r| MotionTemplateAnchorReqInfo {
                    kind: serde_json::to_value(&r.kind)
                        .unwrap_or_default()
                        .as_str()
                        .unwrap_or("custom")
                        .to_string(),
                    required: r.required,
                    role: r.role,
                })
                .collect(),
        })
        .collect()
}

/// Apply a motion template — begins a session using anchor-aware generation.
/// The template maps to an intent and auto-selects the best anchor for targeting.
#[command]
pub fn apply_motion_template(
    template_id: MotionTemplateId,
    direction: Option<MotionDirection>,
    output_frame_count: u32,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    if canvas.active_stroke.is_some() {
        return Err(AppError::Internal(
            "Cannot start motion session during active stroke".to_string(),
        ));
    }

    let sel_guard = selection_state.0.lock().unwrap();
    if sel_guard.transform.is_some() {
        return Err(AppError::Internal(
            "Cannot start motion session during active transform".to_string(),
        ));
    }

    // Map template to intent
    let intent = match template_id {
        MotionTemplateId::IdleBreathing => MotionIntent::IdleBob,
        MotionTemplateId::WalkBasic => MotionIntent::WalkCycleStub,
        MotionTemplateId::RunBasic => MotionIntent::RunCycleStub,
        MotionTemplateId::HopBasic => MotionIntent::Hop,
    };

    // Find best anchor for this template: use the first required anchor kind found
    let template = MotionTemplate::all()
        .into_iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| AppError::Internal("Template not found".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    let anchor = template
        .anchor_requirements
        .iter()
        .filter(|r| r.required)
        .find_map(|r| frame.anchors.iter().find(|a| a.kind == r.kind));

    // Selection takes precedence
    let selection = sel_guard.selection.as_ref();

    let session = MotionSession::begin(
        canvas,
        selection,
        anchor,
        intent,
        direction,
        output_frame_count,
    )
    .map_err(|e| AppError::Internal(e))?;

    let info = build_session_info(&session);

    let mut motion_guard = motion_state.0.lock().unwrap();
    motion_guard.session = Some(session);

    Ok(info)
}
