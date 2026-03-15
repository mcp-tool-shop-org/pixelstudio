import { describe, it, expect } from 'vitest';
import type {
  CharacterBuild,
  CharacterPartRef,
  SceneAssetInstance,
} from '@glyphstudio/domain';
import { CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import type { CharacterValidationIssue } from '@glyphstudio/domain';
import {
  createSlotSnapshot,
  placeCharacterBuild,
  checkPlaceability,
  isCharacterInstance,
  isSourceBuildAvailable,
  reapplyCharacterBuild,
  CHARACTER_PLACEMENT_DEFAULTS,
} from './characterSceneBridge';

// ── Fixtures ──

const HEAD: CharacterPartRef = { sourceId: 'head-basic', slot: 'head', tags: ['human'] };
const TORSO: CharacterPartRef = { sourceId: 'torso-plate', slot: 'torso', providedSockets: ['chest_mount'] };
const ARMS: CharacterPartRef = { sourceId: 'arms-default', slot: 'arms' };
const LEGS: CharacterPartRef = { sourceId: 'legs-default', slot: 'legs' };
const WEAPON: CharacterPartRef = { sourceId: 'sword-iron', slot: 'weapon' };

const WARRIOR: CharacterBuild = {
  id: 'build-warrior',
  name: 'Warrior',
  slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS, weapon: WEAPON },
};

const EMPTY_BUILD: CharacterBuild = {
  id: 'build-empty',
  name: 'Empty',
  slots: {},
};

const MINIMAL_BUILD: CharacterBuild = {
  id: 'build-min',
  name: 'Minimal',
  slots: { head: HEAD },
};

// ── createSlotSnapshot ──

describe('createSlotSnapshot', () => {
  it('captures equipped slot→sourceId mappings', () => {
    const snap = createSlotSnapshot(WARRIOR);
    expect(snap.slots).toEqual({
      head: 'head-basic',
      torso: 'torso-plate',
      arms: 'arms-default',
      legs: 'legs-default',
      weapon: 'sword-iron',
    });
  });

  it('counts equipped slots correctly', () => {
    expect(createSlotSnapshot(WARRIOR).equippedCount).toBe(5);
    expect(createSlotSnapshot(EMPTY_BUILD).equippedCount).toBe(0);
    expect(createSlotSnapshot(MINIMAL_BUILD).equippedCount).toBe(1);
  });

  it('sets totalSlots to vocabulary size', () => {
    expect(createSlotSnapshot(WARRIOR).totalSlots).toBe(CHARACTER_SLOT_IDS.length);
    expect(createSlotSnapshot(WARRIOR).totalSlots).toBe(12);
  });

  it('returns empty slots record for empty build', () => {
    const snap = createSlotSnapshot(EMPTY_BUILD);
    expect(snap.slots).toEqual({});
    expect(snap.equippedCount).toBe(0);
  });
});

// ── placeCharacterBuild ──

