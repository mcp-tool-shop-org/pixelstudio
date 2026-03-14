use serde::{Deserialize, Serialize};

use super::canvas_state::CanvasState;
use super::selection::SelectionRect;

// ─── Domain types ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionIntent {
    IdleBob,
    WalkCycleStub,
    RunCycleStub,
    Hop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionDirection {
    Left,
    Right,
    Up,
    Down,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionTargetMode {
    ActiveSelection,
    AnchorBinding,
    WholeFrame,
}

// ─── Proposal ─────────────────────────────────────────────────

/// A single generated proposal — preview frames that are NOT yet in the timeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionProposal {
    pub id: String,
    pub label: String,
    pub description: String,
    /// One RGBA buffer per generated frame.
    pub preview_frames: Vec<Vec<u8>>,
    pub preview_width: u32,
    pub preview_height: u32,
}

// ─── Session ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionSessionStatus {
    Configuring,
    Generating,
    Reviewing,
    Committing,
    Error,
}

/// Active motion session. Exists independently from timeline/undo.
pub struct MotionSession {
    pub id: String,
    pub intent: MotionIntent,
    pub direction: Option<MotionDirection>,
    pub target_mode: MotionTargetMode,
    pub output_frame_count: u32,
    pub source_frame_id: String,
    /// Source pixel region (composited RGBA from the source frame/selection).
    pub source_pixels: Vec<u8>,
    pub source_width: u32,
    pub source_height: u32,
    /// Anchor context for anchor-aware generation.
    pub anchor_kind: Option<super::anchor::AnchorKind>,
    /// Anchor point position (relative to source region origin).
    pub anchor_offset: Option<(u32, u32)>,
    pub proposals: Vec<MotionProposal>,
    pub selected_proposal_id: Option<String>,
    pub status: MotionSessionStatus,
}

/// A record of a committed motion proposal — used for timeline-level undo/redo.
pub struct MotionCommitRecord {
    pub session_id: String,
    pub intent: MotionIntent,
    pub direction: Option<MotionDirection>,
    pub output_frame_count: u32,
    /// IDs of the frames that were inserted.
    pub inserted_frame_ids: Vec<String>,
    /// The frame index that was active before the commit (for undo restore).
    pub original_active_frame_index: usize,
    /// Stashed copies of the inserted frames (for redo).
    pub stashed_frames: Vec<super::canvas_state::AnimationFrame>,
}

/// Managed motion session state — one session at a time.
/// Also holds the last commit record for undo/redo.
pub struct ManagedMotionState(pub std::sync::Mutex<MotionState>);

pub struct MotionState {
    pub session: Option<MotionSession>,
    pub last_commit: Option<MotionCommitRecord>,
}

// ─── Generation (deterministic heuristics) ────────────────────

impl MotionSession {
    /// Extract composited pixels from a rectangular region of the canvas.
    fn extract_region(canvas: &CanvasState, rx: u32, ry: u32, rw: u32, rh: u32) -> Vec<u8> {
        let composited = canvas.composite_frame();
        let canvas_w = canvas.width as usize;
        let mut pixels = vec![0u8; (rw as usize) * (rh as usize) * 4];
        for row in 0..rh as usize {
            let sy = ry as usize + row;
            if sy >= canvas.height as usize { continue; }
            for col in 0..rw as usize {
                let sx = rx as usize + col;
                if sx >= canvas.width as usize { continue; }
                let src_idx = (sy * canvas_w + sx) * 4;
                let dst_idx = (row * rw as usize + col) * 4;
                pixels[dst_idx..dst_idx + 4].copy_from_slice(&composited[src_idx..src_idx + 4]);
            }
        }
        pixels
    }

