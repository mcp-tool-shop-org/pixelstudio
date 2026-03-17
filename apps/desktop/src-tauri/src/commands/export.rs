use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta};
use crate::errors::AppError;

// --- Export preview types ---

/// What frames to include in the export.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExportScope {
    /// Just the current frame.
    CurrentFrame,
    /// A user-defined span of frames (start..=end, 0-based).
    SelectedSpan { start: usize, end: usize },
    /// A single clip by ID.
    #[serde(rename_all = "camelCase")]
    CurrentClip { clip_id: String },
    /// All clips in project order.
    AllClips,
}

/// How to arrange frames in the output image.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExportLayout {
    HorizontalStrip,
    VerticalStrip,
    /// Grid with optional column count. None = auto square-ish.
    Grid { columns: Option<u32> },
}

/// Where a single frame lands in the output image.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewFramePlacement {
    /// Index into the project frame list (0-based).
    pub frame_index: usize,
    pub frame_id: String,
    /// Position in the output image (pixels).
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Grouping metadata when exporting clips.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewClipGroup {
    pub clip_id: String,
    pub clip_name: String,
    pub start_frame: usize,
    pub end_frame: usize,
    pub frame_count: usize,
    /// Index of the first placement in the placements array belonging to this clip.
    pub placement_offset: usize,
}

/// Full layout preview result — authoritative for later export.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewResult {
    /// Total output image dimensions.
    pub output_width: u32,
    pub output_height: u32,
    /// Source frame dimensions.
    pub frame_width: u32,
    pub frame_height: u32,
    /// Total frames in export.
    pub frame_count: usize,
    /// Grid dimensions (1×N for strips).
    pub columns: u32,
    pub rows: u32,
    /// Per-frame placement rects.
    pub placements: Vec<ExportPreviewFramePlacement>,
    /// Clip grouping info (empty for non-clip scopes).
    pub clip_groups: Vec<ExportPreviewClipGroup>,
    /// Warnings (invalid ranges, oversized output, etc.).
    pub warnings: Vec<String>,
}

// --- Layout helpers ---

/// Compute auto grid dimensions: aim for square-ish, prefer wider.
fn auto_grid(count: u32) -> (u32, u32) {
    if count == 0 {
        return (0, 0);
    }
    let cols = (count as f64).sqrt().ceil() as u32;
    let rows = (count + cols - 1) / cols;
    (cols, rows)
}

/// Build placements for a flat list of frame indices.
fn build_placements(
    frame_indices: &[(usize, String)],
    layout: &ExportLayout,
    fw: u32,
    fh: u32,
) -> (Vec<ExportPreviewFramePlacement>, u32, u32, u32, u32) {
    let count = frame_indices.len() as u32;
    if count == 0 {
        return (Vec::new(), 0, 0, 0, 0);
    }

    let (cols, rows) = match layout {
        ExportLayout::HorizontalStrip => (count, 1),
        ExportLayout::VerticalStrip => (1, count),
        ExportLayout::Grid { columns } => {
            if let Some(c) = columns {
                let c = (*c).max(1).min(count);
                let r = (count + c - 1) / c;
                (c, r)
            } else {
                auto_grid(count)
            }
        }
    };

    let out_w = cols * fw;
    let out_h = rows * fh;

    let placements: Vec<ExportPreviewFramePlacement> = frame_indices
        .iter()
        .enumerate()
        .map(|(i, (frame_idx, frame_id))| {
            let col = (i as u32) % cols;
            let row = (i as u32) / cols;
            ExportPreviewFramePlacement {
                frame_index: *frame_idx,
                frame_id: frame_id.clone(),
                x: col * fw,
                y: row * fh,
                width: fw,
                height: fh,
            }
        })
        .collect();

    (placements, out_w, out_h, cols, rows)
}

// --- Command ---

