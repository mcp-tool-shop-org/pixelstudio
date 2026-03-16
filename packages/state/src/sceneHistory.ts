import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe } from '@glyphstudio/domain';

// ── Operation kinds ──

/**
 * Reversible scene edit operation kinds.
 *
 * Each kind maps to a specific user action that produces a history entry.
 * reapply, unlink, and relink are distinct — they must never be collapsed
 * into a generic "update instance" bucket.
 */
export type SceneHistoryOperationKind =
  | 'add-instance'
  | 'remove-instance'
  | 'move-instance'
  | 'set-instance-visibility'
  | 'set-instance-opacity'
  | 'set-instance-layer'
  | 'set-instance-clip'
  | 'set-instance-parallax'
  | 'reapply-character-source'
  | 'unlink-character-source'
  | 'relink-character-source'
  | 'set-character-override'
  | 'remove-character-override'
  | 'clear-all-character-overrides'
  | 'set-scene-camera'
  | 'set-scene-playback'
  | 'add-camera-keyframe'
  | 'remove-camera-keyframe'
  | 'move-camera-keyframe'
  | 'edit-camera-keyframe'
  | 'restore-entry';

// ── Operation metadata ──

/**
 * Narrow metadata per operation kind.
 *
 * Metadata describes *which* thing was edited, not *how*.
 * The before/after snapshots are the source of truth for state.
 */
export interface SceneHistoryInstanceMeta {
  instanceId: string;
}

export interface SceneHistoryOverrideMeta {
  instanceId: string;
  slotId: string;
}

export interface SceneHistoryCameraMeta {
  changedFields?: string[];
  /** Camera state before the edit — captured for drilldown inspection. */
  beforeCamera?: SceneCamera;
  /** Camera state after the edit — captured for drilldown inspection. */
  afterCamera?: SceneCamera;
}

export interface SceneHistoryKeyframeMeta {
  /** Tick position identifying the target keyframe. */
  tick: number;
  /** Which fields changed (for edit operations). */
  changedFields?: string[];
  /** Previous tick position (for move operations). */
  previousTick?: number;
}

export interface SceneHistoryRestoreMeta {
  /** The provenance sequence number of the entry being restored. */
  sourceSequence: number;
  /** Restore scope — which authored domain(s) are being restored. */
  scope: 'full' | 'camera' | 'keyframes' | 'instances';
}

export type SceneHistoryOperationMetadata =
  | SceneHistoryInstanceMeta
  | SceneHistoryOverrideMeta
  | SceneHistoryCameraMeta
  | SceneHistoryKeyframeMeta
  | SceneHistoryRestoreMeta
  | undefined;

// ── Snapshot ──

/**
 * A scene history snapshot — the mutable scene state that undo/redo restores.
 *
 * Uses the same shape the backend persists (SceneAssetInstance[]).
 * Includes all character fields: snapshot, overrides, linkMode, source metadata.
 *
 * Undo restores the stored snapshot exactly — it does NOT recalculate from
 * current library/source state. Old characterLinkMode, old overrides, old
 * slot snapshot all come back verbatim.
 *
 * Camera is optional — present when the edit involves camera state.
 * Instance-only edits omit camera. Camera-only edits include camera
 * but instances may be unchanged. Undo/redo restores whichever fields
 * are present.
 */
export interface SceneHistorySnapshot {
  instances: SceneAssetInstance[];
  /** Camera state at this point in time. Present for camera-aware edits. */
  camera?: SceneCamera;
  /** Authored camera keyframes at this point in time. Present for keyframe-aware edits. */
  keyframes?: SceneCameraKeyframe[];
}

// ── History entry ──

/**
 * A single scene history entry.
 *
 * Stores both before and after snapshots for bidirectional replay.
 * No reconstructive wizardry — undo swaps to `before`, redo swaps to `after`.
 */
export interface SceneHistoryEntry {
  /** Which operation produced this entry. */
  kind: SceneHistoryOperationKind;
  /** Human-readable label for UI / debug surfaces. */
  label: string;
  /** Scene state before the operation. */
  before: SceneHistorySnapshot;
  /** Scene state after the operation. */
  after: SceneHistorySnapshot;
  /** Narrow metadata identifying what was edited. */
  metadata?: SceneHistoryOperationMetadata;
}

// ── Helpers ──

