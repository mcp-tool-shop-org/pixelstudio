use std::path::Path;
use tauri::{command, State};

use crate::engine::scene::{
    CameraInterpolationMode, ManagedSceneState, SceneAssetInstance, SceneCamera,
    SceneCameraKeyframe, SceneDocument, SceneExportResult, SceneInfo, ScenePlaybackState,
    SceneState, SceneTimelineSummary, SourceAssetFrames, SourceClipInfo,
};
use crate::errors::AppError;
use crate::persistence::scene_io;

/// Create a new empty scene.
#[command]
pub fn new_scene(
    name: String,
    width: u32,
    height: u32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let doc = SceneDocument::new(name, width, height);
    let scene_state = SceneState {
        document: doc,
        file_path: None,
        dirty: false,
    };
    let info = SceneInfo::from_state(&scene_state);
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    *guard = Some(scene_state);
    Ok(info)
}

/// Open an existing scene file.
#[command]
pub fn open_scene(
    file_path: String,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let mut doc = scene_io::load_scene(&file_path)?;
    doc.updated_at = chrono::Utc::now().to_rfc3339();
    let scene_state = SceneState {
        document: doc,
        file_path: Some(file_path),
        dirty: false,
    };
    let info = SceneInfo::from_state(&scene_state);
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    *guard = Some(scene_state);
    Ok(info)
}

/// Save the current scene to its known file path.
#[command]
pub fn save_scene(
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    let path = scene
        .file_path
        .as_ref()
        .ok_or_else(|| AppError::Internal("Scene has no file path — use save_scene_as".into()))?
        .clone();
    scene.document.updated_at = chrono::Utc::now().to_rfc3339();
    scene_io::save_scene(&scene.document, &path)?;
    scene.dirty = false;
    Ok(SceneInfo::from_state(scene))
}

/// Save the current scene to a new file path.
#[command]
pub fn save_scene_as(
    file_path: String,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    scene.document.updated_at = chrono::Utc::now().to_rfc3339();
    scene_io::save_scene(&scene.document, &file_path)?;
    scene.file_path = Some(file_path);
    scene.dirty = false;
    Ok(SceneInfo::from_state(scene))
}

/// Get info about the currently open scene.
#[command]
pub fn get_scene_info(
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    Ok(SceneInfo::from_state(scene))
}

/// Get all instances in the current scene (for panel/rendering).
#[command]
pub fn get_scene_instances(
    state: State<'_, ManagedSceneState>,
) -> Result<Vec<SceneAssetInstance>, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    Ok(scene.document.instances.clone())
}

/// Add a new asset instance to the scene.
#[command]
pub fn add_scene_instance(
    source_path: String,
    asset_id: Option<String>,
    name: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
    clip_id: Option<String>,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    // Validate source file exists
    if !Path::new(&source_path).exists() {
        return Err(AppError::ProjectNotFound(format!(
            "Source asset not found: {}",
            source_path
        )));
    }

    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let display_name = name.unwrap_or_else(|| {
        Path::new(&source_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("asset")
            .to_string()
    });

    let z = scene.document.next_z_order();
    let mut instance = SceneAssetInstance::new(source_path, display_name, z);
    instance.asset_id = asset_id;
    instance.clip_id = clip_id;
    // Default to center of scene if no position given
    instance.x = x.unwrap_or(scene.document.canvas_width as i32 / 2);
    instance.y = y.unwrap_or(scene.document.canvas_height as i32 / 2);

    scene.document.instances.push(instance.clone());
    scene.dirty = true;

    Ok(instance)
}

/// Remove an instance from the scene.
#[command]
pub fn remove_scene_instance(
    instance_id: String,
    state: State<'_, ManagedSceneState>,
) -> Result<bool, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let before = scene.document.instances.len();
    scene.document.instances.retain(|i| i.instance_id != instance_id);
    let removed = scene.document.instances.len() < before;
    if removed {
        scene.dirty = true;
    }
    Ok(removed)
}