/// Preview sprite sheet layout without writing any files.
/// Returns deterministic layout info for the chosen scope/layout.
#[command]
pub fn preview_sprite_sheet_layout(
    scope: ExportScope,
    layout: ExportLayout,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<ExportPreviewResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let fw = canvas.width;
    let fh = canvas.height;
    let total_frames = canvas.frames.len();
    let mut warnings: Vec<String> = Vec::new();

    // Resolve frame indices from scope
    let (frame_indices, clip_groups) = match &scope {
        ExportScope::CurrentFrame => {
            let idx = canvas.active_frame_index;
            let id = canvas.frames[idx].id.clone();
            (vec![(idx, id)], Vec::new())
        }

        ExportScope::SelectedSpan { start, end } => {
            let s = *start;
            let e = *end;
            if s >= total_frames {
                warnings.push(format!("Start frame {} exceeds total frames {}", s, total_frames));
            }
            if e >= total_frames {
                warnings.push(format!("End frame {} exceeds total frames {}", e, total_frames));
            }
            if s > e {
                warnings.push(format!("Start frame {} is after end frame {}", s, e));
            }
            let clamped_s = s.min(total_frames.saturating_sub(1));
            let clamped_e = e.min(total_frames.saturating_sub(1));
            let indices: Vec<(usize, String)> = if clamped_s <= clamped_e {
                (clamped_s..=clamped_e)
                    .map(|i| (i, canvas.frames[i].id.clone()))
                    .collect()
            } else {
                Vec::new()
            };
            (indices, Vec::new())
        }

        ExportScope::CurrentClip { clip_id } => {
            let clip = canvas.clips.iter().find(|c| c.id == *clip_id);
            match clip {
                None => {
                    warnings.push("Selected clip not found".to_string());
                    (Vec::new(), Vec::new())
                }
                Some(clip) => {
                    let clip_warnings = clip.validate(total_frames);
                    warnings.extend(clip_warnings);

                    let s = clip.start_frame.min(total_frames.saturating_sub(1));
                    let e = clip.end_frame.min(total_frames.saturating_sub(1));
                    let indices: Vec<(usize, String)> = if s <= e {
                        (s..=e).map(|i| (i, canvas.frames[i].id.clone())).collect()
                    } else {
                        Vec::new()
                    };

                    let group = ExportPreviewClipGroup {
                        clip_id: clip.id.clone(),
                        clip_name: clip.name.clone(),
                        start_frame: clip.start_frame,
                        end_frame: clip.end_frame,
                        frame_count: indices.len(),
                        placement_offset: 0,
                    };
                    (indices, vec![group])
                }
            }
        }

        ExportScope::AllClips => {
            if canvas.clips.is_empty() {
                warnings.push("No clips defined".to_string());
                (Vec::new(), Vec::new())
            } else {
                // Preserve project clip order (creation order).
                let mut all_indices: Vec<(usize, String)> = Vec::new();
                let mut groups: Vec<ExportPreviewClipGroup> = Vec::new();

                for clip in &canvas.clips {
                    let clip_warnings = clip.validate(total_frames);
                    for w in &clip_warnings {
                        warnings.push(format!("Clip '{}': {}", clip.name, w));
                    }

                    let s = clip.start_frame.min(total_frames.saturating_sub(1));
                    let e = clip.end_frame.min(total_frames.saturating_sub(1));
                    let offset = all_indices.len();

                    let indices: Vec<(usize, String)> = if s <= e && clip_warnings.is_empty() {
                        (s..=e).map(|i| (i, canvas.frames[i].id.clone())).collect()
                    } else if s <= e {
                        // Still include frames even with warnings (warn, don't block)
                        (s..=e).map(|i| (i, canvas.frames[i].id.clone())).collect()
                    } else {
                        Vec::new()
                    };

                    groups.push(ExportPreviewClipGroup {
                        clip_id: clip.id.clone(),
                        clip_name: clip.name.clone(),
                        start_frame: clip.start_frame,
                        end_frame: clip.end_frame,
                        frame_count: indices.len(),
                        placement_offset: offset,
                    });

                    all_indices.extend(indices);
                }

                (all_indices, groups)
            }
        }
    };

    if frame_indices.is_empty() && warnings.is_empty() {
        warnings.push("Empty scope — no frames to export".to_string());
    }

    let (placements, out_w, out_h, cols, rows) =
        build_placements(&frame_indices, &layout, fw, fh);

    // Warn on oversized output (>16384 in either dimension)
    if out_w > 16384 || out_h > 16384 {
        warnings.push(format!(
            "Output dimensions {}x{} exceed 16384px — some tools may not support this",
            out_w, out_h
        ));
    }

    Ok(ExportPreviewResult {
        output_width: out_w,
        output_height: out_h,
        frame_width: fw,
        frame_height: fh,
        frame_count: frame_indices.len(),
        columns: cols,
        rows,
        placements,
        clip_groups,
        warnings,
    })
}

// ==========================================================================
// Export result types
// ==========================================================================

/// Manifest format selection.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ManifestFormat {
    #[default]
    GlyphstudioNative,
    GenericRuntime,
}

/// Summary of a concrete export operation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// Files written to disk.
    pub files: Vec<ExportedFileInfo>,
    /// Manifest file info (if requested).
    pub manifest: Option<ExportedFileInfo>,
    /// Total frames exported.
    pub frame_count: usize,
    /// Total clips exported.
    pub clip_count: usize,
    /// Number of invalid clips skipped (for all-clips export).
    pub skipped_clips: usize,
    /// Whether any filenames were suffixed to avoid overwrite.
    pub was_suffixed: bool,
    /// Warnings encountered during export.
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedFileInfo {
    pub path: String,
    pub width: u32,
    pub height: u32,
}

