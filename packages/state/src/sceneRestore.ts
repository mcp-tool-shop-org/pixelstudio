import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneHistorySnapshot } from './sceneHistory';

// ── Restore scope ──

/**
 * Which domains to include in a restore operation.
 *
 * `full` restores all authored domains: instances, camera, keyframes,
 * and playback config. Domain-scoped restores restore only the selected
 * authored domain and preserve all others.
 *
 * `playback` is intentionally excluded as a standalone scope because
 * playbackConfig is not yet part of SceneHistorySnapshot. Playback-only
 * edits are invisible to the history engine, so standalone playback
 * restore cannot participate honestly in undo/redo/provenance.
 * Playback is still restored as part of `full`.
 */
export type SceneRestoreScope = 'full' | 'camera' | 'keyframes' | 'instances';

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
  | 'scope-not-supported'
  | 'missing-domain-data';

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

// ── Scope labels ──

/** Operator-readable labels for restore scopes. */
export const RESTORE_SCOPE_LABELS: Record<SceneRestoreScope, string> = {
  full: 'Full Scene',
  camera: 'Camera',
  keyframes: 'Keyframes',
  instances: 'Instances',
};

/** The domain-scoped restore scopes (excludes 'full'). */
export const SELECTIVE_RESTORE_SCOPES: SceneRestoreScope[] = [
  'instances',
  'camera',
  'keyframes',
];

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
 *
 * Domain-scoped restore replaces only the selected domain and preserves
 * all other domains exactly as-is.
 */
export function deriveSceneRestore(request: SceneRestoreRequest): SceneRestoreResult {
  const { scope, sourceSequence, sourceSnapshot, currentSnapshot } = request;

  switch (scope) {
    case 'full':
      return deriveFullRestore(sourceSequence, sourceSnapshot, currentSnapshot);
    case 'camera':
      return deriveCameraRestore(sourceSequence, sourceSnapshot, currentSnapshot);
    case 'keyframes':
      return deriveKeyframesRestore(sourceSequence, sourceSnapshot, currentSnapshot);
    case 'instances':
      return deriveInstancesRestore(sourceSequence, sourceSnapshot, currentSnapshot);
    default:
      return {
        status: 'unavailable',
        reason: 'scope-not-supported',
        label: `Restore #${sourceSequence}: scope "${scope as string}" not supported.`,
      };
  }
}

// ── Full restore ──

function deriveFullRestore(
  sourceSequence: number,
  sourceSnapshot: SceneRestoreSnapshot,
  currentSnapshot: SceneRestoreSnapshot,
): SceneRestoreResult {
  if (!sourceSnapshot.instances) {
    return {
      status: 'unavailable',
      reason: 'no-source-snapshot',
      label: `Restore #${sourceSequence}: no source snapshot data available.`,
    };
  }

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

  const before = buildHistorySnapshot(currentSnapshot);
  const after = buildHistorySnapshot({
    instances: restoredInstances,
    camera: restoredCamera,
    keyframes: restoredKeyframes,
  });

  if (isNoOp(before, after, restoredPlayback, currentSnapshot.playbackConfig)) {
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
    label: describeSceneRestore(sourceSequence, 'full'),
  };
}

// ── Camera-only restore ──

function deriveCameraRestore(
  sourceSequence: number,
  sourceSnapshot: SceneRestoreSnapshot,
  currentSnapshot: SceneRestoreSnapshot,
): SceneRestoreResult {
  if (sourceSnapshot.camera === undefined) {
    return {
      status: 'unavailable',
      reason: 'missing-domain-data',
      label: `Restore #${sourceSequence} (Camera): no camera data in source entry.`,
    };
  }

  const restoredCamera = { ...sourceSnapshot.camera };
  const currentInstances = deepCloneInstances(currentSnapshot.instances);
  const currentKeyframes = currentSnapshot.keyframes !== undefined
    ? deepCloneKeyframes(currentSnapshot.keyframes) : undefined;
  const currentPlayback = currentSnapshot.playbackConfig !== undefined
    ? { ...currentSnapshot.playbackConfig } : undefined;

  const before = buildHistorySnapshot(currentSnapshot);
  const after = buildHistorySnapshot({
    instances: currentInstances,
    camera: restoredCamera,
    keyframes: currentKeyframes,
  });

  if (
    JSON.stringify(before.camera) === JSON.stringify(after.camera)
  ) {
    return {
      status: 'unavailable',
      reason: 'source-matches-current',
      label: `Restore #${sourceSequence} (Camera): camera already matches source.`,
    };
  }

  return {
    status: 'success',
    before,
    after,
    instances: currentInstances,
    camera: restoredCamera,
    keyframes: currentKeyframes,
    playbackConfig: currentPlayback,
    label: describeSceneRestore(sourceSequence, 'camera'),
  };
}

// ── Keyframes-only restore ──

