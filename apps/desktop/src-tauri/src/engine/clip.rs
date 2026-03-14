use serde::{Deserialize, Serialize};

/// Pivot preset mode.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PivotMode {
    Center,
    BottomCenter,
    Custom,
}

/// Pivot point — pixel coordinates relative to frame top-left.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PivotPoint {
    pub x: f64,
    pub y: f64,
}

/// Clip-level pivot/origin configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipPivot {
    pub mode: PivotMode,
    /// Pixel coordinates relative to frame top-left.
    /// For preset modes, computed from frame dimensions at export time.
    /// For custom mode, user-specified.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_point: Option<PivotPoint>,
}

impl ClipPivot {
    /// Resolve the pivot to concrete pixel coordinates.
    pub fn resolve(&self, frame_width: u32, frame_height: u32) -> PivotPoint {
        match self.mode {
            PivotMode::Center => PivotPoint {
                x: frame_width as f64 / 2.0,
                y: frame_height as f64 / 2.0,
            },
            PivotMode::BottomCenter => PivotPoint {
                x: frame_width as f64 / 2.0,
                y: frame_height as f64,
            },
            PivotMode::Custom => self.custom_point.clone().unwrap_or(PivotPoint {
                x: frame_width as f64 / 2.0,
                y: frame_height as f64 / 2.0,
            }),
        }
    }
}

/// A named clip definition — a contiguous span of frames with export metadata.
/// Clips are project-level metadata, not per-frame data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Clip {
    pub id: String,
    pub name: String,
    /// Start frame index (inclusive, 0-based).
    pub start_frame: usize,
    /// End frame index (inclusive, 0-based).
    pub end_frame: usize,
    /// Whether the clip should loop on playback/export.
    #[serde(default)]
    pub loop_clip: bool,
    /// Optional FPS override for this clip (None = use project FPS).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fps_override: Option<u32>,
    /// Optional tags for organization.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Optional pivot/origin for runtime use.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pivot: Option<ClipPivot>,
}

