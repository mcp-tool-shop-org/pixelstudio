import { create } from 'zustand';

interface CanvasFrameData {
  width: number;
  height: number;
  data: number[];
  layers: Array<{
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
  }>;
  activeLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

interface CanvasFrameStore {
  frame: CanvasFrameData | null;
  /** Monotonically increasing version counter to trigger re-renders */
  version: number;
  setFrame: (frame: CanvasFrameData) => void;
}

export const useCanvasFrameStore = create<CanvasFrameStore>((set) => ({
  frame: null,
  version: 0,
  setFrame: (frame) => set((s) => ({ frame, version: s.version + 1 })),
}));

export type { CanvasFrameData };
