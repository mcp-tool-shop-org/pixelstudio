import { describe, it, expect } from 'vitest';
import {
  ANIMATION_PRESET_LIBRARY,
  findPreset,
  listPresetsByCategory,
  listCompatiblePresets,
  searchPresets,
} from './animationPresetLibrary';

describe('ANIMATION_PRESET_LIBRARY', () => {
  it('contains 3 starter presets', () => {
    expect(ANIMATION_PRESET_LIBRARY).toHaveLength(3);
  });

  it('all presets have unique IDs', () => {
    const ids = ANIMATION_PRESET_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all presets have required fields', () => {
    for (const p of ANIMATION_PRESET_LIBRARY) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.frameCount).toBeGreaterThan(0);
      expect(typeof p.looping).toBe('boolean');
      expect(p.defaultFps).toBeGreaterThan(0);
      expect(p.compatibleArchetypes.length).toBeGreaterThan(0);
      expect(p.keyframes.length).toBeGreaterThan(0);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });

  it('all keyframes have valid frame indices', () => {
    for (const p of ANIMATION_PRESET_LIBRARY) {
      for (const kf of p.keyframes) {
        expect(kf.frameIndex).toBeGreaterThanOrEqual(0);
        expect(kf.frameIndex).toBeLessThan(p.frameCount);
      }
    }
  });

  it('keyframe count matches frameCount for fully-keyed presets', () => {
    for (const p of ANIMATION_PRESET_LIBRARY) {
      // All starter presets are fully keyed (one keyframe per frame)
      expect(p.keyframes).toHaveLength(p.frameCount);
    }
  });

  it('keyframe frame indices are sequential', () => {
    for (const p of ANIMATION_PRESET_LIBRARY) {
      for (let i = 0; i < p.keyframes.length; i++) {
        expect(p.keyframes[i].frameIndex).toBe(i);
      }
    }
  });

  it('idle-bob is looping', () => {
    const idle = findPreset('idle-bob')!;
    expect(idle.looping).toBe(true);
    expect(idle.frameCount).toBe(4);
  });

  it('attack-swing is non-looping', () => {
    const attack = findPreset('attack-swing')!;
    expect(attack.looping).toBe(false);
    expect(attack.frameCount).toBe(4);
  });

  it('walk-cycle has 6 frames', () => {
    const walk = findPreset('walk-cycle')!;
    expect(walk.frameCount).toBe(6);
    expect(walk.looping).toBe(true);
  });

  it('attack-swing has custom durations on strike frames', () => {
    const attack = findPreset('attack-swing')!;
    const strikeDurations = attack.keyframes
      .filter((kf) => kf.durationMs !== undefined)
      .map((kf) => kf.durationMs);
    expect(strikeDurations.length).toBeGreaterThan(0);
  });
});

describe('findPreset', () => {
  it('finds existing preset', () => {
    expect(findPreset('idle-bob')).toBeDefined();
    expect(findPreset('idle-bob')!.name).toBe('Idle Bob');
  });

  it('returns undefined for unknown ID', () => {
    expect(findPreset('nonexistent')).toBeUndefined();
  });
});

describe('listPresetsByCategory', () => {
  it('returns idle presets', () => {
    const results = listPresetsByCategory('idle');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('idle-bob');
  });

  it('returns attack presets', () => {
    const results = listPresetsByCategory('attack');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('attack-swing');
  });

  it('returns empty for unused category', () => {
    expect(listPresetsByCategory('death')).toHaveLength(0);
  });
});

describe('listCompatiblePresets', () => {
  it('humanoid has all 3 presets', () => {
    const results = listCompatiblePresets('humanoid');
    expect(results).toHaveLength(3);
  });

  it('quadruped has only idle-bob', () => {
    const results = listCompatiblePresets('quadruped');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('idle-bob');
  });

  it('item has no compatible presets', () => {
    expect(listCompatiblePresets('item')).toHaveLength(0);
  });
});

describe('searchPresets', () => {
  it('searches by name', () => {
    const results = searchPresets('walk');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('walk-cycle');
  });

  it('searches by tag', () => {
    const results = searchPresets('locomotion');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('walk-cycle');
  });

  it('searches by description keyword', () => {
    const results = searchPresets('melee');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('attack-swing');
  });

  it('is case-insensitive', () => {
    expect(searchPresets('IDLE')).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    expect(searchPresets('spaceship')).toHaveLength(0);
  });
});
