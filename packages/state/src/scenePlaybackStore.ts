import { create } from 'zustand';
import type { ScenePlaybackState, InstanceClipState } from '@pixelstudio/domain';

interface ScenePlaybackStoreState {
  /** Whether the scene clock is running. */
  isPlaying: boolean;
  /** Scene-level FPS (from backend). */
  fps: number;
  /** Scene-level loop flag (from backend). */
  looping: boolean;
  /** Elapsed time in ms since playback started. */
  elapsedMs: number;
  /** Current scene tick (derived from elapsedMs and fps). */
  currentTick: number;
  /** Timestamp of the last rAF callback (internal). */
  lastTickTime: number;
  /** Cached playback state from backend (clip resolution per instance). */
  playbackState: ScenePlaybackState | null;

  /** Total scene span in ticks (from timeline summary). */
  totalTicks: number;

  /** Camera position X (scene coordinates). */
  cameraX: number;
  /** Camera position Y (scene coordinates). */
  cameraY: number;
  /** Camera zoom factor (1.0 = 100%). */
  cameraZoom: number;

  // Actions
  setPlaying: (playing: boolean) => void;
  setFps: (fps: number) => void;
  setLooping: (looping: boolean) => void;
  advanceClock: (now: number) => void;
  resetClock: () => void;
  setPlaybackState: (state: ScenePlaybackState) => void;
  setTotalTicks: (total: number) => void;
  /** Seek to a specific tick — pauses playback, sets elapsed time to match. */
  seekToTick: (tick: number) => void;
  /** Step forward/back by delta ticks while paused. */
  stepTick: (delta: number) => void;
  setCamera: (x: number, y: number, zoom: number) => void;
  setCameraPosition: (x: number, y: number) => void;
  setCameraZoom: (zoom: number) => void;
  resetCamera: () => void;
  clearAll: () => void;
}

export const useScenePlaybackStore = create<ScenePlaybackStoreState>((set, get) => ({
  isPlaying: false,
  fps: 12,
  looping: true,
  elapsedMs: 0,
  currentTick: 0,
  lastTickTime: 0,
  playbackState: null,

  totalTicks: 1,

  cameraX: 0,
  cameraY: 0,
  cameraZoom: 1.0,

  setPlaying: (playing) =>
    set((s) => ({
      isPlaying: playing,
      lastTickTime: playing ? 0 : s.lastTickTime,
      // Don't reset elapsed on pause — only on explicit reset
    })),

  setFps: (fps) => set({ fps: Math.max(1, Math.min(60, fps)) }),

  setLooping: (looping) => set({ looping }),

  advanceClock: (now) => {
    const s = get();
    if (!s.isPlaying) return;
    if (s.lastTickTime === 0) {
      // First tick — initialize timestamp
      set({ lastTickTime: now });
      return;
    }
    const delta = now - s.lastTickTime;
    const newElapsed = s.elapsedMs + delta;
    const frameDuration = 1000 / s.fps;
    const newTick = Math.floor(newElapsed / frameDuration);

    // If not looping, clamp at totalTicks
    if (!s.looping && s.totalTicks > 0 && newTick >= s.totalTicks) {
      set({
        elapsedMs: (s.totalTicks - 1) * frameDuration,
        currentTick: s.totalTicks - 1,
        lastTickTime: now,
        isPlaying: false,
      });
      return;
    }

    set({
      elapsedMs: newElapsed,
      currentTick: newTick,
      lastTickTime: now,
    });
  },

  resetClock: () =>
    set({
      elapsedMs: 0,
      currentTick: 0,
      lastTickTime: 0,
    }),

  setPlaybackState: (ps) =>
    set({
      playbackState: ps,
      fps: ps.fps,
      looping: ps.looping,
    }),

  setTotalTicks: (total) => set({ totalTicks: Math.max(1, total) }),

  seekToTick: (tick) => {
    const s = get();
    const maxTick = Math.max(0, s.totalTicks - 1);
    const clamped = Math.max(0, Math.min(tick, maxTick));
    const frameDuration = 1000 / s.fps;
    set({
      isPlaying: false,
      currentTick: clamped,
      elapsedMs: clamped * frameDuration,
      lastTickTime: 0,
    });
  },

  stepTick: (delta) => {
    const s = get();
    const maxTick = Math.max(0, s.totalTicks - 1);
    let next = s.currentTick + delta;
    if (s.looping && s.totalTicks > 0) {
      next = ((next % s.totalTicks) + s.totalTicks) % s.totalTicks;
    } else {
      next = Math.max(0, Math.min(next, maxTick));
    }
    const frameDuration = 1000 / s.fps;
    set({
      currentTick: next,
      elapsedMs: next * frameDuration,
      lastTickTime: 0,
    });
  },

  setCamera: (x, y, zoom) =>
    set({ cameraX: x, cameraY: y, cameraZoom: Math.max(0.1, Math.min(10.0, zoom)) }),

  setCameraPosition: (x, y) => set({ cameraX: x, cameraY: y }),

  setCameraZoom: (zoom) => set({ cameraZoom: Math.max(0.1, Math.min(10.0, zoom)) }),

  resetCamera: () => set({ cameraX: 0, cameraY: 0, cameraZoom: 1.0 }),

  clearAll: () =>
    set({
      isPlaying: false,
      fps: 12,
      looping: true,
      elapsedMs: 0,
      currentTick: 0,
      lastTickTime: 0,
      playbackState: null,
      totalTicks: 1,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1.0,
    }),
}));