describe('placeCharacterBuild', () => {
  it('creates an instance with instanceKind "character"', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.instanceKind).toBe('character');
  });

  it('attaches sourceCharacterBuildId', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.sourceCharacterBuildId).toBe('build-warrior');
  });

  it('attaches sourceCharacterBuildName', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.sourceCharacterBuildName).toBe('Warrior');
  });

  it('attaches character slot snapshot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.characterSlotSnapshot).toBeDefined();
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(5);
    expect(inst.characterSlotSnapshot!.slots.head).toBe('head-basic');
  });

  it('uses build name as instance name by default', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.name).toBe('Warrior');
  });

  it('uses default placement values', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.x).toBe(CHARACTER_PLACEMENT_DEFAULTS.x);
    expect(inst.y).toBe(CHARACTER_PLACEMENT_DEFAULTS.y);
    expect(inst.zOrder).toBe(CHARACTER_PLACEMENT_DEFAULTS.zOrder);
    expect(inst.visible).toBe(true);
    expect(inst.opacity).toBe(1.0);
    expect(inst.parallax).toBe(1.0);
  });

  it('respects position overrides', () => {
    const inst = placeCharacterBuild(WARRIOR, { x: 100, y: 200 });
    expect(inst.x).toBe(100);
    expect(inst.y).toBe(200);
  });

  it('respects zOrder override', () => {
    const inst = placeCharacterBuild(WARRIOR, { zOrder: 5 });
    expect(inst.zOrder).toBe(5);
  });

  it('respects name override', () => {
    const inst = placeCharacterBuild(WARRIOR, { name: 'Custom Name' });
    expect(inst.name).toBe('Custom Name');
    // sourceCharacterBuildName still preserves original
    expect(inst.sourceCharacterBuildName).toBe('Warrior');
  });

  it('respects sourcePath override', () => {
    const inst = placeCharacterBuild(WARRIOR, { sourcePath: '/path/to/file.pxs' });
    expect(inst.sourcePath).toBe('/path/to/file.pxs');
  });

  it('generates unique instance IDs', () => {
    const a = placeCharacterBuild(WARRIOR);
    const b = placeCharacterBuild(WARRIOR);
    expect(a.instanceId).not.toBe(b.instanceId);
  });

  it('does not mutate the source build', () => {
    const before = JSON.stringify(WARRIOR);
    placeCharacterBuild(WARRIOR);
    expect(JSON.stringify(WARRIOR)).toBe(before);
  });

  it('works with empty build', () => {
    const inst = placeCharacterBuild(EMPTY_BUILD);
    expect(inst.instanceKind).toBe('character');
    expect(inst.sourceCharacterBuildId).toBe('build-empty');
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(0);
  });
});

// ── Snapshot isolation ──

describe('snapshot isolation', () => {
  it('snapshot is independent of later build changes', () => {
    const mutableBuild: CharacterBuild = {
      id: 'mut-1',
      name: 'Mutable',
      slots: { head: HEAD, torso: TORSO },
    };
    const inst = placeCharacterBuild(mutableBuild);
    // Mutate the original build after placement
    mutableBuild.slots = { head: HEAD };
    mutableBuild.name = 'Changed';
    // Snapshot should still reflect the state at placement time
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(2);
    expect(inst.sourceCharacterBuildName).toBe('Mutable');
  });
});

// ── isCharacterInstance ──

describe('isCharacterInstance', () => {
  it('returns true for character instances', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isCharacterInstance(inst)).toBe(true);
  });

  it('returns false for plain asset instances', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'asset-1',
      sourcePath: '/path.pxs',
      name: 'Tree',
      x: 0, y: 0, zOrder: 0,
      visible: true, opacity: 1, parallax: 1,
    };
    expect(isCharacterInstance(asset)).toBe(false);
  });

  it('returns false for instances with instanceKind "asset"', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'asset-2',
      sourcePath: '/path.pxs',
      name: 'Rock',
      instanceKind: 'asset',
      x: 0, y: 0, zOrder: 0,
      visible: true, opacity: 1, parallax: 1,
    };
    expect(isCharacterInstance(asset)).toBe(false);
  });
});

// ── isSourceBuildAvailable ──

describe('isSourceBuildAvailable', () => {
  it('returns true when source build ID is in library', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSourceBuildAvailable(inst, ['build-warrior', 'other'])).toBe(true);
  });

  it('returns false when source build ID is not in library', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSourceBuildAvailable(inst, ['other'])).toBe(false);
  });

  it('returns false for instances without sourceCharacterBuildId', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'asset-1',
      sourcePath: '/path.pxs',
      name: 'Tree',
      x: 0, y: 0, zOrder: 0,
      visible: true, opacity: 1, parallax: 1,
    };
    expect(isSourceBuildAvailable(asset, ['anything'])).toBe(false);
  });

  it('returns false for empty library', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSourceBuildAvailable(inst, [])).toBe(false);
  });
});

