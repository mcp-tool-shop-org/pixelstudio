use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub const TRANSPARENT: Color = Color { r: 0, g: 0, b: 0, a: 0 };

    pub fn rgba(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }
}

/// Per-layer pixel buffer. RGBA, row-major, origin top-left.
pub struct PixelBuffer {
    pub width: u32,
    pub height: u32,
    /// Row-major RGBA: length = width * height * 4
    data: Vec<u8>,
}

impl PixelBuffer {
    pub fn new(width: u32, height: u32) -> Self {
        let size = (width as usize) * (height as usize) * 4;
        Self {
            width,
            height,
            data: vec![0u8; size],
        }
    }

    pub fn in_bounds(&self, x: u32, y: u32) -> bool {
        x < self.width && y < self.height
    }

    fn index(&self, x: u32, y: u32) -> usize {
        ((y as usize) * (self.width as usize) + (x as usize)) * 4
    }

    pub fn get_pixel(&self, x: u32, y: u32) -> Color {
        if !self.in_bounds(x, y) {
            return Color::TRANSPARENT;
        }
        let i = self.index(x, y);
        Color {
            r: self.data[i],
            g: self.data[i + 1],
            b: self.data[i + 2],
            a: self.data[i + 3],
        }
    }

    pub fn set_pixel(&mut self, x: u32, y: u32, color: &Color) {
        if !self.in_bounds(x, y) {
            return;
        }
        let i = self.index(x, y);
        self.data[i] = color.r;
        self.data[i + 1] = color.g;
        self.data[i + 2] = color.b;
        self.data[i + 3] = color.a;
    }

    /// Return raw RGBA bytes for the full frame.
    pub fn as_bytes(&self) -> &[u8] {
        &self.data
    }

    /// Create from raw RGBA bytes (for deserialization).
    pub fn from_bytes(width: u32, height: u32, data: Vec<u8>) -> Self {
        Self { width, height, data }
    }

    /// Clone the raw data for serialization.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.data.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Color ─────────────────────────────────────────────────────

    #[test]
    fn color_transparent_is_all_zeros() {
        let c = Color::TRANSPARENT;
        assert_eq!((c.r, c.g, c.b, c.a), (0, 0, 0, 0));
    }

    #[test]
    fn color_rgba_constructor() {
        let c = Color::rgba(10, 20, 30, 255);
        assert_eq!((c.r, c.g, c.b, c.a), (10, 20, 30, 255));
    }

    // ── PixelBuffer::new ──────────────────────────────────────────

    #[test]
    fn new_buffer_is_all_transparent() {
        let buf = PixelBuffer::new(4, 4);
        for y in 0..4 {
            for x in 0..4 {
                let c = buf.get_pixel(x, y);
                assert_eq!(c.a, 0, "pixel ({x},{y}) should be transparent");
            }
        }
    }

    #[test]
    fn new_buffer_correct_byte_length() {
        let buf = PixelBuffer::new(8, 6);
        assert_eq!(buf.as_bytes().len(), 8 * 6 * 4);
    }

    #[test]
    fn new_1x1_buffer() {
        let buf = PixelBuffer::new(1, 1);
        assert_eq!(buf.as_bytes().len(), 4);
        assert_eq!(buf.get_pixel(0, 0).a, 0);
    }

    #[test]
    fn new_large_buffer_does_not_panic() {
        let buf = PixelBuffer::new(256, 256);
        assert_eq!(buf.as_bytes().len(), 256 * 256 * 4);
    }

    // ── in_bounds ─────────────────────────────────────────────────

    #[test]
    fn in_bounds_corners() {
        let buf = PixelBuffer::new(8, 8);
        assert!(buf.in_bounds(0, 0));
        assert!(buf.in_bounds(7, 7));
        assert!(buf.in_bounds(7, 0));
        assert!(buf.in_bounds(0, 7));
    }

    #[test]
    fn out_of_bounds_at_width_height() {
        let buf = PixelBuffer::new(8, 8);
        assert!(!buf.in_bounds(8, 0));
        assert!(!buf.in_bounds(0, 8));
        assert!(!buf.in_bounds(8, 8));
    }

    #[test]
    fn out_of_bounds_large_values() {
        let buf = PixelBuffer::new(4, 4);
        assert!(!buf.in_bounds(u32::MAX, 0));
        assert!(!buf.in_bounds(0, u32::MAX));
        assert!(!buf.in_bounds(u32::MAX, u32::MAX));
    }

