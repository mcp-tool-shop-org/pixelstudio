import { describe, it, expect, beforeEach } from 'vitest';
import type {
  CharacterBuildLibrary,
  SavedCharacterBuild,
  CharacterPartRef,
  CharacterSlotId,
} from '@glyphstudio/domain';
import { CHARACTER_BUILD_LIBRARY_VERSION, CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import {
  createEmptyLibrary,
  saveBuildToLibrary,
  toCharacterBuild,
} from './characterBuildLibrary';

// ── Inline replica of characterBuildStorage load/save ──────────
// Production code lives in apps/desktop/src/lib/characterBuildStorage.ts.
// Inlined here so persistence logic is testable from the state package.

const STORAGE_KEY = 'glyphstudio_character_builds';
const VALID_SLOTS = new Set<string>(CHARACTER_SLOT_IDS);

function isValidSlotId(s: unknown): s is CharacterSlotId {
  return typeof s === 'string' && VALID_SLOTS.has(s);
}

function coercePartRef(raw: unknown): CharacterPartRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sourceId !== 'string' || !r.sourceId) return null;
  if (!isValidSlotId(r.slot)) return null;
  const part: CharacterPartRef = { sourceId: r.sourceId, slot: r.slot };
  if (typeof r.variantId === 'string') part.variantId = r.variantId;
  if (Array.isArray(r.tags) && r.tags.every((t: unknown) => typeof t === 'string')) part.tags = r.tags;
  if (Array.isArray(r.requiredSockets) && r.requiredSockets.every((s: unknown) => typeof s === 'string')) part.requiredSockets = r.requiredSockets;
  if (Array.isArray(r.providedSockets) && r.providedSockets.every((s: unknown) => typeof s === 'string')) part.providedSockets = r.providedSockets;
  if (Array.isArray(r.requiredAnchors) && r.requiredAnchors.every((a: unknown) => typeof a === 'string')) part.requiredAnchors = r.requiredAnchors;
  if (Array.isArray(r.providedAnchors) && r.providedAnchors.every((a: unknown) => typeof a === 'string')) part.providedAnchors = r.providedAnchors;
  return part;
}

function coerceSlots(raw: unknown): Partial<Record<CharacterSlotId, CharacterPartRef>> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Partial<Record<CharacterSlotId, CharacterPartRef>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidSlotId(key)) continue;
    const part = coercePartRef(value);
    if (part) result[key] = part;
  }
  return result;
}

function coerceSavedBuild(raw: unknown): SavedCharacterBuild | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (typeof r.createdAt !== 'string') return null;
  if (typeof r.updatedAt !== 'string') return null;
  const build: SavedCharacterBuild = {
    id: r.id,
    name: r.name,
    slots: coerceSlots(r.slots),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
  if (Array.isArray(r.tags) && r.tags.every((t: unknown) => typeof t === 'string')) build.tags = r.tags;
  if (typeof r.description === 'string') build.description = r.description;
  if (typeof r.sourcePresetId === 'string') build.sourcePresetId = r.sourcePresetId;
  return build;
}

function loadCharacterBuildLibrary(): CharacterBuildLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyLibrary();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyLibrary();
    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion !== CHARACTER_BUILD_LIBRARY_VERSION) {
      return createEmptyLibrary();
    }
    if (!Array.isArray(parsed.builds)) return createEmptyLibrary();
    const builds: SavedCharacterBuild[] = [];
    for (const entry of parsed.builds) {
      const build = coerceSavedBuild(entry);
      if (build) builds.push(build);
    }
    return { schemaVersion: CHARACTER_BUILD_LIBRARY_VERSION, builds };
  } catch {
    return createEmptyLibrary();
  }
}

function saveCharacterBuildLibrary(library: CharacterBuildLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}

// ── Fake localStorage ──────────────────────────────────────────
const store = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (_i: number) => null as string | null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: fakeLocalStorage,
  writable: true,
});

// ── Fixtures ──────────────────────────────────────────────────

