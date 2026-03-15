import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  CharacterBuild,
  CharacterBuildLibrary,
  SavedCharacterBuild,
  CharacterPartRef,
} from '@glyphstudio/domain';
import { CHARACTER_BUILD_LIBRARY_VERSION } from '@glyphstudio/domain';
import {
  createEmptyLibrary,
  toSavedBuild,
  toCharacterBuild,
  saveBuildToLibrary,
  deleteBuildFromLibrary,
  duplicateBuildInLibrary,
  findBuildById,
  renameBuildInLibrary,
  hasBuildInLibrary,
  getLibraryBuildCount,
} from './characterBuildLibrary';

// ── Fixtures ──

const HEAD: CharacterPartRef = { sourceId: 'head-basic', slot: 'head', tags: ['human'] };
const TORSO: CharacterPartRef = { sourceId: 'torso-plate', slot: 'torso', providedSockets: ['chest_mount'] };
const ARMS: CharacterPartRef = { sourceId: 'arms-default', slot: 'arms' };
const LEGS: CharacterPartRef = { sourceId: 'legs-default', slot: 'legs' };

const WARRIOR_BUILD: CharacterBuild = {
  id: 'build-warrior',
  name: 'Warrior',
  slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS },
  tags: ['melee', 'heavy'],
};

const MAGE_BUILD: CharacterBuild = {
  id: 'build-mage',
  name: 'Mage',
  slots: { head: HEAD },
};

function makeSavedBuild(overrides: Partial<SavedCharacterBuild> & { id: string; name: string }): SavedCharacterBuild {
  return {
    slots: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── createEmptyLibrary ──

describe('createEmptyLibrary', () => {
  it('returns a library with current schema version', () => {
    const lib = createEmptyLibrary();
    expect(lib.schemaVersion).toBe(CHARACTER_BUILD_LIBRARY_VERSION);
  });

  it('returns a library with empty builds array', () => {
    const lib = createEmptyLibrary();
    expect(lib.builds).toEqual([]);
  });
});

// ── toSavedBuild / toCharacterBuild ──

describe('toSavedBuild', () => {
  it('copies all build fields', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    expect(saved.id).toBe('build-warrior');
    expect(saved.name).toBe('Warrior');
    expect(saved.slots.head?.sourceId).toBe('head-basic');
    expect(saved.slots.torso?.sourceId).toBe('torso-plate');
    expect(saved.tags).toEqual(['melee', 'heavy']);
  });

  it('sets createdAt and updatedAt', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    expect(saved.createdAt).toBeTruthy();
    expect(saved.updatedAt).toBeTruthy();
    // Both should be the same on initial save
    expect(saved.createdAt).toBe(saved.updatedAt);
  });

  it('copies slots by value (not reference)', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    expect(saved.slots).not.toBe(WARRIOR_BUILD.slots);
  });

  it('copies tags by value', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    expect(saved.tags).not.toBe(WARRIOR_BUILD.tags);
  });

  it('handles build without tags', () => {
    const saved = toSavedBuild(MAGE_BUILD);
    expect(saved.tags).toBeUndefined();
  });
});

describe('toCharacterBuild', () => {
  it('converts saved build back to editor build', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    const build = toCharacterBuild(saved);
    expect(build.id).toBe('build-warrior');
    expect(build.name).toBe('Warrior');
    expect(build.slots.head?.sourceId).toBe('head-basic');
    expect(build.tags).toEqual(['melee', 'heavy']);
  });

  it('drops persistence metadata', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    const build = toCharacterBuild(saved);
    expect(build).not.toHaveProperty('createdAt');
    expect(build).not.toHaveProperty('updatedAt');
    expect(build).not.toHaveProperty('description');
  });

  it('round-trip preserves slot content', () => {
    const saved = toSavedBuild(WARRIOR_BUILD);
    const build = toCharacterBuild(saved);
    expect(build.slots).toEqual(WARRIOR_BUILD.slots);
  });
});

// ── saveBuildToLibrary ──

