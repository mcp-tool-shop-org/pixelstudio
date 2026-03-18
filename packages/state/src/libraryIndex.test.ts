import { describe, it, expect } from 'vitest';
import { createSpriteDocument } from '@glyphstudio/domain';
import type { SpriteDocument, PaletteSet, DocumentVariant, Part, PartLibrary } from '@glyphstudio/domain';
import { createEmptyPartLibrary, addPartToLibrary } from './partLibrary';
import { buildLibraryIndex, filterLibraryItems, groupByKind } from './libraryIndex';
import type { LibraryItemKind } from './libraryIndex';

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: `part_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Part',
    width: 4,
    height: 4,
    pixelData: new Array(64).fill(0),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDoc(): SpriteDocument {
  const doc = createSpriteDocument('test', 16, 16);
  doc.paletteSets = [
    { id: 'ps-warm', name: 'Warm', colors: [{ rgba: [255, 128, 0, 255] }] },
    { id: 'ps-cool', name: 'Cool', colors: [{ rgba: [0, 128, 255, 255] }] },
  ];
  doc.variants = [
    {
      id: 'var-left', name: 'Walk Left',
      frames: [{ id: 'f1', index: 0, durationMs: 100, layers: [] }],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    },
  ];
  return doc;
}

describe('libraryIndex', () => {
  describe('buildLibraryIndex', () => {
    it('returns empty array when no doc and empty part library', () => {
      const items = buildLibraryIndex(null, createEmptyPartLibrary(), null, null, null);
      expect(items).toEqual([]);
    });

    it('includes parts from part library', () => {
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart({ id: 'p1', name: 'Head' }));
      const items = buildLibraryIndex(null, lib, null, null, null);
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe('part');
      expect(items[0].name).toBe('Head');
    });

    it('includes palette sets from document', () => {
      const doc = makeDoc();
      const items = buildLibraryIndex(doc, createEmptyPartLibrary(), null, null, null);
      const palettes = items.filter((i) => i.kind === 'palette-set');
      expect(palettes).toHaveLength(2);
      expect(palettes[0].name).toBe('Warm');
      expect(palettes[0].swatchColors).toHaveLength(1);
    });

    it('includes document variants', () => {
      const doc = makeDoc();
      const items = buildLibraryIndex(doc, createEmptyPartLibrary(), null, null, null);
      const variants = items.filter((i) => i.kind === 'variant');
      expect(variants).toHaveLength(1);
      expect(variants[0].name).toBe('Walk Left');
      expect(variants[0].frameCount).toBe(1);
    });

    it('marks active items', () => {
      const doc = makeDoc();
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart({ id: 'p1' }));
      const items = buildLibraryIndex(doc, lib, 'p1', 'ps-warm', 'var-left');

      expect(items.find((i) => i.id === 'p1')?.isActive).toBe(true);
      expect(items.find((i) => i.id === 'ps-warm')?.isActive).toBe(true);
      expect(items.find((i) => i.id === 'var-left')?.isActive).toBe(true);
      expect(items.find((i) => i.id === 'ps-cool')?.isActive).toBe(false);
    });

    it('includes part dimensions and pixelData', () => {
      const part = makePart({ id: 'p1', width: 8, height: 6, pixelData: [1, 2, 3, 4] });
      const lib = addPartToLibrary(createEmptyPartLibrary(), part);
      const items = buildLibraryIndex(null, lib, null, null, null);
      expect(items[0].width).toBe(8);
      expect(items[0].height).toBe(6);
      expect(items[0].pixelData).toEqual([1, 2, 3, 4]);
    });
  });

  describe('filterLibraryItems', () => {
    it('filters by name query', () => {
      const doc = makeDoc();
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart({ name: 'Helmet' }));
      const items = buildLibraryIndex(doc, lib, null, null, null);
      const allKinds = new Set<LibraryItemKind>(['part', 'palette-set', 'variant']);

      const filtered = filterLibraryItems(items, 'helm', allKinds);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Helmet');
    });

    it('filters by kind', () => {
      const doc = makeDoc();
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart({ name: 'Head' }));
      const items = buildLibraryIndex(doc, lib, null, null, null);

      const partsOnly = filterLibraryItems(items, '', new Set<LibraryItemKind>(['part']));
      expect(partsOnly.every((i) => i.kind === 'part')).toBe(true);
    });

    it('case-insensitive search', () => {
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart({ name: 'MyPart' }));
      const items = buildLibraryIndex(null, lib, null, null, null);
      const allKinds = new Set<LibraryItemKind>(['part', 'palette-set', 'variant']);

      expect(filterLibraryItems(items, 'mypart', allKinds)).toHaveLength(1);
      expect(filterLibraryItems(items, 'MYPART', allKinds)).toHaveLength(1);
    });

    it('empty query returns all items of matching kinds', () => {
      const doc = makeDoc();
      const items = buildLibraryIndex(doc, createEmptyPartLibrary(), null, null, null);
      const allKinds = new Set<LibraryItemKind>(['part', 'palette-set', 'variant']);

      expect(filterLibraryItems(items, '', allKinds)).toHaveLength(items.length);
    });
  });

  describe('groupByKind', () => {
    it('groups items correctly', () => {
      const doc = makeDoc();
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart());
      const items = buildLibraryIndex(doc, lib, null, null, null);
      const groups = groupByKind(items);

      expect(groups['part']).toHaveLength(1);
      expect(groups['palette-set']).toHaveLength(2);
      expect(groups['variant']).toHaveLength(1);
    });

    it('returns empty arrays for missing kinds', () => {
      const groups = groupByKind([]);
      expect(groups['part']).toEqual([]);
      expect(groups['palette-set']).toEqual([]);
      expect(groups['variant']).toEqual([]);
    });
  });
});
