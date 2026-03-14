use serde::{Deserialize, Serialize};

use super::anchor::AnchorKind;
use super::motion::{MotionDirection, MotionProposal, MotionSession, MotionSessionStatus};

// ─── Secondary-motion template IDs ─────────────────────────────

/// Template families for environmental / secondary motion.
/// Distinct from locomotion templates — these animate scenery, cloth, and appendages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SecondaryMotionTemplateId {
    /// Gentle breeze — small directional sway with slight falloff.
    WindSoft,
    /// Moderate wind — wider sway, more visible on outer elements.
    WindMedium,
    /// Strong burst — asymmetric push then return (like a gust).
    WindGust,
    /// Slow pendular sway without directional bias (tree trunk, idle character).
    IdleSway,
    /// Pendulum-like arc for hanging objects (signs, chains, capes).
    HangingSwing,
    /// Rapid small oscillations for dense foliage, fur, grass tips.
    FoliageRustle,
}

// ─── Template definition ─────────────────────────────────────

/// Anchor readiness requirement for a secondary-motion template.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryAnchorReq {
    pub kind: AnchorKind,
    pub required: bool,
    pub role: String,
}

/// A secondary-motion template definition.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryMotionTemplate {
    pub id: SecondaryMotionTemplateId,
    pub name: String,
    pub description: String,
    pub anchor_requirements: Vec<SecondaryAnchorReq>,
    /// Whether this template benefits from anchor hierarchy (parent/child).
    pub benefits_from_hierarchy: bool,
    /// Short usage hint for the UI.
    pub hint: String,
}

impl SecondaryMotionTemplate {
    /// Return all built-in secondary-motion templates.
    pub fn all() -> Vec<Self> {
        vec![
            Self {
                id: SecondaryMotionTemplateId::WindSoft,
                name: "Wind — Soft".to_string(),
                description: "Gentle breeze: small directional sway with lag toward tips.".to_string(),
                anchor_requirements: vec![
                    SecondaryAnchorReq { kind: AnchorKind::Custom, required: true, role: "Any anchor to move".to_string() },
                ],
                benefits_from_hierarchy: true,
                hint: "Works with 1+ anchors. Better with hierarchy for layered sway.".to_string(),
            },
            Self {
                id: SecondaryMotionTemplateId::WindMedium,
                name: "Wind — Medium".to_string(),
                description: "Moderate wind: wider sway arc, more visible on outer elements.".to_string(),
                anchor_requirements: vec![
                    SecondaryAnchorReq { kind: AnchorKind::Custom, required: true, role: "Any anchor to move".to_string() },
                ],
                benefits_from_hierarchy: true,
                hint: "Set parents on outer anchors so tips sway more than trunk.".to_string(),
            },
            Self {
                id: SecondaryMotionTemplateId::WindGust,
                name: "Wind — Gust".to_string(),
                description: "Strong burst: asymmetric push then spring-back return.".to_string(),
                anchor_requirements: vec![
                    SecondaryAnchorReq { kind: AnchorKind::Custom, required: true, role: "Any anchor to move".to_string() },
                ],
                benefits_from_hierarchy: true,
                hint: "Hierarchy makes tips lag behind the trunk during the gust.".to_string(),
            },
            Self {
                id: SecondaryMotionTemplateId::IdleSway,
                name: "Idle Sway".to_string(),
                description: "Slow pendular sway without directional bias. Good for trunks, idle characters.".to_string(),
                anchor_requirements: vec![
                    SecondaryAnchorReq { kind: AnchorKind::Custom, required: true, role: "Sway pivot or center".to_string() },
                ],
                benefits_from_hierarchy: false,
                hint: "Works well with a single root anchor on the sway center.".to_string(),
            },
            Self {
                id: SecondaryMotionTemplateId::HangingSwing,
                name: "Hanging Swing".to_string(),
                description: "Pendulum arc for hanging objects: signs, chains, capes, tails.".to_string(),
                anchor_requirements: vec![
                    SecondaryAnchorReq { kind: AnchorKind::Custom, required: true, role: "Hang point (top of swing)".to_string() },
                ],
                benefits_from_hierarchy: true,
                hint: "Best with a base anchor + hanging tip child for weighted arcs.".to_string(),
            },
            Self {
                id: SecondaryMotionTemplateId::FoliageRustle,
                name: "Foliage Rustle".to_string(),
                description: "Rapid small oscillations: dense foliage, grass tips, fur edges.".to_string(),
                anchor_requirements: vec![
                    SecondaryAnchorReq { kind: AnchorKind::Custom, required: true, role: "Rustle region center".to_string() },
                ],
                benefits_from_hierarchy: true,
                hint: "Benefits from canopy/leaf child anchors for varied rustle depth.".to_string(),
            },
        ]
    }
}

