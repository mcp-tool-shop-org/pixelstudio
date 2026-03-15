import { describe, it, expect } from 'vitest';
import type {
  CharacterBuild,
  CharacterPartRef,
  SceneAssetInstance,
  CharacterInstanceOverrides,
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
  deriveSourceStatus,
  sourceStatusLabel,
  instanceBuildName,
  snapshotSummary,
  isSnapshotPossiblyStale,
  applyOverridesToSnapshot,
  deriveEffectiveSlots,
  hasOverrides,
  getOverriddenSlots,
  isSlotOverridden,
  getSlotOverride,
  setSlotOverride,
  clearSlotOverride,
  clearAllOverrides,
  CHARACTER_PLACEMENT_DEFAULTS,
  deriveEffectiveCharacterSlotStates,
  getOverrideCount,
  getEffectiveEquippedCount,
  getRemovedOverrideSlots,
  getReplacedOverrideSlots,
  overrideSummary,
  effectiveSlotSummary,
} from './characterSceneBridge';
import { findBuildById } from './characterBuildLibrary';

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

// ── Integration: reapply with library lookup ──

describe('reapply with library lookup', () => {
  const library = {
    schemaVersion: 1,
    builds: [
      { id: 'build-warrior', name: 'Warrior Renamed', slots: { head: HEAD, torso: TORSO }, createdAt: '', updatedAt: '' },
    ],
  };

  it('resolves source build from library and reapplies', () => {
    const inst = placeCharacterBuild(WARRIOR, { x: 50, y: 75 });
    const source = findBuildById(library, inst.sourceCharacterBuildId!);
    expect(source).toBeDefined();
    const updated = reapplyCharacterBuild(inst, source!);
    expect(updated).not.toBeNull();
    expect(updated!.sourceCharacterBuildName).toBe('Warrior Renamed');
    expect(updated!.characterSlotSnapshot!.equippedCount).toBe(2);
    expect(updated!.x).toBe(50);
    expect(updated!.y).toBe(75);
    expect(updated!.instanceId).toBe(inst.instanceId);
  });

  it('missing build returns undefined from findBuildById — blocks reapply', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const source = findBuildById(library, 'nonexistent-id');
    expect(source).toBeUndefined();
    // Cannot reapply without source — instance stays unchanged
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(5);
  });

  it('reapply is idempotent when source has not changed', () => {
    const inst = placeCharacterBuild(WARRIOR, { x: 10 });
    const source = findBuildById(library, inst.sourceCharacterBuildId!);
    const first = reapplyCharacterBuild(inst, source!);
    const second = reapplyCharacterBuild(first!, source!);
    expect(second!.sourceCharacterBuildName).toBe(first!.sourceCharacterBuildName);
    expect(second!.characterSlotSnapshot).toEqual(first!.characterSlotSnapshot);
    expect(second!.x).toBe(10);
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

// ── Instance summary helpers ──

describe('deriveSourceStatus', () => {
  it('returns "linked" when source build ID is in library', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(deriveSourceStatus(inst, ['build-warrior'])).toBe('linked');
  });

  it('returns "missing-source" when source build ID is not in library', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(deriveSourceStatus(inst, [])).toBe('missing-source');
  });

  it('returns "not-character" for plain asset instances', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(deriveSourceStatus(asset, [])).toBe('not-character');
  });
});

describe('sourceStatusLabel', () => {
  it('returns "Linked" for linked status', () => {
    expect(sourceStatusLabel('linked')).toBe('Linked');
  });

  it('returns "Source missing" for missing-source status', () => {
    expect(sourceStatusLabel('missing-source')).toBe('Source missing');
  });

  it('returns empty string for not-character status', () => {
    expect(sourceStatusLabel('not-character')).toBe('');
  });
});

describe('instanceBuildName', () => {
  it('returns source build name when present', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(instanceBuildName(inst)).toBe('Warrior');
  });

  it('returns "Unknown build" when name is empty', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.sourceCharacterBuildName = '';
    expect(instanceBuildName(inst)).toBe('Unknown build');
  });

  it('returns "Unknown build" when name is undefined', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.sourceCharacterBuildName = undefined;
    expect(instanceBuildName(inst)).toBe('Unknown build');
  });

  it('returns empty string for non-character instances', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(instanceBuildName(asset)).toBe('');
  });
});

