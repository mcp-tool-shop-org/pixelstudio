use serde::{Deserialize, Serialize};
use super::anchor::AnchorKind;

/// Where the sandbox frames came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SandboxSource {
    TimelineSpan,
    MotionProposal,
}

/// A runtime-only sandbox session for inspecting animation quality.
/// Never serialized to disk.
pub struct SandboxSession {
    pub id: String,
    pub source: SandboxSource,
    pub start_frame_index: usize,
    pub end_frame_index: usize,
    /// Composited RGBA preview frames (one per frame in the span).
    pub preview_frames: Vec<Vec<u8>>,
    pub preview_width: u32,
    pub preview_height: u32,
}

/// Managed sandbox state — one session at a time, runtime-only.
pub struct ManagedSandboxState(pub std::sync::Mutex<Option<SandboxSession>>);

// ── Analysis helpers ──────────────────────────────────────────────

/// Bounding box of non-transparent pixels in an RGBA frame.
#[derive(Debug, Clone, Copy)]
pub struct BBox {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
}

impl BBox {
    pub fn center_x(&self) -> f64 { (self.min_x as f64 + self.max_x as f64) / 2.0 }
    pub fn center_y(&self) -> f64 { (self.min_y as f64 + self.max_y as f64) / 2.0 }
    pub fn width(&self) -> u32 { self.max_x.saturating_sub(self.min_x) + 1 }
    pub fn height(&self) -> u32 { self.max_y.saturating_sub(self.min_y) + 1 }
}

/// Compute the bounding box of non-transparent pixels.
/// Returns None if the frame is fully transparent.
pub fn compute_bbox(rgba: &[u8], w: u32, h: u32) -> Option<BBox> {
    let mut min_x = w;
    let mut min_y = h;
    let mut max_x = 0u32;
    let mut max_y = 0u32;
    for y in 0..h {
        for x in 0..w {
            let idx = ((y * w + x) as usize) * 4;
            if rgba[idx + 3] > 0 {
                if x < min_x { min_x = x; }
                if y < min_y { min_y = y; }
                if x > max_x { max_x = x; }
                if y > max_y { max_y = y; }
            }
        }
    }
    if min_x > max_x { None } else { Some(BBox { min_x, min_y, max_x, max_y }) }
}

/// Compute per-pixel delta between two same-sized RGBA frames.
/// Returns the sum of absolute channel differences across all pixels.
pub fn frame_delta(a: &[u8], b: &[u8]) -> u64 {
    a.iter().zip(b.iter())
        .map(|(&av, &bv)| (av as i32 - bv as i32).unsigned_abs() as u64)
        .sum()
}

/// Compute per-pixel delta normalized by pixel count (average per-pixel channel diff).
pub fn frame_delta_normalized(a: &[u8], b: &[u8], pixel_count: usize) -> f64 {
    if pixel_count == 0 { return 0.0; }
    let raw = frame_delta(a, b);
    // 4 channels per pixel
    raw as f64 / (pixel_count as f64 * 4.0)
}

/// Count how many frames are byte-identical to their predecessor.
pub fn count_identical_adjacent(frames: &[Vec<u8>]) -> usize {
    frames.windows(2).filter(|w| w[0] == w[1]).count()
}

/// Analyze the sandbox session and return raw metrics.
pub struct SandboxAnalysis {
    pub frame_count: usize,
    pub bboxes: Vec<Option<BBox>>,
    /// Normalized delta between each adjacent pair of frames.
    pub adjacent_deltas: Vec<f64>,
    /// Normalized delta between first and last frame (loop closure).
    pub first_last_delta: f64,
    /// Number of adjacent frames that are byte-identical.
    pub identical_adjacent_count: usize,
    /// Largest adjacent-frame delta.
    pub largest_adjacent_delta: f64,
    /// Center drift: (dx, dy) from first frame bbox center to last frame bbox center.
    pub center_drift: Option<(f64, f64)>,
    /// Max center displacement from first frame across the span.
    pub max_center_displacement: f64,
}

