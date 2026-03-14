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
