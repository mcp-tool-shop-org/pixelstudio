use std::sync::Mutex;

/// Managed Tauri state for the active scene.
pub struct ManagedSceneState(pub Mutex<Option<SceneState>>);

/// Runtime scene state — the in-memory representation of an open scene.
#[derive(Debug, Clone)]
pub struct SceneState {
    pub document: SceneDocument,
    pub file_path: Option<String>,
    pub dirty: bool,
}

/// The core scene document.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDocument {
    pub scene_id: String,
    pub name: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub instances: Vec<SceneAssetInstance>,
    pub playback: ScenePlaybackConfig,
    /// Scene camera (viewport framing).
    #[serde(default)]
    pub camera: SceneCamera,
    /// Camera keyframes for animated camera movement.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub camera_keyframes: Vec<SceneCameraKeyframe>,
    pub created_at: String,
    pub updated_at: String,
}

/// A placed asset instance within a scene.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneAssetInstance {
    pub instance_id: String,
    /// Path to the source .pxs project file.
    pub source_path: String,
    /// Optional asset catalog ID for quick lookup.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    /// Display name for the instance (defaults from asset name).
    pub name: String,
    /// Which clip to play (None = first clip or static).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub clip_id: Option<String>,
    /// Position in scene coordinates.
    pub x: i32,
    pub y: i32,
    /// Z-order (higher = in front).
    pub z_order: i32,
    /// Visibility toggle.
    #[serde(default = "default_true")]
    pub visible: bool,
    /// Opacity 0.0–1.0.
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    /// Parallax factor — how much camera movement affects this instance.
    /// 1.0 = normal plane, <1.0 = background (moves less), >1.0 = foreground (moves more).
    #[serde(default = "default_parallax")]
    pub parallax: f32,
}

/// Scene camera — defines the viewport into the scene stage.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneCamera {
    /// Camera center X in scene coordinates.
    #[serde(default)]
    pub x: f64,
    /// Camera center Y in scene coordinates.
    #[serde(default)]
    pub y: f64,
    /// Zoom factor (1.0 = 100%, 2.0 = 200%, 0.5 = 50%).
    #[serde(default = "default_zoom")]
    pub zoom: f64,
    /// Optional human-readable name for the camera.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl Default for SceneCamera {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
            name: None,
        }
    }
}

fn default_zoom() -> f64 {
    1.0
}

/// Interpolation mode between camera keyframes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CameraInterpolationMode {
    /// Hold previous value until this keyframe's tick.
    Hold,
    /// Linear interpolation from previous keyframe to this one.
    Linear,
}

impl Default for CameraInterpolationMode {
    fn default() -> Self {
        Self::Linear
    }
}

/// A camera keyframe — defines camera state at a specific tick.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneCameraKeyframe {
    /// Tick at which this keyframe takes effect.
    pub tick: u32,
    /// Camera X position at this tick.
    pub x: f64,
    /// Camera Y position at this tick.
    pub y: f64,
    /// Camera zoom at this tick.
    #[serde(default = "default_zoom")]
    pub zoom: f64,
    /// Interpolation mode from previous keyframe to this one.
    #[serde(default)]
    pub interpolation: CameraInterpolationMode,
    /// Optional human-readable name for this keyframe / shot marker.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Scene-level playback configuration.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenePlaybackConfig {
    /// Frames per second for the global scene clock.
    #[serde(default = "default_fps")]
    pub fps: u32,
    /// Whether playback loops.
    #[serde(default = "default_true")]
    pub looping: bool,
}

impl Default for ScenePlaybackConfig {
    fn default() -> Self {
        Self {
            fps: 12,
            looping: true,
        }
    }
}

impl SceneDocument {
    pub fn new(name: String, width: u32, height: u32) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            scene_id: uuid::Uuid::new_v4().to_string(),
            name,
            canvas_width: width,
            canvas_height: height,
            instances: Vec::new(),
            playback: ScenePlaybackConfig::default(),
            camera: SceneCamera::default(),
            camera_keyframes: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    /// Find instance by ID.
    pub fn find_instance(&self, instance_id: &str) -> Option<&SceneAssetInstance> {
        self.instances.iter().find(|i| i.instance_id == instance_id)
    }

    /// Find instance by ID (mutable).
    pub fn find_instance_mut(&mut self, instance_id: &str) -> Option<&mut SceneAssetInstance> {
        self.instances.iter_mut().find(|i| i.instance_id == instance_id)
    }

