import { describe, it, expect } from 'vitest';
import type { PaletteSet, Part } from '@glyphstudio/domain';
import {
  exportPaletteSets,
  exportParts,
  exportProjectTemplate,
  exportPack,
  parseInterchangeFile,
  parseProjectTemplate,
  parsePack,
  deriveImportName,
  INTERCHANGE_FORMAT,
  INTERCHANGE_VERSION,
} from './interchange';
import type { PackParseResult } from './interchange';
import type { ProjectTemplateParseResult } from './interchange';
import { createSpriteDocument } from '@glyphstudio/domain';
import type { SpriteDocument } from '@glyphstudio/domain';
import { createEmptyPartLibrary, addPartToLibrary } from './partLibrary';

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

  // ── Project templates ──

  describe('exportProjectTemplate', () => {
    it('produces valid template interchange JSON', () => {
      const doc = createSpriteDocument('hero', 32, 32);
      doc.paletteSets = [makePaletteSet('Warm')];
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart('Helmet'));

      const json = exportProjectTemplate(doc, lib);
      const parsed = JSON.parse(json);

      expect(parsed.format).toBe(INTERCHANGE_FORMAT);
      expect(parsed.contentType).toBe('template');
      expect(parsed.template.name).toBe('hero');
      expect(parsed.template.canvasWidth).toBe(32);
      expect(parsed.template.canvasHeight).toBe(32);
      expect(parsed.template.palette.length).toBeGreaterThan(0);
      expect(parsed.paletteSets).toHaveLength(1);
      expect(parsed.parts).toHaveLength(1);
    });

    it('omits palette sets when option is false', () => {
      const doc = createSpriteDocument('test', 16, 16);
      doc.paletteSets = [makePaletteSet('Cool')];
      const json = exportProjectTemplate(doc, createEmptyPartLibrary(), { includePaletteSets: false });
      const parsed = JSON.parse(json);
      expect(parsed.paletteSets).toBeUndefined();
    });

    it('omits parts when option is false', () => {
      const doc = createSpriteDocument('test', 16, 16);
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart('Sword'));
      const json = exportProjectTemplate(doc, lib, { includeParts: false });
      const parsed = JSON.parse(json);
      expect(parsed.parts).toBeUndefined();
    });

    it('includes frameCount for multi-frame documents', () => {
      const doc = createSpriteDocument('anim', 16, 16);
      // Simulate multi-frame by adding frames
      doc.frames.push({ ...doc.frames[0], id: 'f2', index: 1 });
      doc.frames.push({ ...doc.frames[0], id: 'f3', index: 2 });
      const json = exportProjectTemplate(doc, createEmptyPartLibrary());
      const parsed = JSON.parse(json);
      expect(parsed.template.frameCount).toBe(3);
    });
  });

  describe('parseProjectTemplate', () => {
    it('roundtrips a project template', () => {
      const doc = createSpriteDocument('hero', 64, 64);
      doc.paletteSets = [makePaletteSet('Warm')];
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart('Shield'));

      const json = exportProjectTemplate(doc, lib);
      const result = parseProjectTemplate(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.template.name).toBe('hero');
      expect(result.template.canvasWidth).toBe(64);
      expect(result.template.canvasHeight).toBe(64);
      expect(result.template.palette.length).toBeGreaterThan(0);
      expect(result.paletteSets).toHaveLength(1);
      expect(result.parts).toHaveLength(1);
    });

    it('returns error for missing template data', () => {
      const json = JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 1,
      });
      const result = parseProjectTemplate(json);
      expect('error' in result).toBe(true);
    });

    it('returns error for invalid template fields', () => {
      const json = JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 1,
        template: { name: '', canvasWidth: 0, canvasHeight: 16, palette: [] },
      });
      const result = parseProjectTemplate(json);
      expect('error' in result).toBe(true);
    });

    it('returns error for invalid JSON', () => {
      expect('error' in parseProjectTemplate('nope')).toBe(true);
    });

    it('parses template without optional palette sets and parts', () => {
      const doc = createSpriteDocument('minimal', 16, 16);
      const json = exportProjectTemplate(doc, createEmptyPartLibrary(), {
        includePaletteSets: false,
        includeParts: false,
      });
      const result = parseProjectTemplate(json);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.paletteSets).toHaveLength(0);
      expect(result.parts).toHaveLength(0);
    });
  });

  // ── Asset packs ──

  describe('exportPack', () => {
    it('produces valid pack interchange JSON', () => {
      const doc = createSpriteDocument('hero', 32, 32);
      doc.paletteSets = [makePaletteSet('Warm'), makePaletteSet('Cool')];
      const lib = addPartToLibrary(
        addPartToLibrary(createEmptyPartLibrary(), makePart('Shield')),
        makePart('Helmet'),
      );

      const json = exportPack(doc, lib, {
        name: 'Player Kit',
        description: 'Everything for the player character',
        paletteSetIds: ['ps-warm'],
        partIds: ['part-helmet'],
      });
      const parsed = JSON.parse(json);

      expect(parsed.format).toBe(INTERCHANGE_FORMAT);
      expect(parsed.contentType).toBe('pack');
      expect(parsed.pack.name).toBe('Player Kit');
      expect(parsed.pack.description).toBe('Everything for the player character');
      expect(parsed.paletteSets).toHaveLength(1);
      expect(parsed.paletteSets[0].name).toBe('Warm');
      expect(parsed.parts).toHaveLength(1);
      expect(parsed.parts[0].name).toBe('Helmet');
    });

    it('exports only selected items', () => {
      const doc = createSpriteDocument('test', 16, 16);
      doc.paletteSets = [makePaletteSet('A'), makePaletteSet('B')];
      const json = exportPack(doc, createEmptyPartLibrary(), {
        name: 'Selective',
        paletteSetIds: ['ps-a'],
      });
      const parsed = JSON.parse(json);
      expect(parsed.paletteSets).toHaveLength(1);
      expect(parsed.paletteSets[0].name).toBe('A');
    });
  });

  describe('parsePack', () => {
    it('roundtrips a pack', () => {
      const doc = createSpriteDocument('test', 16, 16);
      doc.paletteSets = [makePaletteSet('Warm')];
      const lib = addPartToLibrary(createEmptyPartLibrary(), makePart('Sword'));

      const json = exportPack(doc, lib, {
        name: 'Combat Kit',
        paletteSetIds: ['ps-warm'],
        partIds: ['part-sword'],
      });
      const result = parsePack(json, [], []);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.pack.name).toBe('Combat Kit');
      expect(result.paletteSets).toHaveLength(1);
      expect(result.parts).toHaveLength(1);
      expect(result.conflicts).toHaveLength(0);
    });

    it('detects name conflicts', () => {
      const doc = createSpriteDocument('test', 16, 16);
      doc.paletteSets = [makePaletteSet('Warm')];
      const json = exportPack(doc, createEmptyPartLibrary(), {
        name: 'Kit',
        paletteSetIds: ['ps-warm'],
      });
      const result = parsePack(json, ['Warm'], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.conflicts).toHaveLength(1);
    });

    it('returns error for missing pack metadata', () => {
      const json = JSON.stringify({ format: INTERCHANGE_FORMAT, version: 1 });
      expect('error' in parsePack(json, [], [])).toBe(true);
    });

    it('returns error for empty pack', () => {
      const json = JSON.stringify({
        format: INTERCHANGE_FORMAT,
        version: 1,
        pack: { name: 'Empty' },
        paletteSets: [],
        parts: [],
      });
      expect('error' in parsePack(json, [], [])).toBe(true);
    });
  });
});
