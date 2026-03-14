import { create } from 'zustand';
import type { ScenePlaybackState, InstanceClipState, SceneCameraKeyframe, SceneCameraShot } from '@pixelstudio/domain';

/** Pure camera resolver — identical algorithm to Rust resolve_scene_camera_at_tick. */
export function resolveCameraAtTick(
  keyframes: SceneCameraKeyframe[],
  tick: number,
  baseX: number,
  baseY: number,
  baseZoom: number,
): { x: number; y: number; zoom: number } {
  if (keyframes.length === 0) {
    return { x: baseX, y: baseY, zoom: baseZoom };
  }

  // Already sorted by tick (maintained at mutation time)
  const kfs = keyframes;

  if (kfs.length === 1) {
    const kf = kfs[0];
    return { x: kf.x, y: kf.y, zoom: Math.max(0.1, Math.min(10.0, kf.zoom)) };
  }

  // Before first
  if (tick <= kfs[0].tick) {
    const kf = kfs[0];
    return { x: kf.x, y: kf.y, zoom: Math.max(0.1, Math.min(10.0, kf.zoom)) };
  }

  // After last
  const last = kfs[kfs.length - 1];
  if (tick >= last.tick) {
    return { x: last.x, y: last.y, zoom: Math.max(0.1, Math.min(10.0, last.zoom)) };
  }

  // Between keyframes
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (tick < a.tick || tick >= b.tick) continue;

    if (tick === a.tick) {
      return { x: a.x, y: a.y, zoom: Math.max(0.1, Math.min(10.0, a.zoom)) };
    }

    if (a.interpolation === 'hold') {
      return { x: a.x, y: a.y, zoom: Math.max(0.1, Math.min(10.0, a.zoom)) };
    }

    // Linear
    const span = b.tick - a.tick;
    const t = (tick - a.tick) / span;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      zoom: Math.max(0.1, Math.min(10.0, a.zoom + (b.zoom - a.zoom) * t)),
    };
  }

  return { x: baseX, y: baseY, zoom: baseZoom };
}

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

  /** Base/manual camera (authoring state, persisted in document). */
  baseCameraX: number;
  baseCameraY: number;
  baseCameraZoom: number;

  /** Camera keyframes from document (sorted by tick). */
  cameraKeyframes: SceneCameraKeyframe[];

  /** Selected camera keyframe tick (shared between lane and panel). Null = no selection. */
  selectedKeyframeTick: number | null;

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
  /** Set camera keyframes (sorted by tick). Triggers camera resolution at current tick. */
  setCameraKeyframes: (keyframes: SceneCameraKeyframe[]) => void;
  /** Set the base/manual camera values (persisted state). */
  setBaseCamera: (x: number, y: number, zoom: number) => void;
  /** Select a camera keyframe by tick. Null clears selection. */
  selectKeyframe: (tick: number | null) => void;
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

  baseCameraX: 0,
  baseCameraY: 0,
  baseCameraZoom: 1.0,

  cameraKeyframes: [],

  selectedKeyframeTick: null,

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
      const clampedTick = s.totalTicks - 1;
      const cam = resolveCameraAtTick(s.cameraKeyframes, clampedTick, s.baseCameraX, s.baseCameraY, s.baseCameraZoom);
      set({
        elapsedMs: (s.totalTicks - 1) * frameDuration,
        currentTick: clampedTick,
        lastTickTime: now,
        isPlaying: false,
        cameraX: cam.x,
        cameraY: cam.y,
        cameraZoom: cam.zoom,
      });
      return;
    }

    // Resolve camera at new tick
    const cam = resolveCameraAtTick(s.cameraKeyframes, newTick, s.baseCameraX, s.baseCameraY, s.baseCameraZoom);
    set({
      elapsedMs: newElapsed,
      currentTick: newTick,
      lastTickTime: now,
      cameraX: cam.x,
      cameraY: cam.y,
      cameraZoom: cam.zoom,
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
    const cam = resolveCameraAtTick(s.cameraKeyframes, clamped, s.baseCameraX, s.baseCameraY, s.baseCameraZoom);
    set({
      isPlaying: false,
      currentTick: clamped,
      elapsedMs: clamped * frameDuration,
      lastTickTime: 0,
      cameraX: cam.x,
      cameraY: cam.y,
      cameraZoom: cam.zoom,
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
    const cam = resolveCameraAtTick(s.cameraKeyframes, next, s.baseCameraX, s.baseCameraY, s.baseCameraZoom);
    set({
      currentTick: next,
      elapsedMs: next * frameDuration,
      lastTickTime: 0,
      cameraX: cam.x,
      cameraY: cam.y,
      cameraZoom: cam.zoom,
    });
  },

  setCamera: (x, y, zoom) => {
    const clampedZoom = Math.max(0.1, Math.min(10.0, zoom));
    set({ cameraX: x, cameraY: y, cameraZoom: clampedZoom, baseCameraX: x, baseCameraY: y, baseCameraZoom: clampedZoom });
  },

  setCameraPosition: (x, y) => set({ cameraX: x, cameraY: y }),

  setCameraZoom: (zoom) => set({ cameraZoom: Math.max(0.1, Math.min(10.0, zoom)) }),

  resetCamera: () => set({ cameraX: 0, cameraY: 0, cameraZoom: 1.0, baseCameraX: 0, baseCameraY: 0, baseCameraZoom: 1.0 }),

  setCameraKeyframes: (keyframes) => {
    const s = get();
    const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
    const cam = resolveCameraAtTick(sorted, s.currentTick, s.baseCameraX, s.baseCameraY, s.baseCameraZoom);
    set({ cameraKeyframes: sorted, cameraX: cam.x, cameraY: cam.y, cameraZoom: cam.zoom });
  },

  setBaseCamera: (x, y, zoom) => {
    const clampedZoom = Math.max(0.1, Math.min(10.0, zoom));
    set({ baseCameraX: x, baseCameraY: y, baseCameraZoom: clampedZoom });
  },

  selectKeyframe: (tick) => set({ selectedKeyframeTick: tick }),

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
      baseCameraX: 0,
      baseCameraY: 0,
      baseCameraZoom: 1.0,
      cameraKeyframes: [],
      selectedKeyframeTick: null,
    }),
}));