describe('saveBuildToLibrary', () => {
  it('adds a new build to empty library', () => {
    const lib = createEmptyLibrary();
    const result = saveBuildToLibrary(lib, WARRIOR_BUILD);
    expect(result.builds).toHaveLength(1);
    expect(result.builds[0].id).toBe('build-warrior');
    expect(result.builds[0].name).toBe('Warrior');
  });

  it('prepends new build (most recent first)', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    lib = saveBuildToLibrary(lib, MAGE_BUILD);
    expect(lib.builds[0].id).toBe('build-mage');
    expect(lib.builds[1].id).toBe('build-warrior');
  });

  it('overwrites existing build by ID', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const updated: CharacterBuild = { ...WARRIOR_BUILD, name: 'Veteran Warrior' };
    lib = saveBuildToLibrary(lib, updated);
    expect(lib.builds).toHaveLength(1);
    expect(lib.builds[0].name).toBe('Veteran Warrior');
  });

  it('preserves createdAt on overwrite', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const originalCreatedAt = lib.builds[0].createdAt;
    const updated: CharacterBuild = { ...WARRIOR_BUILD, name: 'Updated' };
    lib = saveBuildToLibrary(lib, updated);
    expect(lib.builds[0].createdAt).toBe(originalCreatedAt);
  });

  it('updates updatedAt on overwrite', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const originalUpdatedAt = lib.builds[0].updatedAt;

    // Ensure time advances
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

    const updated: CharacterBuild = { ...WARRIOR_BUILD, name: 'Updated' };
    lib = saveBuildToLibrary(lib, updated);
    expect(lib.builds[0].updatedAt).not.toBe(originalUpdatedAt);

    vi.useRealTimers();
  });

  it('moves overwritten build to front', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    lib = saveBuildToLibrary(lib, MAGE_BUILD);
    // Warrior is now second
    expect(lib.builds[0].id).toBe('build-mage');
    // Overwrite warrior — should move to front
    lib = saveBuildToLibrary(lib, { ...WARRIOR_BUILD, name: 'Updated Warrior' });
    expect(lib.builds[0].id).toBe('build-warrior');
    expect(lib.builds[0].name).toBe('Updated Warrior');
  });

  it('does not mutate original library', () => {
    const lib = createEmptyLibrary();
    const result = saveBuildToLibrary(lib, WARRIOR_BUILD);
    expect(lib.builds).toHaveLength(0);
    expect(result.builds).toHaveLength(1);
  });

  it('preserves schema version', () => {
    const lib = createEmptyLibrary();
    const result = saveBuildToLibrary(lib, WARRIOR_BUILD);
    expect(result.schemaVersion).toBe(CHARACTER_BUILD_LIBRARY_VERSION);
  });
});

// ── deleteBuildFromLibrary ──

describe('deleteBuildFromLibrary', () => {
  it('removes build by ID', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    lib = saveBuildToLibrary(lib, MAGE_BUILD);
    lib = deleteBuildFromLibrary(lib, 'build-warrior');
    expect(lib.builds).toHaveLength(1);
    expect(lib.builds[0].id).toBe('build-mage');
  });

  it('returns same library if ID not found', () => {
    const lib = createEmptyLibrary();
    const result = deleteBuildFromLibrary(lib, 'nonexistent');
    expect(result).toBe(lib);
  });

  it('does not mutate original library', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const original = lib;
    const result = deleteBuildFromLibrary(lib, 'build-warrior');
    expect(original.builds).toHaveLength(1);
    expect(result.builds).toHaveLength(0);
  });

  it('can delete the only build', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    lib = deleteBuildFromLibrary(lib, 'build-warrior');
    expect(lib.builds).toHaveLength(0);
  });
});

// ── duplicateBuildInLibrary ──

describe('duplicateBuildInLibrary', () => {
  it('creates a copy with new ID', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library, newBuildId } = duplicateBuildInLibrary(lib, 'build-warrior');
    expect(library.builds).toHaveLength(2);
    expect(newBuildId).not.toBeNull();
    expect(newBuildId).not.toBe('build-warrior');
  });

  it('uses "Name Copy" as default duplicate name', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library } = duplicateBuildInLibrary(lib, 'build-warrior');
    expect(library.builds[0].name).toBe('Warrior Copy');
  });

  it('uses custom name when provided', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library } = duplicateBuildInLibrary(lib, 'build-warrior', 'Warrior v2');
    expect(library.builds[0].name).toBe('Warrior v2');
  });

  it('copies slot content', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library, newBuildId } = duplicateBuildInLibrary(lib, 'build-warrior');
    const duplicate = findBuildById(library, newBuildId!);
    expect(duplicate!.slots.head?.sourceId).toBe('head-basic');
    expect(duplicate!.slots.torso?.sourceId).toBe('torso-plate');
  });

  it('copies tags', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library, newBuildId } = duplicateBuildInLibrary(lib, 'build-warrior');
    const duplicate = findBuildById(library, newBuildId!);
    expect(duplicate!.tags).toEqual(['melee', 'heavy']);
    // By value, not reference
    expect(duplicate!.tags).not.toBe(lib.builds[0].tags);
  });

  it('prepends duplicate as most recent', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library } = duplicateBuildInLibrary(lib, 'build-warrior');
    expect(library.builds[0].name).toBe('Warrior Copy');
  });

  it('returns null newBuildId if source not found', () => {
    const lib = createEmptyLibrary();
    const { library, newBuildId } = duplicateBuildInLibrary(lib, 'nonexistent');
    expect(newBuildId).toBeNull();
    expect(library).toBe(lib);
  });

  it('sets fresh timestamps on duplicate', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const { library, newBuildId } = duplicateBuildInLibrary(lib, 'build-warrior');
    const duplicate = findBuildById(library, newBuildId!);
    expect(duplicate!.createdAt).toBe(duplicate!.updatedAt);
  });
});