    /// Create a new session, capturing source pixels from the canvas.
    /// Priority: selection > anchor binding > whole frame.
    pub fn begin(
        canvas: &CanvasState,
        selection: Option<&SelectionRect>,
        anchor: Option<&super::anchor::Anchor>,
        intent: MotionIntent,
        direction: Option<MotionDirection>,
        output_frame_count: u32,
    ) -> Result<Self, String> {
        let source_frame_id = canvas.frames.get(canvas.active_frame_index)
            .map(|f| f.id.clone())
            .ok_or_else(|| "No active frame".to_string())?;

        // Determine source region — selection takes precedence, then anchor, then whole frame
        let (source_pixels, src_w, src_h, target_mode, anchor_kind, anchor_offset) =
            if let Some(sel) = selection {
                let pixels = Self::extract_region(canvas, sel.x, sel.y, sel.width, sel.height);
                (pixels, sel.width, sel.height, MotionTargetMode::ActiveSelection, None, None)
            } else if let Some(anc) = anchor {
                if let Some(bounds) = &anc.bounds {
                    let pixels = Self::extract_region(canvas, bounds.x, bounds.y, bounds.width, bounds.height);
                    // Anchor offset relative to the region origin
                    let ox = anc.x.saturating_sub(bounds.x);
                    let oy = anc.y.saturating_sub(bounds.y);
                    (pixels, bounds.width, bounds.height,
                     MotionTargetMode::AnchorBinding, Some(anc.kind), Some((ox, oy)))
                } else {
                    // Anchor without bounds — fall through to whole frame
                    let composited = canvas.composite_frame();
                    (composited, canvas.width, canvas.height,
                     MotionTargetMode::WholeFrame, Some(anc.kind), Some((anc.x, anc.y)))
                }
            } else {
                let composited = canvas.composite_frame();
                (composited, canvas.width, canvas.height, MotionTargetMode::WholeFrame, None, None)
            };

        // Reject tiny targets (< 2x2)
        if src_w < 2 || src_h < 2 {
            return Err("Target region is too small for motion generation".to_string());
        }

        // Reject fully-transparent targets
        let has_opaque = source_pixels.chunks(4).any(|px| px[3] > 0);
        if !has_opaque {
            return Err("Target region is fully transparent — nothing to animate".to_string());
        }

        Ok(Self {
            id: uuid::Uuid::new_v4().to_string(),
            intent,
            direction,
            target_mode,
            output_frame_count: output_frame_count.min(4).max(2),
            source_frame_id,
            source_pixels,
            source_width: src_w,
            source_height: src_h,
            anchor_kind,
            anchor_offset,
            proposals: Vec::new(),
            selected_proposal_id: None,
            status: MotionSessionStatus::Configuring,
        })
    }

    /// Generate deterministic motion proposals from the source pixels.
    /// Same inputs always produce the same proposals (no hidden randomness).
    pub fn generate_proposals(&mut self) -> Result<(), String> {
        self.status = MotionSessionStatus::Generating;
        self.proposals.clear();
        self.selected_proposal_id = None;

        let w = self.source_width;
        let h = self.source_height;
        let n = self.output_frame_count as usize;

        // Scale amplitudes proportional to sprite size for meaningful motion
        let bob_small = 1i32.max((h as i32) / 16);
        let bob_large = (bob_small * 2).min(h as i32 / 4).max(bob_small + 1);
        let stride_small = 1i32.max((w as i32) / 16);
        let stride_large = (stride_small * 2).min(w as i32 / 4).max(stride_small + 1);
        let hop_small = 2i32.max((h as i32) / 8);
        let hop_large = (hop_small * 2).min(h as i32 / 3).max(hop_small + 1);

        match self.intent {
            MotionIntent::IdleBob => {
                self.proposals.push(self.gen_vertical_bob(w, h, n, bob_small,
                    "Gentle bob", &format!("{}px vertical oscillation", bob_small)));
                if bob_large > bob_small {
                    self.proposals.push(self.gen_vertical_bob(w, h, n, bob_large,
                        "Deep bob", &format!("{}px vertical oscillation", bob_large)));
                }
                if w > 4 {
                    self.proposals.push(self.gen_horizontal_shift(w, h, n, stride_small,
                        "Idle sway", &format!("{}px horizontal sway", stride_small)));
                }
            }
            MotionIntent::WalkCycleStub => {
                let dir = self.direction.unwrap_or(MotionDirection::Right);
                let sign = match dir {
                    MotionDirection::Left => -1i32,
                    _ => 1,
                };
                self.proposals.push(self.gen_walk_stub(w, h, n,
                    sign * stride_small, bob_small,
                    "Walk cycle", "Horizontal stride + vertical bob"));
                if stride_large > stride_small {
                    self.proposals.push(self.gen_walk_stub(w, h, n,
                        sign * stride_large, bob_small,
                        "Wide stride", "Wider horizontal movement + bob"));
                }
            }
            MotionIntent::RunCycleStub => {
                let dir = self.direction.unwrap_or(MotionDirection::Right);
                let sign = match dir {
                    MotionDirection::Left => -1i32,
                    _ => 1,
                };
                let run_stride = stride_large;
                let run_bounce = bob_large;
                self.proposals.push(self.gen_walk_stub(w, h, n,
                    sign * run_stride, run_bounce,
                    "Run cycle", "Fast horizontal movement + bounce"));
                let sprint_stride = (run_stride * 2).min(w as i32 / 3);
                if sprint_stride > run_stride {
                    self.proposals.push(self.gen_walk_stub(w, h, n,
                        sign * sprint_stride, run_bounce,
                        "Sprint", "Large displacement + high bounce"));
                }
            }
            MotionIntent::Hop => {
                self.proposals.push(self.gen_hop(w, h, n, hop_small,
                    "Small hop", &format!("{}px vertical hop arc", hop_small)));
                if hop_large > hop_small {
                    self.proposals.push(self.gen_hop(w, h, n, hop_large,
                        "Big hop", &format!("{}px vertical hop arc", hop_large)));
                }
                if let Some(dir) = self.direction {
                    let dx = match dir {
                        MotionDirection::Left => -stride_small,
                        MotionDirection::Right => stride_small,
                        _ => 0,
                    };
                    if dx != 0 {
                        self.proposals.push(self.gen_directional_hop(w, h, n, dx, hop_small,
                            "Directional hop", "Hop with lateral movement"));
                    }
                }
            }
        }

        // Add anchor-aware proposals when anchor context is present
        if let Some(kind) = self.anchor_kind {
            self.generate_anchor_aware_proposals(w, h, n, kind);
        }

        self.status = MotionSessionStatus::Reviewing;
        Ok(())
    }

