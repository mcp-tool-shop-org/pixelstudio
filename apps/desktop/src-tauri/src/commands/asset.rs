use tauri::{command, State};

use crate::engine::asset_catalog::{
    AssetCatalog, AssetCatalogEntry, AssetKind, AssetSummary,
};
use crate::engine::canvas_state::ManagedCanvasState;
use crate::errors::AppError;

/// List all assets in the catalog, with file existence checks.
#[command]
pub fn list_assets() -> Result<Vec<AssetSummary>, AppError> {
    let catalog = AssetCatalog::load();
    Ok(catalog.entries.iter().map(|e| e.to_summary()).collect())
}

/// Get a single asset catalog entry by ID.
#[command]
pub fn get_asset_catalog_entry(asset_id: String) -> Result<AssetSummary, AppError> {
    let catalog = AssetCatalog::load();
    let entry = catalog
        .find_by_id(&asset_id)
        .ok_or_else(|| AppError::Internal(format!("Asset '{}' not found in catalog", asset_id)))?;
    Ok(entry.to_summary())
}

/// Insert or update an asset catalog entry.
#[command]
pub fn upsert_asset_catalog_entry(
    id: Option<String>,
    name: String,
    file_path: String,
    kind: AssetKind,
    tags: Option<Vec<String>>,
    canvas_width: Option<u32>,
    canvas_height: Option<u32>,
    frame_count: Option<usize>,
    clip_count: Option<usize>,
    thumbnail_path: Option<String>,
) -> Result<AssetSummary, AppError> {
    let mut catalog = AssetCatalog::load();

    let now = chrono::Utc::now().to_rfc3339();
    let resolved_id = id
        .or_else(|| catalog.find_by_path(&file_path).map(|e| e.id.clone()))
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let created_at = catalog
        .find_by_id(&resolved_id)
        .map(|e| e.created_at.clone())
        .unwrap_or_else(|| now.clone());

    let entry = AssetCatalogEntry {
        id: resolved_id,
        name,
        file_path,
        kind,
        tags: tags.unwrap_or_default(),
        created_at,
        updated_at: now,
        canvas_width: canvas_width.unwrap_or(0),
        canvas_height: canvas_height.unwrap_or(0),
        frame_count: frame_count.unwrap_or(0),
        clip_count: clip_count.unwrap_or(0),
        thumbnail_path,
    };

    let summary = entry.to_summary();
    catalog.upsert(entry);
    catalog.save().map_err(|e| AppError::Internal(e))?;

    Ok(summary)
}

/// Remove an asset from the catalog by ID. Does NOT delete the project file.
#[command]
pub fn remove_asset_catalog_entry(asset_id: String) -> Result<bool, AppError> {
    let mut catalog = AssetCatalog::load();
    let removed = catalog.remove(&asset_id);
    if removed {
        catalog.save().map_err(|e| AppError::Internal(e))?;
    }
    Ok(removed)
}

/// Refresh the catalog — re-check file existence for all entries.
/// Returns updated summaries.
#[command]
pub fn refresh_asset_catalog() -> Result<Vec<AssetSummary>, AppError> {
    let catalog = AssetCatalog::load();
    Ok(catalog.entries.iter().map(|e| e.to_summary()).collect())
}

/// Generate a thumbnail for the currently open project and store it in app data.
/// Returns the thumbnail file path.
#[command]
pub fn generate_asset_thumbnail(
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<String, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let frame_data = canvas
        .composite_frame_at(0)
        .ok_or_else(|| AppError::Internal("No frames to thumbnail".to_string()))?;

    let thumb = generate_thumbnail_bytes(&frame_data, canvas.width, canvas.height, 64);
    let thumb_path = thumbnail_path_for_canvas(canvas);

    if let Some(parent) = thumb_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
    }

    let png = encode_png(&thumb, 64, 64).map_err(|e| AppError::Internal(e))?;
    std::fs::write(&thumb_path, &png).map_err(|e| AppError::Io(e))?;

    Ok(thumb_path.to_string_lossy().to_string())
}

// --- Internal helpers ---

/// Thumbnails directory under app data.
fn thumbnails_dir() -> std::path::PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("GlyphStudio").join("thumbnails")
}

/// Deterministic thumbnail path for a canvas (based on first frame ID).
fn thumbnail_path_for_canvas(canvas: &crate::engine::canvas_state::CanvasState) -> std::path::PathBuf {
    let id = if !canvas.frames.is_empty() {
        &canvas.frames[0].id
    } else {
        "empty"
    };
    // Use first 16 chars of frame ID to keep filenames reasonable
    let safe_id: String = id.chars().filter(|c| c.is_alphanumeric() || *c == '-').take(16).collect();
    thumbnails_dir().join(format!("{}.png", safe_id))
}

/// Generate a thumbnail from the current project state.
/// Returns the path if successful, None on failure.
pub fn generate_thumbnail_for_project(
    canvas: &crate::engine::canvas_state::CanvasState,
) -> Option<String> {
    let frame_data = canvas.composite_frame_at(0)?;
    let thumb = generate_thumbnail_bytes(&frame_data, canvas.width, canvas.height, 64);
    let thumb_path = thumbnail_path_for_canvas(canvas);

    if let Some(parent) = thumb_path.parent() {
        std::fs::create_dir_all(parent).ok()?;
    }

    let png = encode_png(&thumb, 64, 64).ok()?;
    std::fs::write(&thumb_path, &png).ok()?;

    Some(thumb_path.to_string_lossy().to_string())
}

/// Nearest-neighbor downscale to a square thumbnail.
fn generate_thumbnail_bytes(data: &[u8], src_w: u32, src_h: u32, thumb_size: u32) -> Vec<u8> {
    let mut out = vec![0u8; (thumb_size * thumb_size * 4) as usize];

    for ty in 0..thumb_size {
        for tx in 0..thumb_size {
            let sx = (tx as f64 / thumb_size as f64 * src_w as f64) as u32;
            let sy = (ty as f64 / thumb_size as f64 * src_h as f64) as u32;
            let sx = sx.min(src_w - 1);
            let sy = sy.min(src_h - 1);

            let src_idx = ((sy * src_w + sx) * 4) as usize;
            let dst_idx = ((ty * thumb_size + tx) * 4) as usize;

            if src_idx + 3 < data.len() && dst_idx + 3 < out.len() {
                out[dst_idx] = data[src_idx];
                out[dst_idx + 1] = data[src_idx + 1];
                out[dst_idx + 2] = data[src_idx + 2];
                out[dst_idx + 3] = data[src_idx + 3];
            }
        }
    }

    out
}

fn encode_png(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(std::io::Cursor::new(&mut buf), width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header error: {}", e))?;
        writer
            .write_image_data(data)
            .map_err(|e| format!("PNG write error: {}", e))?;
    }
    Ok(buf)
}