function deriveKeyframesRestore(
  sourceSequence: number,
  sourceSnapshot: SceneRestoreSnapshot,
  currentSnapshot: SceneRestoreSnapshot,
): SceneRestoreResult {
  if (sourceSnapshot.keyframes === undefined) {
    return {
      status: 'unavailable',
      reason: 'missing-domain-data',
      label: `Restore #${sourceSequence} (Keyframes): no keyframe data in source entry.`,
    };
  }

  const restoredKeyframes = deepCloneKeyframes(sourceSnapshot.keyframes);
  const currentInstances = deepCloneInstances(currentSnapshot.instances);
  const currentCamera = currentSnapshot.camera !== undefined
    ? { ...currentSnapshot.camera } : undefined;
  const currentPlayback = currentSnapshot.playbackConfig !== undefined
    ? { ...currentSnapshot.playbackConfig } : undefined;

  const before = buildHistorySnapshot(currentSnapshot);
  const after = buildHistorySnapshot({
    instances: currentInstances,
    camera: currentCamera,
    keyframes: restoredKeyframes,
  });

  if (
    JSON.stringify(before.keyframes) === JSON.stringify(after.keyframes)
  ) {
    return {
      status: 'unavailable',
      reason: 'source-matches-current',
      label: `Restore #${sourceSequence} (Keyframes): keyframes already match source.`,
    };
  }

  return {
    status: 'success',
    before,
    after,
    instances: currentInstances,
    camera: currentCamera,
    keyframes: restoredKeyframes,
    playbackConfig: currentPlayback,
    label: describeSceneRestore(sourceSequence, 'keyframes'),
  };
}

// ── Instances-only restore ──

function deriveInstancesRestore(
  sourceSequence: number,
  sourceSnapshot: SceneRestoreSnapshot,
  currentSnapshot: SceneRestoreSnapshot,
): SceneRestoreResult {
  if (!sourceSnapshot.instances || sourceSnapshot.instances.length === 0) {
    return {
      status: 'unavailable',
      reason: 'missing-domain-data',
      label: `Restore #${sourceSequence} (Instances): no instance data in source entry.`,
    };
  }

  const restoredInstances = deepCloneInstances(sourceSnapshot.instances);
  const currentCamera = currentSnapshot.camera !== undefined
    ? { ...currentSnapshot.camera } : undefined;
  const currentKeyframes = currentSnapshot.keyframes !== undefined
    ? deepCloneKeyframes(currentSnapshot.keyframes) : undefined;
  const currentPlayback = currentSnapshot.playbackConfig !== undefined
    ? { ...currentSnapshot.playbackConfig } : undefined;

  const before = buildHistorySnapshot(currentSnapshot);
  const after = buildHistorySnapshot({
    instances: restoredInstances,
    camera: currentCamera,
    keyframes: currentKeyframes,
  });

  if (
    JSON.stringify(before.instances) === JSON.stringify(after.instances)
  ) {
    return {
      status: 'unavailable',
      reason: 'source-matches-current',
      label: `Restore #${sourceSequence} (Instances): instances already match source.`,
    };
  }

  return {
    status: 'success',
    before,
    after,
    instances: restoredInstances,
    camera: currentCamera,
    keyframes: currentKeyframes,
    playbackConfig: currentPlayback,
    label: describeSceneRestore(sourceSequence, 'instances'),
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
  return `Restore #${sourceSequence} (${RESTORE_SCOPE_LABELS[scope]})`;
}

// ── Internal helpers ──

function deepCloneInstances(instances: SceneAssetInstance[]): SceneAssetInstance[] {
  return JSON.parse(JSON.stringify(instances)) as SceneAssetInstance[];
}

function deepCloneKeyframes(keyframes: SceneCameraKeyframe[]): SceneCameraKeyframe[] {
  return JSON.parse(JSON.stringify(keyframes)) as SceneCameraKeyframe[];
}

function buildHistorySnapshot(snapshot: SceneRestoreSnapshot): SceneHistorySnapshot {
  const result: SceneHistorySnapshot = {
    instances: deepCloneInstances(snapshot.instances),
  };
  if (snapshot.camera !== undefined) {
    result.camera = { ...snapshot.camera };
  }
  if (snapshot.keyframes !== undefined) {
    result.keyframes = deepCloneKeyframes(snapshot.keyframes);
  }
  return result;
}

function isNoOp(
  before: SceneHistorySnapshot,
  after: SceneHistorySnapshot,
  restoredPlayback: ScenePlaybackConfig | undefined,
  currentPlayback: ScenePlaybackConfig | undefined,
): boolean {
  return (
    JSON.stringify(before.instances) === JSON.stringify(after.instances) &&
    JSON.stringify(before.camera) === JSON.stringify(after.camera) &&
    JSON.stringify(before.keyframes) === JSON.stringify(after.keyframes) &&
    JSON.stringify(restoredPlayback) === JSON.stringify(currentPlayback)
  );
}