    /// Generate anchor-kind-aware proposals that augment the base set.
    fn generate_anchor_aware_proposals(&mut self, w: u32, h: u32, n: usize, kind: super::anchor::AnchorKind) {
        use super::anchor::AnchorKind;

        let bob_amp = 1i32.max((h as i32) / 12);
        let sway_amp = 1i32.max((w as i32) / 14);

        match kind {
            AnchorKind::Head => {
                // Head nod — small vertical bob centered on anchor
                self.proposals.push(self.gen_vertical_bob(w, h, n, bob_amp,
                    "Head nod", &format!("{}px nod oscillation", bob_amp)));
                // Head tilt — small horizontal sway
                if w > 4 {
                    self.proposals.push(self.gen_horizontal_shift(w, h, n, sway_amp,
                        "Head tilt", &format!("{}px lateral tilt", sway_amp)));
                }
            }
            AnchorKind::Torso => {
                // Breathing — gentle vertical oscillation
                let breath = 1i32.max((h as i32) / 20);
                self.proposals.push(self.gen_vertical_bob(w, h, n, breath,
                    "Breathe", &format!("{}px breathing oscillation", breath)));
                // Torso sway
                if w > 4 {
                    self.proposals.push(self.gen_horizontal_shift(w, h, n, sway_amp,
                        "Torso sway", &format!("{}px lateral sway", sway_amp)));
                }
            }
            AnchorKind::ArmLeft | AnchorKind::ArmRight => {
                // Arm swing — pendulum motion using horizontal shift
                let swing = 1i32.max((w as i32) / 10);
                let label = if kind == AnchorKind::ArmLeft { "Left arm swing" } else { "Right arm swing" };
                self.proposals.push(self.gen_horizontal_shift(w, h, n, swing,
                    label, &format!("{}px pendulum swing", swing)));
                // Arm bob — small vertical movement
                let arm_bob = 1i32.max((h as i32) / 16);
                let bob_label = if kind == AnchorKind::ArmLeft { "Left arm bob" } else { "Right arm bob" };
                self.proposals.push(self.gen_vertical_bob(w, h, n, arm_bob,
                    bob_label, &format!("{}px vertical bob", arm_bob)));
            }
            AnchorKind::LegLeft | AnchorKind::LegRight => {
                // Leg stride — horizontal shift simulating step
                let stride = 1i32.max((w as i32) / 8);
                let label = if kind == AnchorKind::LegLeft { "Left leg stride" } else { "Right leg stride" };
                self.proposals.push(self.gen_horizontal_shift(w, h, n, stride,
                    label, &format!("{}px stride motion", stride)));
                // Leg lift — vertical hop motion
                let lift = 1i32.max((h as i32) / 10);
                let lift_label = if kind == AnchorKind::LegLeft { "Left leg lift" } else { "Right leg lift" };
                self.proposals.push(self.gen_hop(w, h, n, lift,
                    lift_label, &format!("{}px leg lift arc", lift)));
            }
            AnchorKind::Custom => {
                // Generic: offer both bob and sway
                self.proposals.push(self.gen_vertical_bob(w, h, n, bob_amp,
                    "Anchor bob", &format!("{}px vertical oscillation", bob_amp)));
                if w > 4 {
                    self.proposals.push(self.gen_horizontal_shift(w, h, n, sway_amp,
                        "Anchor sway", &format!("{}px horizontal sway", sway_amp)));
                }
            }
        }
    }