// ─── Template parameters ─────────────────────────────────────

/// Bounded parameters for secondary-motion generation.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryMotionParams {
    /// Wind/force direction. None = directionless (sway, swing).
    pub direction: Option<MotionDirection>,
    /// Strength multiplier: 0.1–2.0, default 1.0.
    pub strength: f64,
    /// Output frame count: 2, 4, or 6.
    pub frame_count: u32,
    /// Phase offset in radians: 0.0–TAU, default 0.0.
    /// Allows staggering motion for multiple objects.
    pub phase_offset: f64,
    /// Hierarchy-derived amplitude scale: (1 + depth) * falloff_weight.
    /// Computed from anchor hierarchy before generation. Default 1.0 (no hierarchy).
    pub hierarchy_scale: f64,
}

impl SecondaryMotionParams {
    /// Clamp all parameters to valid ranges.
    pub fn clamped(self) -> Self {
        Self {
            direction: self.direction,
            strength: self.strength.clamp(0.1, 2.0),
            frame_count: match self.frame_count {
                0..=3 => 2,
                4..=5 => 4,
                _ => 6,
            },
            phase_offset: self.phase_offset.rem_euclid(std::f64::consts::TAU),
            hierarchy_scale: self.hierarchy_scale.clamp(0.1, 10.0),
        }
    }
}

impl Default for SecondaryMotionParams {
    fn default() -> Self {
        Self {
            direction: None,
            strength: 1.0,
            frame_count: 4,
            phase_offset: 0.0,
            hierarchy_scale: 1.0,
        }
    }
}

// ─── Proposal generation ─────────────────────────────────────

