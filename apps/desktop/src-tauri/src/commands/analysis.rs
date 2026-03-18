/// Canvas analysis commands — bounds, colors, frame comparison.
///
/// These operate on composited frame pixel data and return
/// structured analysis results for the frontend to display.

use serde::Serialize;
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundsResult {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
    pub width: u32,
    pub height: u32,
    pub opaque_pixel_count: u32,
    pub empty: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorEntry {
    pub hex: String,
    pub count: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorsResult {
    pub unique_colors: u32,
    pub histogram: Vec<ColorEntry>,
    pub opaque_pixel_count: u32,
    pub transparent_pixel_count: u32,
    pub total_pixels: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareResult {
    pub changed_pixel_count: u32,
    pub total_pixels: u32,
    pub changed_bounds: Option<ChangedBounds>,
    pub identical: bool,
    pub changed_percent: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedBounds {
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
}

// --- Commands ---

/// Analyze bounding box of non-transparent pixels in the current frame.
#[command]
pub fn analyze_bounds(
    frame_index: Option<usize>,
    state: State<'_, ManagedCanvasState>,
) -> Result<BoundsResult, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let idx = frame_index.unwrap_or(canvas.active_frame_index);
    let data = canvas.composite_frame_at(idx)
        .ok_or_else(|| AppError::Internal(format!("Frame index out of range: {}", idx)))?;

    let w = canvas.width as usize;
    let h = canvas.height as usize;
    let mut min_x = w;
    let mut min_y = h;
    let mut max_x: usize = 0;
    let mut max_y: usize = 0;
    let mut opaque_count: u32 = 0;
    let mut found = false;

    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) * 4;
            if data[i + 3] > 0 {
                opaque_count += 1;
                found = true;
                if x < min_x { min_x = x; }
                if x > max_x { max_x = x; }
                if y < min_y { min_y = y; }
                if y > max_y { max_y = y; }
            }
        }
    }

    if !found {
        return Ok(BoundsResult {
            min_x: 0, min_y: 0, max_x: 0, max_y: 0,
            width: 0, height: 0, opaque_pixel_count: 0, empty: true,
        });
    }

    Ok(BoundsResult {
        min_x: min_x as u32,
        min_y: min_y as u32,
        max_x: max_x as u32,
        max_y: max_y as u32,
        width: (max_x - min_x + 1) as u32,
        height: (max_y - min_y + 1) as u32,
        opaque_pixel_count: opaque_count,
        empty: false,
    })
}

/// Analyze color histogram for the current frame.
#[command]
pub fn analyze_colors(
    frame_index: Option<usize>,
    max_colors: Option<usize>,
    state: State<'_, ManagedCanvasState>,
) -> Result<ColorsResult, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let idx = frame_index.unwrap_or(canvas.active_frame_index);
    let data = canvas.composite_frame_at(idx)
        .ok_or_else(|| AppError::Internal(format!("Frame index out of range: {}", idx)))?;

    let w = canvas.width as usize;
    let h = canvas.height as usize;
    let total = (w * h) as u32;
    let mut color_map = std::collections::HashMap::<u32, u32>::new();
    let mut opaque_count: u32 = 0;

    for i in (0..data.len()).step_by(4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let a = data[i + 3];
        if a > 0 { opaque_count += 1; }
        let key = ((r as u32) << 24) | ((g as u32) << 16) | ((b as u32) << 8) | (a as u32);
        *color_map.entry(key).or_insert(0) += 1;
    }

    let mut histogram: Vec<ColorEntry> = color_map.iter().map(|(&key, &count)| {
        let r = (key >> 24) & 0xFF;
        let g = (key >> 16) & 0xFF;
        let b = (key >> 8) & 0xFF;
        let a = key & 0xFF;
        ColorEntry {
            hex: format!("#{:02x}{:02x}{:02x}{:02x}", r, g, b, a),
            count,
        }
    }).collect();
    histogram.sort_by(|a, b| b.count.cmp(&a.count));

    let limit = max_colors.unwrap_or(50);
    histogram.truncate(limit);

    Ok(ColorsResult {
        unique_colors: color_map.len() as u32,
        histogram,
        opaque_pixel_count: opaque_count,
        transparent_pixel_count: total - opaque_count,
        total_pixels: total,
    })
}