// ── findBuildById ──

describe('findBuildById', () => {
  it('returns the build when found', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const found = findBuildById(lib, 'build-warrior');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Warrior');
  });

  it('returns undefined when not found', () => {
    const lib = createEmptyLibrary();
    expect(findBuildById(lib, 'nonexistent')).toBeUndefined();
  });
});

// ── renameBuildInLibrary ──

describe('renameBuildInLibrary', () => {
  it('updates the build name', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    lib = renameBuildInLibrary(lib, 'build-warrior', 'Veteran');
    expect(lib.builds[0].name).toBe('Veteran');
  });

  it('updates updatedAt', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    const before = lib.builds[0].updatedAt;

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

    lib = renameBuildInLibrary(lib, 'build-warrior', 'Veteran');
    expect(lib.builds[0].updatedAt).not.toBe(before);

    vi.useRealTimers();
  });

  it('returns same library if ID not found', () => {
    const lib = createEmptyLibrary();
    const result = renameBuildInLibrary(lib, 'nonexistent', 'New Name');
    expect(result).toBe(lib);
  });
});

// ── hasBuildInLibrary ──

describe('hasBuildInLibrary', () => {
  it('returns true when build exists', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    expect(hasBuildInLibrary(lib, 'build-warrior')).toBe(true);
  });

  it('returns false when build does not exist', () => {
    const lib = createEmptyLibrary();
    expect(hasBuildInLibrary(lib, 'nonexistent')).toBe(false);
  });
});

// ── getLibraryBuildCount ──

describe('getLibraryBuildCount', () => {
  it('returns 0 for empty library', () => {
    expect(getLibraryBuildCount(createEmptyLibrary())).toBe(0);
  });

  it('returns correct count', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    lib = saveBuildToLibrary(lib, MAGE_BUILD);
    expect(getLibraryBuildCount(lib)).toBe(2);
  });
});

// ── Integration: round-trip lifecycle ──

describe('library lifecycle round-trip', () => {
  it('create → save → duplicate → load → delete', () => {
    let lib = createEmptyLibrary();

    // Save warrior
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);
    expect(getLibraryBuildCount(lib)).toBe(1);

    // Duplicate
    const { library: lib2, newBuildId } = duplicateBuildInLibrary(lib, 'build-warrior', 'Warrior v2');
    lib = lib2;
    expect(getLibraryBuildCount(lib)).toBe(2);

    // Load duplicate back to editor format
    const loaded = toCharacterBuild(findBuildById(lib, newBuildId!)!);
    expect(loaded.name).toBe('Warrior v2');
    expect(loaded.slots.head?.sourceId).toBe('head-basic');

    // Delete original
    lib = deleteBuildFromLibrary(lib, 'build-warrior');
    expect(getLibraryBuildCount(lib)).toBe(1);
    expect(findBuildById(lib, 'build-warrior')).toBeUndefined();
    expect(findBuildById(lib, newBuildId!)).toBeDefined();
  });

  it('save → overwrite → validation still derivable', () => {
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, WARRIOR_BUILD);

    // Overwrite with modified build (remove head)
    const modified: CharacterBuild = {
      ...WARRIOR_BUILD,
      slots: { torso: TORSO, arms: ARMS, legs: LEGS },
    };
    lib = saveBuildToLibrary(lib, modified);

    // Load and check slots survived round-trip
    const loaded = toCharacterBuild(lib.builds[0]);
    expect(loaded.slots.head).toBeUndefined();
    expect(loaded.slots.torso?.sourceId).toBe('torso-plate');
  });

  it('library immutability across operations', () => {
    const empty = createEmptyLibrary();
    const withWarrior = saveBuildToLibrary(empty, WARRIOR_BUILD);
    const withMage = saveBuildToLibrary(withWarrior, MAGE_BUILD);
    const afterDelete = deleteBuildFromLibrary(withMage, 'build-warrior');

    // Each step produces a new library; originals unchanged
    expect(empty.builds).toHaveLength(0);
    expect(withWarrior.builds).toHaveLength(1);
    expect(withMage.builds).toHaveLength(2);
    expect(afterDelete.builds).toHaveLength(1);
  });
});
