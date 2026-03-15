import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe } from '@glyphstudio/domain';
import type {
  SceneHistoryEntry,
  SceneHistorySnapshot,
  SceneHistoryOperationKind,
  SceneHistoryOperationMetadata,
} from './sceneHistory';
import { captureSceneSnapshot, createSceneHistoryEntry } from './sceneHistory';

// ── History state ──

const DEFAULT_MAX_ENTRIES = 100;

/**
 * Scene history stack state.
 *
 * `past` holds entries in chronological order — the most recent edit is last.
 * `future` holds entries that were undone — the next redo candidate is last.
 * `isApplyingHistory` guards against re-recording during undo/redo restore.
 */
export interface SceneHistoryState {
  past: SceneHistoryEntry[];
  future: SceneHistoryEntry[];
  maxEntries: number;
  isApplyingHistory: boolean;
}

export function createEmptySceneHistoryState(
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): SceneHistoryState {
  return {
    past: [],
    future: [],
    maxEntries,
    isApplyingHistory: false,
  };
}

// ── Query helpers ──

export function canUndoScene(history: SceneHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoScene(history: SceneHistoryState): boolean {
  return history.future.length > 0;
}

// ── Record ──

/**
 * Append a history entry to `past` and clear `future`.
 *
 * Enforces `maxEntries` by trimming the oldest entries from the front.
 */
export function recordSceneHistoryEntry(
  history: SceneHistoryState,
  entry: SceneHistoryEntry,
): SceneHistoryState {
  const newPast = [...history.past, entry];
  // Trim oldest if over capacity
  while (newPast.length > history.maxEntries) {
    newPast.shift();
  }
  return {
    ...history,
    past: newPast,
    future: [],
  };
}

// ── Undo ──

export interface SceneHistoryUndoResult {
  history: SceneHistoryState;
  snapshot: SceneHistorySnapshot | undefined;
}

/**
 * Undo the most recent scene edit.
 *
 * Pops the last `past` entry, pushes it onto `future`, and returns the
 * entry's `before` snapshot for the caller to restore.
 *
 * Returns `snapshot: undefined` if there is nothing to undo.
 */
export function undoSceneHistory(
  history: SceneHistoryState,
): SceneHistoryUndoResult {
  if (history.past.length === 0) {
    return { history, snapshot: undefined };
  }
  const newPast = [...history.past];
  const entry = newPast.pop()!;
  return {
    history: {
      ...history,
      past: newPast,
      future: [...history.future, entry],
      isApplyingHistory: true,
    },
    snapshot: entry.before,
  };
}

// ── Redo ──

export interface SceneHistoryRedoResult {
  history: SceneHistoryState;
  snapshot: SceneHistorySnapshot | undefined;
}

/**
 * Redo the most recently undone scene edit.
 *
 * Pops the last `future` entry, pushes it onto `past`, and returns the
 * entry's `after` snapshot for the caller to restore.
 *
 * Returns `snapshot: undefined` if there is nothing to redo.
 */
export function redoSceneHistory(
  history: SceneHistoryState,
): SceneHistoryRedoResult {
  if (history.future.length === 0) {
    return { history, snapshot: undefined };
  }
  const newFuture = [...history.future];
  const entry = newFuture.pop()!;
  return {
    history: {
      ...history,
      past: [...history.past, entry],
      future: newFuture,
      isApplyingHistory: true,
    },
    snapshot: entry.after,
  };
}

// ── Mark history application complete ──

/**
 * Clear the `isApplyingHistory` guard after the caller has finished restoring
 * the snapshot. Call this after applying undo/redo to allow normal recording
 * to resume.
 */
export function finishApplyingHistory(
  history: SceneHistoryState,
): SceneHistoryState {
  return { ...history, isApplyingHistory: false };
}

// ── Canonical front door ──

export interface ApplySceneEditResult {
  instances: SceneAssetInstance[];
  camera?: SceneCamera;
  keyframes?: SceneCameraKeyframe[];
  history: SceneHistoryState;
}

/**
 * The single lawful front door for recorded scene edits.
 *
 * 1. Captures deep-cloned before/after snapshots.
 * 2. Builds a history entry via the 16.1 contract helper.
 * 3. Skips recording if the edit is a no-op (before === after).
 * 4. Appends to `past`, clears `future`.
 * 5. Returns the new instances and history state.
 *
 * If `history.isApplyingHistory` is true (we are mid-undo/redo), the edit
 * is applied but NOT recorded — this prevents undo/redo from creating
 * ghost entries.
 */
export function applySceneEditWithHistory(
  currentInstances: SceneAssetInstance[],
  history: SceneHistoryState,
  kind: SceneHistoryOperationKind,
  nextInstances: SceneAssetInstance[],
  metadata?: SceneHistoryOperationMetadata,
  currentCamera?: SceneCamera,
  nextCamera?: SceneCamera,
  currentKeyframes?: SceneCameraKeyframe[],
  nextKeyframes?: SceneCameraKeyframe[],
): ApplySceneEditResult {
  // If we're mid-undo/redo, apply the edit but don't record it
  if (history.isApplyingHistory) {
    return { instances: nextInstances, camera: nextCamera, keyframes: nextKeyframes, history };
  }

  const before = captureSceneSnapshot(currentInstances, currentCamera, currentKeyframes);
  const after = captureSceneSnapshot(nextInstances, nextCamera, nextKeyframes);
  const entry = createSceneHistoryEntry(kind, before, after, metadata);

  if (!entry) {
    // No-op — scene didn't change
    return { instances: nextInstances, camera: nextCamera, keyframes: nextKeyframes, history };
  }

  return {
    instances: nextInstances,
    camera: nextCamera,
    keyframes: nextKeyframes,
    history: recordSceneHistoryEntry(history, entry),
  };
}