describe('snapshotSummary', () => {
  it('formats equipped/total for normal snapshot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(snapshotSummary(inst)).toBe('5/12 equipped');
  });

  it('formats single equipped slot', () => {
    const inst = placeCharacterBuild(MINIMAL_BUILD);
    expect(snapshotSummary(inst)).toBe('1/12 equipped');
  });

  it('returns "0/0 equipped" when snapshot is missing', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterSlotSnapshot = undefined;
    expect(snapshotSummary(inst)).toBe('0/0 equipped');
  });
});

describe('isSnapshotPossiblyStale', () => {
  it('returns false when source matches snapshot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSnapshotPossiblyStale(inst, {
      name: 'Warrior', slots: { head: 'h', torso: 't', arms: 'a', legs: 'l', weapon: 'w' },
    })).toBe(false);
  });

  it('returns true when slot count differs', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSnapshotPossiblyStale(inst, {
      name: 'Warrior', slots: { head: 'h', torso: 't' }, // only 2 slots
    })).toBe(true);
  });

  it('returns true when build name changed', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSnapshotPossiblyStale(inst, {
      name: 'Warrior v2', slots: { head: 'h', torso: 't', arms: 'a', legs: 'l', weapon: 'w' },
    })).toBe(true);
  });

  it('returns false for non-character instances', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(isSnapshotPossiblyStale(asset, { name: 'x', slots: {} })).toBe(false);
  });

  it('returns false when source build is undefined', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSnapshotPossiblyStale(inst, undefined)).toBe(false);
  });

  it('returns true when snapshot is missing but source exists', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterSlotSnapshot = undefined;
    expect(isSnapshotPossiblyStale(inst, { name: 'Warrior', slots: {} })).toBe(true);
  });
});

// ── Character instance overrides ──

describe('applyOverridesToSnapshot', () => {
  const snapshot = {
    slots: { head: 'helm-iron', torso: 'plate-steel', legs: 'greaves-iron' },
    equippedCount: 3,
    totalSlots: 12,
  };

  it('returns snapshot slots when no overrides', () => {
    const result = applyOverridesToSnapshot(snapshot, undefined);
    expect(result).toEqual({ head: 'helm-iron', torso: 'plate-steel', legs: 'greaves-iron' });
  });

  it('returns snapshot slots with empty overrides object', () => {
    const result = applyOverridesToSnapshot(snapshot, {});
    expect(result).toEqual({ head: 'helm-iron', torso: 'plate-steel', legs: 'greaves-iron' });
  });

  it('replace override swaps one slot', () => {
    const overrides: CharacterInstanceOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'helm-gold' },
    };
    const result = applyOverridesToSnapshot(snapshot, overrides);
    expect(result.head).toBe('helm-gold');
    expect(result.torso).toBe('plate-steel');
    expect(result.legs).toBe('greaves-iron');
  });

  it('remove override deletes one slot', () => {
    const overrides: CharacterInstanceOverrides = {
      head: { slot: 'head', mode: 'remove' },
    };
    const result = applyOverridesToSnapshot(snapshot, overrides);
    expect(result.head).toBeUndefined();
    expect(result.torso).toBe('plate-steel');
    expect(result.legs).toBe('greaves-iron');
  });

  it('multiple overrides combine correctly', () => {
    const overrides: CharacterInstanceOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'helm-gold' },
      legs: { slot: 'legs', mode: 'remove' },
    };
    const result = applyOverridesToSnapshot(snapshot, overrides);
    expect(result.head).toBe('helm-gold');
    expect(result.torso).toBe('plate-steel');
    expect(result.legs).toBeUndefined();
  });

  it('replace override for slot not in snapshot adds it', () => {
    const overrides: CharacterInstanceOverrides = {
      weapon: { slot: 'weapon', mode: 'replace', replacementPartId: 'sword-iron' },
    };
    const result = applyOverridesToSnapshot(snapshot, overrides);
    expect(result.weapon).toBe('sword-iron');
    expect(result.head).toBe('helm-iron');
  });

  it('remove override for slot not in snapshot is a no-op', () => {
    const overrides: CharacterInstanceOverrides = {
      weapon: { slot: 'weapon', mode: 'remove' },
    };
    const result = applyOverridesToSnapshot(snapshot, overrides);
    expect(result).toEqual({ head: 'helm-iron', torso: 'plate-steel', legs: 'greaves-iron' });
  });

  it('handles undefined snapshot gracefully', () => {
    const overrides: CharacterInstanceOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'helm-gold' },
    };
    const result = applyOverridesToSnapshot(undefined, overrides);
    expect(result).toEqual({ head: 'helm-gold' });
  });

  it('replace without replacementPartId does not add slot', () => {
    const overrides: CharacterInstanceOverrides = {
      head: { slot: 'head', mode: 'replace' },
    };
    const result = applyOverridesToSnapshot(snapshot, overrides);
    // No replacementPartId means the replace is invalid — slot unchanged
    expect(result.head).toBe('helm-iron');
  });
});

