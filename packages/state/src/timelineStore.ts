import { create } from 'zustand';

interface TimelineState {
  activeFrameId: string | null;
  activeTagId: string | null;
  playing: boolean;
  fps: number;
  loop: boolean;
  onionSkinEnabled: boolean;
  onionSkinPrevCount: number;
  onionSkinNextCount: number;

  setActiveFrame: (id: string | null) => void;
  setActiveTag: (id: string | null) => void;
  togglePlayback: () => void;
  setFps: (fps: number) => void;
  toggleOnionSkin: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  activeFrameId: null,
  activeTagId: null,
  playing: false,
  fps: 12,
  loop: true,
  onionSkinEnabled: false,
  onionSkinPrevCount: 2,
  onionSkinNextCount: 1,

  setActiveFrame: (id) => set({ activeFrameId: id }),
  setActiveTag: (id) => set({ activeTagId: id }),
  togglePlayback: () => set((s) => ({ playing: !s.playing })),
  setFps: (fps) => set({ fps }),
  toggleOnionSkin: () => set((s) => ({ onionSkinEnabled: !s.onionSkinEnabled })),
}));