    /// Next z-order value (one above the current maximum).
    pub fn next_z_order(&self) -> i32 {
        self.instances.iter().map(|i| i.z_order).max().unwrap_or(-1) + 1
    }
}

impl SceneAssetInstance {
    pub fn new(source_path: String, name: String, z_order: i32) -> Self {
        Self {
            instance_id: uuid::Uuid::new_v4().to_string(),
            source_path,
            asset_id: None,
            name,
            clip_id: None,
            x: 0,
            y: 0,
            z_order,
            visible: true,
            opacity: 1.0,
            parallax: 1.0,
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_opacity() -> f32 {
    1.0
}

fn default_parallax() -> f32 {
    1.0
}

fn default_fps() -> u32 {
    12
}

/// Frontend-facing scene info summary.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneInfo {
    pub scene_id: String,
    pub name: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub instance_count: usize,
    pub fps: u32,
    pub looping: bool,
    pub camera_x: f64,
    pub camera_y: f64,
    pub camera_zoom: f64,
    pub file_path: Option<String>,
    pub dirty: bool,
}

impl SceneInfo {
    pub fn from_state(state: &SceneState) -> Self {
        let doc = &state.document;
        Self {
            scene_id: doc.scene_id.clone(),
            name: doc.name.clone(),
            canvas_width: doc.canvas_width,
            canvas_height: doc.canvas_height,
            instance_count: doc.instances.len(),
            fps: doc.playback.fps,
            looping: doc.playback.looping,
            camera_x: doc.camera.x,
            camera_y: doc.camera.y,
            camera_zoom: doc.camera.zoom,
            file_path: state.file_path.clone(),
            dirty: state.dirty,
        }
    }
}

// --- Clip resolution types ---

/// Status of clip resolution for a scene instance.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClipResolutionStatus {
    /// Clip found and valid.
    Resolved,
    /// No clip assigned — instance shows static/first frame.
    NoClip,
    /// Source .pxs file not found on disk.
    MissingSource,
    /// clip_id set but not found in source project.
    MissingClip,
    /// Source has no clips defined at all.
    NoClipsInSource,
}

/// Resolved clip info for a single scene instance.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceClipState {
    pub instance_id: String,
    pub clip_id: Option<String>,
    pub clip_name: Option<String>,
    pub frame_count: usize,
    /// Clip's own FPS override (None = use scene FPS).
    pub clip_fps: Option<u32>,
    pub clip_loop: bool,
    pub status: ClipResolutionStatus,
}

/// Full playback state for the scene — returned to frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenePlaybackState {
    pub fps: u32,
    pub looping: bool,
    pub instances: Vec<InstanceClipState>,
}

/// Scene timeline summary — total span, timing info, returned to frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneTimelineSummary {
    /// Scene FPS.
    pub fps: u32,
    /// Whether playback loops.
    pub looping: bool,
    /// Total scene span in ticks (longest participating clip, minimum 1).
    pub total_ticks: u32,
    /// Total duration in milliseconds.
    pub total_duration_ms: f64,
    /// Number of instances contributing to timing (resolved clips).
    pub contributing_instances: u32,
    /// Longest individual clip frame count among resolved instances.
    pub longest_clip_frames: u32,
}

impl SceneTimelineSummary {
    /// Compute timeline summary from scene state.
    pub fn from_state(state: &SceneState) -> Self {
        let doc = &state.document;
        let fps = doc.playback.fps.max(1);
        let mut longest: u32 = 0;
        let mut contributing: u32 = 0;

        for inst in &doc.instances {
            if !inst.visible {
                continue;
            }
            let clip_state = resolve_instance_clip(inst);
            match clip_state.status {
                ClipResolutionStatus::Resolved => {
                    let fc = clip_state.frame_count as u32;
                    if fc > longest {
                        longest = fc;
                    }
                    contributing += 1;
                }
                // no_clip instances with multiple frames also contribute
                ClipResolutionStatus::NoClip => {
                    let fc = clip_state.frame_count as u32;
                    if fc > 1 && fc > longest {
                        longest = fc;
                    }
                }
                _ => {}
            }
        }

        let total_ticks = longest.max(1);
        let total_duration_ms = (total_ticks as f64 / fps as f64) * 1000.0;

        Self {
            fps,
            looping: doc.playback.looping,
            total_ticks,
            total_duration_ms,
            contributing_instances: contributing,
            longest_clip_frames: longest,
        }
    }
}