describe('deriveEffectiveSlots', () => {
  it('returns snapshot slots for character instance without overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const effective = deriveEffectiveSlots(inst);
    expect(Object.keys(effective).length).toBe(5);
    expect(effective.head).toBeDefined();
  });

  it('returns empty for non-character instance', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(deriveEffectiveSlots(asset)).toEqual({});
  });

  it('applies overrides to produce effective composition', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      weapon: { slot: 'weapon', mode: 'remove' },
    };
    const effective = deriveEffectiveSlots(inst);
    expect(effective.weapon).toBeUndefined();
    expect(Object.keys(effective).length).toBe(4);
  });
});

describe('hasOverrides', () => {
  it('returns false when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(hasOverrides(inst)).toBe(false);
  });

  it('returns false when characterOverrides is undefined', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = undefined;
    expect(hasOverrides(inst)).toBe(false);
  });

  it('returns false when characterOverrides is empty object', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {};
    expect(hasOverrides(inst)).toBe(false);
  });

  it('returns true when overrides exist', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
    };
    expect(hasOverrides(inst)).toBe(true);
  });
});

describe('getOverriddenSlots', () => {
  it('returns empty array when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(getOverriddenSlots(inst)).toEqual([]);
  });

  it('returns slot IDs that have overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
      weapon: { slot: 'weapon', mode: 'replace', replacementPartId: 'axe' },
    };
    const slots = getOverriddenSlots(inst);
    expect(slots).toContain('head');
    expect(slots).toContain('weapon');
    expect(slots.length).toBe(2);
  });
});

describe('isSlotOverridden', () => {
  it('returns false for non-overridden slot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(isSlotOverridden(inst, 'head')).toBe(false);
  });

  it('returns true for overridden slot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
    };
    expect(isSlotOverridden(inst, 'head')).toBe(true);
  });

  it('returns false for slot not in overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
    };
    expect(isSlotOverridden(inst, 'torso')).toBe(false);
  });
});

describe('getSlotOverride', () => {
  it('returns undefined when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(getSlotOverride(inst, 'head')).toBeUndefined();
  });

  it('returns the override for an overridden slot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'crown' },
    };
    const ov = getSlotOverride(inst, 'head');
    expect(ov?.mode).toBe('replace');
    expect(ov?.replacementPartId).toBe('crown');
  });
});

