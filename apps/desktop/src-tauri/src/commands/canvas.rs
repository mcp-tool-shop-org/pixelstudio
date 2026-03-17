use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::canvas_state::{CanvasState, ManagedCanvasState};
use crate::engine::pixel_buffer::Color;
use crate::errors::AppError;

// --- Response types ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasFrame {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
    pub layers: Vec<LayerInfo>,
    pub active_layer_id: Option<String>,
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_depth: usize,
    pub redo_depth: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerInfo {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelValue {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

// --- Input types ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritePixelInput {
    pub x: u32,
    pub y: u32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    pub layer_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginStrokeInput {
    pub tool: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrokePointsInput {
    pub points: Vec<[u32; 2]>,
}

// --- Canvas lifecycle ---

#[command]
pub fn init_canvas(
    width: u32,
    height: u32,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let canvas = CanvasState::new(width, height);
    let frame = build_frame(&canvas);
    *state.0.lock().unwrap() = Some(canvas);
    Ok(frame)
}

#[command]
pub fn get_canvas_state(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;
    Ok(build_frame(canvas))
}

// --- Pixel read (for color picker) ---

#[command]
pub fn read_pixel(
    x: u32,
    y: u32,
    layer_id: Option<String>,
    state: State<'_, ManagedCanvasState>,
) -> Result<PixelValue, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    match layer_id {
        Some(id) => {
            let layer = canvas.layer_by_id(&id)
                .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;
            let c = layer.buffer.get_pixel(x, y);
            Ok(PixelValue { r: c.r, g: c.g, b: c.b, a: c.a })
        }
        None => {
            let frame = canvas.composite_frame();
            let idx = ((y as usize) * (canvas.width as usize) + (x as usize)) * 4;
            if idx + 3 >= frame.len() {
                return Ok(PixelValue { r: 0, g: 0, b: 0, a: 0 });
            }
            Ok(PixelValue {
                r: frame[idx],
                g: frame[idx + 1],
                b: frame[idx + 2],
                a: frame[idx + 3],
            })
        }
    }
}

// --- Legacy single-pixel write (still useful outside strokes) ---

#[command]
pub fn write_pixel(
    input: WritePixelInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let color = Color::rgba(input.r, input.g, input.b, input.a);
    let target_id = input.layer_id
        .or_else(|| canvas.active_layer_id.clone())
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == target_id)
        .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }
    if !layer.buffer.in_bounds(input.x, input.y) {
        return Err(AppError::Internal(format!(
            "Pixel ({}, {}) out of bounds", input.x, input.y
        )));
    }

    layer.buffer.set_pixel(input.x, input.y, &color);
    Ok(build_frame(canvas))
}

// --- Stroke lifecycle ---

#[command]
pub fn begin_stroke(
    input: BeginStrokeInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<String, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.begin_stroke(input.tool, [input.r, input.g, input.b, input.a])
        .map_err(AppError::Internal)
}

#[command]
pub fn stroke_points(
    input: StrokePointsInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let points: Vec<(u32, u32)> = input.points.iter().map(|p| (p[0], p[1])).collect();
    canvas.stroke_points(&points)
        .map_err(AppError::Internal)?;

    Ok(build_frame(canvas))
}