impl SandboxAnalysis {
    pub fn from_session(session: &SandboxSession) -> Self {
        let frames = &session.preview_frames;
        let w = session.preview_width;
        let h = session.preview_height;
        let pixel_count = (w as usize) * (h as usize);
        let frame_count = frames.len();

        let bboxes: Vec<Option<BBox>> = frames.iter()
            .map(|f| compute_bbox(f, w, h))
            .collect();

        let adjacent_deltas: Vec<f64> = frames.windows(2)
            .map(|w| frame_delta_normalized(&w[0], &w[1], pixel_count))
            .collect();

        let first_last_delta = if frame_count >= 2 {
            frame_delta_normalized(&frames[0], &frames[frame_count - 1], pixel_count)
        } else {
            0.0
        };

        let identical_adjacent_count = count_identical_adjacent(frames);

        let largest_adjacent_delta = adjacent_deltas.iter()
            .cloned()
            .fold(0.0f64, f64::max);

        // Center drift from first to last bbox center
        let center_drift = match (bboxes.first().and_then(|b| *b), bboxes.last().and_then(|b| *b)) {
            (Some(first), Some(last)) => {
                Some((last.center_x() - first.center_x(), last.center_y() - first.center_y()))
            }
            _ => None,
        };

        // Max displacement from first frame center
        let first_center = bboxes.first().and_then(|b| *b).map(|b| (b.center_x(), b.center_y()));
        let max_center_displacement = match first_center {
            Some((fx, fy)) => bboxes.iter()
                .filter_map(|b| *b)
                .map(|b| {
                    let dx = b.center_x() - fx;
                    let dy = b.center_y() - fy;
                    (dx * dx + dy * dy).sqrt()
                })
                .fold(0.0f64, f64::max),
            None => 0.0,
        };

        SandboxAnalysis {
            frame_count,
            bboxes,
            adjacent_deltas,
            first_last_delta,
            identical_adjacent_count,
            largest_adjacent_delta,
            center_drift,
            max_center_displacement,
        }
    }
}

// ── Anchor path extraction ────────────────────────────────────────

/// A single sample point in an anchor path (one frame).
#[derive(Debug, Clone)]
pub struct AnchorPointSample {
    pub frame_index: usize,
    pub x: u32,
    pub y: u32,
    pub present: bool,
}

/// Contact hint for a specific frame in a path.
#[derive(Debug, Clone)]
pub struct ContactHint {
    pub frame_index: usize,
    /// "possible_contact", "likely_sliding", "stable_contact"
    pub label: String,
    pub confidence: f64,
}

/// A complete anchor path across the sandbox span.
#[derive(Debug, Clone)]
pub struct AnchorPath {
    pub anchor_name: String,
    pub anchor_kind: AnchorKind,
    pub samples: Vec<AnchorPointSample>,
    pub contact_hints: Vec<ContactHint>,
    /// Total path distance in pixels.
    pub total_distance: f64,
    /// Max displacement from first sample.
    pub max_displacement: f64,
}

/// Contact detection threshold: if Y is within this many pixels of max Y, consider it a contact candidate.
const CONTACT_Y_THRESHOLD: u32 = 2;
/// If movement between adjacent frames is below this, consider it stable.
const CONTACT_STABLE_THRESHOLD: f64 = 1.0;
/// Sliding: contact-level Y but notable X movement.
const CONTACT_SLIDING_X_THRESHOLD: f64 = 2.0;

