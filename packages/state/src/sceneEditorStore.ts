import { create } from 'zustand';
import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe } from '@glyphstudio/domain';
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
  setProvenanceSequence,
} from './sceneProvenance';
import type { SceneProvenanceDrilldownSource } from './sceneProvenanceDrilldown';
import { captureProvenanceDrilldownSource } from './sceneProvenanceDrilldown';

// ── Undo/redo result with rollback ──

export interface SceneUndoRedoResult {
  /** The restored instances to sync to backend. */
  instances: SceneAssetInstance[];
  /** The restored camera state, if the undone/redone edit involved camera. */
  camera?: SceneCamera;
  /** The restored keyframes, if the undone/redone edit involved keyframes. */
  keyframes?: SceneCameraKeyframe[];
  /** Call this if backend sync fails to restore pre-undo/redo state. */
  rollback: () => void;
}

// ── Store shape ──

export interface SceneEditorState {
  /** Current scene instances — authoritative frontend state. */
  instances: SceneAssetInstance[];
  /** Current camera state — tracked for history snapshot capture. */
  camera: SceneCamera | undefined;
  /** Current authored keyframes — tracked for history snapshot capture. */
  keyframes: SceneCameraKeyframe[];
  /** Undo/redo history stacks. */
  history: SceneHistoryState;
  /** Append-only provenance log — persists with the scene document. */
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

  /**
   * Load camera state without recording history.
   * Used for initial load, refresh, and playback-driven camera updates.
   */
  loadCamera: (camera: SceneCamera) => void;

  /**
   * Load authored keyframes without recording history.
   * Used for initial load and refresh from backend.
   */
  loadKeyframes: (keyframes: SceneCameraKeyframe[]) => void;

  // ── History-producing edits ──

  /**
   * Record a scene edit with history.
   *
   * Call this AFTER a successful backend mutation with the resulting
   * (authoritative) scene state. The store captures its current
   * state as `before` and the provided state as `after`.
   *
   * For camera edits, pass `nextCamera` to include camera state in the
   * history snapshot. For keyframe edits, pass `nextKeyframes`.
   *
   * No-ops are automatically skipped.
   */
  applyEdit: (
    kind: SceneHistoryOperationKind,
    nextInstances: SceneAssetInstance[],
    metadata?: SceneHistoryOperationMetadata,
    nextCamera?: SceneCamera,
    nextKeyframes?: SceneCameraKeyframe[],
  ) => void;

  // ── Undo / Redo ──

  /**
   * Undo the most recent edit.
   *
   * Returns a result with the restored instances, optional camera,
   * and a rollback function, or undefined if nothing to undo.
   *
   * The caller MUST sync restored instances (and camera if present)
   * to the backend. On failure, call `rollback()` to restore the
   * pre-undo state and history.
   */
  undo: () => SceneUndoRedoResult | undefined;

  /**
   * Redo the most recently undone edit.
   *
   * Returns a result with the restored instances, optional camera,
   * and a rollback function, or undefined if nothing to redo.
   *
   * The caller MUST sync restored instances (and camera if present)
   * to the backend. On failure, call `rollback()` to restore the
   * pre-redo state and history.
   */
  redo: () => SceneUndoRedoResult | undefined;

  // ── Persistence hydration ──

  /**
   * Hydrate provenance and drilldown from persisted scene data.
   * Does NOT create history entries or append provenance — this is pure state restoration.
   * Sets the sequence counter to max(persisted sequences) + 1 so new edits don't collide.
   */
  loadPersistedProvenance: (
    provenance: SceneProvenanceEntry[],
    drilldownBySequence: Record<number, SceneProvenanceDrilldownSource>,
  ) => void;

  // ── Lifecycle ──

  /** Reset history stacks and provenance log (call on scene change / new scene). */
  resetHistory: () => void;
}

// ── Store ──

