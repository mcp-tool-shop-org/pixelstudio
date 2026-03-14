use serde::{Deserialize, Serialize};

// ─── Domain types ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnchorKind {
    Head,
    Torso,
    ArmLeft,
    ArmRight,
    LegLeft,
    LegRight,
    Custom,
}

/// Rectangular bounds attached to an anchor for region targeting.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// A named anchor point on a frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Anchor {
    pub id: String,
    pub name: String,
    pub kind: AnchorKind,
    /// Position relative to the frame origin.
    pub x: u32,
    pub y: u32,
    /// Optional rectangular bounds for region-based targeting.
    pub bounds: Option<AnchorBounds>,
    /// Optional parent anchor name for hierarchy (matched by name, not ID).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_name: Option<String>,
    /// Falloff weight for secondary motion amplitude scaling (0.1–3.0, default 1.0).
    #[serde(default = "default_falloff", skip_serializing_if = "is_default_falloff")]
    pub falloff_weight: f32,
}

fn default_falloff() -> f32 {
    1.0
}

fn is_default_falloff(v: &f32) -> bool {
    (*v - 1.0).abs() < f32::EPSILON
}

impl Anchor {
    pub fn new(name: String, kind: AnchorKind, x: u32, y: u32) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            kind,
            x,
            y,
            bounds: None,
            parent_name: None,
            falloff_weight: 1.0,
        }
    }

    /// Compute the effective hierarchy depth of this anchor within a set of anchors.
    /// Returns 0 for root anchors, 1+ for children.
    pub fn depth_in(&self, anchors: &[Anchor]) -> u32 {
        let mut depth = 0u32;
        let mut current_name = self.parent_name.as_deref();
        while let Some(pname) = current_name {
            depth += 1;
            if depth > 10 { break; } // safety cap
            current_name = anchors.iter()
                .find(|a| a.name == pname)
                .and_then(|a| a.parent_name.as_deref());
        }
        depth
    }

    /// Check if setting parent_name to `target` would create a cycle.
    pub fn would_cycle(name: &str, target: &str, anchors: &[Anchor]) -> bool {
        if name == target { return true; }
        // Walk from target up through parents — if we reach `name`, it's a cycle
        let mut current = Some(target);
        while let Some(cname) = current {
            if let Some(anc) = anchors.iter().find(|a| a.name == cname) {
                match &anc.parent_name {
                    Some(pn) if pn == name => return true,
                    Some(pn) => current = Some(pn.as_str()),
                    None => return false,
                }
            } else {
                return false; // parent not found, no cycle
            }
        }
        false
    }

    /// Default name for a given anchor kind.
    pub fn default_name(kind: AnchorKind) -> String {
        match kind {
            AnchorKind::Head => "Head".to_string(),
            AnchorKind::Torso => "Torso".to_string(),
            AnchorKind::ArmLeft => "Left Arm".to_string(),
            AnchorKind::ArmRight => "Right Arm".to_string(),
            AnchorKind::LegLeft => "Left Leg".to_string(),
            AnchorKind::LegRight => "Right Leg".to_string(),
            AnchorKind::Custom => "Anchor".to_string(),
        }
    }
}
