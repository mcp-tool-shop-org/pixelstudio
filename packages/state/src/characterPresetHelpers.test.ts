import { describe, it, expect } from 'vitest';
import type { CharacterBuild, CharacterPartPreset } from '@glyphstudio/domain';
import {
  classifyPresetCompatibility,
  getCompatiblePresetsForSlot,
  classifyAllPresetsForSlot,
} from './characterPresetHelpers';

// ── Fixtures ──

const EMPTY_BUILD: CharacterBuild = {
  id: 'b1',
  name: 'Test',
  slots: {},
};

const HEAD_PRESET: CharacterPartPreset = {
  sourceId: 'head-knight',
  slot: 'head',
  name: 'Knight Helm',
  tags: ['human', 'heavy'],
};

const HEAD_PRESET_2: CharacterPartPreset = {
  sourceId: 'head-wizard',
  slot: 'head',
  name: 'Wizard Hat',
  tags: ['human', 'cloth'],
};

const TORSO_PRESET: CharacterPartPreset = {
  sourceId: 'torso-plate',
  slot: 'torso',
  name: 'Plate Armor',
  providedSockets: ['chest_mount'],
};

const WEAPON_PRESET: CharacterPartPreset = {
  sourceId: 'sword-iron',
  slot: 'weapon',
  name: 'Iron Sword',
  requiredSockets: ['hand'],
};

const WEAPON_WITH_ANCHOR: CharacterPartPreset = {
  sourceId: 'staff-magic',
  slot: 'weapon',
  name: 'Magic Staff',
  requiredAnchors: ['grip_point'],
};

const HANDS_WITH_SOCKET: CharacterPartPreset = {
  sourceId: 'hands-gauntlets',
  slot: 'hands',
  name: 'Gauntlets',
  providedSockets: ['hand'],
};

const HANDS_WITH_ANCHOR: CharacterPartPreset = {
  sourceId: 'hands-staff',
  slot: 'hands',
  name: 'Staff Gloves',
  providedAnchors: ['grip_point'],
};

const ALL_PRESETS: CharacterPartPreset[] = [
  HEAD_PRESET,
  HEAD_PRESET_2,
  TORSO_PRESET,
  WEAPON_PRESET,
  WEAPON_WITH_ANCHOR,
  HANDS_WITH_SOCKET,
  HANDS_WITH_ANCHOR,
];

// ── classifyPresetCompatibility ──

describe('classifyPresetCompatibility', () => {
  it('compatible when slot matches and no requirements', () => {
    const result = classifyPresetCompatibility(HEAD_PRESET, 'head', EMPTY_BUILD);
    expect(result.tier).toBe('compatible');
    expect(result.reasons).toHaveLength(0);
  });

  it('incompatible when slot does not match', () => {
    const result = classifyPresetCompatibility(HEAD_PRESET, 'torso', EMPTY_BUILD);
    expect(result.tier).toBe('incompatible');
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('Head');
    expect(result.reasons[0]).toContain('Torso');
  });

  it('warning when required socket is missing', () => {
    const result = classifyPresetCompatibility(WEAPON_PRESET, 'weapon', EMPTY_BUILD);
    expect(result.tier).toBe('warning');
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('hand');
  });

  it('compatible when required socket is provided by another slot', () => {
    const build: CharacterBuild = {
      ...EMPTY_BUILD,
      slots: { hands: HANDS_WITH_SOCKET },
    };
    const result = classifyPresetCompatibility(WEAPON_PRESET, 'weapon', build);
    expect(result.tier).toBe('compatible');
    expect(result.reasons).toHaveLength(0);
  });

  it('warning when required anchor is missing', () => {
    const result = classifyPresetCompatibility(WEAPON_WITH_ANCHOR, 'weapon', EMPTY_BUILD);
    expect(result.tier).toBe('warning');
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('grip_point');
  });

  it('compatible when required anchor is provided by another slot', () => {
    const build: CharacterBuild = {
      ...EMPTY_BUILD,
      slots: { hands: HANDS_WITH_ANCHOR },
    };
    const result = classifyPresetCompatibility(WEAPON_WITH_ANCHOR, 'weapon', build);
    expect(result.tier).toBe('compatible');
    expect(result.reasons).toHaveLength(0);
  });

  it('excludes current slot occupant when checking provided sockets', () => {
    // If the target slot already has a part that provides a socket,
    // that socket should NOT count — the preset would replace it
    const oldWeapon: CharacterPartPreset = {
      sourceId: 'old-weapon',
      slot: 'weapon',
      name: 'Old Weapon',
      providedSockets: ['hand'], // provides hand, but it's being replaced
    };
    const build: CharacterBuild = {
      ...EMPTY_BUILD,
      slots: { weapon: oldWeapon },
    };
    // New weapon requires 'hand' socket, but the only provider is
    // the occupant being replaced → should warn
    const result = classifyPresetCompatibility(WEAPON_PRESET, 'weapon', build);
    expect(result.tier).toBe('warning');
  });

  it('self-provided sockets count as satisfied', () => {
    // A preset that both requires and provides the same socket
    const selfSufficient: CharacterPartPreset = {
      sourceId: 'self-sufficient',
      slot: 'weapon',
      name: 'Self-Sufficient Weapon',
      requiredSockets: ['grip'],
      providedSockets: ['grip'],
    };
    const result = classifyPresetCompatibility(selfSufficient, 'weapon', EMPTY_BUILD);
    expect(result.tier).toBe('compatible');
  });

  it('returns the preset in the result', () => {
    const result = classifyPresetCompatibility(HEAD_PRESET, 'head', EMPTY_BUILD);
    expect(result.preset).toBe(HEAD_PRESET);
  });

  it('multiple missing requirements produce multiple reasons', () => {
    const demanding: CharacterPartPreset = {
      sourceId: 'demanding',
      slot: 'weapon',
      name: 'Demanding Weapon',
      requiredSockets: ['hand', 'wrist'],
      requiredAnchors: ['grip_point'],
    };
    const result = classifyPresetCompatibility(demanding, 'weapon', EMPTY_BUILD);
    expect(result.tier).toBe('warning');
    expect(result.reasons).toHaveLength(3);
  });
});

