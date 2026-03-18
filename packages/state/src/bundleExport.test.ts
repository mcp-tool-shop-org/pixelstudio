import { describe, it, expect } from 'vitest';
import { createSpriteDocument, createBlankPixelBuffer } from '@glyphstudio/domain';
import type { SpriteDocument, SpritePixelBuffer, DocumentVariant, PaletteSet } from '@glyphstudio/domain';
import { setPixel, samplePixel } from './spriteRaster';
import { generateBundlePlan, executeBundleExport } from './bundleExport';
import type { BundleScope, BundlePlan, BundleExportEntry } from './bundleExport';

function makeDoc(): { doc: SpriteDocument; pixelBuffers: Record<string, SpritePixelBuffer> } {
  const doc = createSpriteDocument('hero', 4, 4);
  const layerId = doc.frames[0].layers[0].id;
  const buf = createBlankPixelBuffer(4, 4);
  setPixel(buf, 0, 0, [0, 0, 0, 255]); // Black
  return { doc, pixelBuffers: { [layerId]: buf } };
}

function addVariant(doc: SpriteDocument, pixelBuffers: Record<string, SpritePixelBuffer>, name: string, color: [number, number, number, number]): string {
  const varLayerId = `vl-${name}`;
  const varBuf = createBlankPixelBuffer(4, 4);
  setPixel(varBuf, 0, 0, color);
  pixelBuffers[varLayerId] = varBuf;

  const variant: DocumentVariant = {
    id: `var-${name}`,
    name,
    frames: [{
      id: `vf-${name}`,
      index: 0,
      durationMs: 100,
      layers: [{ id: varLayerId, name: 'Layer 1', visible: true, index: 0 }],
    }],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
  doc.variants = [...(doc.variants ?? []), variant];
  return variant.id;
}

function addPaletteSet(doc: SpriteDocument, name: string, blackTo: [number, number, number, number]): string {
  const ps: PaletteSet = {
    id: `ps-${name}`,
    name,
    colors: doc.palette.colors.map((c, i) =>
      i === 1 ? { ...c, rgba: blackTo } : { ...c },
    ),
  };
  doc.paletteSets = [...(doc.paletteSets ?? []), ps];
  return ps.id;
}

describe('bundleExport', () => {
  // ── generateBundlePlan ──

  describe('generateBundlePlan', () => {
    it('single base, no palettes → 1 entry, no suffixes', () => {
      const { doc } = makeDoc();
      const plan = generateBundlePlan(doc, { documentVariants: [null], paletteSets: [], format: 'sheet' });
      expect(plan.totalFiles).toBe(1);
      expect(plan.entries[0].filename).toBe('hero');
      expect(plan.entries[0].documentVariantId).toBeNull();
      expect(plan.entries[0].paletteSetId).toBeNull();
    });

    it('multiple doc variants, no palettes → doc variant suffixes', () => {
      const { doc, pixelBuffers } = makeDoc();
      addVariant(doc, pixelBuffers, 'Walk Left', [255, 0, 0, 255]);
      const plan = generateBundlePlan(doc, {
        documentVariants: [null, 'var-Walk Left'],
        paletteSets: [],
        format: 'sheet',
      });
      expect(plan.totalFiles).toBe(2);
      expect(plan.entries[0].filename).toBe('hero-base');
      expect(plan.entries[1].filename).toBe('hero-walk-left');
    });

    it('single doc variant + palette sets → palette suffixes', () => {
      const { doc } = makeDoc();
      addPaletteSet(doc, 'Warm', [255, 128, 0, 255]);
      const plan = generateBundlePlan(doc, {
        documentVariants: [null],
        paletteSets: ['ps-Warm'],
        format: 'sheet',
      });
      expect(plan.totalFiles).toBe(2); // base palette + Warm
      expect(plan.entries[0].filename).toBe('hero-base');
      expect(plan.entries[1].filename).toBe('hero-warm');
    });

    it('both axes → cross product with both suffixes', () => {
      const { doc, pixelBuffers } = makeDoc();
      addVariant(doc, pixelBuffers, 'Left', [255, 0, 0, 255]);
      addPaletteSet(doc, 'Cool', [0, 0, 255, 255]);
      const plan = generateBundlePlan(doc, {
        documentVariants: [null, 'var-Left'],
        paletteSets: ['ps-Cool'],
        format: 'sheet',
      });
      // 2 doc variants × 2 palettes (base + Cool) = 4
      expect(plan.totalFiles).toBe(4);
      expect(plan.entries.map((e) => e.filename)).toEqual([
        'hero-base-base',
        'hero-base-cool',
        'hero-left-base',
        'hero-left-cool',
      ]);
    });

    it('empty documentVariants defaults to base', () => {
      const { doc } = makeDoc();
      const plan = generateBundlePlan(doc, { documentVariants: [], paletteSets: [], format: 'sheet' });
      expect(plan.totalFiles).toBe(1);
      expect(plan.entries[0].documentVariantId).toBeNull();
    });

    it('preserves format in entries', () => {
      const { doc } = makeDoc();
      const plan = generateBundlePlan(doc, { documentVariants: [null], paletteSets: [], format: 'gif' });
      expect(plan.entries[0].format).toBe('gif');
    });
  });

  // ── executeBundleExport ──

  describe('executeBundleExport', () => {
    it('exports base sequence with base palette', () => {
      const { doc, pixelBuffers } = makeDoc();
      const plan = generateBundlePlan(doc, { documentVariants: [null], paletteSets: [], format: 'sheet' });
      const result = executeBundleExport(doc, pixelBuffers, plan);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as BundleExportEntry[];
      expect(entries).toHaveLength(1);
      expect(entries[0].filename).toBe('hero');
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([0, 0, 0, 255]);
    });

    it('exports variant with remapped palette', () => {
      const { doc, pixelBuffers } = makeDoc();
      addVariant(doc, pixelBuffers, 'Left', [0, 0, 0, 255]); // Black pixel
      addPaletteSet(doc, 'Red', [255, 0, 0, 255]); // Black → Red

      const plan = generateBundlePlan(doc, {
        documentVariants: ['var-Left'],
        paletteSets: ['ps-Red'],
        format: 'sheet',
      });
      const result = executeBundleExport(doc, pixelBuffers, plan);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as BundleExportEntry[];
      // 1 variant × 2 palettes (base + Red) = 2
      expect(entries).toHaveLength(2);

      // Base palette: black stays black
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([0, 0, 0, 255]);
      // Red palette: black → red
      expect(samplePixel(entries[1].sheet, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('returns error for unknown variant', () => {
      const { doc, pixelBuffers } = makeDoc();
      const plan: BundlePlan = {
        entries: [{
          filename: 'test',
          documentVariantId: 'bogus',
          documentVariantName: 'Bogus',
          paletteSetId: null,
          paletteSetName: 'base',
          format: 'sheet',
        }],
        totalFiles: 1,
      };
      const result = executeBundleExport(doc, pixelBuffers, plan);
      expect('error' in result).toBe(true);
    });

    it('returns error for unknown palette set', () => {
      const { doc, pixelBuffers } = makeDoc();
      const plan: BundlePlan = {
        entries: [{
          filename: 'test',
          documentVariantId: null,
          documentVariantName: 'base',
          paletteSetId: 'bogus',
          paletteSetName: 'Bogus',
          format: 'sheet',
        }],
        totalFiles: 1,
      };
      const result = executeBundleExport(doc, pixelBuffers, plan);
      expect('error' in result).toBe(true);
    });

    it('cross-product export produces correct file count', () => {
      const { doc, pixelBuffers } = makeDoc();
      addVariant(doc, pixelBuffers, 'Left', [0, 0, 0, 255]);
      addVariant(doc, pixelBuffers, 'Right', [0, 0, 0, 255]);
      addPaletteSet(doc, 'Warm', [255, 128, 0, 255]);
      addPaletteSet(doc, 'Cool', [0, 128, 255, 255]);

      const plan = generateBundlePlan(doc, {
        documentVariants: [null, 'var-Left', 'var-Right'],
        paletteSets: ['ps-Warm', 'ps-Cool'],
        format: 'sheet',
      });
      // 3 doc variants × 3 palettes (base + Warm + Cool) = 9
      expect(plan.totalFiles).toBe(9);

      const result = executeBundleExport(doc, pixelBuffers, plan);
      expect(Array.isArray(result)).toBe(true);
      expect((result as BundleExportEntry[]).length).toBe(9);
    });

    it('metadata name matches filename', () => {
      const { doc, pixelBuffers } = makeDoc();
      const plan = generateBundlePlan(doc, { documentVariants: [null], paletteSets: [], format: 'sheet' });
      const result = executeBundleExport(doc, pixelBuffers, plan);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as BundleExportEntry[];
      expect(entries[0].meta.name).toBe('hero');
    });
  });
});
