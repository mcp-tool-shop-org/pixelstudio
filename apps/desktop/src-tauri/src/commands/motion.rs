use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::motion::{
    ManagedMotionState, MotionDirection, MotionIntent, MotionSession, MotionTargetMode,
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
    pub proposals: Vec<MotionProposalInfo>,
    pub selected_proposal_id: Option<String>,
    pub status: String,
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
#[command]
pub fn begin_motion_session(
    intent: MotionIntent,
    direction: Option<MotionDirection>,
    target_mode: MotionTargetMode,
    output_frame_count: u32,
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

    // Resolve selection for target
    let selection = match target_mode {
        MotionTargetMode::ActiveSelection => {
            sel_guard.selection.as_ref()
        }
        MotionTargetMode::WholeFrame => None,
    };

    // If user asked for selection but none exists, fall back to whole frame
    let session = MotionSession::begin(canvas, selection, intent, direction, output_frame_count)
        .map_err(|e| AppError::Internal(e))?;

    let info = build_session_info(&session);

    let mut motion_guard = motion_state.0.lock().unwrap();
    *motion_guard = Some(session);

    Ok(info)
}

/// Generate motion proposals for the active session.
#[command]
pub fn generate_motion_proposals(
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let mut guard = motion_state.0.lock().unwrap();
    let session = guard
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
    Ok(guard.as_ref().map(build_session_info))
}

/// Accept a motion proposal — selects it for later commit.
#[command]
pub fn accept_motion_proposal(
    proposal_id: String,
    motion_state: State<'_, ManagedMotionState>,
) -> Result<MotionSessionInfo, AppError> {
    let mut guard = motion_state.0.lock().unwrap();
    let session = guard
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
    *guard = None;
    Ok(())
}