/// Summary of a clip available in a source .pxs project.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceClipInfo {
    pub id: String,
    pub name: String,
    pub start_frame: usize,
    pub end_frame: usize,
    pub frame_count: usize,
    pub loop_clip: bool,
    pub fps_override: Option<u32>,
}

/// Resolve clip state for a single instance by reading its source project.
pub fn resolve_instance_clip(instance: &SceneAssetInstance) -> InstanceClipState {
    use std::path::Path;

    let clip_id = instance.clip_id.clone();

    // No clip assigned — static display
    if clip_id.is_none() {
        // Try to read total frame count from source for metadata
        let frame_count = read_source_frame_count(&instance.source_path).unwrap_or(1);
        return InstanceClipState {
            instance_id: instance.instance_id.clone(),
            clip_id: None,
            clip_name: None,
            frame_count,
            clip_fps: None,
            clip_loop: false,
            status: ClipResolutionStatus::NoClip,
        };
    }

    let clip_id_val = clip_id.unwrap();

    // Check source exists
    if !Path::new(&instance.source_path).exists() {
        return InstanceClipState {
            instance_id: instance.instance_id.clone(),
            clip_id: Some(clip_id_val),
            clip_name: None,
            frame_count: 0,
            clip_fps: None,
            clip_loop: false,
            status: ClipResolutionStatus::MissingSource,
        };
    }

    // Load source project clips
    match read_source_clips(&instance.source_path) {
        Ok(clips) => {
            if clips.is_empty() {
                return InstanceClipState {
                    instance_id: instance.instance_id.clone(),
                    clip_id: Some(clip_id_val),
                    clip_name: None,
                    frame_count: 0,
                    clip_fps: None,
                    clip_loop: false,
                    status: ClipResolutionStatus::NoClipsInSource,
                };
            }
            match clips.iter().find(|c| c.id == clip_id_val) {
                Some(clip) => InstanceClipState {
                    instance_id: instance.instance_id.clone(),
                    clip_id: Some(clip_id_val),
                    clip_name: Some(clip.name.clone()),
                    frame_count: clip.frame_count(),
                    clip_fps: clip.fps_override,
                    clip_loop: clip.loop_clip,
                    status: ClipResolutionStatus::Resolved,
                },
                None => InstanceClipState {
                    instance_id: instance.instance_id.clone(),
                    clip_id: Some(clip_id_val),
                    clip_name: None,
                    frame_count: 0,
                    clip_fps: None,
                    clip_loop: false,
                    status: ClipResolutionStatus::MissingClip,
                },
            }
        }
        Err(_) => InstanceClipState {
            instance_id: instance.instance_id.clone(),
            clip_id: Some(clip_id_val),
            clip_name: None,
            frame_count: 0,
            clip_fps: None,
            clip_loop: false,
            status: ClipResolutionStatus::MissingSource,
        },
    }
}

/// Read clips from a source .pxs project file (lightweight — only parses JSON, no pixel data).
fn read_source_clips(source_path: &str) -> Result<Vec<crate::engine::clip::Clip>, String> {
    let data = std::fs::read_to_string(source_path).map_err(|e| e.to_string())?;
    // Parse just enough to extract clips — use the ProjectDocument struct
    let doc: crate::persistence::project_io::ProjectDocument =
        serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(doc.clips)
}

/// Read total frame count from a source .pxs project file.
fn read_source_frame_count(source_path: &str) -> Result<usize, String> {
    let data = std::fs::read_to_string(source_path).map_err(|e| e.to_string())?;
    let doc: crate::persistence::project_io::ProjectDocument =
        serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(doc.frames.len().max(1))
}

/// List all clips available in a source .pxs project.
pub fn list_source_project_clips(source_path: &str) -> Result<Vec<SourceClipInfo>, String> {
    let clips = read_source_clips(source_path)?;
    Ok(clips
        .iter()
        .map(|c| SourceClipInfo {
            id: c.id.clone(),
            name: c.name.clone(),
            start_frame: c.start_frame,
            end_frame: c.end_frame,
            frame_count: c.frame_count(),
            loop_clip: c.loop_clip,
            fps_override: c.fps_override,
        })
        .collect())
}

// --- Scene frame rendering ---

/// Result of loading and compositing frames from a source asset.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAssetFrames {
    pub width: u32,
    pub height: u32,
    /// Base64-encoded PNG for each frame in clip order.
    pub frames: Vec<String>,
    pub clip_id: Option<String>,
    pub frame_count: usize,
}