/** Human-readable labels for each operation kind. */
const OPERATION_LABELS: Record<SceneHistoryOperationKind, string> = {
  'add-instance': 'Add Instance',
  'remove-instance': 'Remove Instance',
  'move-instance': 'Move Instance',
  'set-instance-visibility': 'Toggle Visibility',
  'set-instance-opacity': 'Change Opacity',
  'set-instance-layer': 'Change Layer Order',
  'set-instance-clip': 'Change Clip',
  'set-instance-parallax': 'Change Parallax',
  'reapply-character-source': 'Reapply From Source',
  'unlink-character-source': 'Unlink From Source',
  'relink-character-source': 'Relink To Source',
  'set-character-override': 'Edit Character Override',
  'remove-character-override': 'Remove Character Override',
  'clear-all-character-overrides': 'Clear All Overrides',
  'set-scene-camera': 'Edit Camera',
  'set-scene-playback': 'Edit Playback',
  'add-camera-keyframe': 'Add Camera Keyframe',
  'remove-camera-keyframe': 'Remove Camera Keyframe',
  'move-camera-keyframe': 'Move Camera Keyframe',
  'edit-camera-keyframe': 'Edit Camera Keyframe',
  'restore-entry': 'Restore Entry',
};

/**
 * Get a human-readable label for a scene history operation.
 */
export function describeSceneHistoryOperation(kind: SceneHistoryOperationKind): string {
  return OPERATION_LABELS[kind];
}

/**
 * Determine whether two scene snapshots differ materially.
 *
 * Returns `true` when the snapshots represent different persisted scene content.
 * Uses JSON serialization for deep equality — correct for the scene instance shape
 * which has no functions, symbols, or circular references.
 *
 * This prevents ghost history entries from no-op edits or refresh cycles
 * that re-read the same scene state.
 */
export function isSceneHistoryChange(
  before: SceneHistorySnapshot,
  after: SceneHistorySnapshot,
): boolean {
  if (JSON.stringify(before.instances) !== JSON.stringify(after.instances)) {
    return true;
  }
  // Camera change detection — only when at least one snapshot carries camera
  if (before.camera || after.camera) {
    if (JSON.stringify(before.camera) !== JSON.stringify(after.camera)) {
      return true;
    }
  }
  // Keyframe change detection — only when at least one snapshot carries keyframes
  if (before.keyframes || after.keyframes) {
    if (JSON.stringify(before.keyframes) !== JSON.stringify(after.keyframes)) {
      return true;
    }
  }
  return false;
}

/**
 * Create a scene history entry.
 *
 * Returns `undefined` if the before/after snapshots are identical (no-op guard).
 */
export function createSceneHistoryEntry(
  kind: SceneHistoryOperationKind,
  before: SceneHistorySnapshot,
  after: SceneHistorySnapshot,
  metadata?: SceneHistoryOperationMetadata,
): SceneHistoryEntry | undefined {
  if (!isSceneHistoryChange(before, after)) {
    return undefined;
  }
  return {
    kind,
    label: describeSceneHistoryOperation(kind),
    before,
    after,
    metadata,
  };
}

/**
 * Capture a snapshot of the current scene state.
 *
 * Deep-clones instances (and camera when provided) to prevent aliasing
 * between history entries and live state.
 */
export function captureSceneSnapshot(
  instances: SceneAssetInstance[],
  camera?: SceneCamera,
  keyframes?: SceneCameraKeyframe[],
): SceneHistorySnapshot {
  const snapshot: SceneHistorySnapshot = {
    instances: JSON.parse(JSON.stringify(instances)) as SceneAssetInstance[],
  };
  if (camera !== undefined) {
    snapshot.camera = { ...camera };
  }
  if (keyframes !== undefined) {
    snapshot.keyframes = JSON.parse(JSON.stringify(keyframes)) as SceneCameraKeyframe[];
  }
  return snapshot;
}

/**
 * All operation kinds as an array — useful for exhaustiveness checks in tests.
 */
export const ALL_SCENE_HISTORY_OPERATION_KINDS: SceneHistoryOperationKind[] = [
  'add-instance',
  'remove-instance',
  'move-instance',
  'set-instance-visibility',
  'set-instance-opacity',
  'set-instance-layer',
  'set-instance-clip',
  'set-instance-parallax',
  'reapply-character-source',
  'unlink-character-source',
  'relink-character-source',
  'set-character-override',
  'remove-character-override',
  'clear-all-character-overrides',
  'set-scene-camera',
  'set-scene-playback',
  'add-camera-keyframe',
  'remove-camera-keyframe',
  'move-camera-keyframe',
  'edit-camera-keyframe',
  'restore-entry',
];
