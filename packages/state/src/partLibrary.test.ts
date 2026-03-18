import { describe, it, expect } from 'vitest';
import type { Part, PartLibrary } from '@glyphstudio/domain';
import { PART_LIBRARY_VERSION } from '@glyphstudio/domain';
import {
  createEmptyPartLibrary,
  generateDefaultPartName,
  addPartToLibrary,
  deletePartFromLibrary,
  renamePartInLibrary,
  duplicatePartInLibrary,
  findPartById,
  hasPartInLibrary,
  getPartCount,
} from './partLibrary';

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: `part_test_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Part',
    width: 4,
    height: 4,
    pixelData: new Array(4 * 4 * 4).fill(0),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('partLibrary', () => {
  describe('createEmptyPartLibrary', () => {
    it('returns correct schema version and empty parts array', () => {
      const lib = createEmptyPartLibrary();
      expect(lib.schemaVersion).toBe(PART_LIBRARY_VERSION);
      expect(lib.parts).toEqual([]);
    });
  });

  describe('generateDefaultPartName', () => {
    it('returns "Part 1" for empty library', () => {
      expect(generateDefaultPartName(createEmptyPartLibrary())).toBe('Part 1');
    });

    it('increments past existing names', () => {
      const lib: PartLibrary = {
        schemaVersion: 1,
        parts: [makePart({ name: 'Part 1' }), makePart({ name: 'Part 2' })],
      };
      expect(generateDefaultPartName(lib)).toBe('Part 3');
    });

    it('fills gaps in numbering', () => {
      const lib: PartLibrary = {
        schemaVersion: 1,
        parts: [makePart({ name: 'Part 1' }), makePart({ name: 'Part 3' })],
      };
      expect(generateDefaultPartName(lib)).toBe('Part 2');
    });
  });

  describe('addPartToLibrary', () => {
    it('prepends the part', () => {
      const lib = createEmptyPartLibrary();
      const part = makePart({ name: 'First' });
      const result = addPartToLibrary(lib, part);
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].name).toBe('First');
    });

    it('prepends most recent first', () => {
      let lib = createEmptyPartLibrary();
      lib = addPartToLibrary(lib, makePart({ name: 'Old' }));
      lib = addPartToLibrary(lib, makePart({ name: 'New' }));
      expect(lib.parts[0].name).toBe('New');
      expect(lib.parts[1].name).toBe('Old');
    });

    it('does not mutate the original library', () => {
      const lib = createEmptyPartLibrary();
      addPartToLibrary(lib, makePart());
      expect(lib.parts).toHaveLength(0);
    });
  });

  describe('deletePartFromLibrary', () => {
    it('removes part by ID', () => {
      const part = makePart({ id: 'del-me' });
      let lib = addPartToLibrary(createEmptyPartLibrary(), part);
      lib = deletePartFromLibrary(lib, 'del-me');
      expect(lib.parts).toHaveLength(0);
    });

    it('returns same library when ID not found', () => {
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart());
      const result = deletePartFromLibrary(lib, 'nonexistent');
      expect(result).toBe(lib);
    });
  });

  describe('renamePartInLibrary', () => {
    it('updates name and updatedAt', () => {
      const part = makePart({ id: 'rename-me', name: 'Old Name' });
      let lib = addPartToLibrary(createEmptyPartLibrary(), part);
      lib = renamePartInLibrary(lib, 'rename-me', 'New Name');
      expect(lib.parts[0].name).toBe('New Name');
      expect(lib.parts[0].updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('returns same library when ID not found', () => {
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart());
      const result = renamePartInLibrary(lib, 'nonexistent', 'x');
      expect(result).toBe(lib);
    });
  });

  describe('duplicatePartInLibrary', () => {
    it('creates a copy with unique name and new ID', () => {
      const part = makePart({ id: 'dup-me', name: 'Original' });
      let lib = addPartToLibrary(createEmptyPartLibrary(), part);
      const { library: result, newPartId } = duplicatePartInLibrary(lib, 'dup-me');
      expect(result.parts).toHaveLength(2);
      expect(result.parts[0].name).toBe('Original Copy');
      expect(result.parts[0].id).toBe(newPartId);
      expect(newPartId).not.toBe('dup-me');
    });

    it('preserves pixel data independently', () => {
      const pixelData = [255, 0, 0, 255, 0, 255, 0, 255];
      const part = makePart({ id: 'dup-px', pixelData });
      let lib = addPartToLibrary(createEmptyPartLibrary(), part);
      const { library: result } = duplicatePartInLibrary(lib, 'dup-px');
      expect(result.parts[0].pixelData).toEqual(pixelData);
      // Verify it's a copy
      result.parts[0].pixelData[0] = 0;
      expect(pixelData[0]).toBe(255);
    });

    it('returns null newPartId for unknown source', () => {
      const { newPartId } = duplicatePartInLibrary(createEmptyPartLibrary(), 'nonexistent');
      expect(newPartId).toBeNull();
    });
  });

  describe('findPartById', () => {
    it('returns the part when found', () => {
      const part = makePart({ id: 'find-me', name: 'Found' });
      const lib = addPartToLibrary(createEmptyPartLibrary(), part);
      expect(findPartById(lib, 'find-me')?.name).toBe('Found');
    });

    it('returns undefined when not found', () => {
      expect(findPartById(createEmptyPartLibrary(), 'nope')).toBeUndefined();
    });
  });

  describe('hasPartInLibrary', () => {
    it('returns true when part exists', () => {
      const part = makePart({ id: 'exists' });
      const lib = addPartToLibrary(createEmptyPartLibrary(), part);
      expect(hasPartInLibrary(lib, 'exists')).toBe(true);
    });

    it('returns false when part does not exist', () => {
      expect(hasPartInLibrary(createEmptyPartLibrary(), 'nope')).toBe(false);
    });
  });

  describe('getPartCount', () => {
    it('returns 0 for empty library', () => {
      expect(getPartCount(createEmptyPartLibrary())).toBe(0);
    });

    it('returns correct count', () => {
      let lib = createEmptyPartLibrary();
      lib = addPartToLibrary(lib, makePart());
      lib = addPartToLibrary(lib, makePart());
      expect(getPartCount(lib)).toBe(2);
    });
  });
});
