/** Unique scene identifier. */
export type SceneId = string;

/** Instance kind — distinguishes generic assets from character-derived instances. */
export type SceneInstanceKind = 'asset' | 'character';

/** A placed asset instance within a scene. */
export interface SceneAssetInstance {
  instanceId: string;
  /** Path to the source .pxs project file. */
  sourcePath: string;
  /** Optional asset catalog ID. */
  assetId?: string;
  /** Instance kind — 'asset' (default) or 'character'. */
  instanceKind?: SceneInstanceKind;
  /** Source character build ID this instance was derived from (character instances only). */
  sourceCharacterBuildId?: string;
  /** Snapshot of the character build's name at placement time (character instances only). */
  sourceCharacterBuildName?: string;
  /** Snapshot of equipped slots at placement time (character instances only). */
  characterSlotSnapshot?: CharacterSlotSnapshot;
  /** Local slot overrides for this character instance (character instances only). */
  characterOverrides?: CharacterInstanceOverrides;
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

/**
 * Snapshot of a character build's equipped slots at placement time.
 * Stored on scene instances so the scene can render the character
 * even if the source build is later modified or deleted.
 */
export interface CharacterSlotSnapshot {
  /** Equipped slot entries — slot ID → source part ID. */
  slots: Record<string, string>;
  /** Number of equipped slots at time of snapshot. */
  equippedCount: number;
  /** Total slots in the vocabulary at time of snapshot. */
  totalSlots: number;
}

// ── Character instance overrides ──

/** Override mode for a single slot on a character instance. */
export type CharacterSlotOverrideMode = 'replace' | 'remove';

/**
 * A local override for a single slot on a placed character instance.
 *
 * Overrides layer on top of the snapshot from the source build:
 * - 'replace': swap the slot occupant with a different part
 * - 'remove': hide/remove the slot from the effective composition
 */
export interface CharacterSlotOverride {
  /** Which slot this override applies to. */
  slot: string;
  /** Override mode. */
  mode: CharacterSlotOverrideMode;
  /** Replacement part source ID (only for 'replace' mode). */
  replacementPartId?: string;
}

/**
 * Local overrides for a character instance in a scene.
 * Keyed by slot ID. One override per slot.
 */
export type CharacterInstanceOverrides = Record<string, CharacterSlotOverride>;

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
  /** Optional human-readable name for this keyframe / shot marker. */
  name?: string;
}

/** A derived shot — a segment between two named (or boundary) keyframes. */
export interface SceneCameraShot {
  /** Shot name (from the starting keyframe, or auto-generated). */
  name: string;
  /** Starting tick (inclusive). */
  startTick: number;
  /** Ending tick (exclusive — next shot's start, or scene end). */
  endTick: number;
  /** Duration in ticks. */
  durationTicks: number;
  /** Interpolation mode of the starting keyframe. */
  interpolation: CameraInterpolationMode;
  /** Index of the starting keyframe in the sorted keyframes array. */
  keyframeIndex: number;
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