    // ── get_pixel / set_pixel ─────────────────────────────────────

    #[test]
    fn set_then_get_pixel() {
        let mut buf = PixelBuffer::new(4, 4);
        let c = Color::rgba(255, 128, 64, 200);
        buf.set_pixel(2, 3, &c);
        let got = buf.get_pixel(2, 3);
        assert_eq!((got.r, got.g, got.b, got.a), (255, 128, 64, 200));
    }

    #[test]
    fn set_pixel_does_not_bleed_to_neighbors() {
        let mut buf = PixelBuffer::new(4, 4);
        let red = Color::rgba(255, 0, 0, 255);
        buf.set_pixel(1, 1, &red);
        // Check all 8 neighbors are still transparent
        for (dx, dy) in [(-1i32,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)] {
            let nx = (1 + dx) as u32;
            let ny = (1 + dy) as u32;
            let c = buf.get_pixel(nx, ny);
            assert_eq!(c.a, 0, "neighbor ({nx},{ny}) should still be transparent");
        }
    }

    #[test]
    fn get_pixel_out_of_bounds_returns_transparent() {
        let buf = PixelBuffer::new(4, 4);
        let c = buf.get_pixel(100, 100);
        assert_eq!((c.r, c.g, c.b, c.a), (0, 0, 0, 0));
    }

    #[test]
    fn set_pixel_out_of_bounds_is_noop() {
        let mut buf = PixelBuffer::new(4, 4);
        let red = Color::rgba(255, 0, 0, 255);
        buf.set_pixel(100, 100, &red); // should not panic
        // Buffer unchanged
        assert!(buf.as_bytes().iter().all(|&b| b == 0));
    }

    #[test]
    fn overwrite_pixel() {
        let mut buf = PixelBuffer::new(4, 4);
        buf.set_pixel(0, 0, &Color::rgba(255, 0, 0, 255));
        buf.set_pixel(0, 0, &Color::rgba(0, 255, 0, 128));
        let c = buf.get_pixel(0, 0);
        assert_eq!((c.r, c.g, c.b, c.a), (0, 255, 0, 128));
    }

    #[test]
    fn set_pixel_at_last_valid_position() {
        let mut buf = PixelBuffer::new(3, 5);
        let blue = Color::rgba(0, 0, 255, 255);
        buf.set_pixel(2, 4, &blue);
        let c = buf.get_pixel(2, 4);
        assert_eq!((c.r, c.g, c.b, c.a), (0, 0, 255, 255));
    }

    // ── as_bytes / from_bytes / to_bytes round-trip ───────────────

    #[test]
    fn bytes_round_trip() {
        let mut buf = PixelBuffer::new(4, 4);
        buf.set_pixel(1, 2, &Color::rgba(42, 84, 126, 200));
        buf.set_pixel(3, 0, &Color::rgba(10, 20, 30, 40));
        let bytes = buf.to_bytes();
        let restored = PixelBuffer::from_bytes(4, 4, bytes);
        let c1 = restored.get_pixel(1, 2);
        assert_eq!((c1.r, c1.g, c1.b, c1.a), (42, 84, 126, 200));
        let c2 = restored.get_pixel(3, 0);
        assert_eq!((c2.r, c2.g, c2.b, c2.a), (10, 20, 30, 40));
    }

    #[test]
    fn as_bytes_returns_same_data_as_to_bytes() {
        let mut buf = PixelBuffer::new(2, 2);
        buf.set_pixel(0, 0, &Color::rgba(1, 2, 3, 4));
        assert_eq!(buf.as_bytes(), buf.to_bytes().as_slice());
    }

    #[test]
    fn from_bytes_preserves_dimensions() {
        let data = vec![0u8; 5 * 3 * 4];
        let buf = PixelBuffer::from_bytes(5, 3, data);
        assert_eq!(buf.width, 5);
        assert_eq!(buf.height, 3);
    }

    // ── Row-major layout verification ─────────────────────────────

    #[test]
    fn row_major_layout_consistent() {
        let mut buf = PixelBuffer::new(3, 3);
        // Set pixel at (2, 1) — row 1, column 2
        buf.set_pixel(2, 1, &Color::rgba(99, 0, 0, 255));
        let bytes = buf.as_bytes();
        // Expected byte offset: (1 * 3 + 2) * 4 = 20
        assert_eq!(bytes[20], 99);
        assert_eq!(bytes[23], 255);
    }
}