describe('setSlotOverride', () => {
  it('adds override to instance without existing overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const updated = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    expect(updated.characterOverrides?.head?.mode).toBe('remove');
    // Original not mutated
    expect(inst.characterOverrides).toBeUndefined();
  });

  it('adds override alongside existing overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const step1 = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    const step2 = setSlotOverride(step1, { slot: 'weapon', mode: 'replace', replacementPartId: 'axe' });
    expect(step2.characterOverrides?.head?.mode).toBe('remove');
    expect(step2.characterOverrides?.weapon?.replacementPartId).toBe('axe');
  });

  it('replaces existing override for same slot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const step1 = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    const step2 = setSlotOverride(step1, { slot: 'head', mode: 'replace', replacementPartId: 'crown' });
    expect(step2.characterOverrides?.head?.mode).toBe('replace');
    expect(step2.characterOverrides?.head?.replacementPartId).toBe('crown');
  });

  it('preserves instance ID and scene-local state', () => {
    const inst = placeCharacterBuild(WARRIOR, { x: 50, y: 75, zOrder: 3 });
    const updated = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    expect(updated.instanceId).toBe(inst.instanceId);
    expect(updated.x).toBe(50);
    expect(updated.y).toBe(75);
    expect(updated.zOrder).toBe(3);
  });
});

describe('clearSlotOverride', () => {
  it('returns same instance if no overrides exist', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const result = clearSlotOverride(inst, 'head');
    expect(result).toBe(inst); // identity — no change needed
  });

  it('removes specified override', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const withOverride = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    const cleared = clearSlotOverride(withOverride, 'head');
    expect(cleared.characterOverrides).toBeUndefined(); // last override removed
  });

  it('preserves other overrides when clearing one', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const step1 = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    const step2 = setSlotOverride(step1, { slot: 'weapon', mode: 'remove' });
    const cleared = clearSlotOverride(step2, 'head');
    expect(cleared.characterOverrides?.head).toBeUndefined();
    expect(cleared.characterOverrides?.weapon?.mode).toBe('remove');
  });

  it('sets characterOverrides to undefined when last override cleared', () => {
    const inst = setSlotOverride(placeCharacterBuild(WARRIOR), { slot: 'head', mode: 'remove' });
    const cleared = clearSlotOverride(inst, 'head');
    expect(cleared.characterOverrides).toBeUndefined();
  });

  it('does not mutate original instance', () => {
    const inst = setSlotOverride(placeCharacterBuild(WARRIOR), { slot: 'head', mode: 'remove' });
    const before = JSON.stringify(inst);
    clearSlotOverride(inst, 'head');
    expect(JSON.stringify(inst)).toBe(before);
  });
});

describe('clearAllOverrides', () => {
  it('returns same instance if no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(clearAllOverrides(inst)).toBe(inst);
  });

  it('removes all overrides', () => {
    let inst = placeCharacterBuild(WARRIOR);
    inst = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    inst = setSlotOverride(inst, { slot: 'weapon', mode: 'remove' });
    const cleared = clearAllOverrides(inst);
    expect(cleared.characterOverrides).toBeUndefined();
  });

  it('preserves scene-local state', () => {
    let inst = placeCharacterBuild(WARRIOR, { x: 100, y: 200 });
    inst = setSlotOverride(inst, { slot: 'head', mode: 'remove' });
    const cleared = clearAllOverrides(inst);
    expect(cleared.x).toBe(100);
    expect(cleared.y).toBe(200);
    expect(cleared.instanceId).toBe(inst.instanceId);
  });
});

// ── Override + reapply interaction ──