/// Package identity block embedded in manifests.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPackageInfo {
    #[serde(skip_serializing_if = "String::is_empty")]
    pub package_name: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub version: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub author: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub description: String,
}

/// Manifest data written as JSON alongside exported assets.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifest {
    pub name: String,
    #[serde(rename = "type")]
    pub export_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package: Option<ManifestPackageInfo>,
    pub frame_width: u32,
    pub frame_height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sheet_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sheet_height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<u32>,
    pub clips: Vec<ManifestClip>,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestClip {
    pub name: String,
    pub loop_clip: bool,
    pub fps: Option<u32>,
    pub frame_count: usize,
    /// Pivot point in pixel coordinates (if set).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pivot: Option<ManifestPivot>,
    /// Runtime tags for grouping/filtering.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// For sequences: file names. For sheets: placement rects.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub placements: Vec<ManifestPlacement>,
}

/// Resolved pivot in the manifest — always concrete pixel coordinates.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPivot {
    pub x: f64,
    pub y: f64,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPlacement {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

// --- Generic runtime manifest (lean) ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericRuntimeManifest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package: Option<ManifestPackageInfo>,
    pub frame_width: u32,
    pub frame_height: u32,
    pub clips: Vec<GenericRuntimeClip>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericRuntimeClip {
    pub name: String,
    pub start: usize,
    pub count: usize,
    #[serde(rename = "loop")]
    pub loop_clip: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<u32>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pivot: Option<ManifestPivot>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub placements: Vec<ManifestPlacement>,
}

// --- Manifest formatter layer ---

/// Shared data needed to build any manifest format.
struct ManifestInput<'a> {
    name: String,
    export_type: String,
    image_filename: Option<String>,
    frame_width: u32,
    frame_height: u32,
    sheet_width: Option<u32>,
    sheet_height: Option<u32>,
    columns: Option<u32>,
    rows: Option<u32>,
    clips: &'a [&'a crate::engine::clip::Clip],
    clip_frame_counts: Vec<usize>,
    clip_start_indices: Vec<usize>,
    clip_files: Vec<Vec<String>>,
    clip_placements: Vec<Vec<ManifestPlacement>>,
    package_info: Option<ManifestPackageInfo>,
}

/// Build a ManifestPackageInfo from canvas PackageMetadata (skips if empty).
pub fn package_info_from_canvas(
    canvas: &crate::engine::canvas_state::CanvasState,
) -> Option<ManifestPackageInfo> {
    let m = &canvas.package_metadata;
    if m.package_name.is_empty() && m.version == "0.1.0" && m.author.is_empty() && m.description.is_empty() {
        return None;
    }
    Some(ManifestPackageInfo {
        package_name: m.package_name.clone(),
        version: m.version.clone(),
        author: m.author.clone(),
        description: m.description.clone(),
    })
}

fn format_manifest(input: &ManifestInput, format: &ManifestFormat, fw: u32, fh: u32) -> Result<String, String> {
    match format {
        ManifestFormat::GlyphstudioNative => {
            let manifest = ExportManifest {
                name: input.name.clone(),
                export_type: input.export_type.clone(),
                package: input.package_info.clone(),
                frame_width: input.frame_width,
                frame_height: input.frame_height,
                sheet_width: input.sheet_width,
                sheet_height: input.sheet_height,
                columns: input.columns,
                rows: input.rows,
                clips: input.clips.iter().enumerate().map(|(i, clip)| {
                    ManifestClip {
                        name: clip.name.clone(),
                        loop_clip: clip.loop_clip,
                        fps: clip.fps_override,
                        frame_count: input.clip_frame_counts[i],
                        pivot: resolve_manifest_pivot(clip, fw, fh),
                        tags: clip.tags.clone(),
                        files: input.clip_files[i].clone(),
                        placements: input.clip_placements[i].clone(),
                    }
                }).collect(),
                generated_at: chrono::Utc::now().to_rfc3339(),
            };
            serde_json::to_string_pretty(&manifest).map_err(|e| format!("Manifest serialization failed: {}", e))
        }
        ManifestFormat::GenericRuntime => {
            let manifest = GenericRuntimeManifest {
                image: input.image_filename.clone(),
                package: input.package_info.clone(),
                frame_width: input.frame_width,
                frame_height: input.frame_height,
                clips: input.clips.iter().enumerate().map(|(i, clip)| {
                    GenericRuntimeClip {
                        name: clip.name.clone(),
                        start: input.clip_start_indices[i],
                        count: input.clip_frame_counts[i],
                        loop_clip: clip.loop_clip,
                        fps: clip.fps_override,
                        tags: clip.tags.clone(),
                        pivot: resolve_manifest_pivot(clip, fw, fh),
                        files: input.clip_files[i].clone(),
                        placements: input.clip_placements[i].clone(),
                    }
                }).collect(),
            };
            serde_json::to_string_pretty(&manifest).map_err(|e| format!("Manifest serialization failed: {}", e))
        }
    }
}

