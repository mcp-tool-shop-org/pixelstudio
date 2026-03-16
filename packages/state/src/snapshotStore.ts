import { create } from 'zustand';

export interface CanvasSnapshot {
  id: string;
  name: string;
  createdAt: string;
  width: number;
  height: number;
  data: number[];
}

interface SnapshotState {
  snapshots: CanvasSnapshot[];

  createSnapshot: (name: string, width: number, height: number, data: number[]) => string;
  deleteSnapshot: (id: string) => void;
  renameSnapshot: (id: string, name: string) => void;
  clearAll: () => void;
}

let snapshotCounter = 0;

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: [],

  createSnapshot: (name, width, height, data) => {
    const id = `snap-${Date.now()}-${++snapshotCounter}`;
    const snapshot: CanvasSnapshot = {
      id,
      name,
      createdAt: new Date().toISOString(),
      width,
      height,
      data: [...data],
    };
    set((s) => ({ snapshots: [...s.snapshots, snapshot] }));
    return id;
  },

  deleteSnapshot: (id) =>
    set((s) => ({ snapshots: s.snapshots.filter((snap) => snap.id !== id) })),

  renameSnapshot: (id, name) =>
    set((s) => ({
      snapshots: s.snapshots.map((snap) =>
        snap.id === id ? { ...snap, name: name.trim() || snap.name } : snap,
      ),
    })),

  clearAll: () => set({ snapshots: [] }),
}));
