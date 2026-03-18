import { describe, it, expect } from 'vitest';
import type { SavedPack } from './packLibrary';
import {
  PACK_LIBRARY_VERSION,
  createEmptyPackLibrary,
  addPackToLibrary,
  deletePackFromLibrary,
  renamePackInLibrary,
  findPackById,
  getPackCount,
  generatePackId,
} from './packLibrary';

function makePack(overrides: Partial<SavedPack> = {}): SavedPack {
  return {
    id: generatePackId(),
    name: 'Test Pack',
    paletteSetCount: 2,
    partCount: 3,
    interchangeJson: '{}',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('packLibrary', () => {
  it('createEmptyPackLibrary returns correct structure', () => {
    const lib = createEmptyPackLibrary();
    expect(lib.schemaVersion).toBe(PACK_LIBRARY_VERSION);
    expect(lib.packs).toEqual([]);
  });

  it('addPackToLibrary prepends', () => {
    let lib = createEmptyPackLibrary();
    lib = addPackToLibrary(lib, makePack({ name: 'Old' }));
    lib = addPackToLibrary(lib, makePack({ name: 'New' }));
    expect(lib.packs[0].name).toBe('New');
  });

  it('deletePackFromLibrary removes by ID', () => {
    let lib = addPackToLibrary(createEmptyPackLibrary(), makePack({ id: 'del' }));
    lib = deletePackFromLibrary(lib, 'del');
    expect(lib.packs).toHaveLength(0);
  });

  it('renamePackInLibrary updates name', () => {
    let lib = addPackToLibrary(createEmptyPackLibrary(), makePack({ id: 'r1', name: 'Old' }));
    lib = renamePackInLibrary(lib, 'r1', 'New');
    expect(lib.packs[0].name).toBe('New');
  });

  it('findPackById returns pack', () => {
    const lib = addPackToLibrary(createEmptyPackLibrary(), makePack({ id: 'f1', name: 'Found' }));
    expect(findPackById(lib, 'f1')?.name).toBe('Found');
  });

  it('getPackCount returns length', () => {
    let lib = createEmptyPackLibrary();
    expect(getPackCount(lib)).toBe(0);
    lib = addPackToLibrary(lib, makePack());
    expect(getPackCount(lib)).toBe(1);
  });
});
