use serde::{Deserialize, Serialize};

// ─── Preset domain types ─────────────────────────────────────

/// Preset kind — locomotion or secondary motion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotionPresetKind {
    Locomotion,
    SecondaryMotion,
}

/// An anchor definition within a preset.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetAnchor {
    pub name: String,
    pub kind: String,
    pub parent_name: Option<String>,
    pub falloff_weight: f32,
    /// Suggested relative position (0.0–1.0 normalized to canvas).
    #[serde(default)]
    pub hint_x: f32,
    #[serde(default)]
    pub hint_y: f32,
}

/// Template/intent settings captured in a preset.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetMotionSettings {
    /// For locomotion: intent ID (e.g. "idle_bob", "walk_cycle_stub").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intent: Option<String>,
    /// For secondary: template ID (e.g. "wind_soft", "hanging_swing").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    /// Direction preference.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    /// Strength (secondary only, 0.1–2.0).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strength: Option<f64>,
    /// Frame count.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frame_count: Option<u32>,
    /// Phase offset (secondary only, 0–TAU).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase_offset: Option<f64>,
}

/// Full preset document — serialized to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionPresetDocument {
    /// Schema version for forward compatibility.
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub kind: MotionPresetKind,
    /// Optional short description.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Anchor structure (names, kinds, hierarchy, falloff).
    pub anchors: Vec<PresetAnchor>,
    /// Motion template/intent settings.
    pub motion_settings: PresetMotionSettings,
    /// Human-readable notes about recommended targets.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_notes: Option<String>,
    /// Created timestamp (ISO 8601).
    pub created_at: String,
    /// Last modified timestamp (ISO 8601).
    pub modified_at: String,
}

impl MotionPresetDocument {
    pub const CURRENT_SCHEMA_VERSION: u32 = 1;

    pub fn new(name: String, kind: MotionPresetKind) -> Self {
        let now = chrono_now();
        Self {
            schema_version: Self::CURRENT_SCHEMA_VERSION,
            id: uuid::Uuid::new_v4().to_string(),
            name,
            kind,
            description: None,
            anchors: Vec::new(),
            motion_settings: PresetMotionSettings {
                intent: None,
                template_id: None,
                direction: None,
                strength: None,
                frame_count: None,
                phase_offset: None,
            },
            target_notes: None,
            created_at: now.clone(),
            modified_at: now,
        }
    }
}

/// Summary for listing presets (lightweight, no full anchor data).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionPresetSummary {
    pub id: String,
    pub name: String,
    pub kind: MotionPresetKind,
    pub description: Option<String>,
    pub anchor_count: u32,
    pub has_hierarchy: bool,
    pub template_id: Option<String>,
    pub created_at: String,
    pub modified_at: String,
}

impl MotionPresetDocument {
    pub fn to_summary(&self) -> MotionPresetSummary {
        MotionPresetSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            kind: self.kind,
            description: self.description.clone(),
            anchor_count: self.anchors.len() as u32,
            has_hierarchy: self.anchors.iter().any(|a| a.parent_name.is_some()),
            template_id: self.motion_settings.template_id.clone()
                .or_else(|| self.motion_settings.intent.clone()),
            created_at: self.created_at.clone(),
            modified_at: self.modified_at.clone(),
        }
    }
}

/// Simple timestamp (no chrono dependency — use basic format).
fn chrono_now() -> String {
    // Use system time for a basic ISO-ish timestamp
    let now = std::time::SystemTime::now();
    let dur = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    // Convert to basic UTC-like format: seconds since epoch
    // For a real ISO 8601 we'd need chrono, but this is sufficient for ordering
    format!("{}", secs)
}