describe('reapply preserves overrides', () => {
  it('reapply keeps existing overrides while refreshing snapshot', () => {
    let inst = placeCharacterBuild(WARRIOR, { x: 50 });
    inst = setSlotOverride(inst, { slot: 'weapon', mode: 'remove' });

    const editedBuild: CharacterBuild = {
      id: 'build-warrior',
      name: 'Warrior v2',
      slots: { head: HEAD, torso: TORSO },
    };

    const reapplied = reapplyCharacterBuild(inst, editedBuild);
    expect(reapplied).not.toBeNull();
    // Snapshot updated
    expect(reapplied!.sourceCharacterBuildName).toBe('Warrior v2');
    expect(reapplied!.characterSlotSnapshot!.equippedCount).toBe(2);
    // Overrides preserved
    expect(reapplied!.characterOverrides?.weapon?.mode).toBe('remove');
    // Scene-local state preserved
    expect(reapplied!.x).toBe(50);
  });

  it('effective composition after reapply reflects new snapshot + old overrides', () => {
    let inst = placeCharacterBuild(WARRIOR);
    inst = setSlotOverride(inst, { slot: 'weapon', mode: 'remove' });

    const editedBuild: CharacterBuild = {
      id: 'build-warrior',
      name: 'Warrior v2',
      slots: { head: HEAD, torso: TORSO, arms: ARMS },
    };

    const reapplied = reapplyCharacterBuild(inst, editedBuild)!;
    const effective = deriveEffectiveSlots(reapplied);
    // New snapshot has 3 slots, override removes weapon (which wasn't in new snapshot anyway)
    expect(Object.keys(effective).length).toBe(3);
    expect(effective.weapon).toBeUndefined();
  });

  it('clearing override after reapply reveals new inherited slot', () => {
    let inst = placeCharacterBuild(WARRIOR);
    inst = setSlotOverride(inst, { slot: 'head', mode: 'replace', replacementPartId: 'crown' });

    const editedBuild: CharacterBuild = {
      id: 'build-warrior',
      name: 'Warrior v2',
      slots: { head: HEAD, torso: TORSO },
    };

    const reapplied = reapplyCharacterBuild(inst, editedBuild)!;
    // Before clearing: head is overridden to 'crown'
    expect(deriveEffectiveSlots(reapplied).head).toBe('crown');
    // After clearing: head inherits from new snapshot
    const cleared = clearSlotOverride(reapplied, 'head');
    expect(deriveEffectiveSlots(cleared).head).toBe(HEAD.sourceId);
  });
});

// ── deriveEffectiveCharacterSlotStates ──

describe('deriveEffectiveCharacterSlotStates', () => {
  it('returns empty array for non-character instance', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(deriveEffectiveCharacterSlotStates(asset)).toEqual([]);
  });

  it('returns one entry per canonical slot in CHARACTER_SLOT_IDS order', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const states = deriveEffectiveCharacterSlotStates(inst);
    expect(states.length).toBe(CHARACTER_SLOT_IDS.length);
    expect(states.map((s) => s.slot)).toEqual([...CHARACTER_SLOT_IDS]);
  });

  it('marks equipped inherited slots correctly', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const states = deriveEffectiveCharacterSlotStates(inst);
    const headState = states.find((s) => s.slot === 'head')!;
    expect(headState.effectivePart).toBe('head-basic');
    expect(headState.source).toBe('inherited');
    expect(headState.isOverridden).toBe(false);
    expect(headState.overrideMode).toBeUndefined();
    expect(headState.hasPart).toBe(true);
  });

  it('marks empty inherited slots correctly', () => {
    const inst = placeCharacterBuild(WARRIOR);
    const states = deriveEffectiveCharacterSlotStates(inst);
    const faceState = states.find((s) => s.slot === 'face')!;
    expect(faceState.effectivePart).toBeUndefined();
    expect(faceState.source).toBe('inherited');
    expect(faceState.isOverridden).toBe(false);
    expect(faceState.hasPart).toBe(false);
  });

  it('marks remove-overridden slots correctly', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      weapon: { slot: 'weapon', mode: 'remove' },
    };
    const states = deriveEffectiveCharacterSlotStates(inst);
    const weaponState = states.find((s) => s.slot === 'weapon')!;
    expect(weaponState.effectivePart).toBeUndefined();
    expect(weaponState.source).toBe('override_remove');
    expect(weaponState.isOverridden).toBe(true);
    expect(weaponState.overrideMode).toBe('remove');
    expect(weaponState.hasPart).toBe(false);
  });

  it('marks replace-overridden slots correctly', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
    };
    const states = deriveEffectiveCharacterSlotStates(inst);
    const headState = states.find((s) => s.slot === 'head')!;
    expect(headState.effectivePart).toBe('crown-gold');
    expect(headState.source).toBe('override_replace');
    expect(headState.isOverridden).toBe(true);
    expect(headState.overrideMode).toBe('replace');
    expect(headState.hasPart).toBe(true);
  });

  it('mixed overrides and inherited slots', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
      weapon: { slot: 'weapon', mode: 'remove' },
    };
    const states = deriveEffectiveCharacterSlotStates(inst);

    // Overridden
    expect(states.find((s) => s.slot === 'head')!.isOverridden).toBe(true);
    expect(states.find((s) => s.slot === 'weapon')!.isOverridden).toBe(true);

    // Inherited
    expect(states.find((s) => s.slot === 'torso')!.isOverridden).toBe(false);
    expect(states.find((s) => s.slot === 'torso')!.effectivePart).toBe('torso-plate');

    // Total overridden count
    expect(states.filter((s) => s.isOverridden).length).toBe(2);
    // Total with parts
    expect(states.filter((s) => s.hasPart).length).toBe(4); // head(replaced), torso, arms, legs — weapon removed
  });

  it('empty build returns all slots as inherited with no parts', () => {
    const inst = placeCharacterBuild(EMPTY_BUILD);
    const states = deriveEffectiveCharacterSlotStates(inst);
    expect(states.length).toBe(CHARACTER_SLOT_IDS.length);
    expect(states.every((s) => s.source === 'inherited')).toBe(true);
    expect(states.every((s) => !s.hasPart)).toBe(true);
  });
});

