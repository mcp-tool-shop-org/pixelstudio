import { describe, it, expect } from 'vitest';
import {
  deriveCameraTimelineMarkers,
  deriveShotsFromCameraKeyframes,
  findCurrentCameraShotAtTick,
  findCameraKeyframeAtTick,
} from './scenePlaybackStore';
import type { SceneCameraKeyframe, SceneCameraShot } from '@pixelstudio/domain';

function kf(tick: number, overrides?: Partial<SceneCameraKeyframe>): SceneCameraKeyframe {
  return { tick, x: tick * 10, y: tick * 5, zoom: 1.0, interpolation: 'linear', ...overrides };
}

// --- deriveCameraTimelineMarkers ---

describe('deriveCameraTimelineMarkers', () => {
  it('returns empty array for no keyframes', () => {
    expect(deriveCameraTimelineMarkers([])).toEqual([]);
  });

  it('returns sorted markers with correct indices', () => {
    const keyframes = [kf(10), kf(0), kf(5)];
    const markers = deriveCameraTimelineMarkers(keyframes);
    expect(markers).toHaveLength(3);
    expect(markers[0].tick).toBe(0);
    expect(markers[1].tick).toBe(5);
    expect(markers[2].tick).toBe(10);
    expect(markers[0].index).toBe(0);
    expect(markers[1].index).toBe(1);
    expect(markers[2].index).toBe(2);
  });

  it('preserves name and interpolation', () => {
    const keyframes = [kf(0, { name: 'Intro', interpolation: 'hold' })];
    const markers = deriveCameraTimelineMarkers(keyframes);
    expect(markers[0].name).toBe('Intro');
    expect(markers[0].interpolation).toBe('hold');
  });

  it('preserves camera position data', () => {
    const keyframes = [kf(3, { x: 100, y: 200, zoom: 2.5 })];
    const markers = deriveCameraTimelineMarkers(keyframes);
    expect(markers[0].x).toBe(100);
    expect(markers[0].y).toBe(200);
    expect(markers[0].zoom).toBe(2.5);
  });
});

// --- deriveShotsFromCameraKeyframes ---

describe('deriveShotsFromCameraKeyframes', () => {
  it('returns empty array for no keyframes', () => {
    expect(deriveShotsFromCameraKeyframes([], 100)).toEqual([]);
  });

  it('single keyframe spans to totalTicks', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(0)], 60);
    expect(shots).toHaveLength(1);
    expect(shots[0].startTick).toBe(0);
    expect(shots[0].endTick).toBe(60);
    expect(shots[0].durationTicks).toBe(60);
  });

  it('uses fallback names when no name provided', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(0), kf(10)], 20);
    expect(shots[0].name).toBe('Shot 1');
    expect(shots[1].name).toBe('Shot 2');
  });

  it('uses named keyframes for shot names', () => {
    const shots = deriveShotsFromCameraKeyframes(
      [kf(0, { name: 'Intro' }), kf(10, { name: 'Action' })],
      20,
    );
    expect(shots[0].name).toBe('Intro');
    expect(shots[1].name).toBe('Action');
  });

  it('multiple keyframes produce contiguous shots', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(0), kf(10), kf(25)], 50);
    expect(shots).toHaveLength(3);
    expect(shots[0]).toMatchObject({ startTick: 0, endTick: 10, durationTicks: 10 });
    expect(shots[1]).toMatchObject({ startTick: 10, endTick: 25, durationTicks: 15 });
    expect(shots[2]).toMatchObject({ startTick: 25, endTick: 50, durationTicks: 25 });
  });

  it('last shot extends beyond totalTicks if keyframe is at end', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(0), kf(100)], 50);
    // last shot: endTick = max(50, 100+1) = 101
    expect(shots[1].endTick).toBe(101);
  });

  it('sorts unsorted keyframes', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(20), kf(5), kf(0)], 30);
    expect(shots[0].startTick).toBe(0);
    expect(shots[1].startTick).toBe(5);
    expect(shots[2].startTick).toBe(20);
  });
});

// --- findCurrentCameraShotAtTick ---

