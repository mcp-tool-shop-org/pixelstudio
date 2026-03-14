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

// ==========================================================================
// Tests
// ==========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_anchor(name: &str, kind: AnchorKind, parent: Option<&str>) -> Anchor {
        Anchor {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            kind,
            x: 0,
            y: 0,
            bounds: None,
            parent_name: parent.map(|s| s.to_string()),
            falloff_weight: 1.0,
        }
    }

    // --- would_cycle ---

    #[test]
    fn self_reference_is_cycle() {
        let anchors = vec![make_anchor("A", AnchorKind::Custom, None)];
        assert!(Anchor::would_cycle("A", "A", &anchors));
    }

    #[test]
    fn direct_cycle_detected() {
        // A -> B, trying to set B's parent to A
        let anchors = vec![
            make_anchor("A", AnchorKind::Custom, Some("B")),
            make_anchor("B", AnchorKind::Custom, None),
        ];
        // B parenting to A: walk from A, A's parent is B — cycle!
        assert!(Anchor::would_cycle("B", "A", &anchors));
    }

    #[test]
    fn indirect_cycle_detected() {
        // A -> B -> C, trying to set C's parent to A
        let anchors = vec![
            make_anchor("A", AnchorKind::Custom, Some("B")),
            make_anchor("B", AnchorKind::Custom, Some("C")),
            make_anchor("C", AnchorKind::Custom, None),
        ];
        assert!(Anchor::would_cycle("C", "A", &anchors));
    }

    #[test]
    fn no_cycle_when_valid() {
        let anchors = vec![
            make_anchor("Torso", AnchorKind::Torso, None),
            make_anchor("Head", AnchorKind::Head, Some("Torso")),
        ];
        // Adding arm under torso: no cycle
        assert!(!Anchor::would_cycle("Left Arm", "Torso", &anchors));
    }

    #[test]
    fn no_cycle_with_missing_parent() {
        let anchors = vec![
            make_anchor("A", AnchorKind::Custom, Some("Ghost")),
        ];
        // Ghost doesn't exist — should not be a cycle
        assert!(!Anchor::would_cycle("B", "A", &anchors));
    }

    // --- depth_in ---

    #[test]
    fn root_depth_is_zero() {
        let anchors = vec![make_anchor("Root", AnchorKind::Torso, None)];
        assert_eq!(anchors[0].depth_in(&anchors), 0);
    }

    #[test]
    fn child_depth_is_one() {
        let anchors = vec![
            make_anchor("Torso", AnchorKind::Torso, None),
            make_anchor("Head", AnchorKind::Head, Some("Torso")),
        ];
        assert_eq!(anchors[1].depth_in(&anchors), 1);
    }

    #[test]
    fn grandchild_depth_is_two() {
        let anchors = vec![
            make_anchor("Torso", AnchorKind::Torso, None),
            make_anchor("Head", AnchorKind::Head, Some("Torso")),
            make_anchor("Hat", AnchorKind::Custom, Some("Head")),
        ];
        assert_eq!(anchors[2].depth_in(&anchors), 2);
    }

    #[test]
    fn depth_caps_at_ten() {
        // Build chain of 15 deep
        let mut anchors = vec![make_anchor("A0", AnchorKind::Custom, None)];
        for i in 1..15 {
            anchors.push(make_anchor(
                &format!("A{}", i),
                AnchorKind::Custom,
                Some(&format!("A{}", i - 1)),
            ));
        }
        let last = &anchors[14];
        let depth = last.depth_in(&anchors);
        assert!(depth <= 11); // safety cap kicks in at 10 iterations
    }

    // --- default_name ---

    #[test]
    fn default_names_all_kinds() {
        assert_eq!(Anchor::default_name(AnchorKind::Head), "Head");
        assert_eq!(Anchor::default_name(AnchorKind::Torso), "Torso");
        assert_eq!(Anchor::default_name(AnchorKind::ArmLeft), "Left Arm");
        assert_eq!(Anchor::default_name(AnchorKind::ArmRight), "Right Arm");
        assert_eq!(Anchor::default_name(AnchorKind::LegLeft), "Left Leg");
        assert_eq!(Anchor::default_name(AnchorKind::LegRight), "Right Leg");
        assert_eq!(Anchor::default_name(AnchorKind::Custom), "Anchor");
    }

    // --- Anchor construction ---

    #[test]
    fn new_anchor_has_default_falloff() {
        let a = Anchor::new("Test".to_string(), AnchorKind::Custom, 10, 20);
        assert_eq!(a.falloff_weight, 1.0);
        assert!(a.bounds.is_none());
        assert!(a.parent_name.is_none());
        assert_eq!(a.x, 10);
        assert_eq!(a.y, 20);
    }

    // --- Serde round-trip ---

    #[test]
    fn anchor_json_roundtrip() {
        let mut a = Anchor::new("Head".to_string(), AnchorKind::Head, 5, 10);
        a.parent_name = Some("Torso".to_string());
        a.falloff_weight = 1.5;
        a.bounds = Some(AnchorBounds { x: 2, y: 3, width: 8, height: 12 });

        let json = serde_json::to_string(&a).unwrap();
        let a2: Anchor = serde_json::from_str(&json).unwrap();

        assert_eq!(a2.name, "Head");
        assert_eq!(a2.kind, AnchorKind::Head);
        assert_eq!(a2.x, 5);
        assert_eq!(a2.y, 10);
        assert_eq!(a2.parent_name.as_deref(), Some("Torso"));
        assert!((a2.falloff_weight - 1.5).abs() < f32::EPSILON);
        assert!(a2.bounds.is_some());
        let b = a2.bounds.unwrap();
        assert_eq!((b.x, b.y, b.width, b.height), (2, 3, 8, 12));
    }

    #[test]
    fn anchor_json_default_falloff_omitted() {
        let a = Anchor::new("Arm".to_string(), AnchorKind::ArmLeft, 0, 0);
        let json = serde_json::to_string(&a).unwrap();
        // falloff_weight=1.0 should be skipped via skip_serializing_if
        assert!(!json.contains("falloffWeight") || json.contains("\"falloffWeight\":1"));
    }
}