// ── getOverrideCount ──

describe('getOverrideCount', () => {
  it('returns 0 when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(getOverrideCount(inst)).toBe(0);
  });

  it('returns 0 when characterOverrides is undefined', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = undefined;
    expect(getOverrideCount(inst)).toBe(0);
  });

  it('counts overrides correctly', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
      weapon: { slot: 'weapon', mode: 'replace', replacementPartId: 'axe' },
    };
    expect(getOverrideCount(inst)).toBe(2);
  });
});

// ── getEffectiveEquippedCount ──

describe('getEffectiveEquippedCount', () => {
  it('returns snapshot count when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(getEffectiveEquippedCount(inst)).toBe(5);
  });

  it('returns 0 for non-character instances', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(getEffectiveEquippedCount(asset)).toBe(0);
  });

  it('accounts for remove overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      weapon: { slot: 'weapon', mode: 'remove' },
    };
    expect(getEffectiveEquippedCount(inst)).toBe(4);
  });

  it('accounts for replace overrides (count stays same)', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'replace', replacementPartId: 'crown' },
    };
    expect(getEffectiveEquippedCount(inst)).toBe(5); // replaced, not removed
  });

  it('accounts for replace adding new slot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      face: { slot: 'face', mode: 'replace', replacementPartId: 'mask' },
    };
    expect(getEffectiveEquippedCount(inst)).toBe(6); // 5 + face added
  });
});

// ── getRemovedOverrideSlots / getReplacedOverrideSlots ──

describe('getRemovedOverrideSlots', () => {
  it('returns empty array when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(getRemovedOverrideSlots(inst)).toEqual([]);
  });

  it('returns only slots with remove mode', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
      weapon: { slot: 'weapon', mode: 'replace', replacementPartId: 'axe' },
      torso: { slot: 'torso', mode: 'remove' },
    };
    const removed = getRemovedOverrideSlots(inst);
    expect(removed).toContain('head');
    expect(removed).toContain('torso');
    expect(removed).not.toContain('weapon');
    expect(removed.length).toBe(2);
  });
});

describe('getReplacedOverrideSlots', () => {
  it('returns empty array when no overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(getReplacedOverrideSlots(inst)).toEqual([]);
  });

  it('returns only slots with replace mode', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
      weapon: { slot: 'weapon', mode: 'replace', replacementPartId: 'axe' },
      torso: { slot: 'torso', mode: 'replace', replacementPartId: 'robe' },
    };
    const replaced = getReplacedOverrideSlots(inst);
    expect(replaced).toContain('weapon');
    expect(replaced).toContain('torso');
    expect(replaced).not.toContain('head');
    expect(replaced.length).toBe(2);
  });
});

// ── overrideSummary ──

