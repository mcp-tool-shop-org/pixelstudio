import { create } from 'zustand';
import type { SceneAssetInstance } from '@glyphstudio/domain';
import type {
  SceneHistoryOperationKind,
  SceneHistoryOperationMetadata,
} from './sceneHistory';
import type { SceneHistoryState } from './sceneHistoryEngine';
import {
  createEmptySceneHistoryState,
  canUndoScene,
  canRedoScene,
  applySceneEditWithHistory,
  undoSceneHistory,
  redoSceneHistory,
  finishApplyingHistory,
} from './sceneHistoryEngine';

// ── Store shape ──

export interface SceneEditorState {
  /** Current scene instances — authoritative frontend state. */
  instances: SceneAssetInstance[];
  /** Undo/redo history stacks. */
  history: SceneHistoryState;

  // ── Queries ──

  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;

  // ── Non-history state updates ──

  /**
   * Load instances from backend without recording history.
   * Used for initial load and periodic refresh.
   */
  loadInstances: (instances: SceneAssetInstance[]) => void;

  // ── History-producing edits ──

  /**
   * Record a scene edit with history.
   *
   * Call this AFTER a successful backend mutation with the resulting
   * (authoritative) scene instances. The store captures its current
   * instances as `before` and the provided instances as `after`.
   *
   * No-ops are automatically skipped.
   */
  applyEdit: (
    kind: SceneHistoryOperationKind,
    nextInstances: SceneAssetInstance[],
    metadata?: SceneHistoryOperationMetadata,
  ) => void;

  // ── Undo / Redo ──

  /**
   * Undo the most recent edit.
   * Returns the restored instances array, or undefined if nothing to undo.
   * The caller is responsible for syncing the restored state to the backend.
   */
  undo: () => SceneAssetInstance[] | undefined;

  /**
   * Redo the most recently undone edit.
   * Returns the restored instances array, or undefined if nothing to redo.
   * The caller is responsible for syncing the restored state to the backend.
   */
  redo: () => SceneAssetInstance[] | undefined;

  // ── Lifecycle ──

  /** Reset history stacks (call on scene change / new scene). */
  resetHistory: () => void;
}

// ── Store ──

export const useSceneEditorStore = create<SceneEditorState>((set, get) => ({
  instances: [],
  history: createEmptySceneHistoryState(),
  canUndo: false,
  canRedo: false,

  loadInstances: (instances) => {
    set({ instances });
  },

  applyEdit: (kind, nextInstances, metadata) => {
    const { instances: current, history } = get();
    const result = applySceneEditWithHistory(current, history, kind, nextInstances, metadata);
    set({
      instances: result.instances,
      history: result.history,
      canUndo: canUndoScene(result.history),
      canRedo: canRedoScene(result.history),
    });
  },

  undo: () => {
    const { history } = get();
    const result = undoSceneHistory(history);
    if (!result.snapshot) return undefined;
    const finished = finishApplyingHistory(result.history);
    set({
      instances: result.snapshot.instances,
      history: finished,
      canUndo: canUndoScene(finished),
      canRedo: canRedoScene(finished),
    });
    return result.snapshot.instances;
  },

  redo: () => {
    const { history } = get();
    const result = redoSceneHistory(history);
    if (!result.snapshot) return undefined;
    const finished = finishApplyingHistory(result.history);
    set({
      instances: result.snapshot.instances,
      history: finished,
      canUndo: canUndoScene(finished),
      canRedo: canRedoScene(finished),
    });
    return result.snapshot.instances;
  },

  resetHistory: () => {
    const fresh = createEmptySceneHistoryState();
    set({
      history: fresh,
      canUndo: false,
      canRedo: false,
    });
  },
}));
