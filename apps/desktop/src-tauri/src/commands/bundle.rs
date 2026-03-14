use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::asset_catalog::AssetCatalog;
use crate::errors::AppError;
use crate::persistence::project_io;

use super::export::{ExportLayout, ManifestFormat};

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportBundleFormat {
    Folder,
    Zip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBundleContents {
    pub images: bool,
    pub manifest: bool,
    pub preview: bool,
}

impl Default for ExportBundleContents {
    fn default() -> Self {
        Self {
            images: true,
            manifest: true,
            preview: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BundleExportAction {
    Sequence,
    Sheet,
    AllClipsSheet,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundlePreviewFile {
    pub relative_path: String,
    pub file_type: String, // "image" | "manifest" | "preview"
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundlePreviewResult {
    pub files: Vec<BundlePreviewFile>,
    pub estimated_bytes: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBundleResult {
    pub output_path: String,
    pub format: String,
    pub files: Vec<String>,
    pub total_bytes: u64,
    pub was_suffixed: bool,
    pub warnings: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
}

fn resolve_collision(path: &std::path::Path) -> (std::path::PathBuf, bool) {
    if !path.exists() {
        return (path.to_path_buf(), false);
    }
    let stem = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = path.extension().map(|e| e.to_string_lossy().to_string());
    let parent = path.parent().unwrap_or(std::path::Path::new("."));
    for n in 2..=999 {
        let new_name = match &ext {
            Some(e) => format!("{}_{}.{}", stem, n, e),
            None => format!("{}_{}", stem, n),
        };
        let candidate = parent.join(&new_name);
        if !candidate.exists() {
            return (candidate, true);
        }
    }
    (path.to_path_buf(), false)
}

fn resolve_dir_collision(dir: &std::path::Path) -> (std::path::PathBuf, bool) {
    if !dir.exists() {
        return (dir.to_path_buf(), false);
    }
    let name = dir.file_name().unwrap_or_default().to_string_lossy().to_string();
    let parent = dir.parent().unwrap_or(std::path::Path::new("."));
    for n in 2..=999 {
        let candidate = parent.join(format!("{}_{}", name, n));
        if !candidate.exists() {
            return (candidate, true);
        }
    }
    (dir.to_path_buf(), false)
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

/// Nearest-neighbor downscale for preview thumbnails.
fn generate_thumbnail_bytes(data: &[u8], src_w: u32, src_h: u32, thumb_size: u32) -> Vec<u8> {
    let mut out = vec![0u8; (thumb_size * thumb_size * 4) as usize];
    for ty in 0..thumb_size {
        for tx in 0..thumb_size {
            let sx = ((tx as f64 / thumb_size as f64) * src_w as f64) as u32;
            let sy = ((ty as f64 / thumb_size as f64) * src_h as f64) as u32;
            let sx = sx.min(src_w.saturating_sub(1));
            let sy = sy.min(src_h.saturating_sub(1));
            let src_idx = ((sy * src_w + sx) * 4) as usize;
            let dst_idx = ((ty * thumb_size + tx) * 4) as usize;
            if src_idx + 3 < data.len() && dst_idx + 3 < out.len() {
                out[dst_idx..dst_idx + 4].copy_from_slice(&data[src_idx..src_idx + 4]);
            }
        }
    }
    out
}

/// Resolve clip frame indices (start..=end clamped to total).
fn resolve_clip_frame_indices(
    clip: &crate::engine::clip::Clip,
    total_frames: usize,
) -> Vec<usize> {
    if total_frames == 0 {
        return vec![];
    }
    let start = clip.start_frame.min(total_frames.saturating_sub(1));
    let end = clip.end_frame.min(total_frames.saturating_sub(1));
    (start..=end).collect()
}

/// Compute grid layout dimensions for a frame count.
fn compute_layout(
    layout: &ExportLayout,
    frame_count: usize,
    fw: u32,
    fh: u32,
) -> (u32, u32, u32, u32) {
    let count = frame_count as u32;
    let (cols, rows) = match layout {
        ExportLayout::HorizontalStrip => (count, 1),
        ExportLayout::VerticalStrip => (1, count),
        ExportLayout::Grid { columns } => {
            let c = columns.unwrap_or_else(|| {
                let sq = (count as f64).sqrt().ceil() as u32;
                sq.max(1)
            });
            let c = c.max(1).min(count);
            let r = (count + c - 1) / c;
            (c, r)
        }
    };
    (cols, rows, cols * fw, rows * fh)
}

/// Blit composited frames into a sheet buffer.
fn blit_to_sheet(
    canvas: &crate::engine::canvas_state::CanvasState,
    frame_indices: &[usize],
    cols: u32,
    fw: u32,
    fh: u32,
    sheet_w: u32,
    sheet_h: u32,
) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; (sheet_w * sheet_h * 4) as usize];
    for (i, &fi) in frame_indices.iter().enumerate() {
        let frame_data = canvas
            .composite_frame_at(fi)
            .ok_or_else(|| format!("Failed to composite frame {}", fi))?;
        let col = (i as u32) % cols;
        let row = (i as u32) / cols;
        let ox = col * fw;
        let oy = row * fh;
        for y in 0..fh {
            for x in 0..fw {
                let src = ((y * fw + x) * 4) as usize;
                let dst = (((oy + y) * sheet_w + (ox + x)) * 4) as usize;
                if src + 3 < frame_data.len() && dst + 3 < buf.len() {
                    buf[dst..dst + 4].copy_from_slice(&frame_data[src..src + 4]);
                }
            }
        }
    }
    Ok(buf)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Preview what an asset bundle will contain (authoritative file list).
#[command]
pub fn preview_asset_bundle(
    bundle_name: String,
    export_action: BundleExportAction,
    clip_id: Option<String>,
    _layout: ExportLayout,
    _manifest_format: Option<ManifestFormat>,
    contents: Option<ExportBundleContents>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<BundlePreviewResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let contents = contents.unwrap_or_default();
    let safe_name = sanitize_name(&bundle_name);
    let mut files = Vec::new();
    let mut warnings = Vec::new();

    match export_action {
        BundleExportAction::Sequence => {
            let clip = resolve_clip(canvas, clip_id.as_deref(), &mut warnings)?;
            let indices = resolve_clip_frame_indices(clip, canvas.frames.len());
            if indices.is_empty() {
                warnings.push("Clip has no valid frames".to_string());
            }
            if contents.images {
                let pad = format!("{}", indices.len()).len();
                let clip_safe = sanitize_name(&clip.name);
                for seq in 0..indices.len() {
                    files.push(BundlePreviewFile {
                        relative_path: format!(
                            "images/{}_{:0>width$}.png",
                            clip_safe,
                            seq + 1,
                            width = pad,
                        ),
                        file_type: "image".to_string(),
                    });
                }
            }
            if contents.manifest {
                files.push(BundlePreviewFile {
                    relative_path: format!("manifests/{}_manifest.json", sanitize_name(&clip.name)),
                    file_type: "manifest".to_string(),
                });
            }
        }
        BundleExportAction::Sheet => {
            let clip = resolve_clip(canvas, clip_id.as_deref(), &mut warnings)?;
            let indices = resolve_clip_frame_indices(clip, canvas.frames.len());
            if indices.is_empty() {
                warnings.push("Clip has no valid frames".to_string());
            }
            if contents.images {
                files.push(BundlePreviewFile {
                    relative_path: format!("images/{}.png", sanitize_name(&clip.name)),
                    file_type: "image".to_string(),
                });
            }
            if contents.manifest {
                files.push(BundlePreviewFile {
                    relative_path: format!("manifests/{}.json", sanitize_name(&clip.name)),
                    file_type: "manifest".to_string(),
                });
            }
        }
        BundleExportAction::AllClipsSheet => {
            let valid_clips: Vec<_> = canvas
                .clips
                .iter()
                .filter(|c| {
                    let idx = resolve_clip_frame_indices(c, canvas.frames.len());
                    !idx.is_empty()
                })
                .collect();
            if valid_clips.is_empty() {
                warnings.push("No valid clips to bundle".to_string());
            }
            if contents.images {
                files.push(BundlePreviewFile {
                    relative_path: format!("images/{}.png", safe_name),
                    file_type: "image".to_string(),
                });
            }
            if contents.manifest {
                files.push(BundlePreviewFile {
                    relative_path: format!("manifests/{}.json", safe_name),
                    file_type: "manifest".to_string(),
                });
            }
        }
    }

    if contents.preview {
        files.push(BundlePreviewFile {
            relative_path: "preview/thumbnail.png".to_string(),
            file_type: "preview".to_string(),
        });
    }

    Ok(BundlePreviewResult {
        files,
        estimated_bytes: 0,
        warnings,
    })
}

/// Export an asset bundle as a folder or zip.
#[command]
pub fn export_asset_bundle(
    output_path: String,
    bundle_name: String,
    format: ExportBundleFormat,
    export_action: BundleExportAction,
    clip_id: Option<String>,
    layout: ExportLayout,
    manifest_format: Option<ManifestFormat>,
    contents: Option<ExportBundleContents>,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<ExportBundleResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let contents = contents.unwrap_or_default();
    let safe_name = sanitize_name(&bundle_name);
    let fw = canvas.width;
    let fh = canvas.height;
    let manifest_fmt = manifest_format.unwrap_or_default();

    // Resolve bundle root directory
    let base_dir = std::path::Path::new(&output_path).join(&safe_name);
    let (bundle_dir, was_suffixed) = resolve_dir_collision(&base_dir);
    std::fs::create_dir_all(&bundle_dir).map_err(|e| AppError::Io(e))?;

    let images_dir = bundle_dir.join("images");
    let manifests_dir = bundle_dir.join("manifests");
    let preview_dir = bundle_dir.join("preview");

    let mut written_files = Vec::new();
    let mut warnings = Vec::new();
    let mut total_bytes: u64 = 0;

    match export_action {
        BundleExportAction::Sequence => {
            let clip = resolve_clip(canvas, clip_id.as_deref(), &mut warnings)?;
            let indices = resolve_clip_frame_indices(clip, canvas.frames.len());
            if indices.is_empty() {
                return Err(AppError::Internal("Clip has no valid frames to export".to_string()));
            }

            if contents.images {
                std::fs::create_dir_all(&images_dir).map_err(|e| AppError::Io(e))?;
                let clip_safe = sanitize_name(&clip.name);
                let pad = format!("{}", indices.len()).len();
                for (seq, &fi) in indices.iter().enumerate() {
                    let frame_data = canvas
                        .composite_frame_at(fi)
                        .ok_or_else(|| AppError::Internal(format!("Failed to composite frame {}", fi)))?;
                    let png_data = encode_png(&frame_data, fw, fh)
                        .map_err(|e| AppError::Internal(e))?;
                    let filename = format!("{}_{:0>width$}.png", clip_safe, seq + 1, width = pad);
                    let file_path = images_dir.join(&filename);
                    std::fs::write(&file_path, &png_data).map_err(|e| AppError::Io(e))?;
                    total_bytes += png_data.len() as u64;
                    written_files.push(file_path.to_string_lossy().to_string());
                }
            }

            if contents.manifest {
                std::fs::create_dir_all(&manifests_dir).map_err(|e| AppError::Io(e))?;
                let manifest = build_bundle_manifest(
                    &safe_name,
                    "sequence",
                    &[clip],
                    &[indices.len()],
                    fw,
                    fh,
                    None,
                    None,
                    &manifest_fmt,
                    super::export::package_info_from_canvas(canvas),
                );
                let manifest_path = manifests_dir.join(format!("{}_manifest.json", sanitize_name(&clip.name)));
                let json = serde_json::to_string_pretty(&manifest)
                    .map_err(|e| AppError::Internal(format!("JSON error: {}", e)))?;
                std::fs::write(&manifest_path, json.as_bytes()).map_err(|e| AppError::Io(e))?;
                total_bytes += json.len() as u64;
                written_files.push(manifest_path.to_string_lossy().to_string());
            }
        }
        BundleExportAction::Sheet => {
            let clip = resolve_clip(canvas, clip_id.as_deref(), &mut warnings)?;
            let indices = resolve_clip_frame_indices(clip, canvas.frames.len());
            if indices.is_empty() {
                return Err(AppError::Internal("Clip has no valid frames to export".to_string()));
            }

            let (cols, _rows, sheet_w, sheet_h) = compute_layout(&layout, indices.len(), fw, fh);

            if contents.images {
                std::fs::create_dir_all(&images_dir).map_err(|e| AppError::Io(e))?;
                let sheet_data = blit_to_sheet(canvas, &indices, cols, fw, fh, sheet_w, sheet_h)
                    .map_err(|e| AppError::Internal(e))?;
                let png_data = encode_png(&sheet_data, sheet_w, sheet_h)
                    .map_err(|e| AppError::Internal(e))?;
                let clip_safe = sanitize_name(&clip.name);
                let file_path = images_dir.join(format!("{}.png", clip_safe));
                std::fs::write(&file_path, &png_data).map_err(|e| AppError::Io(e))?;
                total_bytes += png_data.len() as u64;
                written_files.push(file_path.to_string_lossy().to_string());
            }

            if contents.manifest {
                std::fs::create_dir_all(&manifests_dir).map_err(|e| AppError::Io(e))?;
                let manifest = build_bundle_manifest(
                    &safe_name,
                    "sheet",
                    &[clip],
                    &[indices.len()],
                    fw,
                    fh,
                    Some(sheet_w),
                    Some(sheet_h),
                    &manifest_fmt,
                    super::export::package_info_from_canvas(canvas),
                );
                let manifest_path = manifests_dir.join(format!("{}.json", sanitize_name(&clip.name)));
                let json = serde_json::to_string_pretty(&manifest)
                    .map_err(|e| AppError::Internal(format!("JSON error: {}", e)))?;
                std::fs::write(&manifest_path, json.as_bytes()).map_err(|e| AppError::Io(e))?;
                total_bytes += json.len() as u64;
                written_files.push(manifest_path.to_string_lossy().to_string());
            }
        }
        BundleExportAction::AllClipsSheet => {
            let valid_clips: Vec<&crate::engine::clip::Clip> = canvas
                .clips
                .iter()
                .filter(|c| !resolve_clip_frame_indices(c, canvas.frames.len()).is_empty())
                .collect();

            if valid_clips.is_empty() {
                return Err(AppError::Internal("No valid clips to bundle".to_string()));
            }

            // Gather all frame indices across clips
            let mut all_indices = Vec::new();
            let mut clip_frame_counts = Vec::new();
            for clip in &valid_clips {
                let idx = resolve_clip_frame_indices(clip, canvas.frames.len());
                clip_frame_counts.push(idx.len());
                all_indices.extend(idx);
            }

            let (cols, _rows, sheet_w, sheet_h) = compute_layout(&layout, all_indices.len(), fw, fh);

            if contents.images {
                std::fs::create_dir_all(&images_dir).map_err(|e| AppError::Io(e))?;
                let sheet_data = blit_to_sheet(canvas, &all_indices, cols, fw, fh, sheet_w, sheet_h)
                    .map_err(|e| AppError::Internal(e))?;
                let png_data = encode_png(&sheet_data, sheet_w, sheet_h)
                    .map_err(|e| AppError::Internal(e))?;
                let file_path = images_dir.join(format!("{}.png", safe_name));
                std::fs::write(&file_path, &png_data).map_err(|e| AppError::Io(e))?;
                total_bytes += png_data.len() as u64;
                written_files.push(file_path.to_string_lossy().to_string());
            }

            if contents.manifest {
                std::fs::create_dir_all(&manifests_dir).map_err(|e| AppError::Io(e))?;
                let manifest = build_bundle_manifest(
                    &safe_name,
                    "all_clips_sheet",
                    &valid_clips,
                    &clip_frame_counts,
                    fw,
                    fh,
                    Some(sheet_w),
                    Some(sheet_h),
                    &manifest_fmt,
                    super::export::package_info_from_canvas(canvas),
                );
                let manifest_path = manifests_dir.join(format!("{}.json", safe_name));
                let json = serde_json::to_string_pretty(&manifest)
                    .map_err(|e| AppError::Internal(format!("JSON error: {}", e)))?;
                std::fs::write(&manifest_path, json.as_bytes()).map_err(|e| AppError::Io(e))?;
                total_bytes += json.len() as u64;
                written_files.push(manifest_path.to_string_lossy().to_string());
            }
        }
    }

    // Optional preview thumbnail
    if contents.preview {
        if let Some(frame_data) = canvas.composite_frame_at(0) {
            std::fs::create_dir_all(&preview_dir).map_err(|e| AppError::Io(e))?;
            let thumb = generate_thumbnail_bytes(&frame_data, fw, fh, 128);
            if let Ok(png_data) = encode_png(&thumb, 128, 128) {
                let thumb_path = preview_dir.join("thumbnail.png");
                if std::fs::write(&thumb_path, &png_data).is_ok() {
                    total_bytes += png_data.len() as u64;
                    written_files.push(thumb_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Zip if requested
    let (final_path, format_label) = match format {
        ExportBundleFormat::Folder => {
            (bundle_dir.to_string_lossy().to_string(), "folder")
        }
        ExportBundleFormat::Zip => {
            let zip_path_base = std::path::Path::new(&output_path)
                .join(format!("{}.zip", safe_name));
            let (zip_path, _) = resolve_collision(&zip_path_base);

            let zip_data = create_zip_from_dir(&bundle_dir)
                .map_err(|e| AppError::Internal(format!("Zip error: {}", e)))?;

            std::fs::write(&zip_path, &zip_data).map_err(|e| AppError::Io(e))?;
            total_bytes = zip_data.len() as u64;

            // Clean up the folder since we zipped it
            let _ = std::fs::remove_dir_all(&bundle_dir);

            written_files.clear();
            written_files.push(zip_path.to_string_lossy().to_string());

            (zip_path.to_string_lossy().to_string(), "zip")
        }
    };

    Ok(ExportBundleResult {
        output_path: final_path,
        format: format_label.to_string(),
        files: written_files,
        total_bytes,
        was_suffixed,
        warnings,
    })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn resolve_clip<'a>(
    canvas: &'a crate::engine::canvas_state::CanvasState,
    clip_id: Option<&str>,
    warnings: &mut Vec<String>,
) -> Result<&'a crate::engine::clip::Clip, AppError> {
    match clip_id {
        Some(id) => canvas
            .clips
            .iter()
            .find(|c| c.id == id)
            .ok_or_else(|| AppError::Internal(format!("Clip '{}' not found", id))),
        None => {
            if canvas.clips.is_empty() {
                return Err(AppError::Internal("No clips defined".to_string()));
            }
            warnings.push("No clip specified — using first clip".to_string());
            Ok(&canvas.clips[0])
        }
    }
}

/// Build a simple bundle manifest.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BundleManifest {
    name: String,
    export_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    package: Option<super::export::ManifestPackageInfo>,
    frame_width: u32,
    frame_height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    sheet_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sheet_height: Option<u32>,
    clips: Vec<BundleManifestClip>,
    generated_at: String,
    format: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BundleManifestClip {
    name: String,
    frame_count: usize,
    loop_clip: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    fps: Option<u32>,
    tags: Vec<String>,
}

fn build_bundle_manifest(
    name: &str,
    export_type: &str,
    clips: &[&crate::engine::clip::Clip],
    frame_counts: &[usize],
    fw: u32,
    fh: u32,
    sheet_w: Option<u32>,
    sheet_h: Option<u32>,
    format: &ManifestFormat,
    package_info: Option<super::export::ManifestPackageInfo>,
) -> BundleManifest {
    let format_label = match format {
        ManifestFormat::PixelstudioNative => "pixelstudio_native",
        ManifestFormat::GenericRuntime => "generic_runtime",
    };

    let manifest_clips: Vec<BundleManifestClip> = clips
        .iter()
        .zip(frame_counts)
        .map(|(clip, &count)| BundleManifestClip {
            name: clip.name.clone(),
            frame_count: count,
            loop_clip: clip.loop_clip,
            fps: clip.fps_override,
            tags: clip.tags.clone(),
        })
        .collect();

    BundleManifest {
        name: name.to_string(),
        export_type: export_type.to_string(),
        package: package_info,
        frame_width: fw,
        frame_height: fh,
        sheet_width: sheet_w,
        sheet_height: sheet_h,
        clips: manifest_clips,
        generated_at: chrono::Utc::now().to_rfc3339(),
        format: format_label.to_string(),
    }
}

/// Create a zip archive from a directory's contents.
fn create_zip_from_dir(dir: &std::path::Path) -> Result<Vec<u8>, String> {
    use std::io::{Read, Write};

    let buf = Vec::new();
    let cursor = std::io::Cursor::new(buf);
    let mut zip = zip::ZipWriter::new(cursor);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_dir_recursive(
        zip: &mut zip::ZipWriter<std::io::Cursor<Vec<u8>>>,
        base: &std::path::Path,
        current: &std::path::Path,
        options: zip::write::SimpleFileOptions,
    ) -> Result<(), String> {
        let entries = std::fs::read_dir(current)
            .map_err(|e| format!("read_dir error: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("dir entry error: {}", e))?;
            let path = entry.path();
            let rel = path
                .strip_prefix(base)
                .map_err(|e| format!("strip_prefix error: {}", e))?;
            let rel_str = rel.to_string_lossy().replace('\\', "/");

            if path.is_dir() {
                zip.add_directory(&format!("{}/", rel_str), options)
                    .map_err(|e| format!("zip add_directory error: {}", e))?;
                add_dir_recursive(zip, base, &path, options)?;
            } else {
                zip.start_file(&rel_str, options)
                    .map_err(|e| format!("zip start_file error: {}", e))?;
                let mut file = std::fs::File::open(&path)
                    .map_err(|e| format!("open file error: {}", e))?;
                let mut data = Vec::new();
                file.read_to_end(&mut data)
                    .map_err(|e| format!("read file error: {}", e))?;
                zip.write_all(&data)
                    .map_err(|e| format!("zip write error: {}", e))?;
            }
        }
        Ok(())
    }

    add_dir_recursive(&mut zip, dir, dir, options)?;

    let cursor = zip
        .finish()
        .map_err(|e| format!("zip finish error: {}", e))?;
    Ok(cursor.into_inner())
}

// ===========================================================================
// Catalog (multi-asset) bundle commands
// ===========================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogBundleAssetEntry {
    pub asset_id: String,
    pub asset_name: String,
    pub status: String, // "ok" | "missing" | "error"
    pub file_count: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogBundlePreviewResult {
    pub assets: Vec<CatalogBundleAssetEntry>,
    pub total_files: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogBundleExportResult {
    pub output_path: String,
    pub format: String,
    pub asset_count: usize,
    pub skipped_count: usize,
    pub files: Vec<String>,
    pub total_bytes: u64,
    pub was_suffixed: bool,
    pub warnings: Vec<String>,
}

/// Preview a catalog bundle — shows what each selected asset will contribute.
#[command]
pub fn preview_catalog_bundle(
    asset_ids: Vec<String>,
    include_manifest: Option<bool>,
    include_preview: Option<bool>,
) -> Result<CatalogBundlePreviewResult, AppError> {
    let catalog = AssetCatalog::load();
    let manifest = include_manifest.unwrap_or(true);
    let preview = include_preview.unwrap_or(false);

    let mut assets = Vec::new();
    let mut total_files = 0usize;
    let mut warnings = Vec::new();

    for id in &asset_ids {
        let entry = match catalog.find_by_id(id) {
            Some(e) => e,
            None => {
                assets.push(CatalogBundleAssetEntry {
                    asset_id: id.clone(),
                    asset_name: format!("Unknown ({})", &id[..8.min(id.len())]),
                    status: "missing".to_string(),
                    file_count: 0,
                    warnings: vec!["Asset not found in catalog".to_string()],
                });
                continue;
            }
        };

        let path = std::path::Path::new(&entry.file_path);
        if !path.exists() {
            assets.push(CatalogBundleAssetEntry {
                asset_id: id.clone(),
                asset_name: entry.name.clone(),
                status: "missing".to_string(),
                file_count: 0,
                warnings: vec![format!("File not found: {}", entry.file_path)],
            });
            continue;
        }

        // Load project to count exportable content
        match project_io::load_from_file(path) {
            Ok(doc) => {
                let canvas = doc.to_canvas_state();
                let mut file_count = 0usize;
                let mut asset_warnings = Vec::new();

                // Images: one sheet per valid clip, or one all_clips_sheet
                if canvas.clips.is_empty() {
                    // No clips: single frame export
                    file_count += 1;
                    asset_warnings.push("No clips defined — will export first frame only".to_string());
                } else {
                    // One sheet per clip
                    for clip in &canvas.clips {
                        let idx = resolve_clip_frame_indices(clip, canvas.frames.len());
                        if idx.is_empty() {
                            asset_warnings.push(format!("Clip '{}' has no valid frames", clip.name));
                        } else {
                            file_count += 1; // sheet image
                        }
                    }
                }

                if manifest && file_count > 0 {
                    file_count += 1; // manifest
                }
                if preview {
                    file_count += 1; // thumbnail
                }

                total_files += file_count;
                assets.push(CatalogBundleAssetEntry {
                    asset_id: id.clone(),
                    asset_name: entry.name.clone(),
                    status: "ok".to_string(),
                    file_count,
                    warnings: asset_warnings,
                });
            }
            Err(e) => {
                assets.push(CatalogBundleAssetEntry {
                    asset_id: id.clone(),
                    asset_name: entry.name.clone(),
                    status: "error".to_string(),
                    file_count: 0,
                    warnings: vec![format!("Failed to load project: {}", e)],
                });
            }
        }
    }

    // Check for missing/error blocking
    let missing_count = assets.iter().filter(|a| a.status != "ok").count();
    if missing_count > 0 {
        warnings.push(format!(
            "{} asset{} cannot be packaged (missing or invalid)",
            missing_count,
            if missing_count != 1 { "s" } else { "" },
        ));
    }

    Ok(CatalogBundlePreviewResult {
        assets,
        total_files,
        warnings,
    })
}

/// Export a catalog bundle — package multiple assets into one folder or zip.
#[command]
pub fn export_catalog_bundle(
    asset_ids: Vec<String>,
    output_path: String,
    bundle_name: String,
    format: ExportBundleFormat,
    include_manifest: Option<bool>,
    include_preview: Option<bool>,
    layout: ExportLayout,
    manifest_format: Option<ManifestFormat>,
) -> Result<CatalogBundleExportResult, AppError> {
    let catalog = AssetCatalog::load();
    let emit_manifest = include_manifest.unwrap_or(true);
    let emit_preview = include_preview.unwrap_or(false);
    let manifest_fmt = manifest_format.unwrap_or_default();
    let safe_bundle = sanitize_name(&bundle_name);

    // Validate: all selected assets must exist
    let mut resolved_assets = Vec::new();
    for id in &asset_ids {
        let entry = catalog
            .find_by_id(id)
            .ok_or_else(|| AppError::Internal(format!("Asset '{}' not found in catalog", id)))?;

        let path = std::path::Path::new(&entry.file_path);
        if !path.exists() {
            return Err(AppError::Internal(format!(
                "Asset '{}' file not found: {}",
                entry.name, entry.file_path,
            )));
        }

        resolved_assets.push((id.clone(), entry.name.clone(), entry.file_path.clone()));
    }

    if resolved_assets.is_empty() {
        return Err(AppError::Internal("No assets selected for packaging".to_string()));
    }

    // Create bundle root
    let base_dir = std::path::Path::new(&output_path).join(&safe_bundle);
    let (bundle_dir, was_suffixed) = resolve_dir_collision(&base_dir);
    std::fs::create_dir_all(&bundle_dir).map_err(|e| AppError::Io(e))?;

    let assets_dir = bundle_dir.join("assets");
    std::fs::create_dir_all(&assets_dir).map_err(|e| AppError::Io(e))?;

    let mut written_files = Vec::new();
    let mut total_bytes: u64 = 0;
    let mut warnings = Vec::new();
    let mut asset_count = 0usize;
    let mut skipped_count = 0usize;

    for (_id, name, file_path) in &resolved_assets {
        let path = std::path::Path::new(file_path);
        let doc = match project_io::load_from_file(path) {
            Ok(d) => d,
            Err(e) => {
                warnings.push(format!("Skipped '{}': {}", name, e));
                skipped_count += 1;
                continue;
            }
        };

        let canvas = doc.to_canvas_state();
        let fw = canvas.width;
        let fh = canvas.height;
        let safe_name = sanitize_name(name);

        // Per-asset subfolder
        let asset_dir = assets_dir.join(&safe_name);
        let (asset_dir, _) = resolve_dir_collision(&asset_dir);
        let images_dir = asset_dir.join("images");
        let manifests_dir = asset_dir.join("manifests");

        std::fs::create_dir_all(&images_dir).map_err(|e| AppError::Io(e))?;

        if canvas.clips.is_empty() {
            // No clips: export first frame as single image
            if let Some(frame_data) = canvas.composite_frame_at(0) {
                let png_data = encode_png(&frame_data, fw, fh)
                    .map_err(|e| AppError::Internal(e))?;
                let img_path = images_dir.join(format!("{}.png", safe_name));
                std::fs::write(&img_path, &png_data).map_err(|e| AppError::Io(e))?;
                total_bytes += png_data.len() as u64;
                written_files.push(img_path.to_string_lossy().to_string());
            }
            warnings.push(format!("'{}': no clips — exported first frame only", name));
        } else {
            // Export each valid clip as a sheet
            let valid_clips: Vec<&crate::engine::clip::Clip> = canvas
                .clips
                .iter()
                .filter(|c| !resolve_clip_frame_indices(c, canvas.frames.len()).is_empty())
                .collect();

            for clip in &valid_clips {
                let indices = resolve_clip_frame_indices(clip, canvas.frames.len());
                let (cols, _rows, sheet_w, sheet_h) = compute_layout(&layout, indices.len(), fw, fh);

                let sheet_data = blit_to_sheet(&canvas, &indices, cols, fw, fh, sheet_w, sheet_h)
                    .map_err(|e| AppError::Internal(e))?;
                let png_data = encode_png(&sheet_data, sheet_w, sheet_h)
                    .map_err(|e| AppError::Internal(e))?;
                let clip_safe = sanitize_name(&clip.name);
                let img_path = images_dir.join(format!("{}.png", clip_safe));
                std::fs::write(&img_path, &png_data).map_err(|e| AppError::Io(e))?;
                total_bytes += png_data.len() as u64;
                written_files.push(img_path.to_string_lossy().to_string());
            }

            // Write one manifest per asset with all clips
            if emit_manifest && !valid_clips.is_empty() {
                std::fs::create_dir_all(&manifests_dir).map_err(|e| AppError::Io(e))?;
                let clip_frame_counts: Vec<usize> = valid_clips
                    .iter()
                    .map(|c| resolve_clip_frame_indices(c, canvas.frames.len()).len())
                    .collect();
                let pkg_info = super::export::package_info_from_canvas(&canvas);

                let manifest = build_bundle_manifest(
                    &safe_name,
                    "catalog_bundle",
                    &valid_clips,
                    &clip_frame_counts,
                    fw,
                    fh,
                    None,
                    None,
                    &manifest_fmt,
                    pkg_info,
                );
                let manifest_path = manifests_dir.join(format!("{}.json", safe_name));
                let json = serde_json::to_string_pretty(&manifest)
                    .map_err(|e| AppError::Internal(format!("JSON error: {}", e)))?;
                std::fs::write(&manifest_path, json.as_bytes()).map_err(|e| AppError::Io(e))?;
                total_bytes += json.len() as u64;
                written_files.push(manifest_path.to_string_lossy().to_string());
            }
        }

        // Optional preview thumbnail
        if emit_preview {
            if let Some(frame_data) = canvas.composite_frame_at(0) {
                let preview_dir = asset_dir.join("preview");
                std::fs::create_dir_all(&preview_dir).map_err(|e| AppError::Io(e))?;
                let thumb = generate_thumbnail_bytes(&frame_data, fw, fh, 128);
                if let Ok(png_data) = encode_png(&thumb, 128, 128) {
                    let thumb_path = preview_dir.join("thumbnail.png");
                    if std::fs::write(&thumb_path, &png_data).is_ok() {
                        total_bytes += png_data.len() as u64;
                        written_files.push(thumb_path.to_string_lossy().to_string());
                    }
                }
            }
        }

        asset_count += 1;
    }

    // Zip if requested
    let (final_path, format_label) = match format {
        ExportBundleFormat::Folder => {
            (bundle_dir.to_string_lossy().to_string(), "folder")
        }
        ExportBundleFormat::Zip => {
            let zip_path_base = std::path::Path::new(&output_path)
                .join(format!("{}.zip", safe_bundle));
            let (zip_path, _) = resolve_collision(&zip_path_base);

            let zip_data = create_zip_from_dir(&bundle_dir)
                .map_err(|e| AppError::Internal(format!("Zip error: {}", e)))?;

            std::fs::write(&zip_path, &zip_data).map_err(|e| AppError::Io(e))?;
            total_bytes = zip_data.len() as u64;

            let _ = std::fs::remove_dir_all(&bundle_dir);

            written_files.clear();
            written_files.push(zip_path.to_string_lossy().to_string());

            (zip_path.to_string_lossy().to_string(), "zip")
        }
    };

    Ok(CatalogBundleExportResult {
        output_path: final_path,
        format: format_label.to_string(),
        asset_count,
        skipped_count,
        files: written_files,
        total_bytes,
        was_suffixed,
        warnings,
    })
}