    /// Select a proposal by ID.
    pub fn select_proposal(&mut self, proposal_id: &str) -> Result<(), String> {
        if !self.proposals.iter().any(|p| p.id == proposal_id) {
            return Err("Proposal not found".to_string());
        }
        self.selected_proposal_id = Some(proposal_id.to_string());
        Ok(())
    }

    /// Get the selected proposal.
    pub fn selected_proposal(&self) -> Option<&MotionProposal> {
        let id = self.selected_proposal_id.as_ref()?;
        self.proposals.iter().find(|p| &p.id == id)
    }

    // ─── Heuristic generators ─────────────────────────────────

    fn gen_vertical_bob(&self, w: u32, h: u32, n: usize, amplitude: i32, label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            // Oscillation pattern: up, center, down, center (for 4-frame)
            // or up, down (for 2-frame)
            let phase = (i as f64 / n as f64) * std::f64::consts::TAU;
            let dy = (phase.sin() * amplitude as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, 0, -dy));
        }
        MotionProposal {
            id: uuid::Uuid::new_v4().to_string(),
            label: label.to_string(),
            description: desc.to_string(),
            preview_frames: frames,
            preview_width: w,
            preview_height: h,
        }
    }

    fn gen_horizontal_shift(&self, w: u32, h: u32, n: usize, amplitude: i32, label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let phase = (i as f64 / n as f64) * std::f64::consts::TAU;
            let dx = (phase.sin() * amplitude as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, 0));
        }
        MotionProposal {
            id: uuid::Uuid::new_v4().to_string(),
            label: label.to_string(),
            description: desc.to_string(),
            preview_frames: frames,
            preview_width: w,
            preview_height: h,
        }
    }

    fn gen_walk_stub(&self, w: u32, h: u32, n: usize, dx_per_frame: i32, bob_amplitude: i32, label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let dx = dx_per_frame * (i as i32 - n as i32 / 2);
            let phase = (i as f64 / n as f64) * std::f64::consts::TAU;
            let dy = (phase.sin().abs() * bob_amplitude as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, -dy));
        }
        MotionProposal {
            id: uuid::Uuid::new_v4().to_string(),
            label: label.to_string(),
            description: desc.to_string(),
            preview_frames: frames,
            preview_width: w,
            preview_height: h,
        }
    }

    fn gen_hop(&self, w: u32, h: u32, n: usize, peak: i32, label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            // Parabolic arc: ground → peak → ground
            let t = i as f64 / (n - 1).max(1) as f64;
            let dy = (4.0 * peak as f64 * t * (1.0 - t)).round() as i32;
            frames.push(self.shift_pixels(w, h, 0, -dy));
        }
        MotionProposal {
            id: uuid::Uuid::new_v4().to_string(),
            label: label.to_string(),
            description: desc.to_string(),
            preview_frames: frames,
            preview_width: w,
            preview_height: h,
        }
    }

    fn gen_directional_hop(&self, w: u32, h: u32, n: usize, dx_per_frame: i32, peak: i32, label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let t = i as f64 / (n - 1).max(1) as f64;
            let dy = (4.0 * peak as f64 * t * (1.0 - t)).round() as i32;
            let dx = dx_per_frame * (i as i32 - n as i32 / 2);
            frames.push(self.shift_pixels(w, h, dx, -dy));
        }
        MotionProposal {
            id: uuid::Uuid::new_v4().to_string(),
            label: label.to_string(),
            description: desc.to_string(),
            preview_frames: frames,
            preview_width: w,
            preview_height: h,
        }
    }

    /// Shift source pixels by (dx, dy), wrapping transparent for out-of-bounds.
    pub(crate) fn shift_pixels(&self, w: u32, h: u32, dx: i32, dy: i32) -> Vec<u8> {
        let w_usize = w as usize;
        let h_usize = h as usize;
        let mut result = vec![0u8; w_usize * h_usize * 4];

        for row in 0..h_usize {
            let src_row = row as i32 - dy;
            if src_row < 0 || src_row >= h_usize as i32 { continue; }
            for col in 0..w_usize {
                let src_col = col as i32 - dx;
                if src_col < 0 || src_col >= w_usize as i32 { continue; }
                let src_idx = (src_row as usize * w_usize + src_col as usize) * 4;
                let dst_idx = (row * w_usize + col) * 4;
                result[dst_idx..dst_idx + 4].copy_from_slice(&self.source_pixels[src_idx..src_idx + 4]);
            }
        }
        result
    }
}