describe('findCurrentCameraShotAtTick', () => {
  const shots: SceneCameraShot[] = [
    { name: 'A', startTick: 0, endTick: 10, durationTicks: 10, interpolation: 'linear', keyframeIndex: 0 },
    { name: 'B', startTick: 10, endTick: 25, durationTicks: 15, interpolation: 'hold', keyframeIndex: 1 },
    { name: 'C', startTick: 25, endTick: 50, durationTicks: 25, interpolation: 'linear', keyframeIndex: 2 },
  ];

  it('returns null for empty shots', () => {
    expect(findCurrentCameraShotAtTick([], 5)).toBeNull();
  });

  it('finds shot at start tick', () => {
    expect(findCurrentCameraShotAtTick(shots, 0)?.name).toBe('A');
    expect(findCurrentCameraShotAtTick(shots, 10)?.name).toBe('B');
  });

  it('finds shot at mid tick', () => {
    expect(findCurrentCameraShotAtTick(shots, 5)?.name).toBe('A');
    expect(findCurrentCameraShotAtTick(shots, 15)?.name).toBe('B');
    expect(findCurrentCameraShotAtTick(shots, 30)?.name).toBe('C');
  });

  it('returns null for tick at or beyond last endTick', () => {
    expect(findCurrentCameraShotAtTick(shots, 50)).toBeNull();
    expect(findCurrentCameraShotAtTick(shots, 100)).toBeNull();
  });

  it('returns null for negative tick', () => {
    expect(findCurrentCameraShotAtTick(shots, -1)).toBeNull();
  });
});

// --- findCameraKeyframeAtTick ---

describe('findCameraKeyframeAtTick', () => {
  const keyframes = [kf(0), kf(10), kf(25)];

  it('returns null for empty keyframes', () => {
    expect(findCameraKeyframeAtTick([], 0)).toBeNull();
  });

  it('finds exact keyframe', () => {
    const result = findCameraKeyframeAtTick(keyframes, 10);
    expect(result).not.toBeNull();
    expect(result!.keyframe.tick).toBe(10);
    expect(result!.index).toBe(1);
  });

  it('returns null when no keyframe at tick', () => {
    expect(findCameraKeyframeAtTick(keyframes, 5)).toBeNull();
    expect(findCameraKeyframeAtTick(keyframes, 15)).toBeNull();
  });

  it('finds first keyframe at tick 0', () => {
    const result = findCameraKeyframeAtTick(keyframes, 0);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  it('sorts before searching', () => {
    const unsorted = [kf(25), kf(0), kf(10)];
    const result = findCameraKeyframeAtTick(unsorted, 10);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(1); // index in sorted order
  });
});

// --- Visual state derivation edge cases ---

describe('interpolation mode in markers and shots', () => {
  it('markers preserve hold interpolation', () => {
    const markers = deriveCameraTimelineMarkers([kf(0, { interpolation: 'hold' }), kf(10)]);
    expect(markers[0].interpolation).toBe('hold');
    expect(markers[1].interpolation).toBe('linear');
  });

  it('shots inherit interpolation from starting keyframe', () => {
    const shots = deriveShotsFromCameraKeyframes(
      [kf(0, { interpolation: 'hold' }), kf(10, { interpolation: 'linear' })],
      20,
    );
    expect(shots[0].interpolation).toBe('hold');
    expect(shots[1].interpolation).toBe('linear');
  });
});

describe('last shot boundary behavior', () => {
  it('single keyframe at tick 0 extends to totalTicks', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(0)], 100);
    expect(shots[0].endTick).toBe(100);
    expect(shots[0].durationTicks).toBe(100);
  });

  it('last shot extends to at least kf.tick + 1 when totalTicks is small', () => {
    const shots = deriveShotsFromCameraKeyframes([kf(0), kf(50)], 30);
    // last shot at tick 50 with totalTicks 30: endTick = max(30, 51) = 51
    expect(shots[1].endTick).toBe(51);
  });
});

describe('current shot at shot boundaries', () => {
  const shots: SceneCameraShot[] = [
    { name: 'A', startTick: 0, endTick: 10, durationTicks: 10, interpolation: 'linear', keyframeIndex: 0 },
    { name: 'B', startTick: 10, endTick: 20, durationTicks: 10, interpolation: 'linear', keyframeIndex: 1 },
  ];

  it('tick exactly at shot boundary belongs to next shot', () => {
    expect(findCurrentCameraShotAtTick(shots, 10)?.name).toBe('B');
  });

  it('tick one before boundary belongs to current shot', () => {
    expect(findCurrentCameraShotAtTick(shots, 9)?.name).toBe('A');
  });
});

describe('markers with mixed names', () => {
  it('named and unnamed markers coexist', () => {
    const markers = deriveCameraTimelineMarkers([
      kf(0, { name: 'Intro' }),
      kf(10),
      kf(20, { name: 'Outro' }),
    ]);
    expect(markers[0].name).toBe('Intro');
    expect(markers[1].name).toBeUndefined();
    expect(markers[2].name).toBe('Outro');
  });
});