// ==========================================================================
// PNG encoding helper (matches project.rs)
// ==========================================================================

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

/// Sanitize a clip name for use in file paths.
fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
}

/// Find a non-colliding path by appending _2, _3, etc. before the extension.
/// Returns (resolved_path, was_suffixed).
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
    // Extremely unlikely — give up and let overwrite happen
    (path.to_path_buf(), false)
}

/// Find a non-colliding directory path by appending _2, _3, etc.
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

/// Resolve a clip's pivot to ManifestPivot (if set).
fn resolve_manifest_pivot(
    clip: &crate::engine::clip::Clip,
    fw: u32,
    fh: u32,
) -> Option<ManifestPivot> {
    clip.pivot.as_ref().map(|p| {
        let resolved = p.resolve(fw, fh);
        let mode_str = match p.mode {
            crate::engine::clip::PivotMode::Center => "center",
            crate::engine::clip::PivotMode::BottomCenter => "bottom_center",
            crate::engine::clip::PivotMode::Custom => "custom",
        };
        ManifestPivot {
            x: resolved.x,
            y: resolved.y,
            mode: mode_str.to_string(),
        }
    })
}

/// Resolve frame indices for a single clip, returning warnings.
fn resolve_clip_frames(
    clip: &crate::engine::clip::Clip,
    total_frames: usize,
) -> (Vec<usize>, Vec<String>) {
    let mut warnings = Vec::new();
    let clip_warnings = clip.validate(total_frames);
    warnings.extend(clip_warnings.iter().map(|w| format!("Clip '{}': {}", clip.name, w)));

    let s = clip.start_frame.min(total_frames.saturating_sub(1));
    let e = clip.end_frame.min(total_frames.saturating_sub(1));
    let indices: Vec<usize> = if s <= e {
        (s..=e).collect()
    } else {
        Vec::new()
    };
    (indices, warnings)
}

/// Composite and blit frames onto a sheet buffer using placement rects.
fn blit_frames_to_sheet(
    canvas: &crate::engine::canvas_state::CanvasState,
    placements: &[ExportPreviewFramePlacement],
    sheet_w: usize,
    sheet_h: usize,
) -> Vec<u8> {
    let fw = canvas.width as usize;
    let fh = canvas.height as usize;
    let mut sheet = vec![0u8; sheet_w * sheet_h * 4];

    for p in placements {
        let frame_data = match canvas.composite_frame_at(p.frame_index) {
            Some(d) => d,
            None => continue,
        };
        let ox = p.x as usize;
        let oy = p.y as usize;
        for y in 0..fh {
            for x in 0..fw {
                let src_i = (y * fw + x) * 4;
                let dst_i = ((oy + y) * sheet_w + (ox + x)) * 4;
                sheet[dst_i..dst_i + 4].copy_from_slice(&frame_data[src_i..src_i + 4]);
            }
        }
    }
    sheet
}

// ==========================================================================
// Export commands
// ==========================================================================

/// Export a single clip as a numbered PNG sequence.
#[command]
pub fn export_clip_sequence(
    clip_id: String,
    dir_path: String,
    canvas_state: State<'_, ManagedCanvasState>,
    _project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ExportResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let clip = canvas
        .clips
        .iter()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    let total = canvas.frames.len();
    let (indices, warnings) = resolve_clip_frames(clip, total);

    if indices.is_empty() {
        return Err(AppError::Internal("Clip has no valid frames to export".to_string()));
    }

    let base_dir = std::path::Path::new(&dir_path);
    let (dir, dir_suffixed) = resolve_dir_collision(base_dir);
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e))?;

    let safe_name = sanitize_name(&clip.name);
    let pad_width = format!("{}", indices.len()).len();
    let fw = canvas.width;
    let fh = canvas.height;

    let mut files = Vec::new();
    let mut was_suffixed = dir_suffixed;
    for (seq, &frame_idx) in indices.iter().enumerate() {
        let frame_data = canvas
            .composite_frame_at(frame_idx)
            .ok_or_else(|| AppError::Internal(format!("Failed to composite frame {}", frame_idx)))?;

        let filename = format!("{}_{:0>width$}.png", safe_name, seq + 1, width = pad_width);
        let base_path = dir.join(&filename);
        let (file_path, file_suffixed) = resolve_collision(&base_path);
        if file_suffixed { was_suffixed = true; }

        let png_data = encode_png(&frame_data, fw, fh).map_err(|e| AppError::Internal(e))?;
        std::fs::write(&file_path, &png_data).map_err(|e| AppError::Io(e))?;

        files.push(ExportedFileInfo {
            path: file_path.to_string_lossy().to_string(),
            width: fw,
            height: fh,
        });
    }

    Ok(ExportResult {
        files,
        manifest: None,
        frame_count: indices.len(),
        clip_count: 1,
        skipped_clips: 0,
        was_suffixed,
        warnings,
    })
}

