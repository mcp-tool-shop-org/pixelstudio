import { describe, it, expect } from 'vitest';
import type { PaletteSet, Part } from '@glyphstudio/domain';
import {
  exportPaletteSets,
  exportParts,
  parseInterchangeFile,
  deriveImportName,
  INTERCHANGE_FORMAT,
  INTERCHANGE_VERSION,
} from './interchange';

function makePaletteSet(name: string): PaletteSet {
  return {
    id: `ps-${name.toLowerCase()}`,
    name,
    colors: [{ rgba: [255, 0, 0, 255], name: 'Red' }, { rgba: [0, 255, 0, 255] }],
  };
}

function makePart(name: string): Part {
  return {
    id: `part-${name.toLowerCase()}`,
    name,
    width: 4,
    height: 4,
    pixelData: [255, 0, 0, 255, 0, 0, 0, 0],
    tags: ['test'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('interchange', () => {
  // ── Export ──

  describe('exportPaletteSets', () => {
    it('produces valid interchange JSON', () => {
      const json = exportPaletteSets([makePaletteSet('Warm')]);
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe(INTERCHANGE_FORMAT);
      expect(parsed.version).toBe(INTERCHANGE_VERSION);
      expect(parsed.contentType).toBe('palette-sets');
      expect(parsed.paletteSets).toHaveLength(1);
      expect(parsed.paletteSets[0].name).toBe('Warm');
      expect(parsed.paletteSets[0].colors[0].rgba).toEqual([255, 0, 0, 255]);
      expect(parsed.paletteSets[0].colors[0].name).toBe('Red');
    });

    it('omits optional color name when not set', () => {
      const json = exportPaletteSets([makePaletteSet('Test')]);
      const parsed = JSON.parse(json);
      expect(parsed.paletteSets[0].colors[1]).not.toHaveProperty('name');
    });
  });

  describe('exportParts', () => {
    it('produces valid interchange JSON', () => {
      const json = exportParts([makePart('Helmet')]);
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe(INTERCHANGE_FORMAT);
      expect(parsed.contentType).toBe('parts');
      expect(parsed.parts).toHaveLength(1);
      expect(parsed.parts[0].name).toBe('Helmet');
      expect(parsed.parts[0].width).toBe(4);
      expect(parsed.parts[0].tags).toEqual(['test']);
    });
  });

  // ── Import ──

  describe('parseInterchangeFile', () => {
    it('roundtrips palette sets', () => {
      const json = exportPaletteSets([makePaletteSet('Warm'), makePaletteSet('Cool')]);
      const result = parseInterchangeFile(json, [], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.contentType).toBe('palette-sets');
      expect(result.paletteSets).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('roundtrips parts', () => {
      const json = exportParts([makePart('Sword')]);
      const result = parseInterchangeFile(json, [], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.contentType).toBe('parts');
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].pixelData).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);
    });

    it('detects name conflicts for palette sets', () => {
      const json = exportPaletteSets([makePaletteSet('Warm')]);
      const result = parseInterchangeFile(json, ['Warm'], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].name).toBe('Warm');
      expect(result.conflicts[0].hasNameConflict).toBe(true);
    });

    it('detects name conflicts for parts', () => {
      const json = exportParts([makePart('Helmet')]);
      const result = parseInterchangeFile(json, [], ['Helmet']);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].name).toBe('Helmet');
    });

    it('returns error for invalid JSON', () => {
      const result = parseInterchangeFile('not json', [], []);
      expect('error' in result).toBe(true);
    });

    it('returns error for wrong format', () => {
      const result = parseInterchangeFile(JSON.stringify({ format: 'wrong' }), [], []);
      expect('error' in result).toBe(true);
    });

    it('returns error for unsupported version', () => {
      const result = parseInterchangeFile(JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 999,
      }), [], []);
      expect('error' in result).toBe(true);
    });

    it('returns error when no valid data found', () => {
      const result = parseInterchangeFile(JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 1,
        paletteSets: [],
        parts: [],
      }), [], []);
      expect('error' in result).toBe(true);
    });

    it('skips invalid entries during parsing', () => {
      const json = JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 1,
        contentType: 'parts',
        exportedAt: '2026-01-01T00:00:00Z',
        parts: [
          { id: 'good', name: 'Good', width: 2, height: 2, pixelData: [0, 0, 0, 0] },
          null,
          { id: '', name: 'Bad' }, // invalid
        ],
      });
      const result = parseInterchangeFile(json, [], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].id).toBe('good');
    });

    it('handles mixed content type', () => {
      const json = JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 1,
        contentType: 'mixed',
        exportedAt: '2026-01-01T00:00:00Z',
        paletteSets: [{ id: 'ps1', name: 'Warm', colors: [{ rgba: [255, 0, 0, 255] }] }],
        parts: [{ id: 'p1', name: 'Head', width: 4, height: 4, pixelData: [0] }],
      });
      const result = parseInterchangeFile(json, [], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.contentType).toBe('mixed');
      expect(result.paletteSets).toHaveLength(1);
      expect(result.parts).toHaveLength(1);
    });
  });

  // ── Collision resolution ──

  describe('deriveImportName', () => {
    it('appends (Imported) suffix', () => {
      expect(deriveImportName('Warm', new Set())).toBe('Warm (Imported)');
    });

    it('increments when (Imported) already exists', () => {
      expect(deriveImportName('Warm', new Set(['Warm (Imported)']))).toBe('Warm (Imported 2)');
    });

    it('finds next available number', () => {
      const existing = new Set(['Warm (Imported)', 'Warm (Imported 2)', 'Warm (Imported 3)']);
      expect(deriveImportName('Warm', existing)).toBe('Warm (Imported 4)');
    });
  });
});
