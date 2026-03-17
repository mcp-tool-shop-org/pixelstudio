use serde::{Deserialize, Serialize};

/// A named rectangular region on a frame, used for sprite sheet export slicing.
/// Persisted per-frame alongside anchors. Participates in undo/redo.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SliceRegion {
    pub id: String,
    pub name: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl SliceRegion {
    pub fn new(name: String, x: u32, y: u32, width: u32, height: u32) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            x,
            y,
            width,
            height,
        }
    }
}