export const useSceneEditorStore = create<SceneEditorState>((set, get) => ({
  instances: [],
  camera: undefined,
  keyframes: [],
  history: createEmptySceneHistoryState(),
  provenance: [],
  drilldownBySequence: {},
  canUndo: false,
  canRedo: false,

  loadInstances: (instances) => {
    set({ instances });
  },

  loadCamera: (camera) => {
    set({ camera });
  },

  loadKeyframes: (keyframes) => {
    set({ keyframes });
  },

  applyEdit: (kind, nextInstances, metadata, nextCamera, nextKeyframes) => {
    const { instances: current, camera: currentCamera, keyframes: currentKeyframes, history, provenance, drilldownBySequence } = get();
    const result = applySceneEditWithHistory(
      current, history, kind, nextInstances, metadata, currentCamera, nextCamera,
      currentKeyframes.length > 0 || nextKeyframes ? currentKeyframes : undefined,
      nextKeyframes,
    );
    // Provenance + drilldown capture only when history actually recorded an entry (not no-op, not mid-undo)
    const historyChanged = result.history !== history;
    let newProvenance = provenance;
    let newDrilldown = drilldownBySequence;
    if (historyChanged) {
      const entry = createSceneProvenanceEntry(kind, metadata);
      newProvenance = [...provenance, entry];
      const source = captureProvenanceDrilldownSource(
        kind, current, nextInstances, metadata, currentCamera, nextCamera,
        currentKeyframes.length > 0 || nextKeyframes ? currentKeyframes : undefined,
        nextKeyframes,
      );
      newDrilldown = { ...drilldownBySequence, [entry.sequence]: source };
    }
    set({
      instances: result.instances,
      camera: nextCamera ?? currentCamera,
      keyframes: nextKeyframes ?? currentKeyframes,
      history: result.history,
      provenance: newProvenance,
      drilldownBySequence: newDrilldown,
      canUndo: canUndoScene(result.history),
      canRedo: canRedoScene(result.history),
    });
  },

  undo: () => {
    const { history, instances: prevInstances, camera: prevCamera, keyframes: prevKeyframes } = get();
    const prevHistory = history;
    const result = undoSceneHistory(history);
    if (!result.snapshot) return undefined;
    const finished = finishApplyingHistory(result.history);
    const restoredCamera = result.snapshot.camera;
    const restoredKeyframes = result.snapshot.keyframes;
    set({
      instances: result.snapshot.instances,
      camera: restoredCamera ?? prevCamera,
      keyframes: restoredKeyframes ?? prevKeyframes,
      history: finished,
      canUndo: canUndoScene(finished),
      canRedo: canRedoScene(finished),
    });
    return {
      instances: result.snapshot.instances,
      camera: restoredCamera,
      keyframes: restoredKeyframes,
      rollback: () => {
        set({
          instances: prevInstances,
          camera: prevCamera,
          keyframes: prevKeyframes,
          history: prevHistory,
          canUndo: canUndoScene(prevHistory),
          canRedo: canRedoScene(prevHistory),
        });
      },
    };
  },

  redo: () => {
    const { history, instances: prevInstances, camera: prevCamera, keyframes: prevKeyframes } = get();
    const prevHistory = history;
    const result = redoSceneHistory(history);
    if (!result.snapshot) return undefined;
    const finished = finishApplyingHistory(result.history);
    const restoredCamera = result.snapshot.camera;
    const restoredKeyframes = result.snapshot.keyframes;
    set({
      instances: result.snapshot.instances,
      camera: restoredCamera ?? prevCamera,
      keyframes: restoredKeyframes ?? prevKeyframes,
      history: finished,
      canUndo: canUndoScene(finished),
      canRedo: canRedoScene(finished),
    });
    return {
      instances: result.snapshot.instances,
      camera: restoredCamera,
      keyframes: restoredKeyframes,
      rollback: () => {
        set({
          instances: prevInstances,
          camera: prevCamera,
          keyframes: prevKeyframes,
          history: prevHistory,
          canUndo: canUndoScene(prevHistory),
          canRedo: canRedoScene(prevHistory),
        });
      },
    };
  },

  loadPersistedProvenance: (provenance, drilldownBySequence) => {
    // Compute next sequence from persisted entries
    const maxSeq = provenance.reduce((max, e) => Math.max(max, e.sequence), 0);
    setProvenanceSequence(maxSeq + 1);
    set({ provenance, drilldownBySequence });
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
