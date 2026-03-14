/** Unique scene identifier. */
export type SceneId = string;

/** A placed asset instance within a scene. */
export interface SceneAssetInstance {
  instanceId: string;
  /** Path to the source .pxs project file. */
  sourcePath: string;
  /** Optional asset catalog ID. */
  assetId?: string;
  /** Display name for the instance. */
  name: string;
  /** Which clip to play (undefined = first clip or static). */
  clipId?: string;
  /** Position in scene coordinates. */
  x: number;
  y: number;
  /** Z-order (higher = in front). */
  zOrder: number;
  /** Visibility toggle. */
  visible: boolean;
  /** Opacity 0.0–1.0. */
  opacity: number;
  /** Parallax factor: 1.0 = normal, <1.0 = background, >1.0 = foreground. */
  parallax: number;
}

/** Scene camera — defines the viewport into the scene stage. */
export interface SceneCamera {
  /** Camera center X in scene coordinates. */
  x: number;
  /** Camera center Y in scene coordinates. */
  y: number;
  /** Zoom factor (1.0 = 100%). */
  zoom: number;
  /** Optional human-readable name. */
  name?: string;
}

/** Interpolation mode between camera keyframes. */
export type CameraInterpolationMode = 'hold' | 'linear';

/** A camera keyframe — defines camera state at a specific tick. */
export interface SceneCameraKeyframe {
  /** Tick at which this keyframe takes effect. */
  tick: number;
  /** Camera X position at this tick. */
  x: number;
  /** Camera Y position at this tick. */
  y: number;
  /** Camera zoom at this tick. */
  zoom: number;
  /** Interpolation mode from previous keyframe to this one. */
  interpolation: CameraInterpolationMode;
}

/** Scene-level playback configuration. */
export interface ScenePlaybackConfig {
  fps: number;
  looping: boolean;
}

/** The core scene document. */
export interface SceneDocument {
  sceneId: SceneId;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  instances: SceneAssetInstance[];
  playback: ScenePlaybackConfig;
  createdAt: string;
  updatedAt: string;
}

/** Frontend-facing scene info summary. */
export interface SceneInfo {
  sceneId: SceneId;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  instanceCount: number;
  fps: number;
  looping: boolean;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  filePath: string | null;
  dirty: boolean;
}

// --- Clip resolution types ---

/** Status of clip resolution for a scene instance. */
export type ClipResolutionStatus =
  | 'resolved'
  | 'no_clip'
  | 'missing_source'
  | 'missing_clip'
  | 'no_clips_in_source';

/** Resolved clip info for a single scene instance. */
export interface InstanceClipState {
  instanceId: string;
  clipId: string | null;
  clipName: string | null;
  frameCount: number;
  /** Clip's own FPS override (null = use scene FPS). */
  clipFps: number | null;
  clipLoop: boolean;
  status: ClipResolutionStatus;
}

/** Full playback state for the scene. */
export interface ScenePlaybackState {
  fps: number;
  looping: boolean;
  instances: InstanceClipState[];
}

/** Scene timeline summary — total span, timing info. */
export interface SceneTimelineSummary {
  fps: number;
  looping: boolean;
  /** Total scene span in ticks (longest participating clip, minimum 1). */
  totalTicks: number;
  /** Total duration in milliseconds. */
  totalDurationMs: number;
  /** Number of instances contributing to timing. */
  contributingInstances: number;
  /** Longest individual clip frame count. */
  longestClipFrames: number;
}

/** Summary of a clip available in a source .pxs project. */
export interface SourceClipInfo {
  id: string;
  name: string;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  loopClip: boolean;
  fpsOverride: number | null;
}

/** Composited frame images from a source asset. */
export interface SourceAssetFrames {
  width: number;
  height: number;
  /** Base64-encoded PNG for each frame in clip order. */
  frames: string[];
  clipId: string | null;
  frameCount: number;
}

/** Result of exporting a scene frame. */
export interface SceneExportResult {
  outputPath: string;
  width: number;
  height: number;
  warnings: string[];
}