impl Clip {
    pub fn new(name: String, start_frame: usize, end_frame: usize) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            start_frame,
            end_frame,
            loop_clip: false,
            fps_override: None,
            tags: Vec::new(),
            pivot: None,
        }
    }

    /// Number of frames in this clip.
    pub fn frame_count(&self) -> usize {
        if self.end_frame >= self.start_frame {
            self.end_frame - self.start_frame + 1
        } else {
            0
        }
    }

    /// Max tags per clip.
    pub const MAX_TAGS: usize = 16;
    /// Max characters per tag.
    pub const MAX_TAG_LEN: usize = 48;

    /// Normalize a tag: trim, lowercase, clamp length.
    /// Returns None if the result is empty.
    pub fn normalize_tag(raw: &str) -> Option<String> {
        let t = raw.trim().to_lowercase();
        if t.is_empty() {
            return None;
        }
        let truncated: String = t.chars().take(Self::MAX_TAG_LEN).collect();
        Some(truncated)
    }

    /// Normalize and deduplicate the clip's tag list in place.
    pub fn normalize_tags(&mut self) {
        let mut seen = std::collections::HashSet::new();
        let mut normalized = Vec::new();
        for tag in &self.tags {
            if let Some(t) = Self::normalize_tag(tag) {
                if seen.insert(t.clone()) {
                    normalized.push(t);
                }
            }
        }
        normalized.truncate(Self::MAX_TAGS);
        self.tags = normalized;
    }

    /// Validate that the clip's frame range is within bounds.
    pub fn validate(&self, total_frames: usize) -> Vec<String> {
        let mut warnings = Vec::new();
        if self.start_frame >= total_frames {
            warnings.push(format!(
                "Start frame {} exceeds total frames {}",
                self.start_frame, total_frames
            ));
        }
        if self.end_frame >= total_frames {
            warnings.push(format!(
                "End frame {} exceeds total frames {}",
                self.end_frame, total_frames
            ));
        }
        if self.start_frame > self.end_frame {
            warnings.push(format!(
                "Start frame {} is after end frame {}",
                self.start_frame, self.end_frame
            ));
        }
        warnings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_clip(start: usize, end: usize) -> Clip {
        Clip::new("Test".into(), start, end)
    }

    // --- frame_count ---

    #[test]
    fn frame_count_normal() {
        assert_eq!(make_clip(0, 0).frame_count(), 1);
        assert_eq!(make_clip(0, 9).frame_count(), 10);
        assert_eq!(make_clip(5, 5).frame_count(), 1);
    }

    #[test]
    fn frame_count_inverted_returns_zero() {
        assert_eq!(make_clip(10, 5).frame_count(), 0);
    }

    // --- validate ---

    #[test]
    fn validate_valid_clip() {
        assert!(make_clip(0, 9).validate(10).is_empty());
    }

    #[test]
    fn validate_start_exceeds_total() {
        let w = make_clip(10, 15).validate(5);
        assert_eq!(w.len(), 2); // both start and end exceed
    }

    #[test]
    fn validate_end_exceeds_total() {
        let w = make_clip(0, 10).validate(5);
        assert_eq!(w.len(), 1); // only end exceeds
    }

    #[test]
    fn validate_inverted_range() {
        let w = make_clip(5, 2).validate(10);
        assert_eq!(w.len(), 1); // start > end
    }

    // --- normalize_tag ---

    #[test]
    fn normalize_tag_trims_and_lowercases() {
        assert_eq!(Clip::normalize_tag("  Hello World  "), Some("hello world".into()));
    }

    #[test]
    fn normalize_tag_empty_returns_none() {
        assert_eq!(Clip::normalize_tag(""), None);
        assert_eq!(Clip::normalize_tag("   "), None);
    }

    #[test]
    fn normalize_tag_truncates_at_max() {
        let long = "a".repeat(100);
        let result = Clip::normalize_tag(&long).unwrap();
        assert_eq!(result.len(), Clip::MAX_TAG_LEN);
    }

    // --- normalize_tags ---

    #[test]
    fn normalize_tags_deduplicates() {
        let mut clip = make_clip(0, 0);
        clip.tags = vec!["Walk".into(), "walk".into(), "WALK".into(), "run".into()];
        clip.normalize_tags();
        assert_eq!(clip.tags, vec!["walk", "run"]);
    }

    #[test]
    fn normalize_tags_truncates_at_max_tags() {
        let mut clip = make_clip(0, 0);
        clip.tags = (0..32).map(|i| format!("tag{}", i)).collect();
        clip.normalize_tags();
        assert_eq!(clip.tags.len(), Clip::MAX_TAGS);
    }

    // --- Pivot resolution ---

    #[test]
    fn pivot_center() {
        let pivot = ClipPivot { mode: PivotMode::Center, custom_point: None };
        let p = pivot.resolve(32, 32);
        assert!((p.x - 16.0).abs() < 1e-10);
        assert!((p.y - 16.0).abs() < 1e-10);
    }

    #[test]
    fn pivot_bottom_center() {
        let pivot = ClipPivot { mode: PivotMode::BottomCenter, custom_point: None };
        let p = pivot.resolve(64, 32);
        assert!((p.x - 32.0).abs() < 1e-10);
        assert!((p.y - 32.0).abs() < 1e-10);
    }

    #[test]
    fn pivot_custom() {
        let pivot = ClipPivot {
            mode: PivotMode::Custom,
            custom_point: Some(PivotPoint { x: 10.0, y: 20.0 }),
        };
        let p = pivot.resolve(64, 64);
        assert!((p.x - 10.0).abs() < 1e-10);
        assert!((p.y - 20.0).abs() < 1e-10);
    }

    #[test]
    fn pivot_custom_fallback_when_no_point() {
        let pivot = ClipPivot { mode: PivotMode::Custom, custom_point: None };
        let p = pivot.resolve(64, 32);
        // Falls back to center
        assert!((p.x - 32.0).abs() < 1e-10);
        assert!((p.y - 16.0).abs() < 1e-10);
    }
}