/// Export a single clip as a sprite sheet (strip or grid).
#[command]
pub fn export_clip_sheet(
    clip_id: String,
    file_path: String,
    layout: ExportLayout,
    emit_manifest: Option<bool>,
    manifest_format: Option<ManifestFormat>,
    canvas_state: State<'_, ManagedCanvasState>,
    _project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ExportResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let clip = canvas
        .clips
        .iter()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    let total = canvas.frames.len();
    let (indices, mut warnings) = resolve_clip_frames(clip, total);

    if indices.is_empty() {
        return Err(AppError::Internal("Clip has no valid frames to export".to_string()));
    }

    let fw = canvas.width;
    let fh = canvas.height;

    let frame_pairs: Vec<(usize, String)> = indices
        .iter()
        .map(|&i| (i, canvas.frames[i].id.clone()))
        .collect();

    let (placements, out_w, out_h, cols, rows) = build_placements(&frame_pairs, &layout, fw, fh);

    if out_w > 16384 || out_h > 16384 {
        warnings.push(format!(
            "Output dimensions {}x{} exceed 16384px — some tools may not support this",
            out_w, out_h
        ));
    }

    let sheet_data = blit_frames_to_sheet(canvas, &placements, out_w as usize, out_h as usize);

    let base_path = std::path::Path::new(&file_path);
    if let Some(parent) = base_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
    }
    let (path, was_suffixed) = resolve_collision(base_path);

    let png_data = encode_png(&sheet_data, out_w, out_h).map_err(|e| AppError::Internal(e))?;
    std::fs::write(&path, &png_data).map_err(|e| AppError::Io(e))?;

    let mut files = vec![ExportedFileInfo {
        path: path.to_string_lossy().to_string(),
        width: out_w,
        height: out_h,
    }];

    // Optional manifest
    let manifest_info = if emit_manifest.unwrap_or(false) {
        let fmt = manifest_format.unwrap_or_default();
        let image_name = path.file_name().map(|f| f.to_string_lossy().to_string());
        let clip_placements: Vec<ManifestPlacement> = placements
            .iter()
            .map(|p| ManifestPlacement { x: p.x, y: p.y, w: p.width, h: p.height })
            .collect();
        let input = ManifestInput {
            name: clip.name.clone(),
            export_type: "clip_sheet".to_string(),
            image_filename: image_name,
            frame_width: fw,
            frame_height: fh,
            sheet_width: Some(out_w),
            sheet_height: Some(out_h),
            columns: Some(cols),
            rows: Some(rows),
            clips: &[clip],
            clip_frame_counts: vec![indices.len()],
            clip_start_indices: vec![0],
            clip_files: vec![Vec::new()],
            clip_placements: vec![clip_placements],
            package_info: package_info_from_canvas(canvas),
        };
        let manifest_json = format_manifest(&input, &fmt, fw, fh)
            .map_err(|e| AppError::Internal(e))?;

        let manifest_base = path.with_extension("json");
        let (manifest_path, _) = resolve_collision(&manifest_base);
        std::fs::write(&manifest_path, &manifest_json).map_err(|e| AppError::Io(e))?;

        let info = ExportedFileInfo {
            path: manifest_path.to_string_lossy().to_string(),
            width: 0,
            height: 0,
        };
        files.push(info.clone());
        Some(info)
    } else {
        None
    };

    Ok(ExportResult {
        files,
        manifest: manifest_info,
        frame_count: indices.len(),
        clip_count: 1,
        skipped_clips: 0,
        was_suffixed,
        warnings,
    })
}