/// Move an instance to a new position.
#[command]
pub fn move_scene_instance(
    instance_id: String,
    x: i32,
    y: i32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let inst = scene
        .document
        .find_instance_mut(&instance_id)
        .ok_or_else(|| AppError::Internal(format!("Instance not found: {}", instance_id)))?;
    inst.x = x;
    inst.y = y;
    let result = inst.clone();
    scene.dirty = true;
    Ok(result)
}

/// Change an instance's z-order (layer stacking).
#[command]
pub fn set_scene_instance_layer(
    instance_id: String,
    z_order: i32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let inst = scene
        .document
        .find_instance_mut(&instance_id)
        .ok_or_else(|| AppError::Internal(format!("Instance not found: {}", instance_id)))?;
    inst.z_order = z_order;
    let result = inst.clone();
    scene.dirty = true;
    Ok(result)
}

/// Toggle instance visibility.
#[command]
pub fn set_scene_instance_visibility(
    instance_id: String,
    visible: bool,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let inst = scene
        .document
        .find_instance_mut(&instance_id)
        .ok_or_else(|| AppError::Internal(format!("Instance not found: {}", instance_id)))?;
    inst.visible = visible;
    let result = inst.clone();
    scene.dirty = true;
    Ok(result)
}

/// Set instance opacity (clamped 0.0–1.0).
#[command]
pub fn set_scene_instance_opacity(
    instance_id: String,
    opacity: f32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let inst = scene
        .document
        .find_instance_mut(&instance_id)
        .ok_or_else(|| AppError::Internal(format!("Instance not found: {}", instance_id)))?;
    inst.opacity = opacity.clamp(0.0, 1.0);
    let result = inst.clone();
    scene.dirty = true;
    Ok(result)
}

// --- Clip assignment + playback config commands ---

/// Assign a clip to a scene instance (or clear with None).
#[command]
pub fn set_scene_instance_clip(
    instance_id: String,
    clip_id: Option<String>,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let inst = scene
        .document
        .find_instance_mut(&instance_id)
        .ok_or_else(|| AppError::Internal(format!("Instance not found: {}", instance_id)))?;
    inst.clip_id = clip_id;
    let result = inst.clone();
    scene.dirty = true;
    Ok(result)
}

/// Set the scene's global playback FPS (clamped 1–60).
#[command]
pub fn set_scene_playback_fps(
    fps: u32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    scene.document.playback.fps = fps.clamp(1, 60);
    scene.dirty = true;
    Ok(SceneInfo::from_state(scene))
}

/// Set the scene's looping flag.
#[command]
pub fn set_scene_loop(
    looping: bool,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneInfo, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    scene.document.playback.looping = looping;
    scene.dirty = true;
    Ok(SceneInfo::from_state(scene))
}

/// Get full playback state with resolved clip info for every instance.
#[command]
pub fn get_scene_playback_state(
    state: State<'_, ManagedSceneState>,
) -> Result<ScenePlaybackState, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let instances = scene
        .document
        .instances
        .iter()
        .map(crate::engine::scene::resolve_instance_clip)
        .collect();

    Ok(ScenePlaybackState {
        fps: scene.document.playback.fps,
        looping: scene.document.playback.looping,
        instances,
    })
}

/// List clips available in a source .pxs project (for the clip picker).
#[command]
pub fn list_source_clips(
    source_path: String,
) -> Result<Vec<SourceClipInfo>, AppError> {
    if !Path::new(&source_path).exists() {
        return Err(AppError::ProjectNotFound(format!(
            "Source asset not found: {}",
            source_path
        )));
    }

    crate::engine::scene::list_source_project_clips(&source_path)
        .map_err(|e| AppError::Internal(format!("Failed to read source clips: {}", e)))
}

