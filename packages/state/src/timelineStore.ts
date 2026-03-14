import { create } from 'zustand';

export interface FrameInfo {
  id: string;
  name: string;
  index: number;
}

interface TimelineState {
  frames: FrameInfo[];
  activeFrameId: string | null;
  activeFrameIndex: number;
  playing: boolean;
  fps: number;
  loop: boolean;
  onionSkinEnabled: boolean;
  onionSkinPrevCount: number;
  onionSkinNextCount: number;

  setFrames: (frames: FrameInfo[], activeId: string, activeIndex: number) => void;
  setActiveFrame: (id: string | null) => void;
  togglePlayback: () => void;
  setFps: (fps: number) => void;
  toggleOnionSkin: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  frames: [],
  activeFrameId: null,
  activeFrameIndex: 0,
  playing: false,
  fps: 12,
  loop: true,
  onionSkinEnabled: false,
  onionSkinPrevCount: 2,
  onionSkinNextCount: 1,

  setFrames: (frames, activeId, activeIndex) => set({ frames, activeFrameId: activeId, activeFrameIndex: activeIndex }),
  setActiveFrame: (id) => set({ activeFrameId: id }),
  togglePlayback: () => set((s) => ({ playing: !s.playing })),
  setFps: (fps) => set({ fps }),
  toggleOnionSkin: () => set((s) => ({ onionSkinEnabled: !s.onionSkinEnabled })),
}));
