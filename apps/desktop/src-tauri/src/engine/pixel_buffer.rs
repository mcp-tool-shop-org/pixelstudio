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
