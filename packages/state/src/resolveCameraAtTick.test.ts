import { describe, it, expect } from 'vitest';
import { resolveCameraAtTick } from './scenePlaybackStore';
import type { SceneCameraKeyframe } from '@glyphstudio/domain';

function kf(tick: number, overrides?: Partial<SceneCameraKeyframe>): SceneCameraKeyframe {
  return { tick, x: tick * 10, y: tick * 5, zoom: 1.0, interpolation: 'linear', ...overrides };
}

// --- No keyframes: falls back to base camera ---

describe('resolveCameraAtTick — no keyframes', () => {
  it('returns base camera when keyframes are empty', () => {
    const cam = resolveCameraAtTick([], 0, 100, 200, 2.0);
    expect(cam).toEqual({ x: 100, y: 200, zoom: 2.0 });
  });

  it('returns base camera at any tick when keyframes are empty', () => {
    const cam = resolveCameraAtTick([], 999, 50, 60, 1.5);
    expect(cam).toEqual({ x: 50, y: 60, zoom: 1.5 });
  });
});

// --- Single keyframe: always used ---

describe('resolveCameraAtTick — single keyframe', () => {
  it('uses single keyframe at any tick', () => {
    const cam = resolveCameraAtTick([kf(10, { x: 50, y: 25, zoom: 2.0 })], 0, 0, 0, 1.0);
    expect(cam).toEqual({ x: 50, y: 25, zoom: 2.0 });
  });

  it('uses single keyframe after its tick', () => {
    const cam = resolveCameraAtTick([kf(5, { x: 30, y: 15, zoom: 3.0 })], 100, 0, 0, 1.0);
    expect(cam).toEqual({ x: 30, y: 15, zoom: 3.0 });
  });

  it('clamps extreme zoom on single keyframe', () => {
    const cam = resolveCameraAtTick([kf(0, { zoom: 0.01 })], 0, 0, 0, 1.0);
    expect(cam.zoom).toBe(0.1);
    const cam2 = resolveCameraAtTick([kf(0, { zoom: 99 })], 0, 0, 0, 1.0);
    expect(cam2.zoom).toBe(10.0);
  });
});

// --- Before first keyframe ---

describe('resolveCameraAtTick — before first keyframe', () => {
  const keyframes = [kf(10, { x: 100, y: 50, zoom: 2.0 }), kf(20, { x: 200, y: 100, zoom: 3.0 })];

  it('returns first keyframe values before first tick', () => {
    const cam = resolveCameraAtTick(keyframes, 0, 0, 0, 1.0);
    expect(cam).toEqual({ x: 100, y: 50, zoom: 2.0 });
  });

  it('returns first keyframe values at first tick', () => {
    const cam = resolveCameraAtTick(keyframes, 10, 0, 0, 1.0);
    expect(cam).toEqual({ x: 100, y: 50, zoom: 2.0 });
  });
});

// --- After last keyframe ---

describe('resolveCameraAtTick — after last keyframe', () => {
  const keyframes = [kf(0, { x: 0, y: 0, zoom: 1.0 }), kf(10, { x: 100, y: 50, zoom: 2.0 })];

  it('returns last keyframe values at last tick', () => {
    const cam = resolveCameraAtTick(keyframes, 10, 0, 0, 1.0);
    expect(cam).toEqual({ x: 100, y: 50, zoom: 2.0 });
  });

  it('returns last keyframe values far beyond last tick', () => {
    const cam = resolveCameraAtTick(keyframes, 999, 0, 0, 1.0);
    expect(cam).toEqual({ x: 100, y: 50, zoom: 2.0 });
  });
});

// --- Linear interpolation ---

describe('resolveCameraAtTick — linear interpolation', () => {
  const keyframes = [
    kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
    kf(10, { x: 100, y: 50, zoom: 2.0, interpolation: 'linear' }),
  ];

  it('interpolates midpoint correctly', () => {
    const cam = resolveCameraAtTick(keyframes, 5, 0, 0, 1.0);
    expect(cam.x).toBeCloseTo(50);
    expect(cam.y).toBeCloseTo(25);
    expect(cam.zoom).toBeCloseTo(1.5);
  });

  it('interpolates at 25%', () => {
    const cam = resolveCameraAtTick(keyframes, 2, 0, 0, 1.0);
    expect(cam.x).toBeCloseTo(20);
    expect(cam.y).toBeCloseTo(10);
    expect(cam.zoom).toBeCloseTo(1.2);
  });

  it('interpolates at 90%', () => {
    const cam = resolveCameraAtTick(keyframes, 9, 0, 0, 1.0);
    expect(cam.x).toBeCloseTo(90);
    expect(cam.y).toBeCloseTo(45);
    expect(cam.zoom).toBeCloseTo(1.9);
  });

  it('clamps zoom during interpolation', () => {
    const kfs = [
      kf(0, { zoom: 0.05 }),
      kf(10, { zoom: 0.05 }),
    ];
    const cam = resolveCameraAtTick(kfs, 5, 0, 0, 1.0);
    expect(cam.zoom).toBe(0.1); // clamped
  });
});

