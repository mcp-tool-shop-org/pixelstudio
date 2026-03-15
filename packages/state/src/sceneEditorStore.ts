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
import type { SceneProvenanceEntry } from './sceneProvenance';
import {
  createSceneProvenanceEntry,
  resetProvenanceSequence,
} from './sceneProvenance';
import type { SceneProvenanceDrilldownSource } from './sceneProvenanceDrilldown';
import { captureProvenanceDrilldownSource } from './sceneProvenanceDrilldown';

// ── Undo/redo result with rollback ──

export interface SceneUndoRedoResult {
  /** The restored instances to sync to backend. */
  instances: SceneAssetInstance[];
  /** Call this if backend sync fails to restore pre-undo/redo state. */
  rollback: () => void;
}

// ── Store shape ──

export interface SceneEditorState {
  /** Current scene instances — authoritative frontend state. */
  instances: SceneAssetInstance[];
  /** Undo/redo history stacks. */
  history: SceneHistoryState;
  /** Append-only provenance log for this editing session. */
  provenance: SceneProvenanceEntry[];
  /** Captured before/after slices keyed by provenance sequence. */
  drilldownBySequence: Record<number, SceneProvenanceDrilldownSource>;

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
   *
   * Returns a result with the restored instances and a rollback function,
   * or undefined if nothing to undo.
   *
   * The caller MUST sync restored instances to the backend. On failure,
   * call `rollback()` to restore the pre-undo state and history.
   */
  undo: () => SceneUndoRedoResult | undefined;

  /**
   * Redo the most recently undone edit.
   *
   * Returns a result with the restored instances and a rollback function,
   * or undefined if nothing to redo.
   *
   * The caller MUST sync restored instances to the backend. On failure,
   * call `rollback()` to restore the pre-redo state and history.
   */
  redo: () => SceneUndoRedoResult | undefined;

  // ── Lifecycle ──

  /** Reset history stacks and provenance log (call on scene change / new scene). */
  resetHistory: () => void;
}

// ── Store ──

export const useSceneEditorStore = create<SceneEditorState>((set, get) => ({
  instances: [],
  history: createEmptySceneHistoryState(),
  provenance: [],
  drilldownBySequence: {},
  canUndo: false,
  canRedo: false,

  loadInstances: (instances) => {
    set({ instances });
  },

  applyEdit: (kind, nextInstances, metadata) => {
    const { instances: current, history, provenance, drilldownBySequence } = get();
    const result = applySceneEditWithHistory(current, history, kind, nextInstances, metadata);
    // Provenance + drilldown capture only when history actually recorded an entry (not no-op, not mid-undo)
    const historyChanged = result.history !== history;
    let nextProvenance = provenance;
    let nextDrilldown = drilldownBySequence;
    if (historyChanged) {
      const entry = createSceneProvenanceEntry(kind, metadata);
      nextProvenance = [...provenance, entry];
      const source = captureProvenanceDrilldownSource(kind, current, nextInstances, metadata);
      nextDrilldown = { ...drilldownBySequence, [entry.sequence]: source };
    }
    set({
      instances: result.instances,
      history: result.history,
      provenance: nextProvenance,
      drilldownBySequence: nextDrilldown,
      canUndo: canUndoScene(result.history),
      canRedo: canRedoScene(result.history),
    });
  },

  undo: () => {
    const { history, instances: prevInstances } = get();
    const prevHistory = history;
    const result = undoSceneHistory(history);
    if (!result.snapshot) return undefined;
    const finished = finishApplyingHistory(result.history);
    set({
      instances: result.snapshot.instances,
      history: finished,
      canUndo: canUndoScene(finished),
      canRedo: canRedoScene(finished),
    });
    return {
      instances: result.snapshot.instances,
      rollback: () => {
        set({
          instances: prevInstances,
          history: prevHistory,
          canUndo: canUndoScene(prevHistory),
          canRedo: canRedoScene(prevHistory),
        });
      },
    };
  },

  redo: () => {
    const { history, instances: prevInstances } = get();
    const prevHistory = history;
    const result = redoSceneHistory(history);
    if (!result.snapshot) return undefined;
    const finished = finishApplyingHistory(result.history);
    set({
      instances: result.snapshot.instances,
      history: finished,
      canUndo: canUndoScene(finished),
      canRedo: canRedoScene(finished),
    });
    return {
      instances: result.snapshot.instances,
      rollback: () => {
        set({
          instances: prevInstances,
          history: prevHistory,
          canUndo: canUndoScene(prevHistory),
          canRedo: canRedoScene(prevHistory),
        });
      },
    };
  },

  resetHistory: () => {
    const fresh = createEmptySceneHistoryState();
    resetProvenanceSequence();
    set({
      history: fresh,
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
    });
  },
}));