// ── getCompatiblePresetsForSlot ──

describe('getCompatiblePresetsForSlot', () => {
  it('returns only presets targeting the given slot', () => {
    const results = getCompatiblePresetsForSlot(ALL_PRESETS, 'head', EMPTY_BUILD);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.preset.sourceId)).toEqual(['head-knight', 'head-wizard']);
  });

  it('excludes incompatible presets', () => {
    const results = getCompatiblePresetsForSlot(ALL_PRESETS, 'head', EMPTY_BUILD);
    expect(results.every((r) => r.tier !== 'incompatible')).toBe(true);
  });

  it('sorts compatible before warnings', () => {
    // For weapon slot: WEAPON_PRESET requires 'hand', WEAPON_WITH_ANCHOR requires 'grip_point'
    // Both are warnings in empty build
    const weaponPresets: CharacterPartPreset[] = [
      WEAPON_PRESET, // warning (needs hand)
      WEAPON_WITH_ANCHOR, // warning (needs grip_point)
      { ...WEAPON_PRESET, sourceId: 'dagger', name: 'Dagger', requiredSockets: undefined }, // compatible
    ];
    const results = getCompatiblePresetsForSlot(weaponPresets, 'weapon', EMPTY_BUILD);
    expect(results[0].tier).toBe('compatible');
    expect(results[0].preset.sourceId).toBe('dagger');
  });

  it('returns empty array when no presets match slot', () => {
    const results = getCompatiblePresetsForSlot(ALL_PRESETS, 'feet', EMPTY_BUILD);
    expect(results).toHaveLength(0);
  });

  it('warning presets become compatible when requirements are met', () => {
    const build: CharacterBuild = {
      ...EMPTY_BUILD,
      slots: { hands: HANDS_WITH_SOCKET },
    };
    const results = getCompatiblePresetsForSlot([WEAPON_PRESET], 'weapon', build);
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('compatible');
  });
});

// ── classifyAllPresetsForSlot ──

describe('classifyAllPresetsForSlot', () => {
  it('returns all presets including incompatible', () => {
    const results = classifyAllPresetsForSlot(ALL_PRESETS, 'head', EMPTY_BUILD);
    expect(results).toHaveLength(ALL_PRESETS.length);
    const incompatible = results.filter((r) => r.tier === 'incompatible');
    expect(incompatible.length).toBeGreaterThan(0);
  });

  it('preserves original order', () => {
    const results = classifyAllPresetsForSlot(ALL_PRESETS, 'head', EMPTY_BUILD);
    expect(results.map((r) => r.preset.sourceId)).toEqual(ALL_PRESETS.map((p) => p.sourceId));
  });
});