impl MotionSession {
    /// Generate secondary-motion proposals from a template.
    /// Deterministic: same inputs always produce the same output.
    pub fn generate_secondary_proposals(
        &mut self,
        template_id: SecondaryMotionTemplateId,
        params: SecondaryMotionParams,
    ) -> Result<(), String> {
        self.status = MotionSessionStatus::Generating;
        self.proposals.clear();
        self.selected_proposal_id = None;

        let params = params.clamped();
        let w = self.source_width;
        let h = self.source_height;
        let n = params.frame_count as usize;

        // Base amplitude scaled to sprite dimensions, strength, and hierarchy depth/falloff
        let scale = params.strength * params.hierarchy_scale;
        let base_amp_x = (1i32.max((w as i32) / 12) as f64 * scale).round() as i32;
        let base_amp_y = (1i32.max((h as i32) / 12) as f64 * scale).round() as i32;

        match template_id {
            SecondaryMotionTemplateId::WindSoft => {
                // Soft wind: gentle sine sway in the wind direction
                // Directional offset with smooth return
                let (dx_amp, dy_amp) = self.direction_amplitudes(params.direction, base_amp_x / 2, base_amp_y / 4);
                self.proposals.push(self.gen_wind_sway(w, h, n, dx_amp, dy_amp, params.phase_offset,
                    "Soft breeze", "Gentle directional sway"));
                // Variant: even softer
                self.proposals.push(self.gen_wind_sway(w, h, n, dx_amp / 2, dy_amp / 2, params.phase_offset,
                    "Whisper breeze", "Very subtle directional sway"));
            }
            SecondaryMotionTemplateId::WindMedium => {
                // Medium wind: wider sway arc
                let (dx_amp, dy_amp) = self.direction_amplitudes(params.direction, base_amp_x, base_amp_y / 3);
                self.proposals.push(self.gen_wind_sway(w, h, n, dx_amp, dy_amp, params.phase_offset,
                    "Steady wind", "Moderate directional sway"));
                // Variant: with slight vertical bob
                self.proposals.push(self.gen_wind_sway(w, h, n, dx_amp, base_amp_y / 2, params.phase_offset,
                    "Breezy bob", "Moderate sway with vertical dip"));
            }
            SecondaryMotionTemplateId::WindGust => {
                // Gust: asymmetric push then spring-back
                // Quick displacement in direction, slower return
                let (dx_amp, dy_amp) = self.direction_amplitudes(params.direction, base_amp_x * 2, base_amp_y / 2);
                self.proposals.push(self.gen_gust(w, h, n, dx_amp, dy_amp, params.phase_offset,
                    "Sharp gust", "Asymmetric push-and-return"));
                // Variant: gust with overshoot
                self.proposals.push(self.gen_gust_with_overshoot(w, h, n, dx_amp, dy_amp, params.phase_offset,
                    "Gust + rebound", "Push, overshoot, then settle"));
            }
            SecondaryMotionTemplateId::IdleSway => {
                // Slow pendular sway (no directional bias)
                self.proposals.push(self.gen_pendular_sway(w, h, n, base_amp_x, 0, params.phase_offset,
                    "Horizontal sway", "Slow side-to-side pendulum"));
                // Variant: with slight vertical
                self.proposals.push(self.gen_pendular_sway(w, h, n, base_amp_x / 2, base_amp_y / 3, params.phase_offset,
                    "Gentle rock", "Side-to-side with slight vertical bob"));
            }
            SecondaryMotionTemplateId::HangingSwing => {
                // Pendulum-like arc: horizontal oscillation with slight vertical lift at extremes
                self.proposals.push(self.gen_hanging_swing(w, h, n, base_amp_x, base_amp_y / 3, params.phase_offset,
                    "Pendulum swing", "Arc motion with vertical lift at peaks"));
                // Variant: tighter swing
                self.proposals.push(self.gen_hanging_swing(w, h, n, base_amp_x / 2, base_amp_y / 4, params.phase_offset,
                    "Tight swing", "Smaller arc with subtle lift"));
            }
            SecondaryMotionTemplateId::FoliageRustle => {
                // Rapid small oscillations: higher frequency wobble
                let rustle_amp = (base_amp_x / 3).max(1);
                self.proposals.push(self.gen_rustle(w, h, n, rustle_amp, rustle_amp / 2, params.phase_offset,
                    "Quick rustle", "Rapid small oscillations"));
                // Variant: diagonal rustle
                self.proposals.push(self.gen_rustle(w, h, n, rustle_amp, rustle_amp, params.phase_offset,
                    "Diagonal rustle", "Rapid diagonal oscillations"));
            }
        }

        self.status = MotionSessionStatus::Reviewing;
        Ok(())
    }

    // ─── Direction helper ─────────────────────────────────────

    /// Map optional direction to (dx, dy) amplitude pair.
    /// Default: right-ward wind when no direction specified.
    fn direction_amplitudes(&self, dir: Option<MotionDirection>, h_amp: i32, v_amp: i32) -> (i32, i32) {
        match dir {
            Some(MotionDirection::Left)  => (-h_amp, 0),
            Some(MotionDirection::Right) | None => (h_amp, 0),
            Some(MotionDirection::Up)    => (0, -v_amp),
            Some(MotionDirection::Down)  => (0, v_amp),
        }
    }

    // ─── Secondary-motion heuristic generators ────────────────