/// Composite all layers of a serialized frame into a single RGBA buffer.
/// Uses standard alpha-over blending, same as canvas_state::composite_frame.
fn composite_serialized_frame(
    layers: &[crate::persistence::project_io::SerializedLayer],
    width: u32,
    height: u32,
) -> Vec<u8> {
    let pixel_count = (width * height * 4) as usize;
    let mut result = vec![0u8; pixel_count];

    for layer in layers {
        if !layer.visible || layer.opacity <= 0.0 {
            continue;
        }
        if layer.pixel_data.len() < pixel_count {
            continue;
        }
        let opacity = layer.opacity;
        for i in (0..pixel_count).step_by(4) {
            let sa = (layer.pixel_data[i + 3] as f32 / 255.0) * opacity;
            if sa == 0.0 {
                continue;
            }
            let da = result[i + 3] as f32 / 255.0;
            let out_a = sa + da * (1.0 - sa);
            if out_a > 0.0 {
                result[i] = ((layer.pixel_data[i] as f32 * sa
                    + result[i] as f32 * da * (1.0 - sa))
                    / out_a) as u8;
                result[i + 1] = ((layer.pixel_data[i + 1] as f32 * sa
                    + result[i + 1] as f32 * da * (1.0 - sa))
                    / out_a) as u8;
                result[i + 2] = ((layer.pixel_data[i + 2] as f32 * sa
                    + result[i + 2] as f32 * da * (1.0 - sa))
                    / out_a) as u8;
                result[i + 3] = (out_a * 255.0) as u8;
            }
        }
    }

    result
}

/// Encode raw RGBA data to PNG bytes (public for export commands).
pub fn encode_png_public(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    encode_png_scene(data, width, height)
}

/// Encode raw RGBA data to PNG bytes.
fn encode_png_scene(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
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

/// Load a source .pxs project and return composited frames for a given clip.
/// If clip_id is None, returns only the first frame (static).
pub fn load_source_asset_frames(
    source_path: &str,
    clip_id: Option<&str>,
) -> Result<SourceAssetFrames, String> {
    use base64::Engine;

    let data = std::fs::read_to_string(source_path).map_err(|e| e.to_string())?;
    let doc: crate::persistence::project_io::ProjectDocument =
        serde_json::from_str(&data).map_err(|e| e.to_string())?;

    let w = doc.canvas_width;
    let h = doc.canvas_height;

    // Determine frame range
    let (start, end, resolved_clip_id) = if let Some(cid) = clip_id {
        if let Some(clip) = doc.clips.iter().find(|c| c.id == cid) {
            let s = clip.start_frame.min(doc.frames.len().saturating_sub(1));
            let e = clip.end_frame.min(doc.frames.len().saturating_sub(1));
            (s, e, Some(cid.to_string()))
        } else {
            // Clip not found — fallback to first frame
            (0, 0, Some(cid.to_string()))
        }
    } else {
        // No clip — static, first frame only
        (0, 0, None)
    };

    // Handle V1 single-frame projects
    if doc.frames.is_empty() {
        let rgba = composite_serialized_frame(&doc.layers, w, h);
        let png_bytes = encode_png_scene(&rgba, w, h)?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
        return Ok(SourceAssetFrames {
            width: w,
            height: h,
            frames: vec![b64],
            clip_id: resolved_clip_id,
            frame_count: 1,
        });
    }

    let mut frame_pngs = Vec::new();
    for i in start..=end {
        if i >= doc.frames.len() {
            break;
        }
        let frame = &doc.frames[i];
        let rgba = composite_serialized_frame(&frame.layers, w, h);
        let png_bytes = encode_png_scene(&rgba, w, h)?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
        frame_pngs.push(b64);
    }

    if frame_pngs.is_empty() {
        // Fallback: composite first frame
        let frame = &doc.frames[0];
        let rgba = composite_serialized_frame(&frame.layers, w, h);
        let png_bytes = encode_png_scene(&rgba, w, h)?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
        frame_pngs.push(b64);
    }

    let count = frame_pngs.len();
    Ok(SourceAssetFrames {
        width: w,
        height: h,
        frames: frame_pngs,
        clip_id: resolved_clip_id,
        frame_count: count,
    })
}

/// Result of exporting a scene frame.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneExportResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub warnings: Vec<String>,
}

// --- Camera keyframe interpolation ---