describe('overrideSummary', () => {
  it('returns "No local overrides" when none', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(overrideSummary(inst)).toBe('No local overrides');
  });

  it('returns singular form for 1 override', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
    };
    expect(overrideSummary(inst)).toBe('1 local override');
  });

  it('returns plural form for multiple overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      head: { slot: 'head', mode: 'remove' },
      weapon: { slot: 'weapon', mode: 'remove' },
      torso: { slot: 'torso', mode: 'replace', replacementPartId: 'robe' },
    };
    expect(overrideSummary(inst)).toBe('3 local overrides');
  });
});

// ── effectiveSlotSummary ──

describe('effectiveSlotSummary', () => {
  it('returns empty string for non-character instance', () => {
    const asset: SceneAssetInstance = {
      instanceId: 'a1', sourcePath: '/a.pxs', name: 'A',
      x: 0, y: 0, zOrder: 0, visible: true, opacity: 1, parallax: 1,
    };
    expect(effectiveSlotSummary(asset)).toBe('');
  });

  it('returns effective count without overrides', () => {
    const inst = placeCharacterBuild(WARRIOR);
    expect(effectiveSlotSummary(inst)).toBe('5/12 effective');
  });

  it('reflects overrides in effective count', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      weapon: { slot: 'weapon', mode: 'remove' },
    };
    expect(effectiveSlotSummary(inst)).toBe('4/12 effective');
  });

  it('reflects replace adding new slot', () => {
    const inst = placeCharacterBuild(WARRIOR);
    inst.characterOverrides = {
      face: { slot: 'face', mode: 'replace', replacementPartId: 'mask' },
    };
    expect(effectiveSlotSummary(inst)).toBe('6/12 effective');
  });
});

// ── Integration: derivation + reapply ──

describe('effective derivation after reapply', () => {
  it('deriveEffectiveCharacterSlotStates reflects new snapshot + preserved overrides', () => {
    let inst = placeCharacterBuild(WARRIOR);
    inst = setSlotOverride(inst, { slot: 'head', mode: 'replace', replacementPartId: 'crown' });
    inst = setSlotOverride(inst, { slot: 'weapon', mode: 'remove' });

    const editedBuild: CharacterBuild = {
      id: 'build-warrior',
      name: 'Warrior v2',
      slots: { head: HEAD, torso: TORSO, arms: ARMS },
    };

    const reapplied = reapplyCharacterBuild(inst, editedBuild)!;
    const states = deriveEffectiveCharacterSlotStates(reapplied);

    // head: overridden to crown
    const headState = states.find((s) => s.slot === 'head')!;
    expect(headState.effectivePart).toBe('crown');
    expect(headState.source).toBe('override_replace');

    // weapon: override_remove (weapon not in new snapshot anyway)
    const weaponState = states.find((s) => s.slot === 'weapon')!;
    expect(weaponState.effectivePart).toBeUndefined();
    expect(weaponState.source).toBe('override_remove');

    // torso: inherited from new snapshot
    const torsoState = states.find((s) => s.slot === 'torso')!;
    expect(torsoState.effectivePart).toBe('torso-plate');
    expect(torsoState.source).toBe('inherited');

    // legs: not in new snapshot, not overridden
    const legsState = states.find((s) => s.slot === 'legs')!;
    expect(legsState.effectivePart).toBeUndefined();
    expect(legsState.source).toBe('inherited');
    expect(legsState.hasPart).toBe(false);
  });

  it('counts align after reapply with overrides', () => {
    let inst = placeCharacterBuild(WARRIOR);
    inst = setSlotOverride(inst, { slot: 'weapon', mode: 'remove' });

    const editedBuild: CharacterBuild = {
      id: 'build-warrior',
      name: 'Warrior v2',
      slots: { head: HEAD, torso: TORSO },
    };

    const reapplied = reapplyCharacterBuild(inst, editedBuild)!;
    expect(getOverrideCount(reapplied)).toBe(1);
    expect(getEffectiveEquippedCount(reapplied)).toBe(2); // head + torso, weapon removed but wasn't in snapshot
    expect(effectiveSlotSummary(reapplied)).toBe('2/12 effective');
    expect(overrideSummary(reapplied)).toBe('1 local override');
  });
});