/// Load composited frame images for a source asset's clip.
/// Returns base64-encoded PNGs for each frame in the clip range.
/// If clip_id is None, returns first frame only (static).
#[command]
pub fn get_source_asset_frames(
    source_path: String,
    clip_id: Option<String>,
) -> Result<SourceAssetFrames, AppError> {
    if !Path::new(&source_path).exists() {
        return Err(AppError::ProjectNotFound(format!(
            "Source asset not found: {}",
            source_path
        )));
    }

    crate::engine::scene::load_source_asset_frames(&source_path, clip_id.as_deref())
        .map_err(|e| AppError::Internal(format!("Failed to load asset frames: {}", e)))
}

// --- Timeline summary + seek ---

/// Get a summary of the scene timeline — total span, timing info.
#[command]
pub fn get_scene_timeline_summary(
    state: State<'_, ManagedSceneState>,
) -> Result<SceneTimelineSummary, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    Ok(SceneTimelineSummary::from_state(scene))
}

/// Seek the scene to a specific tick. Returns the clamped tick value.
/// This is a runtime-only operation — does not modify scene content or enter undo history.
#[command]
pub fn seek_scene_tick(
    tick: u32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneTimelineSummary, AppError> {
    // We compute the timeline summary to know the valid range,
    // but we don't store the current tick in the backend — the frontend owns that.
    // This command just validates and returns the timeline context.
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    let summary = SceneTimelineSummary::from_state(scene);
    // The frontend will clamp the tick using summary.total_ticks
    let _ = tick; // validation happens frontend-side with the returned summary
    Ok(summary)
}

/// Set per-instance parallax factor (clamped 0.1–3.0).
/// 1.0 = normal plane, <1.0 = background (moves less with camera), >1.0 = foreground (moves more).
#[command]
pub fn set_scene_instance_parallax(
    instance_id: String,
    parallax: f32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneAssetInstance, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let inst = scene
        .document
        .find_instance_mut(&instance_id)
        .ok_or_else(|| AppError::Internal(format!("Instance not found: {}", instance_id)))?;
    inst.parallax = parallax.clamp(0.1, 3.0);
    let result = inst.clone();
    scene.dirty = true;
    Ok(result)
}

// --- Camera commands ---

/// Get the current scene camera state.
#[command]
pub fn get_scene_camera(
    state: State<'_, ManagedSceneState>,
) -> Result<SceneCamera, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    Ok(scene.document.camera.clone())
}

/// Set the scene camera position (center point).
#[command]
pub fn set_scene_camera_position(
    x: f64,
    y: f64,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneCamera, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    scene.document.camera.x = x;
    scene.document.camera.y = y;
    scene.dirty = true;
    Ok(scene.document.camera.clone())
}

/// Set the scene camera zoom level (clamped 0.1–10.0).
#[command]
pub fn set_scene_camera_zoom(
    zoom: f64,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneCamera, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    scene.document.camera.zoom = zoom.clamp(0.1, 10.0);
    scene.dirty = true;
    Ok(scene.document.camera.clone())
}

/// Reset the scene camera to default (centered at origin, zoom 1.0).
#[command]
pub fn reset_scene_camera(
    state: State<'_, ManagedSceneState>,
) -> Result<SceneCamera, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    scene.document.camera = SceneCamera::default();
    scene.dirty = true;
    Ok(scene.document.camera.clone())
}

/// Get the effective (resolved) scene camera at a specific tick.
/// Evaluates keyframe interpolation — returns the same camera that export would use.
#[command]
pub fn get_scene_camera_at_tick(
    tick: u32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneCamera, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    Ok(crate::engine::scene::resolve_scene_camera_at_tick(
        &scene.document,
        tick,
    ))
}

// --- Camera keyframe commands ---

