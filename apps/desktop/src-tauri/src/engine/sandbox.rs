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

// ── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::anchor::Anchor;
    use super::super::canvas_state::AnimationFrame;

    /// Build a minimal RGBA frame buffer (w × h, all transparent).
    fn transparent_frame(w: u32, h: u32) -> Vec<u8> {
        vec![0u8; (w as usize) * (h as usize) * 4]
    }

    /// Set one pixel to opaque white in a frame buffer.
    fn paint_pixel(buf: &mut Vec<u8>, w: u32, x: u32, y: u32) {
        let idx = ((y * w + x) as usize) * 4;
        buf[idx] = 255;
        buf[idx + 1] = 255;
        buf[idx + 2] = 255;
        buf[idx + 3] = 255;
    }

    /// Set one pixel to a specific RGBA value.
    fn paint_rgba(buf: &mut Vec<u8>, w: u32, x: u32, y: u32, r: u8, g: u8, b: u8, a: u8) {
        let idx = ((y * w + x) as usize) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = a;
    }

    fn make_session(frames: Vec<Vec<u8>>, w: u32, h: u32) -> SandboxSession {
        SandboxSession {
            id: "test".into(),
            source: SandboxSource::TimelineSpan,
            start_frame_index: 0,
            end_frame_index: frames.len().saturating_sub(1),
            preview_frames: frames,
            preview_width: w,
            preview_height: h,
        }
    }

    fn make_anchor(name: &str, kind: AnchorKind, x: u32, y: u32) -> Anchor {
        Anchor {
            id: format!("a-{name}"),
            name: name.to_string(),
            kind,
            x,
            y,
            bounds: None,
            parent_name: None,
            falloff_weight: 1.0,
        }
    }

    fn make_animation_frame(anchors: Vec<Anchor>) -> AnimationFrame {
        AnimationFrame {
            id: uuid::Uuid::new_v4().to_string(),
            name: "frame".into(),
            layers: Vec::new(),
            active_layer_id: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            layer_counter: 0,
            duration_ms: None,
            anchors,
        }
    }

    // ── BBox ──────────────────────────────────────────────────────

    #[test]
    fn bbox_center_on_symmetric_box() {
        let b = BBox { min_x: 2, min_y: 4, max_x: 8, max_y: 10 };
        assert_eq!(b.center_x(), 5.0);
        assert_eq!(b.center_y(), 7.0);
    }

    #[test]
    fn bbox_center_on_single_pixel() {
        let b = BBox { min_x: 3, min_y: 7, max_x: 3, max_y: 7 };
        assert_eq!(b.center_x(), 3.0);
        assert_eq!(b.center_y(), 7.0);
    }

    #[test]
    fn bbox_width_height() {
        let b = BBox { min_x: 0, min_y: 0, max_x: 9, max_y: 4 };
        assert_eq!(b.width(), 10);
        assert_eq!(b.height(), 5);
    }

    #[test]
    fn bbox_single_pixel_width_height_is_one() {
        let b = BBox { min_x: 5, min_y: 5, max_x: 5, max_y: 5 };
        assert_eq!(b.width(), 1);
        assert_eq!(b.height(), 1);
    }

    // ── compute_bbox ──────────────────────────────────────────────

    #[test]
    fn compute_bbox_fully_transparent_returns_none() {
        let buf = transparent_frame(4, 4);
        assert!(compute_bbox(&buf, 4, 4).is_none());
    }

    #[test]
    fn compute_bbox_single_opaque_pixel() {
        let mut buf = transparent_frame(8, 8);
        paint_pixel(&mut buf, 8, 3, 5);
        let bb = compute_bbox(&buf, 8, 8).unwrap();
        assert_eq!((bb.min_x, bb.min_y, bb.max_x, bb.max_y), (3, 5, 3, 5));
    }

    #[test]
    fn compute_bbox_respects_all_four_corners() {
        let mut buf = transparent_frame(10, 10);
        paint_pixel(&mut buf, 10, 1, 2); // top-left of content
        paint_pixel(&mut buf, 10, 8, 9); // bottom-right of content
        let bb = compute_bbox(&buf, 10, 10).unwrap();
        assert_eq!((bb.min_x, bb.min_y, bb.max_x, bb.max_y), (1, 2, 8, 9));
    }

    #[test]
    fn compute_bbox_frame_edge_pixels() {
        let mut buf = transparent_frame(4, 4);
        paint_pixel(&mut buf, 4, 0, 0);
        paint_pixel(&mut buf, 4, 3, 3);
        let bb = compute_bbox(&buf, 4, 4).unwrap();
        assert_eq!((bb.min_x, bb.min_y, bb.max_x, bb.max_y), (0, 0, 3, 3));
    }

    #[test]
    fn compute_bbox_semitransparent_pixel_is_opaque() {
        let mut buf = transparent_frame(4, 4);
        paint_rgba(&mut buf, 4, 2, 2, 100, 100, 100, 1); // alpha=1 is still non-transparent
        let bb = compute_bbox(&buf, 4, 4).unwrap();
        assert_eq!((bb.min_x, bb.min_y), (2, 2));
    }

    #[test]
    fn compute_bbox_1x1_frame() {
        let mut buf = transparent_frame(1, 1);
        paint_pixel(&mut buf, 1, 0, 0);
        let bb = compute_bbox(&buf, 1, 1).unwrap();
        assert_eq!((bb.min_x, bb.min_y, bb.max_x, bb.max_y), (0, 0, 0, 0));
        assert_eq!(bb.width(), 1);
    }

    // ── frame_delta ───────────────────────────────────────────────

    #[test]
    fn frame_delta_identical_is_zero() {
        let a = vec![128u8; 16];
        assert_eq!(frame_delta(&a, &a), 0);
    }

    #[test]
    fn frame_delta_counts_absolute_differences() {
        let a = vec![0u8; 4];
        let b = vec![10u8; 4]; // diff = 10 per channel × 4 channels
        assert_eq!(frame_delta(&a, &b), 40);
    }

    #[test]
    fn frame_delta_is_symmetric() {
        let a = vec![100u8, 50, 200, 0];
        let b = vec![10u8, 60, 150, 255];
        assert_eq!(frame_delta(&a, &b), frame_delta(&b, &a));
    }

    #[test]
    fn frame_delta_max_range_single_pixel() {
        let a = vec![0u8; 4];
        let b = vec![255u8; 4]; // 255 × 4 = 1020
        assert_eq!(frame_delta(&a, &b), 1020);
    }

    // ── frame_delta_normalized ────────────────────────────────────

    #[test]
    fn frame_delta_normalized_zero_pixels_returns_zero() {
        assert_eq!(frame_delta_normalized(&[], &[], 0), 0.0);
    }

    #[test]
    fn frame_delta_normalized_identical_returns_zero() {
        let a = vec![128u8; 16]; // 4 pixels
        assert_eq!(frame_delta_normalized(&a, &a, 4), 0.0);
    }

    #[test]
    fn frame_delta_normalized_max_diff() {
        // 1 pixel: [0,0,0,0] vs [255,255,255,255]
        // raw delta = 1020, normalized = 1020 / (1 * 4) = 255.0
        let a = vec![0u8; 4];
        let b = vec![255u8; 4];
        assert!((frame_delta_normalized(&a, &b, 1) - 255.0).abs() < f64::EPSILON);
    }

    #[test]
    fn frame_delta_normalized_scales_with_pixel_count() {
        // 2 pixels identical + diff: net raw delta is same but spread over more pixels
        let a = vec![0u8; 8]; // 2 pixels
        let mut b = vec![0u8; 8];
        // Only second pixel differs: channels = 10 each → raw delta = 40
        b[4] = 10; b[5] = 10; b[6] = 10; b[7] = 10;
        // normalized = 40 / (2 * 4) = 5.0
        assert!((frame_delta_normalized(&a, &b, 2) - 5.0).abs() < f64::EPSILON);
    }

    // ── count_identical_adjacent ──────────────────────────────────

    #[test]
    fn count_identical_adjacent_empty() {
        assert_eq!(count_identical_adjacent(&[]), 0);
    }

    #[test]
    fn count_identical_adjacent_single_frame() {
        assert_eq!(count_identical_adjacent(&[vec![1, 2, 3, 4]]), 0);
    }

    #[test]
    fn count_identical_adjacent_all_same() {
        let f = vec![1u8, 2, 3, 4];
        assert_eq!(count_identical_adjacent(&[f.clone(), f.clone(), f.clone()]), 2);
    }

    #[test]
    fn count_identical_adjacent_all_different() {
        assert_eq!(count_identical_adjacent(&[vec![1], vec![2], vec![3]]), 0);
    }

    #[test]
    fn count_identical_adjacent_mixed() {
        let a = vec![0u8; 4];
        let b = vec![1u8; 4];
        // a, a, b, b, a → identical pairs: (a,a), (b,b) = 2
        assert_eq!(count_identical_adjacent(&[a.clone(), a.clone(), b.clone(), b.clone(), a]), 2);
    }

    // ── SandboxAnalysis ───────────────────────────────────────────

    #[test]
    fn analysis_single_frame_has_no_deltas() {
        let mut f = transparent_frame(4, 4);
        paint_pixel(&mut f, 4, 2, 2);
        let session = make_session(vec![f], 4, 4);
        let analysis = SandboxAnalysis::from_session(&session);
        assert_eq!(analysis.frame_count, 1);
        assert!(analysis.adjacent_deltas.is_empty());
        assert_eq!(analysis.first_last_delta, 0.0);
        assert_eq!(analysis.identical_adjacent_count, 0);
    }

    #[test]
    fn analysis_identical_frames_zero_deltas() {
        let mut f = transparent_frame(4, 4);
        paint_pixel(&mut f, 4, 1, 1);
        let session = make_session(vec![f.clone(), f.clone(), f], 4, 4);
        let analysis = SandboxAnalysis::from_session(&session);
        assert_eq!(analysis.adjacent_deltas.len(), 2);
        assert!(analysis.adjacent_deltas.iter().all(|&d| d == 0.0));
        assert_eq!(analysis.first_last_delta, 0.0);
        assert_eq!(analysis.identical_adjacent_count, 2);
        assert_eq!(analysis.largest_adjacent_delta, 0.0);
    }

    #[test]
    fn analysis_detects_center_drift() {
        // Frame 1: pixel at (1, 1)
        let mut f1 = transparent_frame(8, 8);
        paint_pixel(&mut f1, 8, 1, 1);
        // Frame 2: pixel at (5, 5) — center has drifted
        let mut f2 = transparent_frame(8, 8);
        paint_pixel(&mut f2, 8, 5, 5);
        let session = make_session(vec![f1, f2], 8, 8);
        let analysis = SandboxAnalysis::from_session(&session);
        let (dx, dy) = analysis.center_drift.unwrap();
        assert_eq!(dx, 4.0);
        assert_eq!(dy, 4.0);
    }

    #[test]
    fn analysis_center_drift_none_when_all_transparent() {
        let f = transparent_frame(4, 4);
        let session = make_session(vec![f.clone(), f], 4, 4);
        let analysis = SandboxAnalysis::from_session(&session);
        assert!(analysis.center_drift.is_none());
    }

    #[test]
    fn analysis_max_displacement_tracks_peak() {
        // Three frames: pixel at x=0, x=10, x=5. Max displacement is from x=0 to x=10.
        let w = 16u32;
        let h = 4u32;
        let mut f0 = transparent_frame(w, h);
        paint_pixel(&mut f0, w, 0, 2);
        let mut f1 = transparent_frame(w, h);
        paint_pixel(&mut f1, w, 10, 2);
        let mut f2 = transparent_frame(w, h);
        paint_pixel(&mut f2, w, 5, 2);
        let session = make_session(vec![f0, f1, f2], w, h);
        let analysis = SandboxAnalysis::from_session(&session);
        // All single-pixel bboxes → center equals pixel coord
        // Max displacement from (0,2) to (10,2) = 10.0
        assert!((analysis.max_center_displacement - 10.0).abs() < f64::EPSILON);
    }

    #[test]
    fn analysis_loop_closure_detects_nonzero_diff() {
        let mut f0 = transparent_frame(4, 4);
        paint_pixel(&mut f0, 4, 0, 0);
        let mut f1 = transparent_frame(4, 4);
        paint_pixel(&mut f1, 4, 3, 3);
        // f0 and f1 differ → first_last_delta > 0
        let session = make_session(vec![f0.clone(), f1, f0], 4, 4);
        let analysis = SandboxAnalysis::from_session(&session);
        // first == last, so loop closure delta should be 0
        assert_eq!(analysis.first_last_delta, 0.0);
        // but adjacent deltas are nonzero
        assert!(analysis.adjacent_deltas[0] > 0.0);
    }

    #[test]
    fn analysis_largest_adjacent_delta_picks_max() {
        let w = 4u32;
        let h = 1u32;
        let mut f0 = transparent_frame(w, h);
        paint_rgba(&mut f0, w, 0, 0, 10, 0, 0, 255);
        let mut f1 = transparent_frame(w, h);
        paint_rgba(&mut f1, w, 0, 0, 20, 0, 0, 255); // small diff from f0
        let mut f2 = transparent_frame(w, h);
        paint_rgba(&mut f2, w, 0, 0, 255, 0, 0, 255); // big diff from f1
        let session = make_session(vec![f0, f1, f2], w, h);
        let analysis = SandboxAnalysis::from_session(&session);
        assert!(analysis.largest_adjacent_delta > analysis.adjacent_deltas[0]);
        assert_eq!(analysis.largest_adjacent_delta, analysis.adjacent_deltas[1]);
    }

    // ── extract_anchor_paths ──────────────────────────────────────

    #[test]
    fn extract_paths_no_anchors_returns_empty() {
        let frames = vec![make_animation_frame(vec![]), make_animation_frame(vec![])];
        let paths = extract_anchor_paths(&frames, 0, 1);
        assert!(paths.is_empty());
    }

    #[test]
    fn extract_paths_single_anchor_all_frames() {
        let frames = vec![
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 5, 10)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 8, 10)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 11, 10)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].anchor_name, "foot_l");
        assert_eq!(paths[0].samples.len(), 3);
        assert!(paths[0].samples.iter().all(|s| s.present));
        // Total distance: 3+3 = 6 pixels horizontal
        assert!((paths[0].total_distance - 6.0).abs() < f64::EPSILON);
    }

    #[test]
    fn extract_paths_anchor_appears_mid_span() {
        let frames = vec![
            make_animation_frame(vec![]), // no anchor
            make_animation_frame(vec![make_anchor("head", AnchorKind::Head, 10, 5)]),
            make_animation_frame(vec![make_anchor("head", AnchorKind::Head, 12, 5)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        assert_eq!(paths.len(), 1);
        assert!(!paths[0].samples[0].present);
        assert!(paths[0].samples[1].present);
        assert!(paths[0].samples[2].present);
        // Distance only between present samples: 2.0
        assert!((paths[0].total_distance - 2.0).abs() < f64::EPSILON);
    }

    #[test]
    fn extract_paths_anchor_disappears() {
        let frames = vec![
            make_animation_frame(vec![make_anchor("hip", AnchorKind::Torso, 10, 10)]),
            make_animation_frame(vec![]), // anchor gone
        ];
        let paths = extract_anchor_paths(&frames, 0, 1);
        assert_eq!(paths.len(), 1);
        assert!(paths[0].samples[0].present);
        assert!(!paths[0].samples[1].present);
        // Only one present → total distance = 0
        assert_eq!(paths[0].total_distance, 0.0);
    }

    #[test]
    fn extract_paths_multiple_anchors() {
        let frames = vec![
            make_animation_frame(vec![
                make_anchor("foot_l", AnchorKind::LegLeft, 5, 20),
                make_anchor("foot_r", AnchorKind::LegRight, 15, 20),
            ]),
            make_animation_frame(vec![
                make_anchor("foot_l", AnchorKind::LegLeft, 6, 20),
                make_anchor("foot_r", AnchorKind::LegRight, 14, 20),
            ]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 1);
        assert_eq!(paths.len(), 2);
        let names: Vec<&str> = paths.iter().map(|p| p.anchor_name.as_str()).collect();
        assert!(names.contains(&"foot_l"));
        assert!(names.contains(&"foot_r"));
    }

    #[test]
    fn extract_paths_subspan() {
        // 4 frames, only extract span [1..2]
        let frames = vec![
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 0, 0)]),
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 10, 0)]),
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 20, 0)]),
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 30, 0)]),
        ];
        let paths = extract_anchor_paths(&frames, 1, 2);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].samples.len(), 2);
        assert_eq!(paths[0].samples[0].x, 10);
        assert_eq!(paths[0].samples[1].x, 20);
        assert!((paths[0].total_distance - 10.0).abs() < f64::EPSILON);
    }

    #[test]
    fn extract_paths_end_index_beyond_len_is_safe() {
        let frames = vec![
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 5, 5)]),
        ];
        // end_index = 5, but only 1 frame exists
        let paths = extract_anchor_paths(&frames, 0, 5);
        assert_eq!(paths.len(), 1);
        // Frame 0 present, frames 1-5 not present (out of bounds)
        assert!(paths[0].samples[0].present);
        assert!(paths[0].samples.iter().skip(1).all(|s| !s.present));
    }

    #[test]
    fn extract_paths_max_displacement() {
        // Anchor at (0,0), (10,0), (3,0) → max displacement = 10
        let frames = vec![
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 0, 0)]),
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 10, 0)]),
            make_animation_frame(vec![make_anchor("a", AnchorKind::Custom, 3, 0)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        assert!((paths[0].max_displacement - 10.0).abs() < f64::EPSILON);
    }

    // ── contact heuristics ────────────────────────────────────────

    #[test]
    fn contact_hints_skipped_for_non_leg_anchors() {
        // Head and Torso anchors should produce no contact hints
        let frames = vec![
            make_animation_frame(vec![make_anchor("head", AnchorKind::Head, 10, 100)]),
            make_animation_frame(vec![make_anchor("head", AnchorKind::Head, 10, 100)]),
            make_animation_frame(vec![make_anchor("head", AnchorKind::Head, 10, 100)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        assert!(paths[0].contact_hints.is_empty());

        let frames2 = vec![
            make_animation_frame(vec![make_anchor("torso", AnchorKind::Torso, 10, 100)]),
            make_animation_frame(vec![make_anchor("torso", AnchorKind::Torso, 10, 100)]),
            make_animation_frame(vec![make_anchor("torso", AnchorKind::Torso, 10, 100)]),
        ];
        let paths2 = extract_anchor_paths(&frames2, 0, 2);
        assert!(paths2[0].contact_hints.is_empty());
    }

    #[test]
    fn contact_hints_stable_contact_for_stationary_leg() {
        // Leg at same position near max Y → stable_contact
        let frames = vec![
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 50)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 50)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 50)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        let hints = &paths[0].contact_hints;
        assert!(!hints.is_empty());
        assert!(hints.iter().all(|h| h.label == "stable_contact"));
        assert!(hints.iter().all(|h| h.confidence == 0.8));
    }

    #[test]
    fn contact_hints_sliding_leg() {
        // Leg at max Y, X moves significantly between frames, Y stays constant
        let frames = vec![
            make_animation_frame(vec![make_anchor("foot_r", AnchorKind::LegRight, 10, 50)]),
            make_animation_frame(vec![make_anchor("foot_r", AnchorKind::LegRight, 15, 50)]),
            make_animation_frame(vec![make_anchor("foot_r", AnchorKind::LegRight, 20, 50)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        let hints = &paths[0].contact_hints;
        // Middle sample at max Y, X moving by 5 per frame → likely_sliding
        assert!(hints.iter().any(|h| h.label == "likely_sliding"));
    }

    #[test]
    fn contact_hints_possible_contact_when_y_is_near_max() {
        // Leg near max Y, but with noticeable Y movement → possible_contact
        let frames = vec![
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 48)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 15, 50)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 20, 48)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        let hints = &paths[0].contact_hints;
        assert!(hints.iter().any(|h| h.label == "possible_contact" || h.label == "likely_sliding"));
    }

    #[test]
    fn contact_hints_custom_anchor_gets_hints() {
        let frames = vec![
            make_animation_frame(vec![make_anchor("custom_pt", AnchorKind::Custom, 10, 50)]),
            make_animation_frame(vec![make_anchor("custom_pt", AnchorKind::Custom, 10, 50)]),
            make_animation_frame(vec![make_anchor("custom_pt", AnchorKind::Custom, 10, 50)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        assert!(!paths[0].contact_hints.is_empty());
    }

    #[test]
    fn contact_hints_not_near_bottom_skipped() {
        // Leg well above max Y → no contact hints for those frames
        let frames = vec![
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 5)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 50)]),
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 5)]),
        ];
        let paths = extract_anchor_paths(&frames, 0, 2);
        let hints = &paths[0].contact_hints;
        // Only frame at y=50 (max_y) should get a hint, frames at y=5 are far from bottom
        let hinted_indices: Vec<usize> = hints.iter().map(|h| h.frame_index).collect();
        assert!(hinted_indices.contains(&1)); // frame at y=50
        assert!(!hinted_indices.contains(&0)); // frame at y=5 is far from max
    }

    #[test]
    fn contact_hints_single_present_sample_returns_empty() {
        // Less than 2 present samples → no hints
        let frames = vec![
            make_animation_frame(vec![make_anchor("foot_l", AnchorKind::LegLeft, 10, 50)]),
            make_animation_frame(vec![]), // anchor gone
        ];
        let paths = extract_anchor_paths(&frames, 0, 1);
        assert!(paths[0].contact_hints.is_empty());
    }
}
