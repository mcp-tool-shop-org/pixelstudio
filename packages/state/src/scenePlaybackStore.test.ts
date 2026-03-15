import { describe, it, expect, beforeEach } from 'vitest';
import { useScenePlaybackStore } from './scenePlaybackStore';
import type { SceneCameraKeyframe } from '@glyphstudio/domain';

function kf(tick: number, overrides?: Partial<SceneCameraKeyframe>): SceneCameraKeyframe {
  return { tick, x: tick * 10, y: tick * 5, zoom: 1.0, interpolation: 'linear', ...overrides };
}

// Reset store before each test
beforeEach(() => {
  useScenePlaybackStore.getState().clearAll();
});

// --- seekToTick ---

describe('seekToTick', () => {
  it('pauses playback on seek', () => {
    const store = useScenePlaybackStore;
    store.getState().setPlaying(true);
    store.getState().seekToTick(5);
    expect(store.getState().isPlaying).toBe(false);
  });

  it('clamps tick to [0, totalTicks-1]', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(20);
    expect(store.getState().currentTick).toBe(9);
    store.getState().seekToTick(-5);
    expect(store.getState().currentTick).toBe(0);
  });

  it('sets elapsed time consistent with tick and fps', () => {
    const store = useScenePlaybackStore;
    store.getState().setFps(12);
    store.getState().setTotalTicks(100);
    store.getState().seekToTick(24);
    expect(store.getState().currentTick).toBe(24);
    expect(store.getState().elapsedMs).toBe(24 * (1000 / 12));
  });

  it('resolves camera at seek tick', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0 }),
      kf(20, { x: 200, y: 100, zoom: 2.0 }),
    ]);
    store.getState().seekToTick(10);
    // Linear interp midpoint
    expect(store.getState().cameraX).toBeCloseTo(100);
    expect(store.getState().cameraY).toBeCloseTo(50);
    expect(store.getState().cameraZoom).toBeCloseTo(1.5);
  });
});

// --- stepTick ---

describe('stepTick', () => {
  it('steps forward by delta', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(3);
    store.getState().stepTick(2);
    expect(store.getState().currentTick).toBe(5);
  });

  it('steps backward by negative delta', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(5);
    store.getState().stepTick(-2);
    expect(store.getState().currentTick).toBe(3);
  });

  it('clamps at 0 when not looping', () => {
    const store = useScenePlaybackStore;
    store.getState().setLooping(false);
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(2);
    store.getState().stepTick(-5);
    expect(store.getState().currentTick).toBe(0);
  });

  it('clamps at totalTicks-1 when not looping', () => {
    const store = useScenePlaybackStore;
    store.getState().setLooping(false);
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(8);
    store.getState().stepTick(5);
    expect(store.getState().currentTick).toBe(9);
  });

  it('wraps around when looping forward', () => {
    const store = useScenePlaybackStore;
    store.getState().setLooping(true);
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(8);
    store.getState().stepTick(5);
    // (8+5) % 10 = 3
    expect(store.getState().currentTick).toBe(3);
  });

  it('wraps around when looping backward', () => {
    const store = useScenePlaybackStore;
    store.getState().setLooping(true);
    store.getState().setTotalTicks(10);
    store.getState().seekToTick(2);
    store.getState().stepTick(-5);
    // ((2-5) % 10 + 10) % 10 = 7
    expect(store.getState().currentTick).toBe(7);
  });

  it('resolves camera after step', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'hold' }),
      kf(10, { x: 100, y: 50, zoom: 2.0 }),
    ]);
    store.getState().seekToTick(0);
    store.getState().stepTick(5);
    // Still in hold segment
    expect(store.getState().cameraX).toBe(0);
    expect(store.getState().cameraY).toBe(0);
  });
});

// --- advanceClock ---

