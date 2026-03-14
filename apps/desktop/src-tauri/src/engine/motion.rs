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
    pub proposals: Vec<MotionProposal>,
    pub selected_proposal_id: Option<String>,
    pub status: MotionSessionStatus,
}

/// Managed motion session state — one session at a time.
pub struct ManagedMotionState(pub std::sync::Mutex<Option<MotionSession>>);

// ─── Generation (deterministic heuristics) ────────────────────

impl MotionSession {
    /// Create a new session, capturing source pixels from the canvas.
    pub fn begin(
        canvas: &CanvasState,
        selection: Option<&SelectionRect>,
        intent: MotionIntent,
        direction: Option<MotionDirection>,
        output_frame_count: u32,
    ) -> Result<Self, String> {
        let source_frame_id = canvas.frames.get(canvas.active_frame_index)
            .map(|f| f.id.clone())
            .ok_or_else(|| "No active frame".to_string())?;

        // Determine source region
        let (source_pixels, src_w, src_h, target_mode) = if let Some(sel) = selection {
            // Extract composited pixels from selection rect
            let composited = canvas.composite_frame();
            let w = sel.width;
            let h = sel.height;
            let mut pixels = vec![0u8; (w as usize) * (h as usize) * 4];
            let canvas_w = canvas.width as usize;
            for row in 0..h as usize {
                let sy = sel.y as usize + row;
                if sy >= canvas.height as usize { continue; }
                for col in 0..w as usize {
                    let sx = sel.x as usize + col;
                    if sx >= canvas.width as usize { continue; }
                    let src_idx = (sy * canvas_w + sx) * 4;
                    let dst_idx = (row * w as usize + col) * 4;
                    pixels[dst_idx..dst_idx + 4].copy_from_slice(&composited[src_idx..src_idx + 4]);
                }
            }
            (pixels, w, h, MotionTargetMode::ActiveSelection)
        } else {
            // Whole frame composited
            let composited = canvas.composite_frame();
            let w = canvas.width;
            let h = canvas.height;
            (composited, w, h, MotionTargetMode::WholeFrame)
        };

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

        match self.intent {
            MotionIntent::IdleBob => {
                // Proposal 1: vertical bob (1px up, center, 1px down, center)
                self.proposals.push(self.gen_vertical_bob(w, h, n, 1, "Gentle bob", "1px vertical oscillation"));
                // Proposal 2: stronger bob (2px)
                if h > 4 {
                    self.proposals.push(self.gen_vertical_bob(w, h, n, 2, "Deep bob", "2px vertical oscillation"));
                }
                // Proposal 3: horizontal sway
                if w > 4 {
                    self.proposals.push(self.gen_horizontal_shift(w, h, n, 1, "Idle sway", "1px horizontal sway"));
                }
            }
            MotionIntent::WalkCycleStub => {
                let dir = self.direction.unwrap_or(MotionDirection::Right);
                let dx = match dir {
                    MotionDirection::Left => -1i32,
                    MotionDirection::Right => 1,
                    _ => 1,
                };
                // Proposal 1: walk with horizontal displacement + bob
                self.proposals.push(self.gen_walk_stub(w, h, n, dx, 1, "Walk cycle", "Horizontal stride + vertical bob"));
                // Proposal 2: wider stride
                if w > 8 {
                    self.proposals.push(self.gen_walk_stub(w, h, n, dx * 2, 1, "Wide stride", "Wider horizontal movement + bob"));
                }
            }
            MotionIntent::RunCycleStub => {
                let dir = self.direction.unwrap_or(MotionDirection::Right);
                let dx = match dir {
                    MotionDirection::Left => -2i32,
                    MotionDirection::Right => 2,
                    _ => 2,
                };
                // Proposal 1: run with larger displacement + bounce
                self.proposals.push(self.gen_walk_stub(w, h, n, dx, 2, "Run cycle", "Fast horizontal movement + bounce"));
                // Proposal 2: sprint
                if w > 8 {
                    self.proposals.push(self.gen_walk_stub(w, h, n, dx * 2, 2, "Sprint", "Large displacement + high bounce"));
                }
            }
            MotionIntent::Hop => {
                // Proposal 1: vertical hop
                self.proposals.push(self.gen_hop(w, h, n, 2, "Small hop", "2px vertical hop arc"));
                // Proposal 2: bigger hop
                if h > 8 {
                    self.proposals.push(self.gen_hop(w, h, n, 4, "Big hop", "4px vertical hop arc"));
                }
                // Proposal 3: directional hop
                if let Some(dir) = self.direction {
                    let dx = match dir {
                        MotionDirection::Left => -1i32,
                        MotionDirection::Right => 1,
                        _ => 0,
                    };
                    if dx != 0 {
                        self.proposals.push(self.gen_directional_hop(w, h, n, dx, 3, "Directional hop", "Hop with lateral movement"));
                    }
                }
            }
        }

        self.status = MotionSessionStatus::Reviewing;
        Ok(())
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
    fn shift_pixels(&self, w: u32, h: u32, dx: i32, dy: i32) -> Vec<u8> {
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
