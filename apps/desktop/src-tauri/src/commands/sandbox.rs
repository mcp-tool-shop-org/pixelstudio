use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::sandbox::{self, ManagedSandboxState, SandboxAnalysis, SandboxSession, SandboxSource};
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxSessionInfo {
    pub session_id: String,
    pub source: String,
    pub start_frame_index: usize,
    pub end_frame_index: usize,
    pub frame_count: usize,
    pub preview_frames: Vec<Vec<u8>>,
    pub preview_width: u32,
    pub preview_height: u32,
}

fn build_sandbox_info(session: &SandboxSession) -> SandboxSessionInfo {
    SandboxSessionInfo {
        session_id: session.id.clone(),
        source: serde_json::to_value(&session.source)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
        start_frame_index: session.start_frame_index,
        end_frame_index: session.end_frame_index,
        frame_count: session.preview_frames.len(),
        preview_frames: session.preview_frames.clone(),
        preview_width: session.preview_width,
        preview_height: session.preview_height,
    }
}

// --- Commands ---

/// Begin a sandbox session from a timeline frame span.
/// Composites each frame in the range and stores the previews.
/// Never mutates project state.
#[command]
pub fn begin_sandbox_session(
    start_frame_index: usize,
    end_frame_index: usize,
    source: SandboxSource,
    canvas_state: State<'_, ManagedCanvasState>,
    sandbox_state: State<'_, ManagedSandboxState>,
) -> Result<SandboxSessionInfo, AppError> {
    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    if start_frame_index >= canvas.frames.len() || end_frame_index >= canvas.frames.len() {
        return Err(AppError::Internal("Frame index out of range".to_string()));
    }
    if start_frame_index > end_frame_index {
        return Err(AppError::Internal("Start frame must be before or equal to end frame".to_string()));
    }

    let w = canvas.width;
    let h = canvas.height;
    let mut preview_frames = Vec::new();

    // Composite each frame in the span
    for idx in start_frame_index..=end_frame_index {
        let frame = &canvas.frames[idx];
        let mut composited = vec![0u8; (w as usize) * (h as usize) * 4];
        for layer in &frame.layers {
            if !layer.visible { continue; }
            let layer_data = layer.buffer.as_bytes();
            let opacity = layer.opacity;
            for i in 0..((w as usize) * (h as usize)) {
                let src_a = layer_data[i * 4 + 3] as f32 * opacity;
                if src_a <= 0.0 { continue; }
                let dst_idx = i * 4;
                let src_idx = i * 4;
                if src_a >= 255.0 {
                    composited[dst_idx..dst_idx + 4].copy_from_slice(&layer_data[src_idx..src_idx + 4]);
                } else {
                    // Simple alpha-over blend
                    let sa = src_a / 255.0;
                    let da = composited[dst_idx + 3] as f32 / 255.0;
                    let out_a = sa + da * (1.0 - sa);
                    if out_a > 0.0 {
                        for c in 0..3 {
                            composited[dst_idx + c] = ((layer_data[src_idx + c] as f32 * sa
                                + composited[dst_idx + c] as f32 * da * (1.0 - sa))
                                / out_a) as u8;
                        }
                        composited[dst_idx + 3] = (out_a * 255.0) as u8;
                    }
                }
            }
        }
        preview_frames.push(composited);
    }

    let session = SandboxSession {
        id: uuid::Uuid::new_v4().to_string(),
        source,
        start_frame_index,
        end_frame_index,
        preview_frames,
        preview_width: w,
        preview_height: h,
    };

    let info = build_sandbox_info(&session);

    let mut guard = sandbox_state.0.lock().unwrap();
    *guard = Some(session);

    Ok(info)
}

/// Get the current sandbox session state.
#[command]
pub fn get_sandbox_session(
    sandbox_state: State<'_, ManagedSandboxState>,
) -> Result<Option<SandboxSessionInfo>, AppError> {
    let guard = sandbox_state.0.lock().unwrap();
    Ok(guard.as_ref().map(build_sandbox_info))
}

