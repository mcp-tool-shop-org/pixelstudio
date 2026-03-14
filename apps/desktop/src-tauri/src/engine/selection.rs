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

/// Active transform session — extracted pixels being moved/flipped/rotated.
pub struct TransformSession {
    pub layer_id: String,
    /// Original selection bounds (where pixels were extracted from).
    pub source_rect: SelectionRect,
    /// Pixel data snapshot (may be transformed by flip/rotate).
    pub payload_width: u32,
    pub payload_height: u32,
    pub payload_data: Vec<u8>,
    /// Original pixels that were under the selection (for cancel/restore).
    pub original_data: Vec<u8>,
    /// Preview offset from source origin.
    pub offset_x: i32,
    pub offset_y: i32,
}

impl TransformSession {
    /// Flip the payload horizontally.
    pub fn flip_horizontal(&mut self) {
        let w = self.payload_width as usize;
        let h = self.payload_height as usize;
        let mut flipped = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let src = (y * w + x) * 4;
                let dst = (y * w + (w - 1 - x)) * 4;
                flipped[dst..dst + 4].copy_from_slice(&self.payload_data[src..src + 4]);
            }
        }
        self.payload_data = flipped;
    }

    /// Flip the payload vertically.
    pub fn flip_vertical(&mut self) {
        let w = self.payload_width as usize;
        let h = self.payload_height as usize;
        let mut flipped = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let src = (y * w + x) * 4;
                let dst = ((h - 1 - y) * w + x) * 4;
                flipped[dst..dst + 4].copy_from_slice(&self.payload_data[src..src + 4]);
            }
        }
        self.payload_data = flipped;
    }

    /// Rotate the payload 90° clockwise. Swaps width/height.
    pub fn rotate_90_cw(&mut self) {
        let w = self.payload_width as usize;
        let h = self.payload_height as usize;
        let mut rotated = vec![0u8; w * h * 4];
        // New dimensions: width=h, height=w
        for y in 0..h {
            for x in 0..w {
                let src = (y * w + x) * 4;
                let dst = (x * h + (h - 1 - y)) * 4;
                rotated[dst..dst + 4].copy_from_slice(&self.payload_data[src..src + 4]);
            }
        }
        self.payload_data = rotated;
        std::mem::swap(&mut self.payload_width, &mut self.payload_height);
    }

    /// Rotate the payload 90° counter-clockwise. Swaps width/height.
    pub fn rotate_90_ccw(&mut self) {
        let w = self.payload_width as usize;
        let h = self.payload_height as usize;
        let mut rotated = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let src = (y * w + x) * 4;
                let dst = ((w - 1 - x) * h + y) * 4;
                rotated[dst..dst + 4].copy_from_slice(&self.payload_data[src..src + 4]);
            }
        }
        self.payload_data = rotated;
        std::mem::swap(&mut self.payload_width, &mut self.payload_height);
    }
}

/// Managed selection + clipboard + transform state.
pub struct SelectionState {
    pub selection: Option<SelectionRect>,
    pub clipboard: Option<ClipboardPayload>,
    pub transform: Option<TransformSession>,
}

impl SelectionState {
    pub fn new() -> Self {
        Self {
            selection: None,
            clipboard: None,
            transform: None,
        }
    }
}

/// App-wide managed selection state.
pub struct ManagedSelectionState(pub Mutex<SelectionState>);