// ── reapplyCharacterBuild ──

describe('reapplyCharacterBuild', () => {
  it('updates snapshot from new build state', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const updatedBuild: CharacterBuild = {
      id: 'build-warrior-v2',
      name: 'Warrior V2',
      slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS },
    };
    const result = reapplyCharacterBuild(inst, updatedBuild);
    expect(result).not.toBeNull();
    expect(result!.sourceCharacterBuildId).toBe('build-warrior-v2');
    expect(result!.sourceCharacterBuildName).toBe('Warrior V2');
    expect(result!.characterSlotSnapshot!.equippedCount).toBe(4);
    // weapon removed in v2
    expect(result!.characterSlotSnapshot!.slots.weapon).toBeUndefined();
  });

  it('preserves scene-local transform state', () => {
    const inst = placeCharacterBuild(WARRIOR, { x: 50, y: 75, zOrder: 3 });
    // Simulate scene modifications
    const modified: SceneAssetInstance = { ...inst, opacity: 0.5, parallax: 0.8, visible: false };
    const result = reapplyCharacterBuild(modified, MINIMAL_BUILD);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(50);
    expect(result!.y).toBe(75);
    expect(result!.zOrder).toBe(3);
    expect(result!.opacity).toBe(0.5);
    expect(result!.parallax).toBe(0.8);
    expect(result!.visible).toBe(false);
  });

  it('preserves instance name (does not overwrite with build name)', () => {
    const inst = placeCharacterBuild(WARRIOR, { name: 'My Hero' });
    const result = reapplyCharacterBuild(inst, MINIMAL_BUILD);
    expect(result!.name).toBe('My Hero');
    expect(result!.sourceCharacterBuildName).toBe('Minimal');
  });

  it('preserves instanceId across reapply', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const result = reapplyCharacterBuild(inst, MINIMAL_BUILD);
    expect(result!.instanceId).toBe(inst.instanceId);
  });

  it('returns null for non-character instances', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'asset-1',
      sourcePath: '/path.pxs',
      name: 'Tree',
      x: 0, y: 0, zOrder: 0,
      visible: true, opacity: 1, parallax: 1,
    };
    expect(reapplyCharacterBuild(asset, WARRIOR)).toBeNull();
  });

  it('returns null for instances with instanceKind "asset"', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'asset-2',
      sourcePath: '/path.pxs',
      name: 'Rock',
      instanceKind: 'asset',
      x: 0, y: 0, zOrder: 0,
      visible: true, opacity: 1, parallax: 1,
    };
    expect(reapplyCharacterBuild(asset, WARRIOR)).toBeNull();
  });

  it('does not mutate the original instance', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const before = JSON.stringify(inst);
    reapplyCharacterBuild(inst, MINIMAL_BUILD);
    expect(JSON.stringify(inst)).toBe(before);
  });
});

// ── Integration: placement → reapply round-trip ──

describe('placement → reapply round-trip', () => {
  it('place → edit source → reapply refreshes snapshot but preserves scene state', () => {
    // Step 1: Place warrior
    const inst = placeCharacterBuild(WARRIOR, { x: 100, y: 200, zOrder: 5 });
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(5);

    // Step 2: Source build is edited externally (weapon removed)
    const editedBuild: CharacterBuild = {
      id: 'build-warrior',
      name: 'Warrior (Unarmed)',
      slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS },
    };

    // Step 3: Reapply
    const refreshed = reapplyCharacterBuild(inst, editedBuild);
    expect(refreshed).not.toBeNull();
    expect(refreshed!.characterSlotSnapshot!.equippedCount).toBe(4);
    expect(refreshed!.sourceCharacterBuildName).toBe('Warrior (Unarmed)');
    // Scene-local state preserved
    expect(refreshed!.x).toBe(100);
    expect(refreshed!.y).toBe(200);
    expect(refreshed!.zOrder).toBe(5);
    expect(refreshed!.instanceId).toBe(inst.instanceId);
  });

  it('snapshot survives source deletion (source check returns false)', () => {
    const inst = placeCharacterBuild(WARRIOR);
    // Source build deleted from library
    expect(isSourceBuildAvailable(inst, [])).toBe(false);
    // But the snapshot data is still intact on the instance
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(5);
    expect(inst.sourceCharacterBuildId).toBe('build-warrior');
    expect(inst.sourceCharacterBuildName).toBe('Warrior');
  });
});

