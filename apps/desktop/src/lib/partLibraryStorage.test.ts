import { describe, it, expect, beforeEach } from 'vitest';
import type { Part, PartLibrary } from '@glyphstudio/domain';
import { PART_LIBRARY_VERSION } from '@glyphstudio/domain';
import { createEmptyPartLibrary, addPartToLibrary } from '@glyphstudio/state';
import { loadPartLibrary, savePartLibrary } from './partLibraryStorage';

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: `part_test_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Part',
    width: 4,
    height: 4,
    pixelData: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('partLibraryStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty library when nothing stored', () => {
    const lib = loadPartLibrary();
    expect(lib.schemaVersion).toBe(PART_LIBRARY_VERSION);
    expect(lib.parts).toEqual([]);
  });

  it('returns empty library for garbage data', () => {
    localStorage.setItem('glyphstudio_part_library', 'not json');
    const lib = loadPartLibrary();
    expect(lib.parts).toEqual([]);
  });

  it('returns empty library for null value', () => {
    localStorage.setItem('glyphstudio_part_library', 'null');
    const lib = loadPartLibrary();
    expect(lib.parts).toEqual([]);
  });

  it('returns empty library for wrong schema version', () => {
    localStorage.setItem('glyphstudio_part_library', JSON.stringify({
      schemaVersion: 999,
      parts: [],
    }));
    const lib = loadPartLibrary();
    expect(lib.parts).toEqual([]);
  });

  it('roundtrips a part library', () => {
    const part = makePart({ id: 'roundtrip', name: 'Helmet', tags: ['armor'] });
    let lib = createEmptyPartLibrary();
    lib = addPartToLibrary(lib, part);

    savePartLibrary(lib);
    const loaded = loadPartLibrary();

    expect(loaded.parts).toHaveLength(1);
    expect(loaded.parts[0].id).toBe('roundtrip');
    expect(loaded.parts[0].name).toBe('Helmet');
    expect(loaded.parts[0].width).toBe(4);
    expect(loaded.parts[0].height).toBe(4);
    expect(loaded.parts[0].pixelData).toEqual(part.pixelData);
    expect(loaded.parts[0].tags).toEqual(['armor']);
  });

  it('skips invalid parts during load', () => {
    localStorage.setItem('glyphstudio_part_library', JSON.stringify({
      schemaVersion: PART_LIBRARY_VERSION,
      parts: [
        { id: 'good', name: 'Good', width: 2, height: 2, pixelData: [0, 0, 0, 0], createdAt: 'x', updatedAt: 'x' },
        { id: '', name: 'Bad ID' }, // invalid
        null, // invalid
        { id: 'also-good', name: 'Also Good', width: 1, height: 1, pixelData: [1, 2, 3, 4], createdAt: 'y', updatedAt: 'y' },
      ],
    }));
    const lib = loadPartLibrary();
    expect(lib.parts).toHaveLength(2);
    expect(lib.parts[0].id).toBe('good');
    expect(lib.parts[1].id).toBe('also-good');
  });
});