// --- Hold interpolation ---

describe('resolveCameraAtTick — hold interpolation', () => {
  const keyframes = [
    kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'hold' }),
    kf(10, { x: 100, y: 50, zoom: 2.0, interpolation: 'linear' }),
  ];

  it('holds A value at midpoint', () => {
    const cam = resolveCameraAtTick(keyframes, 5, 0, 0, 1.0);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
    expect(cam.zoom).toBe(1.0);
  });

  it('holds A value one tick before B', () => {
    const cam = resolveCameraAtTick(keyframes, 9, 0, 0, 1.0);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
    expect(cam.zoom).toBe(1.0);
  });

  it('snaps to B at B tick', () => {
    const cam = resolveCameraAtTick(keyframes, 10, 0, 0, 1.0);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(50);
    expect(cam.zoom).toBe(2.0);
  });
});

// --- Multiple segments with mixed interpolation ---

describe('resolveCameraAtTick — multi-segment', () => {
  const keyframes = [
    kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
    kf(10, { x: 100, y: 50, zoom: 2.0, interpolation: 'hold' }),
    kf(20, { x: 200, y: 100, zoom: 1.0, interpolation: 'linear' }),
  ];

  it('first segment linear at midpoint', () => {
    const cam = resolveCameraAtTick(keyframes, 5, 0, 0, 1.0);
    expect(cam.x).toBeCloseTo(50);
    expect(cam.y).toBeCloseTo(25);
    expect(cam.zoom).toBeCloseTo(1.5);
  });

  it('second segment hold between kf1 and kf2', () => {
    const cam = resolveCameraAtTick(keyframes, 15, 0, 0, 1.0);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(50);
    expect(cam.zoom).toBe(2.0);
  });

  it('transitions to third keyframe at tick 20', () => {
    const cam = resolveCameraAtTick(keyframes, 20, 0, 0, 1.0);
    expect(cam.x).toBe(200);
    expect(cam.y).toBe(100);
    expect(cam.zoom).toBe(1.0);
  });
});

// --- Zoom clamping edge cases ---

describe('resolveCameraAtTick — zoom clamping', () => {
  it('zoom below 0.1 clamped to 0.1', () => {
    const cam = resolveCameraAtTick([kf(0, { zoom: -5 })], 0, 0, 0, 1.0);
    expect(cam.zoom).toBe(0.1);
  });

  it('zoom above 10 clamped to 10', () => {
    const cam = resolveCameraAtTick([kf(0, { zoom: 50 })], 0, 0, 0, 1.0);
    expect(cam.zoom).toBe(10.0);
  });

  it('interpolated zoom clamped', () => {
    const kfs = [
      kf(0, { zoom: 0.05, interpolation: 'linear' }),
      kf(10, { zoom: 15.0 }),
    ];
    // At tick 0: zoom=0.05 → clamped to 0.1
    const cam0 = resolveCameraAtTick(kfs, 0, 0, 0, 1.0);
    expect(cam0.zoom).toBe(0.1);
    // At tick 10: zoom=15 → clamped to 10
    const cam10 = resolveCameraAtTick(kfs, 10, 0, 0, 1.0);
    expect(cam10.zoom).toBe(10.0);
  });
});

// --- TS↔Rust parity: ensure identical behavior ---

describe('resolveCameraAtTick — Rust parity contract', () => {
  it('exactly on keyframe A in [A, B] segment uses A values, not interpolated', () => {
    const keyframes = [
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(10, { x: 100, y: 50, zoom: 2.0 }),
    ];
    const cam = resolveCameraAtTick(keyframes, 0, 99, 99, 99);
    // Should be exactly A, not the base camera
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
    expect(cam.zoom).toBe(1.0);
  });

  it('tick at B boundary belongs to B segment, not A segment', () => {
    const keyframes = [
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(10, { x: 100, y: 50, zoom: 2.0, interpolation: 'hold' }),
      kf(20, { x: 200, y: 100, zoom: 3.0 }),
    ];
    // Tick 10 should use kf at tick=10 as the start of [10, 20) segment
    const cam = resolveCameraAtTick(keyframes, 10, 0, 0, 1.0);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(50);
    expect(cam.zoom).toBe(2.0);
  });

  it('base camera is ignored once keyframes exist', () => {
    const keyframes = [kf(50, { x: 500, y: 250, zoom: 5.0 })];
    const cam = resolveCameraAtTick(keyframes, 0, 999, 999, 999);
    // Single keyframe overrides base at ALL ticks
    expect(cam.x).toBe(500);
    expect(cam.y).toBe(250);
    expect(cam.zoom).toBe(5.0);
  });
});
