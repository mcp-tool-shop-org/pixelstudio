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

// ==========================================================================
// Tests
// ==========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a 3x2 RGBA buffer with distinct pixel colors for testing transforms.
    /// Layout (row-major):
    ///   (0,0)=R  (1,0)=G  (2,0)=B
    ///   (0,1)=Y  (1,1)=C  (2,1)=M
    fn test_payload_3x2() -> Vec<u8> {
        vec![
            255, 0, 0, 255,   0, 255, 0, 255,   0, 0, 255, 255,   // row 0: R G B
            255, 255, 0, 255,  0, 255, 255, 255, 255, 0, 255, 255, // row 1: Y C M
        ]
    }

    fn session_3x2() -> TransformSession {
        TransformSession {
            layer_id: "l1".into(),
            source_rect: SelectionRect { x: 0, y: 0, width: 3, height: 2 },
            payload_width: 3,
            payload_height: 2,
            payload_data: test_payload_3x2(),
            original_data: test_payload_3x2(),
            offset_x: 0,
            offset_y: 0,
        }
    }

    fn px_at(data: &[u8], w: u32, x: u32, y: u32) -> [u8; 4] {
        let i = (y as usize * w as usize + x as usize) * 4;
        [data[i], data[i + 1], data[i + 2], data[i + 3]]
    }

    // --- flip_horizontal ---

    #[test]
    fn flip_horizontal_mirrors_columns() {
        let mut s = session_3x2();
        s.flip_horizontal();
        // Row 0 was R G B → should become B G R
        assert_eq!(px_at(&s.payload_data, 3, 0, 0), [0, 0, 255, 255]); // B
        assert_eq!(px_at(&s.payload_data, 3, 1, 0), [0, 255, 0, 255]); // G (center stays)
        assert_eq!(px_at(&s.payload_data, 3, 2, 0), [255, 0, 0, 255]); // R
        // Row 1 was Y C M → should become M C Y
        assert_eq!(px_at(&s.payload_data, 3, 0, 1), [255, 0, 255, 255]); // M
        assert_eq!(px_at(&s.payload_data, 3, 2, 1), [255, 255, 0, 255]); // Y
    }

    #[test]
    fn flip_horizontal_twice_is_identity() {
        let mut s = session_3x2();
        let original = s.payload_data.clone();
        s.flip_horizontal();
        s.flip_horizontal();
        assert_eq!(s.payload_data, original);
    }

    #[test]
    fn flip_horizontal_preserves_dimensions() {
        let mut s = session_3x2();
        s.flip_horizontal();
        assert_eq!(s.payload_width, 3);
        assert_eq!(s.payload_height, 2);
    }

    // --- flip_vertical ---

    #[test]
    fn flip_vertical_mirrors_rows() {
        let mut s = session_3x2();
        s.flip_vertical();
        // (0,0) was R, now should be Y (from row 1)
        assert_eq!(px_at(&s.payload_data, 3, 0, 0), [255, 255, 0, 255]); // Y
        assert_eq!(px_at(&s.payload_data, 3, 1, 0), [0, 255, 255, 255]); // C
        assert_eq!(px_at(&s.payload_data, 3, 2, 0), [255, 0, 255, 255]); // M
        // Row 1 should now be original row 0
        assert_eq!(px_at(&s.payload_data, 3, 0, 1), [255, 0, 0, 255]); // R
        assert_eq!(px_at(&s.payload_data, 3, 1, 1), [0, 255, 0, 255]); // G
        assert_eq!(px_at(&s.payload_data, 3, 2, 1), [0, 0, 255, 255]); // B
    }

    #[test]
    fn flip_vertical_twice_is_identity() {
        let mut s = session_3x2();
        let original = s.payload_data.clone();
        s.flip_vertical();
        s.flip_vertical();
        assert_eq!(s.payload_data, original);
    }

    #[test]
    fn flip_vertical_preserves_dimensions() {
        let mut s = session_3x2();
        s.flip_vertical();
        assert_eq!(s.payload_width, 3);
        assert_eq!(s.payload_height, 2);
    }

    // --- rotate_90_cw ---

    #[test]
    fn rotate_cw_swaps_dimensions() {
        let mut s = session_3x2();
        // 3x2 → 2x3
        s.rotate_90_cw();
        assert_eq!(s.payload_width, 2);
        assert_eq!(s.payload_height, 3);
    }

    #[test]
    fn rotate_cw_maps_pixels_correctly() {
        let mut s = session_3x2();
        // Original 3x2:
        //   (0,0)=R  (1,0)=G  (2,0)=B
        //   (0,1)=Y  (1,1)=C  (2,1)=M
        //
        // After 90° CW (new is 2x3):
        //   (0,0)=Y  (1,0)=R
        //   (0,1)=C  (1,1)=G
        //   (0,2)=M  (1,2)=B
        s.rotate_90_cw();
        assert_eq!(px_at(&s.payload_data, 2, 0, 0), [255, 255, 0, 255]); // Y
        assert_eq!(px_at(&s.payload_data, 2, 1, 0), [255, 0, 0, 255]);   // R
        assert_eq!(px_at(&s.payload_data, 2, 0, 1), [0, 255, 255, 255]); // C
        assert_eq!(px_at(&s.payload_data, 2, 1, 1), [0, 255, 0, 255]);   // G
        assert_eq!(px_at(&s.payload_data, 2, 0, 2), [255, 0, 255, 255]); // M
        assert_eq!(px_at(&s.payload_data, 2, 1, 2), [0, 0, 255, 255]);   // B
    }

    #[test]
    fn rotate_cw_four_times_is_identity() {
        let mut s = session_3x2();
        let original = s.payload_data.clone();
        for _ in 0..4 {
            s.rotate_90_cw();
        }
        assert_eq!(s.payload_width, 3);
        assert_eq!(s.payload_height, 2);
        assert_eq!(s.payload_data, original);
    }

    // --- rotate_90_ccw ---

    #[test]
    fn rotate_ccw_swaps_dimensions() {
        let mut s = session_3x2();
        s.rotate_90_ccw();
        assert_eq!(s.payload_width, 2);
        assert_eq!(s.payload_height, 3);
    }

    #[test]
    fn rotate_ccw_maps_pixels_correctly() {
        let mut s = session_3x2();
        // After 90° CCW (new is 2x3):
        //   (0,0)=B  (1,0)=M
        //   (0,1)=G  (1,1)=C
        //   (0,2)=R  (1,2)=Y
        s.rotate_90_ccw();
        assert_eq!(px_at(&s.payload_data, 2, 0, 0), [0, 0, 255, 255]);   // B
        assert_eq!(px_at(&s.payload_data, 2, 1, 0), [255, 0, 255, 255]); // M
        assert_eq!(px_at(&s.payload_data, 2, 0, 1), [0, 255, 0, 255]);   // G
        assert_eq!(px_at(&s.payload_data, 2, 1, 1), [0, 255, 255, 255]); // C
        assert_eq!(px_at(&s.payload_data, 2, 0, 2), [255, 0, 0, 255]);   // R
        assert_eq!(px_at(&s.payload_data, 2, 1, 2), [255, 255, 0, 255]); // Y
    }

    #[test]
    fn rotate_ccw_four_times_is_identity() {
        let mut s = session_3x2();
        let original = s.payload_data.clone();
        for _ in 0..4 {
            s.rotate_90_ccw();
        }
        assert_eq!(s.payload_width, 3);
        assert_eq!(s.payload_height, 2);
        assert_eq!(s.payload_data, original);
    }

    // --- CW + CCW are inverse ---

    #[test]
    fn rotate_cw_then_ccw_is_identity() {
        let mut s = session_3x2();
        let original = s.payload_data.clone();
        s.rotate_90_cw();
        s.rotate_90_ccw();
        assert_eq!(s.payload_width, 3);
        assert_eq!(s.payload_height, 2);
        assert_eq!(s.payload_data, original);
    }

    #[test]
    fn rotate_ccw_then_cw_is_identity() {
        let mut s = session_3x2();
        let original = s.payload_data.clone();
        s.rotate_90_ccw();
        s.rotate_90_cw();
        assert_eq!(s.payload_width, 3);
        assert_eq!(s.payload_height, 2);
        assert_eq!(s.payload_data, original);
    }

    // --- Combined transforms ---

    #[test]
    fn flip_h_then_flip_v_equals_rotate_180() {
        let mut s1 = session_3x2();
        let mut s2 = session_3x2();

        s1.flip_horizontal();
        s1.flip_vertical();

        s2.rotate_90_cw();
        s2.rotate_90_cw();

        assert_eq!(s1.payload_data, s2.payload_data);
    }

    // --- 1x1 edge case ---

    #[test]
    fn single_pixel_transforms_are_all_identity() {
        let pixel = vec![42u8, 128, 200, 255];
        let mut s = TransformSession {
            layer_id: "l".into(),
            source_rect: SelectionRect { x: 0, y: 0, width: 1, height: 1 },
            payload_width: 1,
            payload_height: 1,
            payload_data: pixel.clone(),
            original_data: pixel.clone(),
            offset_x: 0,
            offset_y: 0,
        };
        s.flip_horizontal();
        assert_eq!(s.payload_data, pixel);
        s.flip_vertical();
        assert_eq!(s.payload_data, pixel);
        s.rotate_90_cw();
        assert_eq!(s.payload_data, pixel);
        s.rotate_90_ccw();
        assert_eq!(s.payload_data, pixel);
    }
}