// ── checkPlaceability ──

describe('checkPlaceability', () => {
  const NO_ISSUES: CharacterValidationIssue[] = [];

  const ERROR_ISSUE: CharacterValidationIssue = {
    kind: 'missing_required_slot',
    slot: 'head',
    message: 'Head is required',
    severity: 'error',
  };

  const WARNING_ISSUE: CharacterValidationIssue = {
    kind: 'missing_required_socket',
    slot: 'weapon',
    message: 'Weapon requires hand socket',
    severity: 'warning',
  };

  it('returns placeable for valid build with equipped parts', () => {
    const result = checkPlaceability(WARRIOR, NO_ISSUES);
    expect(result.placeable).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns not placeable when build is null', () => {
    const result = checkPlaceability(null, NO_ISSUES);
    expect(result.placeable).toBe(false);
    expect(result.reason).toBe('No active build');
  });

  it('returns not placeable for empty build (no equipped slots)', () => {
    const result = checkPlaceability(EMPTY_BUILD, NO_ISSUES);
    expect(result.placeable).toBe(false);
    expect(result.reason).toBe('Build has no equipped parts');
  });

  it('returns not placeable when build has validation errors', () => {
    const result = checkPlaceability(MINIMAL_BUILD, [ERROR_ISSUE]);
    expect(result.placeable).toBe(false);
    expect(result.reason).toContain('1 error');
    expect(result.reason).toContain('resolve before placing');
  });

  it('returns not placeable with multiple errors and correct pluralization', () => {
    const result = checkPlaceability(MINIMAL_BUILD, [ERROR_ISSUE, ERROR_ISSUE]);
    expect(result.placeable).toBe(false);
    expect(result.reason).toContain('2 errors');
  });

  it('returns placeable when build has only warnings (no errors)', () => {
    const result = checkPlaceability(WARRIOR, [WARNING_ISSUE]);
    expect(result.placeable).toBe(true);
  });

  it('returns placeable when build has warnings mixed with no errors', () => {
    const result = checkPlaceability(WARRIOR, [WARNING_ISSUE, WARNING_ISSUE]);
    expect(result.placeable).toBe(true);
  });

  it('returns not placeable when build has errors even with warnings', () => {
    const result = checkPlaceability(WARRIOR, [ERROR_ISSUE, WARNING_ISSUE]);
    expect(result.placeable).toBe(false);
    expect(result.reason).toContain('1 error');
  });

  it('checks empty slots before errors (empty build short-circuits)', () => {
    const result = checkPlaceability(EMPTY_BUILD, [ERROR_ISSUE]);
    expect(result.placeable).toBe(false);
    expect(result.reason).toBe('Build has no equipped parts');
  });
});

// ── Integration: placeability → placement ──

describe('placeability → placement integration', () => {
  it('placeable build creates valid instance', () => {
    const result = checkPlaceability(WARRIOR, []);
    expect(result.placeable).toBe(true);
    const inst = placeCharacterBuild(WARRIOR);
    expect(inst.instanceKind).toBe('character');
    expect(inst.sourceCharacterBuildId).toBe('build-warrior');
  });

  it('repeated placement creates distinct instances with same source', () => {
    const a = placeCharacterBuild(WARRIOR);
    const b = placeCharacterBuild(WARRIOR);
    expect(a.instanceId).not.toBe(b.instanceId);
    expect(a.sourceCharacterBuildId).toBe(b.sourceCharacterBuildId);
  });
});