/// Export all clips into a single combined sprite sheet.
/// Clip order matches project clip order (same as preview).
#[command]
pub fn export_all_clips_sheet(
    file_path: String,
    layout: ExportLayout,
    emit_manifest: Option<bool>,
    manifest_format: Option<ManifestFormat>,
    canvas_state: State<'_, ManagedCanvasState>,
    _project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ExportResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    if canvas.clips.is_empty() {
        return Err(AppError::Internal("No clips defined".to_string()));
    }

    let total = canvas.frames.len();
    let fw = canvas.width;
    let fh = canvas.height;
    let mut all_warnings: Vec<String> = Vec::new();
    let mut skipped_clips: usize = 0;

    // Collect all frame indices in clip order, skipping invalid clips
    let mut all_frame_pairs: Vec<(usize, String)> = Vec::new();
    let mut included_clips: Vec<&crate::engine::clip::Clip> = Vec::new();
    let mut clip_offsets: Vec<(usize, usize)> = Vec::new(); // (offset, count) per included clip

    for clip in &canvas.clips {
        // Determine validity: invalid if range is reversed or fully out of bounds
        let is_invalid = clip.start_frame > clip.end_frame
            || clip.start_frame >= total
            || clip.end_frame >= total;

        if is_invalid {
            skipped_clips += 1;
            all_warnings.push(format!(
                "Clip '{}' skipped (invalid range {}..{})",
                clip.name, clip.start_frame, clip.end_frame
            ));
            continue;
        }

        let (indices, clip_warns) = resolve_clip_frames(clip, total);
        all_warnings.extend(clip_warns);
        let offset = all_frame_pairs.len();
        let count = indices.len();
        for &i in &indices {
            all_frame_pairs.push((i, canvas.frames[i].id.clone()));
        }
        clip_offsets.push((offset, count));
        included_clips.push(clip);
    }

    if all_frame_pairs.is_empty() {
        return Err(AppError::Internal("No valid frames across any clip".to_string()));
    }

    let (placements, out_w, out_h, cols, rows) =
        build_placements(&all_frame_pairs, &layout, fw, fh);

    if out_w > 16384 || out_h > 16384 {
        all_warnings.push(format!(
            "Output dimensions {}x{} exceed 16384px — some tools may not support this",
            out_w, out_h
        ));
    }

    let sheet_data = blit_frames_to_sheet(canvas, &placements, out_w as usize, out_h as usize);

    let base_path = std::path::Path::new(&file_path);
    if let Some(parent) = base_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
    }
    let (path, was_suffixed) = resolve_collision(base_path);

    let png_data = encode_png(&sheet_data, out_w, out_h).map_err(|e| AppError::Internal(e))?;
    std::fs::write(&path, &png_data).map_err(|e| AppError::Io(e))?;

    let mut files = vec![ExportedFileInfo {
        path: path.to_string_lossy().to_string(),
        width: out_w,
        height: out_h,
    }];

    let clip_count = included_clips.len();

    // Optional manifest
    let manifest_info = if emit_manifest.unwrap_or(false) {
        let fmt = manifest_format.unwrap_or_default();
        let image_name = path.file_name().map(|f| f.to_string_lossy().to_string());
        let clip_refs: Vec<&crate::engine::clip::Clip> = included_clips.iter().copied().collect();
        let mut m_frame_counts = Vec::new();
        let mut m_start_indices = Vec::new();
        let mut m_placements = Vec::new();
        let mut running_start = 0usize;
        for &(offset, count) in &clip_offsets {
            m_frame_counts.push(count);
            m_start_indices.push(running_start);
            running_start += count;
            let cp: Vec<ManifestPlacement> = placements[offset..offset + count]
                .iter()
                .map(|p| ManifestPlacement { x: p.x, y: p.y, w: p.width, h: p.height })
                .collect();
            m_placements.push(cp);
        }
        let input = ManifestInput {
            name: "all_clips".to_string(),
            export_type: "all_clips_sheet".to_string(),
            image_filename: image_name,
            frame_width: fw,
            frame_height: fh,
            sheet_width: Some(out_w),
            sheet_height: Some(out_h),
            columns: Some(cols),
            rows: Some(rows),
            clips: &clip_refs,
            clip_frame_counts: m_frame_counts,
            clip_start_indices: m_start_indices,
            clip_files: vec![Vec::new(); clip_refs.len()],
            clip_placements: m_placements,
            package_info: package_info_from_canvas(canvas),
        };
        let manifest_json = format_manifest(&input, &fmt, fw, fh)
            .map_err(|e| AppError::Internal(e))?;

        let manifest_base = path.with_extension("json");
        let (manifest_path, _) = resolve_collision(&manifest_base);
        std::fs::write(&manifest_path, &manifest_json).map_err(|e| AppError::Io(e))?;

        let info = ExportedFileInfo {
            path: manifest_path.to_string_lossy().to_string(),
            width: 0,
            height: 0,
        };
        files.push(info.clone());
        Some(info)
    } else {
        None
    };

    Ok(ExportResult {
        files,
        manifest: manifest_info,
        frame_count: all_frame_pairs.len(),
        clip_count,
        skipped_clips,
        was_suffixed,
        warnings: all_warnings,
    })
}

