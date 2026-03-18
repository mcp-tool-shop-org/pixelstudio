import { create } from 'zustand';

/** A single frame's composited snapshot within a range checkpoint. */
export interface FrameSnapshot {
  frameIndex: number;
  frameId: string;
  frameName: string;
  width: number;
  height: number;
  data: number[];
}

/** A range checkpoint — a set of frame snapshots captured at a point in time. */
export interface RangeCheckpoint {
  id: string;
  name: string;
  createdAt: string;
  frameSnapshots: FrameSnapshot[];
}

interface RangeSnapshotState {
  checkpoints: RangeCheckpoint[];
  /** The checkpoint currently being compared against (null = live view). */
  compareCheckpointId: string | null;

  createCheckpoint: (name: string, frames: FrameSnapshot[]) => string;
  deleteCheckpoint: (id: string) => void;
  renameCheckpoint: (id: string, name: string) => void;
  setCompareCheckpoint: (id: string | null) => void;
  clearAll: () => void;
}

let counter = 0;

export const useRangeSnapshotStore = create<RangeSnapshotState>((set, get) => ({
  checkpoints: [],
  compareCheckpointId: null,

  createCheckpoint: (name, frames) => {
    const id = `rsnap-${Date.now()}-${++counter}`;
    const checkpoint: RangeCheckpoint = {
      id,
      name,
      createdAt: new Date().toISOString(),
      frameSnapshots: frames,
    };
    set((s) => ({ checkpoints: [...s.checkpoints, checkpoint] }));
    return id;
  },

  deleteCheckpoint: (id) => {
    set((s) => ({
      checkpoints: s.checkpoints.filter((c) => c.id !== id),
      compareCheckpointId: s.compareCheckpointId === id ? null : s.compareCheckpointId,
    }));
  },

  renameCheckpoint: (id, name) => {
    set((s) => ({
      checkpoints: s.checkpoints.map((c) =>
        c.id === id ? { ...c, name } : c,
      ),
    }));
  },

  setCompareCheckpoint: (id) => set({ compareCheckpointId: id }),

  clearAll: () => set({ checkpoints: [], compareCheckpointId: null }),
}));
