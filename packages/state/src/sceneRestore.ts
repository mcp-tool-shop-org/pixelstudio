import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneHistorySnapshot } from './sceneHistory';

// ── Restore scope ──

/**
 * Which domains to include in a restore operation.
 *
 * `full` restores all authored domains: instances, camera, keyframes,
 * and playback config. Selective scopes will be added in a later commit.
 */
export type SceneRestoreScope = 'full';

// ── Restore request ──

/**
 * A fully resolved restore request.
 *
 * The source snapshot is the historical "after" state from the entry
 * being restored. The current snapshot is the live scene state.
 *
 * Restore is an explicit authored edit — it creates its own history
 * entry and provenance record, distinct from undo/redo.
 */
export interface SceneRestoreRequest {
  /** Which domains to restore. */
  scope: SceneRestoreScope;
  /** The provenance sequence number being restored. */
  sourceSequence: number;
  /** The historical "after" state to restore into the scene. */
  sourceSnapshot: SceneRestoreSnapshot;
  /** The current live scene state before restore. */
  currentSnapshot: SceneRestoreSnapshot;
}

/**
 * Scene state for restore purposes.
 *
 * Covers all authored domains. Transient playback state (isPlaying,
 * currentTick) is explicitly excluded — restore only touches authored
 * configuration.
 */
export interface SceneRestoreSnapshot {
  instances: SceneAssetInstance[];
  camera?: SceneCamera;
  keyframes?: SceneCameraKeyframe[];
  playbackConfig?: ScenePlaybackConfig;
}

// ── Restore result ──

/**
 * Reasons a restore operation cannot be performed.
 */
export type SceneRestoreUnavailableReason =
  | 'no-source-snapshot'
  | 'source-matches-current'
  | 'scope-not-supported';

/**
 * The result of a restore derivation.
 *
 * On success, provides the before/after history snapshots ready for
 * the history engine and the full authored state to apply.
 *
 * On failure, provides a reason why the restore cannot proceed.
 */
export type SceneRestoreResult =
  | {
      status: 'success';
      /** History snapshot of the state before restore (current state). */
      before: SceneHistorySnapshot;
      /** History snapshot of the state after restore (restored state). */
      after: SceneHistorySnapshot;
      /** The instances to apply. */
      instances: SceneAssetInstance[];
      /** The camera to apply (undefined means no camera data in source). */
      camera: SceneCamera | undefined;
      /** The keyframes to apply (undefined means no keyframe data in source). */
      keyframes: SceneCameraKeyframe[] | undefined;
      /** The playback config to apply (undefined means no playback data in source). */
      playbackConfig: ScenePlaybackConfig | undefined;
      /** Human-readable label for the restore operation. */
      label: string;
    }
  | {
      status: 'unavailable';
      reason: SceneRestoreUnavailableReason;
      label: string;
    };

// ── Authored domain coverage ──

/**
 * The authored domains that full restore covers.
 *
 * These are the scene domains that persist and that users author.
 * Transient playback state (isPlaying, currentTick) is NOT included.
 */
export const FULL_RESTORE_DOMAINS = [
  'instances',
  'camera',
  'keyframes',
  'playbackConfig',
] as const;

export type FullRestoreDomain = (typeof FULL_RESTORE_DOMAINS)[number];

// ── Derivation ──

/**
 * Derive a restore result from a restore request.
 *
 * Pure function — no store access, no side effects. The caller is
 * responsible for applying the result to the store and creating
 * history/provenance entries.
 *
 * Full restore replaces all authored domains from the source snapshot.
 * When the source snapshot lacks a domain (e.g., camera is undefined),
 * the current value for that domain is preserved — restore never
 * destructively clears data that wasn't captured in the source.
 */
export function deriveSceneRestore(request: SceneRestoreRequest): SceneRestoreResult {
  const { scope, sourceSequence, sourceSnapshot, currentSnapshot } = request;

  // Scope guard — only 'full' is supported in this commit
  if (scope !== 'full') {
    return {
      status: 'unavailable',
      reason: 'scope-not-supported',
      label: `Restore #${sourceSequence}: scope "${scope}" not yet supported.`,
    };
  }

  // Source must have at least instances
  if (!sourceSnapshot.instances) {
    return {
      status: 'unavailable',
      reason: 'no-source-snapshot',
      label: `Restore #${sourceSequence}: no source snapshot data available.`,
    };
  }

  // Derive the "after" state: source snapshot merged with current for missing domains
  const restoredInstances = deepCloneInstances(sourceSnapshot.instances);
  const restoredCamera = sourceSnapshot.camera !== undefined
    ? { ...sourceSnapshot.camera }
    : currentSnapshot.camera !== undefined
      ? { ...currentSnapshot.camera }
      : undefined;
  const restoredKeyframes = sourceSnapshot.keyframes !== undefined
    ? deepCloneKeyframes(sourceSnapshot.keyframes)
    : currentSnapshot.keyframes !== undefined
      ? deepCloneKeyframes(currentSnapshot.keyframes)
      : undefined;
  const restoredPlayback = sourceSnapshot.playbackConfig !== undefined
    ? { ...sourceSnapshot.playbackConfig }
    : currentSnapshot.playbackConfig !== undefined
      ? { ...currentSnapshot.playbackConfig }
      : undefined;

  // Build history snapshots
  const before: SceneHistorySnapshot = {
    instances: deepCloneInstances(currentSnapshot.instances),
  };
  if (currentSnapshot.camera !== undefined) {
    before.camera = { ...currentSnapshot.camera };
  }
  if (currentSnapshot.keyframes !== undefined) {
    before.keyframes = deepCloneKeyframes(currentSnapshot.keyframes);
  }

  const after: SceneHistorySnapshot = {
    instances: deepCloneInstances(restoredInstances),
  };
  if (restoredCamera !== undefined) {
    after.camera = { ...restoredCamera };
  }
  if (restoredKeyframes !== undefined) {
    after.keyframes = deepCloneKeyframes(restoredKeyframes);
  }

  // No-op guard: if before and after are identical, this is a no-change restore
  if (
    JSON.stringify(before.instances) === JSON.stringify(after.instances) &&
    JSON.stringify(before.camera) === JSON.stringify(after.camera) &&
    JSON.stringify(before.keyframes) === JSON.stringify(after.keyframes) &&
    JSON.stringify(restoredPlayback) === JSON.stringify(currentSnapshot.playbackConfig)
  ) {
    return {
      status: 'unavailable',
      reason: 'source-matches-current',
      label: `Restore #${sourceSequence}: source matches current scene state.`,
    };
  }

  return {
    status: 'success',
    before,
    after,
    instances: restoredInstances,
    camera: restoredCamera,
    keyframes: restoredKeyframes,
    playbackConfig: restoredPlayback,
    label: describeSceneRestore(sourceSequence, scope),
  };
}

// ── Label helper ──

/**
 * Generate a human-readable label for a restore operation.
 */
export function describeSceneRestore(
  sourceSequence: number,
  scope: SceneRestoreScope,
): string {
  if (scope === 'full') {
    return `Restore #${sourceSequence}`;
  }
  return `Restore #${sourceSequence} (${scope})`;
}

// ── Deep clone helpers ──

function deepCloneInstances(instances: SceneAssetInstance[]): SceneAssetInstance[] {
  return JSON.parse(JSON.stringify(instances)) as SceneAssetInstance[];
}

function deepCloneKeyframes(keyframes: SceneCameraKeyframe[]): SceneCameraKeyframe[] {
  return JSON.parse(JSON.stringify(keyframes)) as SceneCameraKeyframe[];
}