/// Export a single clip as a sequence with optional manifest.
#[command]
pub fn export_clip_sequence_with_manifest(
    clip_id: String,
    dir_path: String,
    manifest_format: Option<ManifestFormat>,
    canvas_state: State<'_, ManagedCanvasState>,
    _project_meta: State<'_, ManagedProjectMeta>,
) -> Result<ExportResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let clip = canvas
        .clips
        .iter()
        .find(|c| c.id == clip_id)
        .ok_or_else(|| AppError::Internal("Clip not found".to_string()))?;

    let total = canvas.frames.len();
    let (indices, warnings) = resolve_clip_frames(clip, total);

    if indices.is_empty() {
        return Err(AppError::Internal("Clip has no valid frames to export".to_string()));
    }

    let base_dir = std::path::Path::new(&dir_path);
    let (dir, dir_suffixed) = resolve_dir_collision(base_dir);
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e))?;

    let safe_name = sanitize_name(&clip.name);
    let pad_width = format!("{}", indices.len()).len();
    let fw = canvas.width;
    let fh = canvas.height;

    let mut files = Vec::new();
    let mut file_names = Vec::new();
    let mut was_suffixed = dir_suffixed;
    for (seq, &frame_idx) in indices.iter().enumerate() {
        let frame_data = canvas
            .composite_frame_at(frame_idx)
            .ok_or_else(|| AppError::Internal(format!("Failed to composite frame {}", frame_idx)))?;

        let filename = format!("{}_{:0>width$}.png", safe_name, seq + 1, width = pad_width);
        let base_path = dir.join(&filename);
        let (file_path, file_suffixed) = resolve_collision(&base_path);
        if file_suffixed { was_suffixed = true; }

        let png_data = encode_png(&frame_data, fw, fh).map_err(|e| AppError::Internal(e))?;
        std::fs::write(&file_path, &png_data).map_err(|e| AppError::Io(e))?;

        let actual_name = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        files.push(ExportedFileInfo {
            path: file_path.to_string_lossy().to_string(),
            width: fw,
            height: fh,
        });
        file_names.push(actual_name);
    }

    // Write manifest
    let fmt = manifest_format.unwrap_or_default();
    let input = ManifestInput {
        name: clip.name.clone(),
        export_type: "clip_sequence".to_string(),
        image_filename: None,
        frame_width: fw,
        frame_height: fh,
        sheet_width: None,
        sheet_height: None,
        columns: None,
        rows: None,
        clips: &[clip],
        clip_frame_counts: vec![indices.len()],
        clip_start_indices: vec![0],
        clip_files: vec![file_names],
        clip_placements: vec![Vec::new()],
        package_info: package_info_from_canvas(canvas),
    };
    let manifest_json = format_manifest(&input, &fmt, fw, fh)
        .map_err(|e| AppError::Internal(e))?;

    let manifest_base = dir.join(format!("{}_manifest.json", safe_name));
    let (manifest_path, _) = resolve_collision(&manifest_base);
    std::fs::write(&manifest_path, &manifest_json).map_err(|e| AppError::Io(e))?;

    let manifest_info = ExportedFileInfo {
        path: manifest_path.to_string_lossy().to_string(),
        width: 0,
        height: 0,
    };
    files.push(manifest_info.clone());

    Ok(ExportResult {
        files,
        manifest: Some(manifest_info),
        frame_count: indices.len(),
        clip_count: 1,
        skipped_clips: 0,
        was_suffixed,
        warnings,
    })
}

/// Export the current frame as a single PNG file.
/// Intended for single-frame static sprites that have no clips defined.
#[command]
pub fn export_current_frame_png(
    file_path: String,
    canvas_state: State<'_, ManagedCanvasState>,
) -> Result<ExportResult, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".to_string()))?;

    let fw = canvas.width;
    let fh = canvas.height;
    let idx = canvas.active_frame_index;
    let frame_id = canvas.frames[idx].id.clone();

    let placement = ExportPreviewFramePlacement {
        frame_index: idx,
        frame_id,
        x: 0,
        y: 0,
        width: fw,
        height: fh,
    };
    let pixel_data = blit_frames_to_sheet(canvas, &[placement], fw as usize, fh as usize);

    let base_path = std::path::Path::new(&file_path);
    if let Some(parent) = base_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
    }
    let (path, was_suffixed) = resolve_collision(base_path);

    let png_data = encode_png(&pixel_data, fw, fh).map_err(|e| AppError::Internal(e))?;
    std::fs::write(&path, &png_data).map_err(|e| AppError::Io(e))?;

    Ok(ExportResult {
        files: vec![ExportedFileInfo {
            path: path.to_string_lossy().to_string(),
            width: fw,
            height: fh,
        }],
        manifest: None,
        frame_count: 1,
        clip_count: 0,
        skipped_clips: 0,
        was_suffixed,
        warnings: Vec::new(),
    })
}