/// Close the sandbox session. No project mutation.
#[command]
pub fn close_sandbox_session(
    sandbox_state: State<'_, ManagedSandboxState>,
) -> Result<(), AppError> {
    let mut guard = sandbox_state.0.lock().unwrap();
    *guard = None;
    Ok(())
}

// ── Analysis response types ───────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BBoxInfo {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
    pub center_x: f64,
    pub center_y: f64,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopDiagnosticsInfo {
    /// Normalized first-last frame delta (0 = identical, higher = more different).
    pub first_last_delta: f64,
    /// Human label: "good", "moderate_mismatch", "large_mismatch".
    pub label: String,
    /// Readable hint.
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriftDiagnosticsInfo {
    /// Center drift (dx, dy) from first to last frame.
    pub drift_x: f64,
    pub drift_y: f64,
    /// Euclidean drift magnitude.
    pub drift_magnitude: f64,
    /// Max displacement from first frame center across span.
    pub max_displacement: f64,
    /// Human label: "none", "mild", "notable", "strong".
    pub label: String,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingDiagnosticsInfo {
    /// Number of adjacent identical frames.
    pub identical_adjacent_count: usize,
    /// Largest adjacent-frame delta.
    pub largest_adjacent_delta: f64,
    /// Average adjacent-frame delta.
    pub avg_adjacent_delta: f64,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticIssueInfo {
    /// "info", "warning", "strong_warning"
    pub severity: String,
    pub label: String,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxMetricsSummary {
    pub session_id: String,
    pub frame_count: usize,
    pub preview_width: u32,
    pub preview_height: u32,
    pub bboxes: Vec<Option<BBoxInfo>>,
    pub adjacent_deltas: Vec<f64>,
    pub loop_diagnostics: LoopDiagnosticsInfo,
    pub drift_diagnostics: DriftDiagnosticsInfo,
    pub timing_diagnostics: TimingDiagnosticsInfo,
    pub issues: Vec<DiagnosticIssueInfo>,
}

// ── Threshold constants ───────────────────────────────────────────
// All thresholds are on normalized per-pixel-per-channel deltas (0..255 scale).
// A delta of 1.0 means every pixel differs by 1 on average across all 4 channels.

/// Below this, first/last frames are considered a good loop closure.
const LOOP_GOOD_THRESHOLD: f64 = 0.5;
/// Above this, first/last frames are considered a large mismatch.
const LOOP_LARGE_THRESHOLD: f64 = 3.0;

/// Drift magnitude thresholds (in pixels, bbox center displacement).
const DRIFT_MILD_THRESHOLD: f64 = 1.5;
const DRIFT_NOTABLE_THRESHOLD: f64 = 4.0;
const DRIFT_STRONG_THRESHOLD: f64 = 8.0;

/// Adjacent delta spike: if a single jump exceeds 3x the average, flag it.
const ABRUPTNESS_MULTIPLIER: f64 = 3.0;

/// If more than half of adjacent pairs are identical, flag stillness.
const STILLNESS_RATIO: f64 = 0.5;

fn build_loop_diagnostics(analysis: &SandboxAnalysis) -> LoopDiagnosticsInfo {
    let d = analysis.first_last_delta;
    let (label, hint) = if analysis.frame_count < 2 {
        ("not_applicable".to_string(), "Single frame — no loop to analyze.".to_string())
    } else if d <= LOOP_GOOD_THRESHOLD {
        ("good".to_string(), "Good loop closure — first and last frames are similar.".to_string())
    } else if d <= LOOP_LARGE_THRESHOLD {
        ("moderate_mismatch".to_string(), "Moderate loop mismatch — first and last frames differ noticeably.".to_string())
    } else {
        ("large_mismatch".to_string(), "Large first/last difference — the loop may pop or jump.".to_string())
    };
    LoopDiagnosticsInfo { first_last_delta: d, label, hint }
}

fn build_drift_diagnostics(analysis: &SandboxAnalysis) -> DriftDiagnosticsInfo {
    let (dx, dy) = analysis.center_drift.unwrap_or((0.0, 0.0));
    let mag = (dx * dx + dy * dy).sqrt();
    let max_d = analysis.max_center_displacement;
    let (label, hint) = if mag < DRIFT_MILD_THRESHOLD {
        ("none".to_string(), "No significant drift detected.".to_string())
    } else if mag < DRIFT_NOTABLE_THRESHOLD {
        ("mild".to_string(), "Mild drift — the sprite may translate slightly across the loop.".to_string())
    } else if mag < DRIFT_STRONG_THRESHOLD {
        ("notable".to_string(), "Notable drift — the sprite appears to slide during the animation.".to_string())
    } else {
        ("strong".to_string(), "Strong drift — the sprite translates significantly, which may indicate unintentional movement.".to_string())
    };
    DriftDiagnosticsInfo { drift_x: dx, drift_y: dy, drift_magnitude: mag, max_displacement: max_d, label, hint }
}

fn build_timing_diagnostics(analysis: &SandboxAnalysis) -> TimingDiagnosticsInfo {
    let avg = if analysis.adjacent_deltas.is_empty() {
        0.0
    } else {
        analysis.adjacent_deltas.iter().sum::<f64>() / analysis.adjacent_deltas.len() as f64
    };
    let hint = if analysis.frame_count < 2 {
        "Single frame — no timing to analyze.".to_string()
    } else if analysis.identical_adjacent_count > 0 && analysis.adjacent_deltas.len() > 0
        && (analysis.identical_adjacent_count as f64 / analysis.adjacent_deltas.len() as f64) > STILLNESS_RATIO
    {
        "Many consecutive frames are identical — the animation may feel static.".to_string()
    } else if analysis.largest_adjacent_delta > avg * ABRUPTNESS_MULTIPLIER && avg > 0.1 {
        "Some frame transitions are much larger than average — may feel abrupt.".to_string()
    } else {
        "Frame-to-frame timing looks consistent.".to_string()
    };
    TimingDiagnosticsInfo {
        identical_adjacent_count: analysis.identical_adjacent_count,
        largest_adjacent_delta: analysis.largest_adjacent_delta,
        avg_adjacent_delta: avg,
        hint,
    }
}

/// Generate at most 5 diagnostic issues, ordered by severity.
fn build_issues(
    analysis: &SandboxAnalysis,
    loop_diag: &LoopDiagnosticsInfo,
    drift_diag: &DriftDiagnosticsInfo,
    timing_diag: &TimingDiagnosticsInfo,
) -> Vec<DiagnosticIssueInfo> {
    let mut issues = Vec::new();

    // Loop closure
    if analysis.frame_count >= 2 {
        match loop_diag.label.as_str() {
            "large_mismatch" => issues.push(DiagnosticIssueInfo {
                severity: "strong_warning".to_string(),
                label: "Loop mismatch".to_string(),
                explanation: format!(
                    "First and last frames differ significantly (delta {:.1}). The loop will likely pop.",
                    analysis.first_last_delta
                ),
            }),
            "moderate_mismatch" => issues.push(DiagnosticIssueInfo {
                severity: "warning".to_string(),
                label: "Moderate loop gap".to_string(),
                explanation: "First and last frames differ noticeably — consider adjusting for smoother looping.".to_string(),
            }),
            _ => {}
        }
    }

    // Drift
    match drift_diag.label.as_str() {
        "strong" => issues.push(DiagnosticIssueInfo {
            severity: "strong_warning".to_string(),
            label: "Strong drift".to_string(),
            explanation: format!(
                "Sprite center drifts {:.1}px across the span — may indicate unintentional translation.",
                drift_diag.drift_magnitude
            ),
        }),
        "notable" => issues.push(DiagnosticIssueInfo {
            severity: "warning".to_string(),
            label: "Possible drift".to_string(),
            explanation: format!(
                "Sprite center drifts {:.1}px — the animation may slide unintentionally.",
                drift_diag.drift_magnitude
            ),
        }),
        "mild" => issues.push(DiagnosticIssueInfo {
            severity: "info".to_string(),
            label: "Mild drift".to_string(),
            explanation: "Slight center-of-mass shift detected — may be intentional.".to_string(),
        }),
        _ => {}
    }

    // Stillness
    if analysis.frame_count >= 2 && analysis.adjacent_deltas.len() > 0 {
        let stillness_ratio = analysis.identical_adjacent_count as f64 / analysis.adjacent_deltas.len() as f64;
        if stillness_ratio > STILLNESS_RATIO {
            issues.push(DiagnosticIssueInfo {
                severity: "warning".to_string(),
                label: "Repeated frames".to_string(),
                explanation: format!(
                    "{} of {} frame transitions are identical — the animation may feel static.",
                    analysis.identical_adjacent_count,
                    analysis.adjacent_deltas.len()
                ),
            });
        }
    }

    // Abruptness
    let avg_delta = timing_diag.avg_adjacent_delta;
    if avg_delta > 0.1 && analysis.largest_adjacent_delta > avg_delta * ABRUPTNESS_MULTIPLIER {
        issues.push(DiagnosticIssueInfo {
            severity: "warning".to_string(),
            label: "Abrupt transition".to_string(),
            explanation: format!(
                "Largest frame jump ({:.1}) is {:.1}x the average ({:.1}) — some transitions may feel jarring.",
                analysis.largest_adjacent_delta,
                analysis.largest_adjacent_delta / avg_delta,
                avg_delta
            ),
        });
    }

    // Single-frame note
    if analysis.frame_count == 1 {
        issues.push(DiagnosticIssueInfo {
            severity: "info".to_string(),
            label: "Single frame".to_string(),
            explanation: "Only one frame in the sandbox — no motion to analyze.".to_string(),
        });
    }

    // Cap at 5
    issues.truncate(5);
    issues
}

/// Analyze the active sandbox session. Deterministic — same input always produces same output.
#[command]
pub fn analyze_sandbox_motion(
    sandbox_state: State<'_, ManagedSandboxState>,
) -> Result<SandboxMetricsSummary, AppError> {
    let guard = sandbox_state.0.lock().unwrap();
    let session = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No sandbox session active".to_string()))?;

    let analysis = SandboxAnalysis::from_session(session);
    let loop_diag = build_loop_diagnostics(&analysis);
    let drift_diag = build_drift_diagnostics(&analysis);
    let timing_diag = build_timing_diagnostics(&analysis);
    let issues = build_issues(&analysis, &loop_diag, &drift_diag, &timing_diag);

    let bboxes: Vec<Option<BBoxInfo>> = analysis.bboxes.iter().map(|b| {
        b.map(|bb| BBoxInfo {
            min_x: bb.min_x,
            min_y: bb.min_y,
            max_x: bb.max_x,
            max_y: bb.max_y,
            center_x: bb.center_x(),
            center_y: bb.center_y(),
            width: bb.width(),
            height: bb.height(),
        })
    }).collect();

    Ok(SandboxMetricsSummary {
        session_id: session.id.clone(),
        frame_count: analysis.frame_count,
        preview_width: session.preview_width,
        preview_height: session.preview_height,
        bboxes,
        adjacent_deltas: analysis.adjacent_deltas,
        loop_diagnostics: loop_diag,
        drift_diagnostics: drift_diag,
        timing_diagnostics: timing_diag,
        issues,
    })
}

// ── Anchor path visualization types ───────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorPointSampleInfo {
    pub frame_index: usize,
    pub x: u32,
    pub y: u32,
    pub present: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactHintInfo {
    pub frame_index: usize,
    /// "stable_contact", "likely_sliding", "possible_contact"
    pub label: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorPathInfo {
    pub anchor_name: String,
    pub anchor_kind: String,
    pub samples: Vec<AnchorPointSampleInfo>,
    pub contact_hints: Vec<ContactHintInfo>,
    pub total_distance: f64,
    pub max_displacement: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxAnchorPathsResult {
    pub session_id: String,
    pub paths: Vec<AnchorPathInfo>,
}

/// Extract anchor paths for the sandbox frame span.
/// Matches anchors across frames by name only.
#[command]
pub fn get_sandbox_anchor_paths(
    sandbox_state: State<'_, ManagedSandboxState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<SandboxAnchorPathsResult, AppError> {
    let sb_guard = sandbox_state.0.lock().unwrap();
    let session = sb_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No sandbox session active".to_string()))?;

    let canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let paths = sandbox::extract_anchor_paths(
        &canvas.frames,
        session.start_frame_index,
        session.end_frame_index,
    );

    let path_infos: Vec<AnchorPathInfo> = paths.into_iter().map(|p| {
        let kind_str = serde_json::to_value(&p.anchor_kind)
            .unwrap_or_default()
            .as_str()
            .unwrap_or("custom")
            .to_string();

        AnchorPathInfo {
            anchor_name: p.anchor_name,
            anchor_kind: kind_str,
            samples: p.samples.into_iter().map(|s| AnchorPointSampleInfo {
                frame_index: s.frame_index,
                x: s.x,
                y: s.y,
                present: s.present,
            }).collect(),
            contact_hints: p.contact_hints.into_iter().map(|c| ContactHintInfo {
                frame_index: c.frame_index,
                label: c.label,
                confidence: c.confidence,
            }).collect(),
            total_distance: p.total_distance,
            max_displacement: p.max_displacement,
        }
    }).collect();

    Ok(SandboxAnchorPathsResult {
        session_id: session.id.clone(),
        paths: path_infos,
    })
}

// ── Apply action types ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxTimingApplyResult {
    pub session_id: String,
    pub frames_affected: usize,
    pub duration_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxDuplicateSpanResult {
    pub session_id: String,
    pub new_frame_ids: Vec<String>,
    pub insert_position: usize,
    pub first_new_frame_id: String,
}

/// Validate the sandbox span still exists and matches the session.
fn validate_sandbox_span(
    session: &SandboxSession,
    canvas: &crate::engine::canvas_state::CanvasState,
) -> Result<(), AppError> {
    if session.start_frame_index >= canvas.frames.len()
        || session.end_frame_index >= canvas.frames.len()
    {
        return Err(AppError::Internal(
            "Sandbox span is stale — timeline frames have changed.".to_string(),
        ));
    }
    Ok(())
}

/// Apply uniform timing to the sandbox span's real timeline frames.
/// One undoable action — stores prior durations for undo.
#[command]
pub fn apply_sandbox_timing(
    duration_ms: Option<u32>,
    sandbox_state: State<'_, ManagedSandboxState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<SandboxTimingApplyResult, AppError> {
    let sb_guard = sandbox_state.0.lock().unwrap();
    let session = sb_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No sandbox session active".to_string()))?;

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    validate_sandbox_span(session, canvas)?;

    let _prior = canvas
        .apply_span_timing(session.start_frame_index, session.end_frame_index, duration_ms)
        .map_err(|e| AppError::Internal(e))?;

    let frames_affected = session.end_frame_index - session.start_frame_index + 1;

    Ok(SandboxTimingApplyResult {
        session_id: session.id.clone(),
        frames_affected,
        duration_ms,
    })
}

/// Duplicate the sandbox span as new timeline frames, inserted after the original span.
/// One undoable action — returns new frame IDs for removal on undo.
#[command]
pub fn duplicate_sandbox_span(
    sandbox_state: State<'_, ManagedSandboxState>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<SandboxDuplicateSpanResult, AppError> {
    let sb_guard = sandbox_state.0.lock().unwrap();
    let session = sb_guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No sandbox session active".to_string()))?;

    let mut canvas_guard = canvas_state.0.lock().unwrap();
    let canvas = canvas_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    validate_sandbox_span(session, canvas)?;

    let (first_id, new_ids, insert_pos) = canvas
        .duplicate_span(session.start_frame_index, session.end_frame_index)
        .map_err(|e| AppError::Internal(e))?;

    Ok(SandboxDuplicateSpanResult {
        session_id: session.id.clone(),
        new_frame_ids: new_ids,
        insert_position: insert_pos,
        first_new_frame_id: first_id,
    })
}