const HEAD: CharacterPartRef = { sourceId: 'head-basic', slot: 'head', tags: ['human'] };
const TORSO: CharacterPartRef = { sourceId: 'torso-plate', slot: 'torso', providedSockets: ['chest_mount'] };
const ARMS: CharacterPartRef = { sourceId: 'arms-default', slot: 'arms' };
const LEGS: CharacterPartRef = { sourceId: 'legs-default', slot: 'legs' };
const WEAPON: CharacterPartRef = { sourceId: 'sword-iron', slot: 'weapon', requiredSockets: ['hand'], requiredAnchors: ['grip'] };

const VALID_SAVED_BUILD: SavedCharacterBuild = {
  id: 'build-warrior',
  name: 'Warrior',
  slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS },
  tags: ['melee', 'heavy'],
  description: 'A sturdy warrior build.',
  sourcePresetId: 'preset-knight',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-02-20T14:30:00.000Z',
};

const VALID_LIBRARY: CharacterBuildLibrary = {
  schemaVersion: 1,
  builds: [VALID_SAVED_BUILD],
};

// ── Tests ──────────────────────────────────────────────────────
describe('characterBuildStorage', () => {
  beforeEach(() => store.clear());

  // ── Load: missing storage ──

  describe('load — missing storage', () => {
    it('returns empty library when localStorage is empty', () => {
      const lib = loadCharacterBuildLibrary();
      expect(lib.schemaVersion).toBe(CHARACTER_BUILD_LIBRARY_VERSION);
      expect(lib.builds).toEqual([]);
    });
  });

  // ── Load: corrupt storage ──

  describe('load — corrupt storage', () => {
    it('returns empty library for malformed JSON', () => {
      store.set(STORAGE_KEY, '<<<garbage>>>');
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('returns empty library for null JSON', () => {
      store.set(STORAGE_KEY, 'null');
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('returns empty library for array JSON', () => {
      store.set(STORAGE_KEY, '[]');
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('returns empty library for empty object', () => {
      store.set(STORAGE_KEY, '{}');
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });
  });

  // ── Load: version guard ──

  describe('load — version guard', () => {
    it('returns empty library for wrong schema version', () => {
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 999, builds: [] }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('returns empty library for missing schema version', () => {
      store.set(STORAGE_KEY, JSON.stringify({ builds: [] }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('returns empty library for string schema version', () => {
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: '1', builds: [] }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('accepts current schema version', () => {
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: CHARACTER_BUILD_LIBRARY_VERSION, builds: [] }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.schemaVersion).toBe(CHARACTER_BUILD_LIBRARY_VERSION);
    });
  });

  // ── Load: builds array coercion ──

  describe('load — builds coercion', () => {
    it('returns empty library for non-array builds', () => {
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, builds: 'not-array' }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('skips builds with missing id', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{ name: 'No ID', slots: {}, createdAt: 'x', updatedAt: 'x' }],
      }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('skips builds with missing name', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{ id: 'b1', slots: {}, createdAt: 'x', updatedAt: 'x' }],
      }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('skips builds with missing timestamps', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{ id: 'b1', name: 'Test', slots: {} }],
      }));
      expect(loadCharacterBuildLibrary().builds).toEqual([]);
    });

    it('skips null entries in builds array', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [null, VALID_SAVED_BUILD],
      }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds).toHaveLength(1);
      expect(lib.builds[0].id).toBe('build-warrior');
    });
  });

  // ── Load: slot/part coercion ──

  describe('load — slot coercion', () => {
    it('skips parts with invalid slot IDs', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{
          id: 'b1', name: 'Test', createdAt: 'x', updatedAt: 'x',
          slots: { head: HEAD, invalid_slot: { sourceId: 'bad', slot: 'invalid_slot' } },
        }],
      }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].slots.head).toBeDefined();
      expect(Object.keys(lib.builds[0].slots)).toEqual(['head']);
    });

    it('skips parts with missing sourceId', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{
          id: 'b1', name: 'Test', createdAt: 'x', updatedAt: 'x',
          slots: { head: { slot: 'head' } },
        }],
      }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].slots.head).toBeUndefined();
    });

    it('skips parts with non-string sourceId', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{
          id: 'b1', name: 'Test', createdAt: 'x', updatedAt: 'x',
          slots: { head: { sourceId: 42, slot: 'head' } },
        }],
      }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].slots.head).toBeUndefined();
    });

    it('handles missing slots gracefully', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{
          id: 'b1', name: 'Test', createdAt: 'x', updatedAt: 'x',
        }],
      }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].slots).toEqual({});
    });

    it('preserves optional part fields', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{
          id: 'b1', name: 'Test', createdAt: 'x', updatedAt: 'x',
          slots: { weapon: WEAPON },
        }],
      }));
      const lib = loadCharacterBuildLibrary();
      const weapon = lib.builds[0].slots.weapon!;
      expect(weapon.requiredSockets).toEqual(['hand']);
      expect(weapon.requiredAnchors).toEqual(['grip']);
    });

    it('drops non-string-array tags on parts', () => {
      store.set(STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        builds: [{
          id: 'b1', name: 'Test', createdAt: 'x', updatedAt: 'x',
          slots: { head: { sourceId: 'h1', slot: 'head', tags: [1, 2, 3] } },
        }],
      }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].slots.head!.tags).toBeUndefined();
    });
  });

  // ── Load: optional build fields ──

  describe('load — optional build fields', () => {
    it('preserves tags', () => {
      store.set(STORAGE_KEY, JSON.stringify(VALID_LIBRARY));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].tags).toEqual(['melee', 'heavy']);
    });

    it('preserves description', () => {
      store.set(STORAGE_KEY, JSON.stringify(VALID_LIBRARY));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].description).toBe('A sturdy warrior build.');
    });

    it('preserves sourcePresetId', () => {
      store.set(STORAGE_KEY, JSON.stringify(VALID_LIBRARY));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].sourcePresetId).toBe('preset-knight');
    });

    it('drops non-string description', () => {
      const bad = { ...VALID_SAVED_BUILD, description: 42 };
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, builds: [bad] }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].description).toBeUndefined();
    });

    it('drops non-string-array tags on build', () => {
      const bad = { ...VALID_SAVED_BUILD, tags: 'not-array' };
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, builds: [bad] }));
      const lib = loadCharacterBuildLibrary();
      expect(lib.builds[0].tags).toBeUndefined();
    });

    it('ignores unknown keys on build', () => {
      const extended = { ...VALID_SAVED_BUILD, mystery: 'value' };
      store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, builds: [extended] }));
      const lib = loadCharacterBuildLibrary();
      expect((lib.builds[0] as Record<string, unknown>)['mystery']).toBeUndefined();
    });
  });

  // ── Save behavior ──

  describe('save', () => {
    it('writes expected shape to storage', () => {
      saveCharacterBuildLibrary(VALID_LIBRARY);
      const raw = store.get(STORAGE_KEY);
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.builds).toHaveLength(1);
      expect(parsed.builds[0].id).toBe('build-warrior');
    });

    it('saved payload includes schema version', () => {
      saveCharacterBuildLibrary(createEmptyLibrary());
      const parsed = JSON.parse(store.get(STORAGE_KEY)!);
      expect(parsed.schemaVersion).toBe(CHARACTER_BUILD_LIBRARY_VERSION);
    });
  });

  // ── Round-trip ──

  describe('round-trip', () => {
    it('save then load round-trips library cleanly', () => {
      saveCharacterBuildLibrary(VALID_LIBRARY);
      const loaded = loadCharacterBuildLibrary();
      expect(loaded.schemaVersion).toBe(1);
      expect(loaded.builds).toHaveLength(1);
      expect(loaded.builds[0].id).toBe('build-warrior');
      expect(loaded.builds[0].name).toBe('Warrior');
      expect(loaded.builds[0].slots.head?.sourceId).toBe('head-basic');
      expect(loaded.builds[0].tags).toEqual(['melee', 'heavy']);
      expect(loaded.builds[0].description).toBe('A sturdy warrior build.');
    });

    it('save multiple builds → load preserves all', () => {
      let lib = createEmptyLibrary();
      lib = saveBuildToLibrary(lib, { id: 'b1', name: 'Build 1', slots: { head: HEAD } });
      lib = saveBuildToLibrary(lib, { id: 'b2', name: 'Build 2', slots: { torso: TORSO } });
      saveCharacterBuildLibrary(lib);

      const loaded = loadCharacterBuildLibrary();
      expect(loaded.builds).toHaveLength(2);
      expect(loaded.builds[0].id).toBe('b2'); // most recent first
      expect(loaded.builds[1].id).toBe('b1');
    });

    it('timestamps survive round-trip', () => {
      saveCharacterBuildLibrary(VALID_LIBRARY);
      const loaded = loadCharacterBuildLibrary();
      expect(loaded.builds[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
      expect(loaded.builds[0].updatedAt).toBe('2026-02-20T14:30:00.000Z');
    });

    it('build → persist → reload → same slot composition', () => {
      const build = {
        id: 'test-rt',
        name: 'Round Trip',
        slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS, weapon: WEAPON },
      };
      let lib = createEmptyLibrary();
      lib = saveBuildToLibrary(lib, build);
      saveCharacterBuildLibrary(lib);

      const loaded = loadCharacterBuildLibrary();
      const recovered = toCharacterBuild(loaded.builds[0]);
      expect(recovered.slots.head?.sourceId).toBe('head-basic');
      expect(recovered.slots.torso?.sourceId).toBe('torso-plate');
      expect(recovered.slots.weapon?.sourceId).toBe('sword-iron');
      expect(recovered.slots.weapon?.requiredSockets).toEqual(['hand']);
    });

    it('overwrite persists correctly', () => {
      let lib = createEmptyLibrary();
      lib = saveBuildToLibrary(lib, { id: 'b1', name: 'Original', slots: { head: HEAD } });
      saveCharacterBuildLibrary(lib);

      lib = loadCharacterBuildLibrary();
      lib = saveBuildToLibrary(lib, { id: 'b1', name: 'Updated', slots: { head: HEAD, torso: TORSO } });
      saveCharacterBuildLibrary(lib);

      const loaded = loadCharacterBuildLibrary();
      expect(loaded.builds).toHaveLength(1);
      expect(loaded.builds[0].name).toBe('Updated');
      expect(loaded.builds[0].slots.torso?.sourceId).toBe('torso-plate');
    });

    it('empty library round-trips', () => {
      saveCharacterBuildLibrary(createEmptyLibrary());
      const loaded = loadCharacterBuildLibrary();
      expect(loaded.schemaVersion).toBe(CHARACTER_BUILD_LIBRARY_VERSION);
      expect(loaded.builds).toEqual([]);
    });
  });

  // ── Ordering law ──

  describe('ordering', () => {
    it('most recently saved build appears first after round-trip', () => {
      let lib = createEmptyLibrary();
      lib = saveBuildToLibrary(lib, { id: 'a', name: 'A', slots: {} });
      lib = saveBuildToLibrary(lib, { id: 'b', name: 'B', slots: {} });
      lib = saveBuildToLibrary(lib, { id: 'c', name: 'C', slots: {} });
      saveCharacterBuildLibrary(lib);

      const loaded = loadCharacterBuildLibrary();
      expect(loaded.builds.map((b) => b.id)).toEqual(['c', 'b', 'a']);
    });

    it('overwritten build moves to front after round-trip', () => {
      let lib = createEmptyLibrary();
      lib = saveBuildToLibrary(lib, { id: 'a', name: 'A', slots: {} });
      lib = saveBuildToLibrary(lib, { id: 'b', name: 'B', slots: {} });
      // Overwrite a — moves to front
      lib = saveBuildToLibrary(lib, { id: 'a', name: 'A Updated', slots: {} });
      saveCharacterBuildLibrary(lib);

      const loaded = loadCharacterBuildLibrary();
      expect(loaded.builds.map((b) => b.id)).toEqual(['a', 'b']);
      expect(loaded.builds[0].name).toBe('A Updated');
    });
  });
});