// ==========================================================================
// Tests
// ==========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- auto_grid ---

    #[test]
    fn auto_grid_zero() {
        assert_eq!(auto_grid(0), (0, 0));
    }

    #[test]
    fn auto_grid_single() {
        assert_eq!(auto_grid(1), (1, 1));
    }

    #[test]
    fn auto_grid_perfect_square() {
        let (c, r) = auto_grid(9);
        assert_eq!(c, 3);
        assert_eq!(r, 3);
    }

    #[test]
    fn auto_grid_non_square() {
        let (c, r) = auto_grid(10);
        // sqrt(10) = 3.16.. → ceil = 4 cols, rows = ceil(10/4) = 3
        assert_eq!(c, 4);
        assert_eq!(r, 3);
    }

    #[test]
    fn auto_grid_two() {
        let (c, r) = auto_grid(2);
        // sqrt(2) = 1.41.. → ceil = 2 cols, rows = 1
        assert_eq!(c, 2);
        assert_eq!(r, 1);
    }

    // --- build_placements ---

    fn frame(idx: usize) -> (usize, String) {
        (idx, format!("f{}", idx))
    }

    #[test]
    fn build_placements_empty() {
        let (placements, w, h, cols, rows) =
            build_placements(&[], &ExportLayout::HorizontalStrip, 32, 32);
        assert!(placements.is_empty());
        assert_eq!(w, 0);
        assert_eq!(h, 0);
        assert_eq!(cols, 0);
        assert_eq!(rows, 0);
    }

    #[test]
    fn build_placements_horizontal_strip() {
        let frames = vec![frame(0), frame(1), frame(2)];
        let (placements, w, h, cols, rows) =
            build_placements(&frames, &ExportLayout::HorizontalStrip, 32, 32);
        assert_eq!(placements.len(), 3);
        assert_eq!(cols, 3);
        assert_eq!(rows, 1);
        assert_eq!(w, 96);
        assert_eq!(h, 32);
        assert_eq!(placements[0].x, 0);
        assert_eq!(placements[1].x, 32);
        assert_eq!(placements[2].x, 64);
    }

    #[test]
    fn build_placements_vertical_strip() {
        let frames = vec![frame(0), frame(1), frame(2)];
        let (placements, w, h, cols, rows) =
            build_placements(&frames, &ExportLayout::VerticalStrip, 16, 16);
        assert_eq!(cols, 1);
        assert_eq!(rows, 3);
        assert_eq!(w, 16);
        assert_eq!(h, 48);
        assert_eq!(placements[0].y, 0);
        assert_eq!(placements[1].y, 16);
        assert_eq!(placements[2].y, 32);
    }

    #[test]
    fn build_placements_grid_auto() {
        let frames: Vec<_> = (0..9).map(frame).collect();
        let (placements, w, h, cols, rows) =
            build_placements(&frames, &ExportLayout::Grid { columns: None }, 32, 32);
        assert_eq!(cols, 3);
        assert_eq!(rows, 3);
        assert_eq!(w, 96);
        assert_eq!(h, 96);
        // Last frame in grid
        assert_eq!(placements[8].x, 64);
        assert_eq!(placements[8].y, 64);
    }

    #[test]
    fn build_placements_grid_custom_columns() {
        let frames: Vec<_> = (0..6).map(frame).collect();
        let (placements, w, h, cols, rows) =
            build_placements(&frames, &ExportLayout::Grid { columns: Some(2) }, 32, 32);
        assert_eq!(cols, 2);
        assert_eq!(rows, 3);
        assert_eq!(w, 64);
        assert_eq!(h, 96);
        // Frame at index 3 → col 1, row 1
        assert_eq!(placements[3].x, 32);
        assert_eq!(placements[3].y, 32);
    }

    #[test]
    fn build_placements_grid_columns_clamped() {
        let frames: Vec<_> = (0..4).map(frame).collect();
        // Columns > count → clamped to count
        let (_, _, _, cols, rows) =
            build_placements(&frames, &ExportLayout::Grid { columns: Some(100) }, 32, 32);
        assert_eq!(cols, 4);
        assert_eq!(rows, 1);
    }

    #[test]
    fn build_placements_correct_frame_ids() {
        let frames = vec![(5, "frame-five".to_string()), (10, "frame-ten".to_string())];
        let (placements, _, _, _, _) =
            build_placements(&frames, &ExportLayout::HorizontalStrip, 32, 32);
        assert_eq!(placements[0].frame_index, 5);
        assert_eq!(placements[0].frame_id, "frame-five");
        assert_eq!(placements[1].frame_index, 10);
        assert_eq!(placements[1].frame_id, "frame-ten");
    }
}
