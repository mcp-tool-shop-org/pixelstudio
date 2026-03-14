use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Rectangular selection bounds in pixel coordinates.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Clipboard payload — copied pixel region with its dimensions.
#[derive(Debug, Clone)]
pub struct ClipboardPayload {
    pub width: u32,
    pub height: u32,
    pub layer_id: String,
    /// Raw RGBA pixel data for the copied region.
    pub data: Vec<u8>,
}

/// Managed selection + clipboard state.
pub struct SelectionState {
    pub selection: Option<SelectionRect>,
    pub clipboard: Option<ClipboardPayload>,
}

impl SelectionState {
    pub fn new() -> Self {
        Self {
            selection: None,
            clipboard: None,
        }
    }
}

/// App-wide managed selection state.
pub struct ManagedSelectionState(pub Mutex<SelectionState>);
