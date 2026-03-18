import { create } from 'zustand';

export interface FrameInfo {
  id: string;
  name: string;
  index: number;
  durationMs: number | null;
}

export interface OnionSkinData {
  width: number;
  height: number;
  prevData: number[] | null;
  nextData: number[] | null;
}

interface TimelineState {
  frames: FrameInfo[];
  activeFrameId: string | null;
  activeFrameIndex: number;
  playing: boolean;
  fps: number;
  loop: boolean;
  onionSkinEnabled: boolean;
  onionSkinShowPrev: boolean;
  onionSkinShowNext: boolean;
  onionSkinPrevOpacity: number;
  onionSkinNextOpacity: number;
  onionSkinData: OnionSkinData | null;

  /** Frame range selection for batch operations (sorted indices). */
  selectedFrameIndices: number[];
  /** Last batch transform applied (for repeat). */
  lastBatchTransform: string | null;
  /** Loop seam inspection mode — shows first↔last frame overlay. */
  loopSeamMode: boolean;

  setFrames: (frames: FrameInfo[], activeId: string, activeIndex: number) => void;
  setActiveFrame: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
  togglePlayback: () => void;
  setFps: (fps: number) => void;
  toggleLoop: () => void;
  toggleOnionSkin: () => void;
  setOnionSkinShowPrev: (show: boolean) => void;
  setOnionSkinShowNext: (show: boolean) => void;
  setOnionSkinPrevOpacity: (opacity: number) => void;
  setOnionSkinNextOpacity: (opacity: number) => void;
  setOnionSkinData: (data: OnionSkinData | null) => void;

  setLastBatchTransform: (cmd: string) => void;
  toggleLoopSeamMode: () => void;
  /** Select a contiguous range from anchor to target (Shift+click). */
  selectFrameRange: (anchorIndex: number, targetIndex: number) => void;
  /** Toggle a single frame in/out of the selection (Ctrl+click). */
  toggleFrameSelected: (index: number) => void;
  /** Clear frame range selection. */
  clearFrameSelection: () => void;
  /** Select all frames. */
  selectAllFrames: () => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  frames: [],
  activeFrameId: null,
  activeFrameIndex: 0,
  playing: false,
  fps: 12,
  loop: true,
  onionSkinEnabled: false,
  onionSkinShowPrev: true,
  onionSkinShowNext: true,
  onionSkinPrevOpacity: 0.3,
  onionSkinNextOpacity: 0.2,
  onionSkinData: null,
  selectedFrameIndices: [],
  lastBatchTransform: null,
  loopSeamMode: false,

  setFrames: (frames, activeId, activeIndex) => set({ frames, activeFrameId: activeId, activeFrameIndex: activeIndex, onionSkinData: null }),
  setActiveFrame: (id) => set({ activeFrameId: id }),
  setPlaying: (playing) => set({ playing }),
  togglePlayback: () => set((s) => ({ playing: !s.playing })),
  setFps: (fps) => set({ fps: Math.max(1, Math.min(60, fps)) }),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  toggleOnionSkin: () => set((s) => ({ onionSkinEnabled: !s.onionSkinEnabled })),
  setOnionSkinShowPrev: (show) => set({ onionSkinShowPrev: show }),
  setOnionSkinShowNext: (show) => set({ onionSkinShowNext: show }),
  setOnionSkinPrevOpacity: (opacity) => set({ onionSkinPrevOpacity: Math.max(0, Math.min(1, opacity)) }),
  setOnionSkinNextOpacity: (opacity) => set({ onionSkinNextOpacity: Math.max(0, Math.min(1, opacity)) }),
  setOnionSkinData: (data) => set({ onionSkinData: data }),
  setLastBatchTransform: (cmd) => set({ lastBatchTransform: cmd }),
  toggleLoopSeamMode: () => set((s) => ({ loopSeamMode: !s.loopSeamMode })),

  selectFrameRange: (anchorIndex, targetIndex) => {
    const lo = Math.min(anchorIndex, targetIndex);
    const hi = Math.max(anchorIndex, targetIndex);
    const indices: number[] = [];
    for (let i = lo; i <= hi; i++) indices.push(i);
    set({ selectedFrameIndices: indices });
  },

  toggleFrameSelected: (index) => {
    const current = get().selectedFrameIndices;
    if (current.includes(index)) {
      set({ selectedFrameIndices: current.filter((i) => i !== index) });
    } else {
      set({ selectedFrameIndices: [...current, index].sort((a, b) => a - b) });
    }
  },

  clearFrameSelection: () => set({ selectedFrameIndices: [] }),

  selectAllFrames: () => {
    const { frames } = get();
    set({ selectedFrameIndices: frames.map((_, i) => i) });
  },
}));