/// Linear interpolation between two f64 values.
fn lerp_f64(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

/// Resolve the effective camera at a given tick from keyframes.
///
/// Rules:
/// - No keyframes → use document's base camera
/// - One keyframe → use that keyframe everywhere
/// - Multiple keyframes (sorted by tick):
///   - Before first → first keyframe
///   - After last → last keyframe
///   - Exactly on a keyframe → that keyframe's values
///   - Between keyframes A and B:
///     - A.interpolation == Hold → use A until B's tick
///     - A.interpolation == Linear → lerp from A to B
///
/// Interpolation mode belongs to the *starting* keyframe of each segment.
pub fn resolve_scene_camera_at_tick(doc: &SceneDocument, tick: u32) -> SceneCamera {
    if doc.camera_keyframes.is_empty() {
        return doc.camera.clone();
    }

    // Sort keyframes (should already be sorted, but be defensive)
    let mut kfs = doc.camera_keyframes.clone();
    kfs.sort_by_key(|k| k.tick);

    // Single keyframe — always use it
    if kfs.len() == 1 {
        let kf = &kfs[0];
        return SceneCamera {
            x: kf.x,
            y: kf.y,
            zoom: kf.zoom.clamp(0.1, 10.0),
            name: None,
        };
    }

    // Before first keyframe
    if tick <= kfs[0].tick {
        let kf = &kfs[0];
        return SceneCamera {
            x: kf.x,
            y: kf.y,
            zoom: kf.zoom.clamp(0.1, 10.0),
            name: None,
        };
    }

    // After last keyframe
    let last = &kfs[kfs.len() - 1];
    if tick >= last.tick {
        return SceneCamera {
            x: last.x,
            y: last.y,
            zoom: last.zoom.clamp(0.1, 10.0),
            name: None,
        };
    }

    // Between keyframes — find the segment
    for i in 0..kfs.len() - 1 {
        let a = &kfs[i];
        let b = &kfs[i + 1];

        if tick < a.tick || tick >= b.tick {
            continue;
        }

        // Exactly on A
        if tick == a.tick {
            return SceneCamera {
                x: a.x,
                y: a.y,
                zoom: a.zoom.clamp(0.1, 10.0),
                name: None,
            };
        }

        // Between A and B
        match a.interpolation {
            CameraInterpolationMode::Hold => {
                return SceneCamera {
                    x: a.x,
                    y: a.y,
                    zoom: a.zoom.clamp(0.1, 10.0),
                    name: None,
                };
            }
            CameraInterpolationMode::Linear => {
                let span = (b.tick - a.tick) as f64;
                let t = (tick - a.tick) as f64 / span;
                return SceneCamera {
                    x: lerp_f64(a.x, b.x, t),
                    y: lerp_f64(a.y, b.y, t),
                    zoom: lerp_f64(a.zoom, b.zoom, t).clamp(0.1, 10.0),
                    name: None,
                };
            }
        }
    }

    // Fallback (should not reach here)
    doc.camera.clone()
}

/// Composite all visible instances at a given scene tick into one RGBA buffer.
/// Camera-aware: applies camera pan, zoom, and per-instance parallax.
/// Output dimensions are always scene canvas size — zoom changes framing, not resolution.
///
/// Transform model (matches frontend CSS):
///   output_x = (inst.x - cam.x * inst.parallax) * zoom
///   output_y = (inst.y - cam.y * inst.parallax) * zoom
///   Instance pixels are also scaled by zoom.
///
/// Instances are rendered in z-order. Missing sources are skipped with warnings.
pub fn composite_scene_frame(
    doc: &SceneDocument,
    tick: u32,
    scene_fps: u32,
) -> (Vec<u8>, u32, u32, Vec<String>) {
    let cw = doc.canvas_width;
    let ch = doc.canvas_height;
    let pixel_count = (cw * ch * 4) as usize;
    let mut canvas = vec![0u8; pixel_count];
    let mut warnings = Vec::new();

    let resolved_cam = resolve_scene_camera_at_tick(doc, tick);
    let cam_x = resolved_cam.x;
    let cam_y = resolved_cam.y;
    let zoom = resolved_cam.zoom.max(0.01);

    // Sort instances by z-order (lowest first = painted first)
    let mut sorted: Vec<&SceneAssetInstance> = doc.instances.iter().collect();
    sorted.sort_by_key(|i| i.z_order);

    for inst in sorted {
        if !inst.visible || inst.opacity <= 0.0 {
            continue;
        }

        // Resolve the frame RGBA data for this instance at the given tick
        let frame_data = resolve_instance_frame_data(inst, tick, scene_fps);
        let (rgba, fw, fh) = match frame_data {
            Ok(data) => data,
            Err(reason) => {
                warnings.push(format!("{}: {}", inst.name, reason));
                continue;
            }
        };

        // Camera-aware instance position with parallax:
        // output_x = (inst.x - cam_x * parallax) * zoom
        let parallax = inst.parallax as f64;
        let base_x = (inst.x as f64 - cam_x * parallax) * zoom;
        let base_y = (inst.y as f64 - cam_y * parallax) * zoom;

        // Blit instance onto output canvas with zoom scaling and opacity
        let opacity = inst.opacity;
        let scaled_w = (fw as f64 * zoom).round() as i32;
        let scaled_h = (fh as f64 * zoom).round() as i32;

        for out_py in 0..scaled_h {
            let dst_y = base_y.round() as i32 + out_py;
            if dst_y < 0 || dst_y >= ch as i32 {
                continue;
            }
            // Map output pixel back to source pixel (nearest-neighbor for pixel art)
            let src_py = ((out_py as f64 / zoom).floor() as u32).min(fh - 1);

            for out_px in 0..scaled_w {
                let dst_x = base_x.round() as i32 + out_px;
                if dst_x < 0 || dst_x >= cw as i32 {
                    continue;
                }
                let src_px = ((out_px as f64 / zoom).floor() as u32).min(fw - 1);

                let src_i = ((src_py * fw + src_px) * 4) as usize;
                let dst_i = ((dst_y as u32 * cw + dst_x as u32) * 4) as usize;

                let sa = (rgba[src_i + 3] as f32 / 255.0) * opacity;
                if sa == 0.0 {
                    continue;
                }
                let da = canvas[dst_i + 3] as f32 / 255.0;
                let out_a = sa + da * (1.0 - sa);
                if out_a > 0.0 {
                    canvas[dst_i] = ((rgba[src_i] as f32 * sa
                        + canvas[dst_i] as f32 * da * (1.0 - sa))
                        / out_a) as u8;
                    canvas[dst_i + 1] = ((rgba[src_i + 1] as f32 * sa
                        + canvas[dst_i + 1] as f32 * da * (1.0 - sa))
                        / out_a) as u8;
                    canvas[dst_i + 2] = ((rgba[src_i + 2] as f32 * sa
                        + canvas[dst_i + 2] as f32 * da * (1.0 - sa))
                        / out_a) as u8;
                    canvas[dst_i + 3] = (out_a * 255.0) as u8;
                }
            }
        }
    }

    (canvas, cw, ch, warnings)
}

/// Resolve the RGBA frame data for an instance at a given tick.
/// Returns (rgba_bytes, width, height) or an error reason string.
fn resolve_instance_frame_data(
    inst: &SceneAssetInstance,
    tick: u32,
    _scene_fps: u32,
) -> Result<(Vec<u8>, u32, u32), String> {
    use std::path::Path;

    if !Path::new(&inst.source_path).exists() {
        return Err("source file missing".into());
    }

    let data = std::fs::read_to_string(&inst.source_path)
        .map_err(|e| format!("read error: {}", e))?;
    let doc: crate::persistence::project_io::ProjectDocument =
        serde_json::from_str(&data).map_err(|e| format!("parse error: {}", e))?;

    let w = doc.canvas_width;
    let h = doc.canvas_height;

    // Determine which frame to render
    let frame_idx = if let Some(ref clip_id) = inst.clip_id {
        if let Some(clip) = doc.clips.iter().find(|c| c.id == *clip_id) {
            let clip_len = clip.frame_count();
            if clip_len == 0 {
                clip.start_frame
            } else {
                let effective_tick = tick as usize;
                let frame_in_clip = if clip.loop_clip {
                    effective_tick % clip_len
                } else {
                    effective_tick.min(clip_len - 1)
                };
                clip.start_frame + frame_in_clip
            }
        } else {
            0 // Clip not found — fallback to first frame
        }
    } else {
        0 // No clip — static first frame
    };

    // Composite the frame
    if doc.frames.is_empty() {
        // V1 project
        let rgba = composite_serialized_frame(&doc.layers, w, h);
        Ok((rgba, w, h))
    } else {
        let idx = frame_idx.min(doc.frames.len() - 1);
        let frame = &doc.frames[idx];
        let rgba = composite_serialized_frame(&frame.layers, w, h);
        Ok((rgba, w, h))
    }
}
