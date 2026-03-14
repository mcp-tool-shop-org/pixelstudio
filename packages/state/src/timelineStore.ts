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
}

export const useTimelineStore = create<TimelineState>((set) => ({
  frames: [],
  activeFrameId: null,
  activeFrameIndex: 0,
  playing: false,
  fps: 12,
  loop: true,
  onionSkinEnabled: false,
  onionSkinShowPrev: true,
  onionSkinShowNext: false,
  onionSkinPrevOpacity: 0.25,
  onionSkinNextOpacity: 0.15,
  onionSkinData: null,

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
}));