/// Extract anchor paths from canvas frames within the sandbox span.
/// Matches anchors across frames by name only.
pub fn extract_anchor_paths(
    frames: &[super::canvas_state::AnimationFrame],
    start_index: usize,
    end_index: usize,
) -> Vec<AnchorPath> {
    // Collect all unique anchor names across the span
    let mut anchor_names: Vec<String> = Vec::new();
    let mut anchor_kinds: std::collections::HashMap<String, AnchorKind> = std::collections::HashMap::new();

    for idx in start_index..=end_index {
        if idx >= frames.len() { break; }
        for anchor in &frames[idx].anchors {
            if !anchor_names.contains(&anchor.name) {
                anchor_names.push(anchor.name.clone());
                anchor_kinds.insert(anchor.name.clone(), anchor.kind);
            }
        }
    }

    anchor_names.iter().map(|name| {
        let kind = anchor_kinds.get(name).copied().unwrap_or(AnchorKind::Custom);
        let mut samples = Vec::new();

        for idx in start_index..=end_index {
            if idx >= frames.len() {
                samples.push(AnchorPointSample {
                    frame_index: idx,
                    x: 0, y: 0,
                    present: false,
                });
                continue;
            }
            match frames[idx].anchors.iter().find(|a| a.name == *name) {
                Some(anchor) => samples.push(AnchorPointSample {
                    frame_index: idx,
                    x: anchor.x,
                    y: anchor.y,
                    present: true,
                }),
                None => samples.push(AnchorPointSample {
                    frame_index: idx,
                    x: 0, y: 0,
                    present: false,
                }),
            }
        }

        // Compute total path distance and max displacement
        let present_samples: Vec<&AnchorPointSample> = samples.iter().filter(|s| s.present).collect();
        let total_distance = present_samples.windows(2).map(|w| {
            let dx = w[1].x as f64 - w[0].x as f64;
            let dy = w[1].y as f64 - w[0].y as f64;
            (dx * dx + dy * dy).sqrt()
        }).sum::<f64>();

        let max_displacement = if let Some(first) = present_samples.first() {
            present_samples.iter().map(|s| {
                let dx = s.x as f64 - first.x as f64;
                let dy = s.y as f64 - first.y as f64;
                (dx * dx + dy * dy).sqrt()
            }).fold(0.0f64, f64::max)
        } else {
            0.0
        };

        // Contact heuristics (only for leg anchors and custom)
        let contact_hints = compute_contact_hints(&samples, kind);

        AnchorPath {
            anchor_name: name.clone(),
            anchor_kind: kind,
            samples,
            contact_hints,
            total_distance,
            max_displacement,
        }
    }).collect()
}

fn compute_contact_hints(samples: &[AnchorPointSample], kind: AnchorKind) -> Vec<ContactHint> {
    // Only compute contact for leg and custom anchors
    match kind {
        AnchorKind::LegLeft | AnchorKind::LegRight | AnchorKind::Custom => {}
        _ => return Vec::new(),
    }

    let present: Vec<&AnchorPointSample> = samples.iter().filter(|s| s.present).collect();
    if present.len() < 2 { return Vec::new(); }

    // Find max Y (lowest point on screen = highest Y value)
    let max_y = present.iter().map(|s| s.y).max().unwrap_or(0);
    let mut hints = Vec::new();

    for i in 0..present.len() {
        let s = present[i];
        let near_bottom = s.y >= max_y.saturating_sub(CONTACT_Y_THRESHOLD);
        if !near_bottom { continue; }

        // Check movement relative to neighbors
        let has_prev = i > 0;
        let has_next = i + 1 < present.len();

        let prev_dx = if has_prev {
            (s.x as f64 - present[i - 1].x as f64).abs()
        } else { 0.0 };
        let prev_dy = if has_prev {
            (s.y as f64 - present[i - 1].y as f64).abs()
        } else { 0.0 };
        let next_dx = if has_next {
            (present[i + 1].x as f64 - s.x as f64).abs()
        } else { 0.0 };
        let next_dy = if has_next {
            (present[i + 1].y as f64 - s.y as f64).abs()
        } else { 0.0 };

        let avg_movement = ((prev_dx + prev_dy + next_dx + next_dy) / 2.0).max(0.001);
        let avg_x_movement = ((prev_dx + next_dx) / 2.0).max(0.001);

        if avg_movement <= CONTACT_STABLE_THRESHOLD {
            hints.push(ContactHint {
                frame_index: s.frame_index,
                label: "stable_contact".to_string(),
                confidence: 0.8,
            });
        } else if avg_x_movement >= CONTACT_SLIDING_X_THRESHOLD && prev_dy <= CONTACT_STABLE_THRESHOLD && next_dy <= CONTACT_STABLE_THRESHOLD {
            hints.push(ContactHint {
                frame_index: s.frame_index,
                label: "likely_sliding".to_string(),
                confidence: 0.6,
            });
        } else {
            hints.push(ContactHint {
                frame_index: s.frame_index,
                label: "possible_contact".to_string(),
                confidence: 0.4,
            });
        }
    }

    hints
}