/**
 * Derive named shots from camera keyframes.
 * Each keyframe becomes a shot that spans from its tick to the next keyframe's tick (or totalTicks).
 * Names come from the keyframe's name field, falling back to "Shot N".
 */
export function deriveShotsFromCameraKeyframes(
  keyframes: SceneCameraKeyframe[],
  totalTicks: number,
): SceneCameraShot[] {
  if (keyframes.length === 0) return [];

  const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
  const shots: SceneCameraShot[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const kf = sorted[i];
    const endTick = i < sorted.length - 1 ? sorted[i + 1].tick : Math.max(totalTicks, kf.tick + 1);
    const durationTicks = endTick - kf.tick;

    shots.push({
      name: kf.name ?? `Shot ${i + 1}`,
      startTick: kf.tick,
      endTick,
      durationTicks,
      interpolation: kf.interpolation,
      keyframeIndex: i,
    });
  }

  return shots;
}

/** Marker data for timeline lane rendering. */
export interface CameraTimelineMarker {
  tick: number;
  x: number;
  y: number;
  zoom: number;
  interpolation: 'hold' | 'linear';
  name: string | undefined;
  index: number;
}

/** Derive marker positions from keyframes for timeline lane rendering. */
export function deriveCameraTimelineMarkers(
  keyframes: SceneCameraKeyframe[],
): CameraTimelineMarker[] {
  const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
  return sorted.map((kf, i) => ({
    tick: kf.tick,
    x: kf.x,
    y: kf.y,
    zoom: kf.zoom,
    interpolation: kf.interpolation,
    name: kf.name,
    index: i,
  }));
}

/** Find the shot that contains a given tick, or null if none. */
export function findCurrentCameraShotAtTick(
  shots: SceneCameraShot[],
  tick: number,
): SceneCameraShot | null {
  for (const shot of shots) {
    if (tick >= shot.startTick && tick < shot.endTick) {
      return shot;
    }
  }
  return null;
}

/** Find the exact keyframe at a given tick, or null if no keyframe sits there. */
export function findCameraKeyframeAtTick(
  keyframes: SceneCameraKeyframe[],
  tick: number,
): { keyframe: SceneCameraKeyframe; index: number } | null {
  const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].tick === tick) {
      return { keyframe: sorted[i], index: i };
    }
  }
  return null;
}