/// Compare two frames pixel-by-pixel.
#[command]
pub fn compare_frames(
    frame_a: usize,
    frame_b: usize,
    state: State<'_, ManagedCanvasState>,
) -> Result<CompareResult, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let data_a = canvas.composite_frame_at(frame_a)
        .ok_or_else(|| AppError::Internal(format!("Frame index out of range: {}", frame_a)))?;
    let data_b = canvas.composite_frame_at(frame_b)
        .ok_or_else(|| AppError::Internal(format!("Frame index out of range: {}", frame_b)))?;

    let w = canvas.width as usize;
    let h = canvas.height as usize;
    let total = (w * h) as u32;
    let mut changed: u32 = 0;
    let mut min_x = w;
    let mut min_y = h;
    let mut max_x: usize = 0;
    let mut max_y: usize = 0;

    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) * 4;
            if data_a[i] != data_b[i]
                || data_a[i + 1] != data_b[i + 1]
                || data_a[i + 2] != data_b[i + 2]
                || data_a[i + 3] != data_b[i + 3]
            {
                changed += 1;
                if x < min_x { min_x = x; }
                if x > max_x { max_x = x; }
                if y < min_y { min_y = y; }
                if y > max_y { max_y = y; }
            }
        }
    }

    let identical = changed == 0;
    let pct = (changed as f64 / total as f64) * 100.0;
    let changed_percent = (pct * 100.0).round() / 100.0;

    Ok(CompareResult {
        changed_pixel_count: changed,
        total_pixels: total,
        changed_bounds: if identical {
            None
        } else {
            Some(ChangedBounds {
                min_x: min_x as u32,
                min_y: min_y as u32,
                max_x: max_x as u32,
                max_y: max_y as u32,
            })
        },
        identical,
        changed_percent,
    })
}

// --- Motion trail data ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameCentroid {
    pub frame_index: usize,
    pub cx: f32,
    pub cy: f32,
    pub empty: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionTrailData {
    pub centroids: Vec<FrameCentroid>,
    pub canvas_width: u32,
    pub canvas_height: u32,
}

/// Compute content centroids for all frames (center-of-mass of opaque pixels).
/// Used for motion trail / arc visibility overlays.
#[command]
pub fn compute_motion_trail(
    state: State<'_, ManagedCanvasState>,
) -> Result<MotionTrailData, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let w = canvas.width as usize;
    let h = canvas.height as usize;
    let mut centroids = Vec::with_capacity(canvas.frames.len());

    for idx in 0..canvas.frames.len() {
        let data = canvas.composite_frame_at(idx)
            .ok_or_else(|| AppError::Internal(format!("Failed to composite frame {}", idx)))?;

        let mut sum_x: f64 = 0.0;
        let mut sum_y: f64 = 0.0;
        let mut count: u64 = 0;

        for y in 0..h {
            for x in 0..w {
                let a = data[(y * w + x) * 4 + 3];
                if a > 0 {
                    // Weight by alpha for smoother centroid
                    let weight = a as f64;
                    sum_x += x as f64 * weight;
                    sum_y += y as f64 * weight;
                    count += a as u64;
                }
            }
        }

        if count == 0 {
            centroids.push(FrameCentroid { frame_index: idx, cx: 0.0, cy: 0.0, empty: true });
        } else {
            centroids.push(FrameCentroid {
                frame_index: idx,
                cx: (sum_x / count as f64) as f32,
                cy: (sum_y / count as f64) as f32,
                empty: false,
            });
        }
    }

    Ok(MotionTrailData {
        centroids,
        canvas_width: canvas.width,
        canvas_height: canvas.height,
    })
}