// ─── Motion Templates ────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionTemplateId {
    IdleBreathing,
    WalkBasic,
    RunBasic,
    HopBasic,
}

/// Which anchor kinds a template expects.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionTemplateAnchorReq {
    pub kind: super::anchor::AnchorKind,
    pub required: bool,
    pub role: String,
}

/// A motion template definition.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionTemplate {
    pub id: MotionTemplateId,
    pub name: String,
    pub description: String,
    /// Anchor requirements: which parts this template can use.
    pub anchor_requirements: Vec<MotionTemplateAnchorReq>,
}

impl MotionTemplate {
    pub fn all() -> Vec<Self> {
        use super::anchor::AnchorKind;
        vec![
            Self {
                id: MotionTemplateId::IdleBreathing,
                name: "Idle Breathing".to_string(),
                description: "Gentle vertical breathing with optional head nod and arm sway".to_string(),
                anchor_requirements: vec![
                    MotionTemplateAnchorReq { kind: AnchorKind::Torso, required: true, role: "Breathing center".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::Head, required: false, role: "Head nod".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::ArmLeft, required: false, role: "Left arm sway".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::ArmRight, required: false, role: "Right arm sway".to_string() },
                ],
            },
            Self {
                id: MotionTemplateId::WalkBasic,
                name: "Walk Basic".to_string(),
                description: "Walk cycle with leg stride, torso bob, and arm swing".to_string(),
                anchor_requirements: vec![
                    MotionTemplateAnchorReq { kind: AnchorKind::Torso, required: true, role: "Stride center + bob".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::LegLeft, required: true, role: "Left leg stride".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::LegRight, required: true, role: "Right leg stride".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::ArmLeft, required: false, role: "Counter-swing".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::ArmRight, required: false, role: "Counter-swing".to_string() },
                ],
            },
            Self {
                id: MotionTemplateId::RunBasic,
                name: "Run Basic".to_string(),
                description: "Run cycle with exaggerated stride and bounce".to_string(),
                anchor_requirements: vec![
                    MotionTemplateAnchorReq { kind: AnchorKind::Torso, required: true, role: "Bounce center".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::LegLeft, required: true, role: "Left leg stride".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::LegRight, required: true, role: "Right leg stride".to_string() },
                ],
            },
            Self {
                id: MotionTemplateId::HopBasic,
                name: "Hop Basic".to_string(),
                description: "Hop with parabolic arc, optional arm raise".to_string(),
                anchor_requirements: vec![
                    MotionTemplateAnchorReq { kind: AnchorKind::Torso, required: true, role: "Hop center".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::ArmLeft, required: false, role: "Arm raise".to_string() },
                    MotionTemplateAnchorReq { kind: AnchorKind::ArmRight, required: false, role: "Arm raise".to_string() },
                ],
            },
        ]
    }
}