describe('advanceClock', () => {
  it('does nothing when not playing', () => {
    const store = useScenePlaybackStore;
    store.getState().advanceClock(1000);
    expect(store.getState().currentTick).toBe(0);
    expect(store.getState().elapsedMs).toBe(0);
  });

  it('initializes lastTickTime on first advance', () => {
    const store = useScenePlaybackStore;
    store.getState().setPlaying(true);
    store.getState().advanceClock(1000);
    // First call only sets lastTickTime, no elapsed change
    expect(store.getState().currentTick).toBe(0);
    expect(store.getState().lastTickTime).toBe(1000);
  });

  it('advances tick based on fps', () => {
    const store = useScenePlaybackStore;
    store.getState().setFps(10); // 100ms per frame
    store.getState().setTotalTicks(100);
    store.getState().setPlaying(true);
    store.getState().advanceClock(1000); // init
    store.getState().advanceClock(1500); // 500ms later = 5 frames
    expect(store.getState().currentTick).toBe(5);
    expect(store.getState().elapsedMs).toBe(500);
  });

  it('stops at end when not looping', () => {
    const store = useScenePlaybackStore;
    store.getState().setFps(10);
    store.getState().setTotalTicks(5);
    store.getState().setLooping(false);
    store.getState().setPlaying(true);
    store.getState().advanceClock(1000); // init
    store.getState().advanceClock(2000); // 1000ms = 10 frames, but only 5 ticks
    expect(store.getState().isPlaying).toBe(false);
    expect(store.getState().currentTick).toBe(4); // clamped to totalTicks - 1
  });
});

// --- setFps clamping ---

describe('setFps', () => {
  it('clamps FPS to [1, 60]', () => {
    const store = useScenePlaybackStore;
    store.getState().setFps(0);
    expect(store.getState().fps).toBe(1);
    store.getState().setFps(100);
    expect(store.getState().fps).toBe(60);
  });
});

// --- setTotalTicks ---

describe('setTotalTicks', () => {
  it('enforces minimum of 1', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(0);
    expect(store.getState().totalTicks).toBe(1);
    store.getState().setTotalTicks(-5);
    expect(store.getState().totalTicks).toBe(1);
  });
});

// --- setCameraKeyframes triggers camera resolution ---

describe('setCameraKeyframes', () => {
  it('resolves camera at current tick when keyframes change', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);
    store.getState().seekToTick(5);
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(10, { x: 100, y: 50, zoom: 2.0 }),
    ]);
    expect(store.getState().cameraX).toBeCloseTo(50);
    expect(store.getState().cameraY).toBeCloseTo(25);
    expect(store.getState().cameraZoom).toBeCloseTo(1.5);
  });

  it('sorts keyframes by tick', () => {
    const store = useScenePlaybackStore;
    store.getState().setCameraKeyframes([kf(20), kf(5), kf(0)]);
    expect(store.getState().cameraKeyframes.map((k) => k.tick)).toEqual([0, 5, 20]);
  });
});

// --- Camera zoom clamping ---

describe('camera zoom clamping', () => {
  it('setCameraZoom clamps to [0.1, 10.0]', () => {
    const store = useScenePlaybackStore;
    store.getState().setCameraZoom(0.01);
    expect(store.getState().cameraZoom).toBe(0.1);
    store.getState().setCameraZoom(50);
    expect(store.getState().cameraZoom).toBe(10.0);
  });

  it('setCamera clamps zoom and sets base camera', () => {
    const store = useScenePlaybackStore;
    store.getState().setCamera(10, 20, 0.01);
    expect(store.getState().cameraZoom).toBe(0.1);
    expect(store.getState().baseCameraZoom).toBe(0.1);
  });
});

// --- clearAll resets everything ---

describe('clearAll', () => {
  it('resets all state to defaults', () => {
    const store = useScenePlaybackStore;
    store.getState().setPlaying(true);
    store.getState().setFps(24);
    store.getState().setLooping(false);
    store.getState().setTotalTicks(50);
    store.getState().seekToTick(10);
    store.getState().setCameraKeyframes([kf(0), kf(10)]);
    store.getState().selectKeyframe(5);

    store.getState().clearAll();

    const s = store.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.fps).toBe(12);
    expect(s.looping).toBe(true);
    expect(s.currentTick).toBe(0);
    expect(s.elapsedMs).toBe(0);
    expect(s.totalTicks).toBe(1);
    expect(s.cameraX).toBe(0);
    expect(s.cameraY).toBe(0);
    expect(s.cameraZoom).toBe(1.0);
    expect(s.cameraKeyframes).toEqual([]);
    expect(s.selectedKeyframeTick).toBeNull();
  });
});

// --- keyframe selection ---

describe('selectKeyframe', () => {
  it('selects a keyframe tick', () => {
    const store = useScenePlaybackStore;
    store.getState().selectKeyframe(10);
    expect(store.getState().selectedKeyframeTick).toBe(10);
  });

  it('clears selection with null', () => {
    const store = useScenePlaybackStore;
    store.getState().selectKeyframe(10);
    store.getState().selectKeyframe(null);
    expect(store.getState().selectedKeyframeTick).toBeNull();
  });
});