    /// Wind sway: smooth sine oscillation in the given direction.
    fn gen_wind_sway(&self, w: u32, h: u32, n: usize, dx_amp: i32, dy_amp: i32, phase: f64,
                      label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let t = (i as f64 / n as f64) * std::f64::consts::TAU + phase;
            let dx = (t.sin() * dx_amp as f64).round() as i32;
            let dy = (t.sin() * dy_amp as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, dy));
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

    /// Gust: asymmetric displacement — fast push in direction, slow return.
    /// Uses a skewed sine: first half is the push (compressed), second half returns.
    fn gen_gust(&self, w: u32, h: u32, n: usize, dx_amp: i32, dy_amp: i32, phase: f64,
                 label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            // Skewed timing: peak at ~25% of cycle, then slow return
            let t = (i as f64 / n as f64) + phase / std::f64::consts::TAU;
            let t_norm = t.rem_euclid(1.0);
            let factor = if t_norm < 0.25 {
                // Quick ramp up
                (t_norm / 0.25).powi(2)
            } else {
                // Slow decay back
                let decay = (t_norm - 0.25) / 0.75;
                1.0 - decay.powi(2)
            };
            let dx = (factor * dx_amp as f64).round() as i32;
            let dy = (factor * dy_amp as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, dy));
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

    /// Gust with overshoot: push, overshoot past rest, then settle.
    fn gen_gust_with_overshoot(&self, w: u32, h: u32, n: usize, dx_amp: i32, dy_amp: i32, phase: f64,
                                label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let t = (i as f64 / n as f64) + phase / std::f64::consts::TAU;
            let t_norm = t.rem_euclid(1.0);
            // Damped oscillation: peak at ~20%, overshoot at ~50%, settle by 100%
            let factor = if t_norm < 0.2 {
                (t_norm / 0.2).powi(2)
            } else {
                let decay_t = (t_norm - 0.2) / 0.8;
                (-decay_t * 3.0).exp() * (decay_t * std::f64::consts::TAU * 1.5).cos()
            };
            let dx = (factor * dx_amp as f64).round() as i32;
            let dy = (factor * dy_amp as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, dy));
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

    /// Pendular sway: symmetric sine oscillation (no directional bias).
    fn gen_pendular_sway(&self, w: u32, h: u32, n: usize, dx_amp: i32, dy_amp: i32, phase: f64,
                          label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let t = (i as f64 / n as f64) * std::f64::consts::TAU + phase;
            let dx = (t.sin() * dx_amp as f64).round() as i32;
            // Vertical follows |sin| — slight lift at extremes of horizontal swing
            let dy = -((t.sin().abs()) * dy_amp as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, dy));
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

    /// Hanging swing: pendulum arc with vertical lift at the extremes.
    /// Like a real pendulum — lowest at center, higher at the ends.
    fn gen_hanging_swing(&self, w: u32, h: u32, n: usize, dx_amp: i32, dy_lift: i32, phase: f64,
                          label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            let t = (i as f64 / n as f64) * std::f64::consts::TAU + phase;
            let dx = (t.sin() * dx_amp as f64).round() as i32;
            // Lift = 1 - cos(t), which peaks when sin(t) peaks (at extremes)
            let dy = -((1.0 - t.cos()) * 0.5 * dy_lift as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, dy));
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

    /// Foliage rustle: higher-frequency oscillations (2x base frequency).
    /// Creates a more jittery, organic feel.
    fn gen_rustle(&self, w: u32, h: u32, n: usize, dx_amp: i32, dy_amp: i32, phase: f64,
                   label: &str, desc: &str) -> MotionProposal {
        let mut frames = Vec::with_capacity(n);
        for i in 0..n {
            // Double frequency for rustle feel
            let t = (i as f64 / n as f64) * std::f64::consts::TAU * 2.0 + phase;
            let dx = (t.sin() * dx_amp as f64).round() as i32;
            // Offset the vertical by a quarter phase for diagonal wobble
            let dy = ((t + std::f64::consts::FRAC_PI_4).sin() * dy_amp as f64).round() as i32;
            frames.push(self.shift_pixels(w, h, dx, dy));
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
}