#[command]
pub fn end_stroke(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.end_stroke().map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

// --- Undo/Redo ---

#[command]
pub fn undo(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.undo().map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn redo(
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.redo().map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

// --- Layer management ---

#[command]
pub fn create_layer(
    name: Option<String>,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.create_layer(name);
    Ok(build_frame(canvas))
}

#[command]
pub fn delete_layer(
    layer_id: String,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.delete_layer(&layer_id).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn rename_layer(
    layer_id: String,
    name: String,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.rename_layer(&layer_id, name).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn select_layer(
    layer_id: String,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.select_layer(&layer_id).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn set_layer_visibility(
    layer_id: String,
    visible: bool,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_layer_visibility(&layer_id, visible).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn set_layer_lock(
    layer_id: String,
    locked: bool,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_layer_lock(&layer_id, locked).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn set_layer_opacity(
    layer_id: String,
    opacity: f32,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.set_layer_opacity(&layer_id, opacity).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

#[command]
pub fn reorder_layer(
    layer_id: String,
    new_index: usize,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    canvas.reorder_layer(&layer_id, new_index).map_err(AppError::Internal)?;
    Ok(build_frame(canvas))
}

// --- Fill rect (for AI copilot bulk operations) ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillRectInput {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    pub layer_id: Option<String>,
}

#[command]
pub fn fill_rect(
    input: FillRectInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let color = Color::rgba(input.r, input.g, input.b, input.a);
    let target_id = input.layer_id
        .or_else(|| canvas.active_layer_id.clone())
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == target_id)
        .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }

    for dy in 0..input.height {
        for dx in 0..input.width {
            let px = input.x + dx;
            let py = input.y + dy;
            if layer.buffer.in_bounds(px, py) {
                layer.buffer.set_pixel(px, py, &color);
            }
        }
    }

    Ok(build_frame(canvas))
}

// --- Flood fill (bucket tool) ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FloodFillInput {
    pub x: u32,
    pub y: u32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    pub layer_id: Option<String>,
}

#[command]
pub fn flood_fill(
    input: FloodFillInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let fill_color = Color::rgba(input.r, input.g, input.b, input.a);
    let target_id = input.layer_id
        .or_else(|| canvas.active_layer_id.clone())
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == target_id)
        .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }

    if !layer.buffer.in_bounds(input.x, input.y) {
        return Err(AppError::Internal("Pixel out of bounds".to_string()));
    }

    let target_color = layer.buffer.get_pixel(input.x, input.y);
    let tc = [target_color.r, target_color.g, target_color.b, target_color.a];
    let fc = [fill_color.r, fill_color.g, fill_color.b, fill_color.a];

    // Don't fill if the target color is the same as fill color
    if tc == fc {
        return Ok(build_frame(canvas));
    }

    // Flood fill with undo patch tracking
    let w = canvas.width;
    let h = canvas.height;
    let mut visited = vec![false; (w * h) as usize];
    let mut stack: Vec<(u32, u32)> = vec![(input.x, input.y)];
    let mut patches = Vec::new();

    while let Some((cx, cy)) = stack.pop() {
        let idx = (cy * w + cx) as usize;
        if visited[idx] { continue; }

        let pixel = layer.buffer.get_pixel(cx, cy);
        let pc = [pixel.r, pixel.g, pixel.b, pixel.a];
        if pc != tc { continue; }

        visited[idx] = true;
        patches.push(crate::engine::canvas_state::PixelPatch {
            x: cx, y: cy, before: pc, after: fc,
        });
        layer.buffer.set_pixel(cx, cy, &fill_color);

        if cx > 0 { stack.push((cx - 1, cy)); }
        if cx + 1 < w { stack.push((cx + 1, cy)); }
        if cy > 0 { stack.push((cx, cy - 1)); }
        if cy + 1 < h { stack.push((cx, cy + 1)); }
    }

    if !patches.is_empty() {
        let record = crate::engine::canvas_state::StrokeRecord {
            id: uuid::Uuid::new_v4().to_string(),
            layer_id: target_id,
            tool: "fill".into(),
            color: fc,
            patches,
        };
        canvas.undo_stack.push(crate::engine::canvas_state::UndoAction::Stroke(record));
        canvas.redo_stack.clear();
    }

    Ok(build_frame(canvas))
}

// --- Magic select (wand tool — flood fill that returns bounding rect) ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicSelectInput {
    pub x: u32,
    pub y: u32,
    pub layer_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicSelectResult {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub pixel_count: u32,
}

#[command]
pub fn magic_select(
    input: MagicSelectInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<MagicSelectResult, AppError> {
    let guard = state.0.lock().unwrap();
    let canvas = guard.as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let target_id = input.layer_id
        .or_else(|| canvas.active_layer_id.clone())
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let layer = canvas.layer_by_id(&target_id)
        .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;

    if !layer.buffer.in_bounds(input.x, input.y) {
        return Err(AppError::Internal("Pixel out of bounds".to_string()));
    }

    let target_color = layer.buffer.get_pixel(input.x, input.y);
    let tc = [target_color.r, target_color.g, target_color.b, target_color.a];

    let w = canvas.width;
    let h = canvas.height;
    let mut visited = vec![false; (w * h) as usize];
    let mut stack: Vec<(u32, u32)> = vec![(input.x, input.y)];
    let mut min_x = input.x;
    let mut min_y = input.y;
    let mut max_x = input.x;
    let mut max_y = input.y;
    let mut count: u32 = 0;

    while let Some((cx, cy)) = stack.pop() {
        let idx = (cy * w + cx) as usize;
        if visited[idx] { continue; }

        let pixel = layer.buffer.get_pixel(cx, cy);
        let pc = [pixel.r, pixel.g, pixel.b, pixel.a];
        if pc != tc { continue; }

        visited[idx] = true;
        count += 1;
        if cx < min_x { min_x = cx; }
        if cx > max_x { max_x = cx; }
        if cy < min_y { min_y = cy; }
        if cy > max_y { max_y = cy; }

        if cx > 0 { stack.push((cx - 1, cy)); }
        if cx + 1 < w { stack.push((cx + 1, cy)); }
        if cy > 0 { stack.push((cx, cy - 1)); }
        if cy + 1 < h { stack.push((cx, cy + 1)); }
    }

    Ok(MagicSelectResult {
        x: min_x,
        y: min_y,
        width: max_x - min_x + 1,
        height: max_y - min_y + 1,
        pixel_count: count,
    })
}

// --- Template rendering (for AI copilot sprite generation) ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRegionInput {
    /// Absolute pixel x offset on canvas (can be negative for animation overshoot).
    pub x: i32,
    /// Absolute pixel y offset on canvas (can be negative for animation overshoot).
    pub y: i32,
    /// Width in pixels.
    pub width: u32,
    /// Height in pixels.
    pub height: u32,
    /// Shape to rasterize: "rect", "ellipse", "triangle-up", "triangle-down", "diamond".
    pub shape: String,
    /// Fill color RGBA.
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    /// Z-order for render sorting (higher = rendered later = on top).
    pub z_order: i32,
    /// Optional 1px outline color.
    pub outline_r: Option<u8>,
    pub outline_g: Option<u8>,
    pub outline_b: Option<u8>,
    pub outline_a: Option<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderConnectionInput {
    /// Center of source region (can be negative for animation overshoot).
    pub from_x: i32,
    pub from_y: i32,
    /// Center of destination region (can be negative for animation overshoot).
    pub to_x: i32,
    pub to_y: i32,
    /// Bridge color RGBA.
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderTemplateInput {
    pub regions: Vec<RenderRegionInput>,
    pub connections: Vec<RenderConnectionInput>,
    pub layer_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderTemplateResult {
    pub region_count: u32,
    pub connection_count: u32,
    pub pixel_count: u32,
}

/// Check if a pixel is inside an ellipse inscribed in (0,0)-(w,h).
fn in_ellipse(px: u32, py: u32, w: u32, h: u32) -> bool {
    if w == 0 || h == 0 { return false; }
    let cx = w as f64 / 2.0;
    let cy = h as f64 / 2.0;
    let dx = (px as f64 + 0.5 - cx) / cx;
    let dy = (py as f64 + 0.5 - cy) / cy;
    dx * dx + dy * dy <= 1.0
}

/// Check if a pixel is inside an upward-pointing triangle inscribed in (0,0)-(w,h).
fn in_triangle_up(px: u32, py: u32, w: u32, h: u32) -> bool {
    if w == 0 || h == 0 { return false; }
    let fx = px as f64 + 0.5;
    let fy = py as f64 + 0.5;
    let hw = w as f64 / 2.0;
    let fh = h as f64;
    // Triangle: apex at (hw, 0), base from (0, h) to (w, h)
    let t = fy / fh; // 0 at top, 1 at bottom
    let half_width_at_y = hw * t;
    fx >= (hw - half_width_at_y) && fx <= (hw + half_width_at_y)
}

/// Check if a pixel is inside a downward-pointing triangle inscribed in (0,0)-(w,h).
fn in_triangle_down(px: u32, py: u32, w: u32, h: u32) -> bool {
    if w == 0 || h == 0 { return false; }
    let fx = px as f64 + 0.5;
    let fy = py as f64 + 0.5;
    let hw = w as f64 / 2.0;
    let fh = h as f64;
    // Triangle: base from (0, 0) to (w, 0), apex at (hw, h)
    let t = fy / fh; // 0 at top, 1 at bottom
    let half_width_at_y = hw * (1.0 - t);
    fx >= (hw - half_width_at_y) && fx <= (hw + half_width_at_y)
}

/// Check if a pixel is inside a diamond inscribed in (0,0)-(w,h).
fn in_diamond(px: u32, py: u32, w: u32, h: u32) -> bool {
    if w == 0 || h == 0 { return false; }
    let cx = w as f64 / 2.0;
    let cy = h as f64 / 2.0;
    let dx = ((px as f64 + 0.5) - cx).abs() / cx;
    let dy = ((py as f64 + 0.5) - cy).abs() / cy;
    dx + dy <= 1.0
}

/// Check if a pixel is on the 1px outline of a shape.
fn on_outline(px: u32, py: u32, w: u32, h: u32, shape: &str) -> bool {
    if w < 3 || h < 3 { return true; } // too small, all pixels are outline
    // Border pixels
    let is_border = px == 0 || py == 0 || px == w - 1 || py == h - 1;
    match shape {
        "rect" => is_border,
        "ellipse" => {
            // On the ellipse edge: inside but at least one neighbor is outside
            if !in_ellipse(px, py, w, h) { return false; }
            let check_outside = |dx: i32, dy: i32| {
                let nx = px as i32 + dx;
                let ny = py as i32 + dy;
                if nx < 0 || ny < 0 || nx >= w as i32 || ny >= h as i32 {
                    return true;
                }
                !in_ellipse(nx as u32, ny as u32, w, h)
            };
            check_outside(-1, 0) || check_outside(1, 0) || check_outside(0, -1) || check_outside(0, 1)
        }
        _ => is_border, // simplified for triangles/diamond
    }
}

/// Test if a local pixel (relative to region origin) is inside the shape.
fn pixel_in_shape(px: u32, py: u32, w: u32, h: u32, shape: &str) -> bool {
    match shape {
        "rect" => true,
        "ellipse" => in_ellipse(px, py, w, h),
        "triangle-up" => in_triangle_up(px, py, w, h),
        "triangle-down" => in_triangle_down(px, py, w, h),
        "diamond" => in_diamond(px, py, w, h),
        _ => true, // fallback to rect
    }
}

#[command]
pub fn render_template(
    input: RenderTemplateInput,
    state: State<'_, ManagedCanvasState>,
) -> Result<RenderTemplateResult, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let target_id = input.layer_id
        .or_else(|| canvas.active_layer_id.clone())
        .ok_or_else(|| AppError::Internal("No active layer".to_string()))?;

    let layer = canvas.layers.iter_mut().find(|l| l.id == target_id)
        .ok_or_else(|| AppError::Internal("Layer not found".to_string()))?;

    if layer.locked {
        return Err(AppError::Internal("Layer is locked".to_string()));
    }

    let mut pixel_count: u32 = 0;

    // Sort regions by z_order (lower first = painted first = behind)
    let mut sorted_regions = input.regions;
    sorted_regions.sort_by_key(|r| r.z_order);

    // Render connections first (they go behind regions)
    for conn in &input.connections {
        let color = Color::rgba(conn.r, conn.g, conn.b, conn.a);
        // Bresenham-style thick line (2px wide)
        let dx = (conn.to_x as i64) - (conn.from_x as i64);
        let dy = (conn.to_y as i64) - (conn.from_y as i64);
        let steps = dx.abs().max(dy.abs()).max(1);
        for i in 0..=steps {
            let t = i as f64 / steps as f64;
            let cx = conn.from_x as f64 + dx as f64 * t;
            let cy = conn.from_y as f64 + dy as f64 * t;
            // 2px wide line
            for ox in -1i32..=0 {
                for oy in -1i32..=0 {
                    let px_i = cx as i32 + ox;
                    let py_i = cy as i32 + oy;
                    if px_i < 0 || py_i < 0 { continue; }
                    let px = px_i as u32;
                    let py = py_i as u32;
                    if layer.buffer.in_bounds(px, py) {
                        layer.buffer.set_pixel(px, py, &color);
                        pixel_count += 1;
                    }
                }
            }
        }
    }

    // Render regions in z-order
    for region in &sorted_regions {
        let fill = Color::rgba(region.r, region.g, region.b, region.a);
        let has_outline = region.outline_r.is_some();
        let outline = if has_outline {
            Color::rgba(
                region.outline_r.unwrap_or(0),
                region.outline_g.unwrap_or(0),
                region.outline_b.unwrap_or(0),
                region.outline_a.unwrap_or(255),
            )
        } else {
            Color::TRANSPARENT
        };

        for ly in 0..region.height {
            for lx in 0..region.width {
                if !pixel_in_shape(lx, ly, region.width, region.height, &region.shape) {
                    continue;
                }
                let px_i = region.x + lx as i32;
                let py_i = region.y + ly as i32;
                if px_i < 0 || py_i < 0 {
                    continue;
                }
                let px = px_i as u32;
                let py = py_i as u32;
                if !layer.buffer.in_bounds(px, py) {
                    continue;
                }
                let color = if has_outline && on_outline(lx, ly, region.width, region.height, &region.shape) {
                    &outline
                } else {
                    &fill
                };
                layer.buffer.set_pixel(px, py, color);
                pixel_count += 1;
            }
        }
    }

    Ok(RenderTemplateResult {
        region_count: sorted_regions.len() as u32,
        connection_count: input.connections.len() as u32,
        pixel_count,
    })
}

// --- Helpers ---

pub fn build_frame(canvas: &CanvasState) -> CanvasFrame {
    CanvasFrame {
        width: canvas.width,
        height: canvas.height,
        data: canvas.composite_frame(),
        layers: canvas.layers.iter().map(|l| LayerInfo {
            id: l.id.clone(),
            name: l.name.clone(),
            visible: l.visible,
            locked: l.locked,
            opacity: l.opacity,
        }).collect(),
        active_layer_id: canvas.active_layer_id.clone(),
        can_undo: !canvas.undo_stack.is_empty(),
        can_redo: !canvas.redo_stack.is_empty(),
        undo_depth: canvas.undo_stack.len(),
        redo_depth: canvas.redo_stack.len(),
    }
}
