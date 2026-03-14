use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::motion::{ManagedMotionState, MotionDirection, MotionIntent, MotionSession};
use crate::engine::secondary_motion::{
    SecondaryMotionParams, SecondaryMotionTemplate, SecondaryMotionTemplateId,
};
use crate::engine::selection::ManagedSelectionState;
use crate::errors::AppError;

// Re-use the existing motion session info builder from motion commands
use super::motion::MotionSessionInfo;

// ─── Response types ──────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryTemplateInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub anchor_requirements: Vec<SecondaryAnchorReqInfo>,
    pub benefits_from_hierarchy: bool,
    pub hint: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryAnchorReqInfo {
    pub kind: String,
    pub required: bool,
    pub role: String,
}

/// Readiness tier for a secondary-motion template.
#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReadinessTier {
    /// All anchors met, hierarchy present if beneficial.
    Ready,
    /// Usable but hierarchy or optional anchors missing.
    Limited,
    /// No valid target — cannot generate.
    Blocked,
}

/// Structured readiness info for a secondary-motion template against current frame.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryReadinessInfo {
    pub template_id: String,
    pub template_name: String,
    pub tier: ReadinessTier,
    pub total_anchors: u32,
    pub root_anchors: Vec<String>,
    pub child_anchors: Vec<String>,
    pub hierarchy_present: bool,
    pub hierarchy_beneficial: bool,
    pub notes: Vec<String>,
    pub fix_hints: Vec<String>,
}

// ─── Commands ────────────────────────────────────────────────

/// List all available secondary-motion templates.
#[command]
pub fn list_secondary_motion_templates() -> Vec<SecondaryTemplateInfo> {
    SecondaryMotionTemplate::all()
        .into_iter()
        .map(|t| SecondaryTemplateInfo {
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
                .map(|r| SecondaryAnchorReqInfo {
                    kind: serde_json::to_value(&r.kind)
                        .unwrap_or_default()
                        .as_str()
                        .unwrap_or("custom")
                        .to_string(),
                    required: r.required,
                    role: r.role,
                })
                .collect(),
            benefits_from_hierarchy: t.benefits_from_hierarchy,
            hint: t.hint,
        })
        .collect()
}

/// Check readiness of a secondary-motion template against the current frame's anchors.
/// Returns structured readiness info: tier, anchor summary, hierarchy status, and fix hints.
#[command]
pub fn check_secondary_readiness(
    template_id: SecondaryMotionTemplateId,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<SecondaryReadinessInfo, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let template = SecondaryMotionTemplate::all()
        .into_iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| AppError::Internal("Template not found".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    let anchors = &frame.anchors;

    let total_anchors = anchors.len() as u32;

    // Classify anchors as root vs child
    let root_anchors: Vec<String> = anchors
        .iter()
        .filter(|a| a.parent_name.is_none())
        .map(|a| a.name.clone())
        .collect();
    let child_anchors: Vec<String> = anchors
        .iter()
        .filter(|a| a.parent_name.is_some())
        .map(|a| a.name.clone())
        .collect();

    let hierarchy_present = !child_anchors.is_empty();

    // Determine readiness tier
    let mut notes = Vec::new();
    let mut fix_hints = Vec::new();

    let tier = if total_anchors == 0 {
        notes.push("No anchors on this frame".to_string());
        fix_hints.push("Add at least one anchor in the Anchors panel".to_string());
        ReadinessTier::Blocked
    } else if hierarchy_present || !template.benefits_from_hierarchy {
        if hierarchy_present {
            notes.push(format!(
                "{} root, {} child anchor{}",
                root_anchors.len(),
                child_anchors.len(),
                if child_anchors.len() != 1 { "s" } else { "" }
            ));
        } else {
            notes.push(format!("{} anchor{}, no hierarchy needed", total_anchors,
                if total_anchors != 1 { "s" } else { "" }));
        }
        ReadinessTier::Ready
    } else {
        // Has anchors but no hierarchy, and template benefits from it
        notes.push(format!("{} anchor{}, all roots", total_anchors,
            if total_anchors != 1 { "s" } else { "" }));
        notes.push("No hierarchy — all anchors will move uniformly".to_string());
        if total_anchors >= 2 {
            fix_hints.push("Set parent relationships for layered motion depth".to_string());
        } else {
            fix_hints.push("Add more anchors and set parent relationships for richer motion".to_string());
        }
        ReadinessTier::Limited
    };

    let template_id_str = serde_json::to_value(&template.id)
        .unwrap_or_default()
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    Ok(SecondaryReadinessInfo {
        template_id: template_id_str,
        template_name: template.name,
        tier,
        total_anchors,
        root_anchors,
        child_anchors,
        hierarchy_present,
        hierarchy_beneficial: template.benefits_from_hierarchy,
        notes,
        fix_hints,
    })
}

/// Apply a secondary-motion template — begins a motion session using the template's
/// generation logic instead of the locomotion intent system.
/// Reuses the existing motion session infrastructure for proposals, selection, and commit.
#[command]
pub fn apply_secondary_motion_template(
    template_id: SecondaryMotionTemplateId,
    direction: Option<MotionDirection>,
    strength: Option<f64>,
    frame_count: Option<u32>,
    phase_offset: Option<f64>,
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

    // Find a matching anchor for this template (first required kind found)
    let template = SecondaryMotionTemplate::all()
        .into_iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| AppError::Internal("Template not found".to_string()))?;

    let frame = &canvas.frames[canvas.active_frame_index];
    let anchor = template
        .anchor_requirements
        .iter()
        .filter(|r| r.required)
        .find_map(|r| {
            // For Custom kind, use any available anchor
            if r.kind == crate::engine::anchor::AnchorKind::Custom {
                frame.anchors.first()
            } else {
                frame.anchors.iter().find(|a| a.kind == r.kind)
            }
        });

    // Compute hierarchy scale from anchor depth and falloff weight.
    // Formula: (1 + depth) * falloff_weight — deeper anchors with higher falloff move more.
    let hierarchy_scale = anchor
        .map(|a| {
            let depth = a.depth_in(&frame.anchors) as f64;
            (1.0 + depth) * a.falloff_weight as f64
        })
        .unwrap_or(1.0);

    // Build clamped parameters
    let params = SecondaryMotionParams {
        direction,
        strength: strength.unwrap_or(1.0),
        frame_count: frame_count.unwrap_or(4),
        phase_offset: phase_offset.unwrap_or(0.0),
        hierarchy_scale,
    }
    .clamped();

    // Selection takes precedence
    let selection = sel_guard.selection.as_ref();

    // Begin the session using IdleBob as a base intent (the secondary generator overrides)
    let mut session = MotionSession::begin(
        canvas,
        selection,
        anchor,
        MotionIntent::IdleBob, // Placeholder — secondary generator takes over
        direction,
        params.frame_count,
    )
    .map_err(|e| AppError::Internal(e))?;

    // Generate secondary-motion proposals (overrides the default locomotion logic)
    session
        .generate_secondary_proposals(template_id, params)
        .map_err(|e| AppError::Internal(e))?;

    let info = build_secondary_session_info(&session);

    let mut motion_guard = motion_state.0.lock().unwrap();
    motion_guard.session = Some(session);

    Ok(info)
}

// ─── Helper ──────────────────────────────────────────────────

fn build_secondary_session_info(session: &MotionSession) -> MotionSessionInfo {
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
            .map(|p| super::motion::MotionProposalInfo {
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