/// List all camera keyframes, sorted by tick.
#[command]
pub fn list_scene_camera_keyframes(
    state: State<'_, ManagedSceneState>,
) -> Result<Vec<SceneCameraKeyframe>, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;
    let mut kfs = scene.document.camera_keyframes.clone();
    kfs.sort_by_key(|k| k.tick);
    Ok(kfs)
}

/// Add a camera keyframe at a specific tick.
/// If a keyframe already exists at that tick, it is replaced.
#[command]
pub fn add_scene_camera_keyframe(
    tick: u32,
    x: f64,
    y: f64,
    zoom: f64,
    interpolation: Option<CameraInterpolationMode>,
    state: State<'_, ManagedSceneState>,
) -> Result<Vec<SceneCameraKeyframe>, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let interp = interpolation.unwrap_or(CameraInterpolationMode::Linear);
    let clamped_zoom = zoom.clamp(0.1, 10.0);

    // Remove existing keyframe at this tick if any
    scene.document.camera_keyframes.retain(|k| k.tick != tick);

    scene.document.camera_keyframes.push(SceneCameraKeyframe {
        tick,
        x,
        y,
        zoom: clamped_zoom,
        interpolation: interp,
    });

    scene.document.camera_keyframes.sort_by_key(|k| k.tick);
    scene.dirty = true;
    Ok(scene.document.camera_keyframes.clone())
}

/// Update an existing camera keyframe at a specific tick.
/// Returns error if no keyframe exists at the given tick.
#[command]
pub fn update_scene_camera_keyframe(
    tick: u32,
    x: Option<f64>,
    y: Option<f64>,
    zoom: Option<f64>,
    interpolation: Option<CameraInterpolationMode>,
    state: State<'_, ManagedSceneState>,
) -> Result<Vec<SceneCameraKeyframe>, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let kf = scene
        .document
        .camera_keyframes
        .iter_mut()
        .find(|k| k.tick == tick)
        .ok_or_else(|| {
            AppError::Internal(format!("No camera keyframe at tick {}", tick))
        })?;

    if let Some(new_x) = x {
        kf.x = new_x;
    }
    if let Some(new_y) = y {
        kf.y = new_y;
    }
    if let Some(new_zoom) = zoom {
        kf.zoom = new_zoom.clamp(0.1, 10.0);
    }
    if let Some(new_interp) = interpolation {
        kf.interpolation = new_interp;
    }

    scene.dirty = true;
    let mut kfs = scene.document.camera_keyframes.clone();
    kfs.sort_by_key(|k| k.tick);
    Ok(kfs)
}

/// Delete a camera keyframe at a specific tick.
/// Returns the remaining keyframes.
#[command]
pub fn delete_scene_camera_keyframe(
    tick: u32,
    state: State<'_, ManagedSceneState>,
) -> Result<Vec<SceneCameraKeyframe>, AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let before = scene.document.camera_keyframes.len();
    scene.document.camera_keyframes.retain(|k| k.tick != tick);
    if scene.document.camera_keyframes.len() < before {
        scene.dirty = true;
    }
    Ok(scene.document.camera_keyframes.clone())
}

/// Export the current scene frame as a PNG file.
/// Composites all visible instances at the given tick, respecting z-order, opacity, visibility.
#[command]
pub fn export_scene_frame(
    file_path: String,
    tick: u32,
    state: State<'_, ManagedSceneState>,
) -> Result<SceneExportResult, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let scene = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No scene is open".into()))?;

    let fps = scene.document.playback.fps;
    let (rgba, w, h, warnings) =
        crate::engine::scene::composite_scene_frame(&scene.document, tick, fps);

    let png_bytes = crate::engine::scene::encode_png_public(&rgba, w, h)
        .map_err(|e| AppError::Internal(format!("PNG encoding failed: {}", e)))?;

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("Failed to create directory: {}", e)))?;
    }

    std::fs::write(&file_path, &png_bytes)
        .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;

    Ok(SceneExportResult {
        output_path: file_path,
        width: w,
        height: h,
        warnings,
    })
}
