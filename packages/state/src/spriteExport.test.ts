import { describe, it, expect } from 'vitest';
import {
  createSpriteDocument,
  createSpriteFrame,
  createBlankPixelBuffer,
} from '@glyphstudio/domain';
import type { SpriteDocument, SpritePixelBuffer, SpriteSheetMeta, PaletteSet, DocumentVariant } from '@glyphstudio/domain';
import { generateSpriteSheetMeta, encodeAnimatedGif, generateVariantExports, generateDocumentVariantExports, sanitizeFilename } from './spriteExport';
import type { VariantExportEntry, DocumentVariantExportEntry } from './spriteExport';
import { isImportExportError } from './spriteImportExport';
import { setPixel, samplePixel } from './spriteRaster';

/** Helper: create a document with N frames at given durations. */
function makeDoc(
  name: string,
  width: number,
  height: number,
  durations: number[],
): SpriteDocument {
  const doc = createSpriteDocument(name, width, height);
  doc.frames = durations.map((d, i) => createSpriteFrame(i, d));
  return doc;
}

describe('spriteExport', () => {
  describe('generateSpriteSheetMeta', () => {
    it('returns error for empty frame list', () => {
      const doc = createSpriteDocument('empty', 16, 16);
      doc.frames = [];
      const result = generateSpriteSheetMeta(doc);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('No frames');
      }
    });

    it('generates correct metadata for a single frame', () => {
      const doc = makeDoc('single', 32, 32, [100]);
      const meta = generateSpriteSheetMeta(doc) as SpriteSheetMeta;

      expect(meta.format).toBe('glyphstudio-sprite-sheet');
      expect(meta.version).toBe(1);
      expect(meta.name).toBe('single');
      expect(meta.frameWidth).toBe(32);
      expect(meta.frameHeight).toBe(32);
      expect(meta.sheetWidth).toBe(32);
      expect(meta.sheetHeight).toBe(32);
      expect(meta.frameCount).toBe(1);
      expect(meta.layout).toBe('horizontal');
      expect(meta.frames).toHaveLength(1);
      expect(meta.frames[0]).toEqual({
        index: 0,
        x: 0,
        y: 0,
        w: 32,
        h: 32,
        durationMs: 100,
      });
    });

    it('generates correct metadata for multiple frames', () => {
      const doc = makeDoc('walk', 16, 24, [100, 150, 100, 200]);
      const meta = generateSpriteSheetMeta(doc) as SpriteSheetMeta;

      expect(meta.frameCount).toBe(4);
      expect(meta.sheetWidth).toBe(64); // 16 * 4
      expect(meta.sheetHeight).toBe(24);
      expect(meta.frames).toHaveLength(4);

      // Check frame positions are sequential horizontal strip
      expect(meta.frames[0].x).toBe(0);
      expect(meta.frames[1].x).toBe(16);
      expect(meta.frames[2].x).toBe(32);
      expect(meta.frames[3].x).toBe(48);

      // All y offsets are 0 in horizontal layout
      for (const f of meta.frames) {
        expect(f.y).toBe(0);
      }
    });

    it('preserves per-frame durations', () => {
      const durations = [50, 100, 200, 500];
      const doc = makeDoc('timing', 8, 8, durations);
      const meta = generateSpriteSheetMeta(doc) as SpriteSheetMeta;

      const metaDurations = meta.frames.map((f) => f.durationMs);
      expect(metaDurations).toEqual(durations);
    });

    it('frame indices match array order', () => {
      const doc = makeDoc('order', 16, 16, [100, 100, 100]);
      const meta = generateSpriteSheetMeta(doc) as SpriteSheetMeta;

      const indices = meta.frames.map((f) => f.index);
      expect(indices).toEqual([0, 1, 2]);
    });

    it('all frames report correct dimensions', () => {
      const doc = makeDoc('dims', 24, 32, [100, 100]);
      const meta = generateSpriteSheetMeta(doc) as SpriteSheetMeta;

      for (const f of meta.frames) {
        expect(f.w).toBe(24);
        expect(f.h).toBe(32);
      }
    });

    it('serializes cleanly to JSON', () => {
      const doc = makeDoc('json', 16, 16, [100, 200]);
      const meta = generateSpriteSheetMeta(doc) as SpriteSheetMeta;
      const json = JSON.stringify(meta);
      const parsed = JSON.parse(json) as SpriteSheetMeta;

      expect(parsed.format).toBe('glyphstudio-sprite-sheet');
      expect(parsed.frames).toHaveLength(2);
      expect(parsed.frames[0].durationMs).toBe(100);
      expect(parsed.frames[1].durationMs).toBe(200);
    });
  });

  // ── GIF encoding ──

  /** Helper: create a solid-color frame buffer. */
  function makeSolidFrame(
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): SpritePixelBuffer {
    const buf = createBlankPixelBuffer(w, h);
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = r;
      buf.data[i + 1] = g;
      buf.data[i + 2] = b;
      buf.data[i + 3] = a;
    }
    return buf;
  }

  describe('encodeAnimatedGif', () => {
    it('returns error for empty frame list', () => {
      const result = encodeAnimatedGif([], []);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('No frames');
      }
    });

    it('returns error when buffer count does not match duration count', () => {
      const frame = makeSolidFrame(4, 4, 255, 0, 0, 255);
      const result = encodeAnimatedGif([frame], [100, 200]);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('does not match');
      }
    });

    it('returns error for mismatched frame dimensions', () => {
      const f1 = makeSolidFrame(4, 4, 255, 0, 0, 255);
      const f2 = makeSolidFrame(8, 8, 0, 255, 0, 255);
      const result = encodeAnimatedGif([f1, f2], [100, 100]);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('dimensions');
      }
    });

    it('encodes a single opaque frame', () => {
      const frame = makeSolidFrame(4, 4, 255, 0, 0, 255);
      const result = encodeAnimatedGif([frame], [100]);
      expect(result).toBeInstanceOf(Uint8Array);

      const bytes = result as Uint8Array;
      // GIF89a magic bytes
      expect(bytes[0]).toBe(0x47); // G
      expect(bytes[1]).toBe(0x49); // I
      expect(bytes[2]).toBe(0x46); // F
      expect(bytes[3]).toBe(0x38); // 8
      expect(bytes[4]).toBe(0x39); // 9
      expect(bytes[5]).toBe(0x61); // a
      // Trailer byte at end
      expect(bytes[bytes.length - 1]).toBe(0x3b);
    });

    it('encodes multiple frames with different durations', () => {
      const f1 = makeSolidFrame(4, 4, 255, 0, 0, 255);
      const f2 = makeSolidFrame(4, 4, 0, 255, 0, 255);
      const f3 = makeSolidFrame(4, 4, 0, 0, 255, 255);
      const result = encodeAnimatedGif([f1, f2, f3], [100, 200, 50]);

      expect(result).toBeInstanceOf(Uint8Array);
      const bytes = result as Uint8Array;
      expect(bytes.length).toBeGreaterThan(0);
      // Valid GIF header
      expect(bytes[0]).toBe(0x47);
      expect(bytes[bytes.length - 1]).toBe(0x3b);
    });

    it('handles transparent pixels', () => {
      const frame = makeSolidFrame(4, 4, 0, 0, 0, 0); // fully transparent
      const result = encodeAnimatedGif([frame], [100]);

      expect(result).toBeInstanceOf(Uint8Array);
      const bytes = result as Uint8Array;
      expect(bytes[0]).toBe(0x47);
      expect(bytes[bytes.length - 1]).toBe(0x3b);
    });

    it('respects loop=false for single play', () => {
      const frame = makeSolidFrame(4, 4, 128, 128, 128, 255);
      const result = encodeAnimatedGif([frame], [100], false);

      expect(result).toBeInstanceOf(Uint8Array);
      // Should still produce valid GIF
      const bytes = result as Uint8Array;
      expect(bytes[0]).toBe(0x47);
    });
  });

  // ── sanitizeFilename ──

  describe('sanitizeFilename', () => {
    it('removes special characters', () => {
      expect(sanitizeFilename('My Variant!')).toBe('my-variant!');
    });

    it('replaces spaces with hyphens', () => {
      expect(sanitizeFilename('Warm Colors')).toBe('warm-colors');
    });

    it('removes filesystem-unsafe characters', () => {
      expect(sanitizeFilename('test<>:"/\\|?*file')).toBe('testfile');
    });

    it('lowercases the result', () => {
      expect(sanitizeFilename('CamelCase')).toBe('camelcase');
    });
  });

  // ── generateVariantExports ──

  describe('generateVariantExports', () => {
    function makeExportDoc(): { doc: SpriteDocument; pixelBuffers: Record<string, SpritePixelBuffer> } {
      const doc = createSpriteDocument('sprite', 4, 4);
      const layerId = doc.frames[0].layers[0].id;
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [0, 0, 0, 255]); // Black
      const pixelBuffers = { [layerId]: buf };

      // Add a palette set that remaps Black → Red
      const ps: PaletteSet = {
        id: 'ps-warm',
        name: 'Warm',
        colors: doc.palette.colors.map((c, i) =>
          i === 1 ? { ...c, rgba: [255, 0, 0, 255] as [number, number, number, number] } : { ...c },
        ),
      };
      doc.paletteSets = [ps];
      return { doc, pixelBuffers };
    }

    it('exports a single variant with remapped pixels', () => {
      const { doc, pixelBuffers } = makeExportDoc();
      const result = generateVariantExports(doc, pixelBuffers, ['ps-warm']);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as VariantExportEntry[];
      expect(entries).toHaveLength(1);
      expect(entries[0].paletteSetId).toBe('ps-warm');
      expect(entries[0].suffix).toBe('warm');
      expect(entries[0].meta.name).toBe('sprite-warm');
      // Sheet should have the remapped pixel
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('exports multiple variants', () => {
      const { doc, pixelBuffers } = makeExportDoc();
      // Add a second palette set
      const ps2: PaletteSet = {
        id: 'ps-cool',
        name: 'Cool',
        colors: doc.palette.colors.map((c, i) =>
          i === 1 ? { ...c, rgba: [0, 0, 255, 255] as [number, number, number, number] } : { ...c },
        ),
      };
      doc.paletteSets!.push(ps2);

      const result = generateVariantExports(doc, pixelBuffers, ['ps-warm', 'ps-cool']);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as VariantExportEntry[];
      expect(entries).toHaveLength(2);
      expect(entries[0].suffix).toBe('warm');
      expect(entries[1].suffix).toBe('cool');
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(samplePixel(entries[1].sheet, 0, 0)).toEqual([0, 0, 255, 255]);
    });

    it('returns error for empty palette set selection', () => {
      const { doc, pixelBuffers } = makeExportDoc();
      const result = generateVariantExports(doc, pixelBuffers, []);
      expect('error' in result).toBe(true);
    });

    it('returns error for unknown palette set id', () => {
      const { doc, pixelBuffers } = makeExportDoc();
      const result = generateVariantExports(doc, pixelBuffers, ['bogus']);
      expect('error' in result).toBe(true);
    });

    it('returns error for doc with no frames', () => {
      const { doc, pixelBuffers } = makeExportDoc();
      doc.frames = [];
      const result = generateVariantExports(doc, pixelBuffers, ['ps-warm']);
      expect('error' in result).toBe(true);
    });

    it('handles identity palette set (no remapping needed)', () => {
      const { doc, pixelBuffers } = makeExportDoc();
      // Add palette set identical to base
      const identityPs: PaletteSet = {
        id: 'ps-same',
        name: 'Same',
        colors: doc.palette.colors.map((c) => ({ ...c })),
      };
      doc.paletteSets!.push(identityPs);

      const result = generateVariantExports(doc, pixelBuffers, ['ps-same']);
      expect(Array.isArray(result)).toBe(true);
      const entries = result as VariantExportEntry[];
      // Pixel unchanged
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([0, 0, 0, 255]);
    });
  });

  // ── generateDocumentVariantExports ──

  describe('generateDocumentVariantExports', () => {
    function makeVariantDoc(): { doc: SpriteDocument; pixelBuffers: Record<string, SpritePixelBuffer> } {
      const doc = createSpriteDocument('sprite', 4, 4);
      const baseLayerId = doc.frames[0].layers[0].id;
      const baseBuf = createBlankPixelBuffer(4, 4);
      setPixel(baseBuf, 0, 0, [0, 0, 0, 255]); // Black
      const pixelBuffers: Record<string, SpritePixelBuffer> = { [baseLayerId]: baseBuf };

      // Add a variant with red pixel
      const varLayerId = 'var-layer-1';
      const varBuf = createBlankPixelBuffer(4, 4);
      setPixel(varBuf, 0, 0, [255, 0, 0, 255]); // Red
      pixelBuffers[varLayerId] = varBuf;

      const variant: DocumentVariant = {
        id: 'var-left',
        name: 'Walk Left',
        frames: [{
          id: 'vf1',
          index: 0,
          durationMs: 100,
          layers: [{ id: varLayerId, name: 'Layer 1', visible: true, index: 0 }],
        }],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      doc.variants = [variant];

      return { doc, pixelBuffers };
    }

    it('exports base sequence', () => {
      const { doc, pixelBuffers } = makeVariantDoc();
      const result = generateDocumentVariantExports(doc, pixelBuffers, [null]);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as DocumentVariantExportEntry[];
      expect(entries).toHaveLength(1);
      expect(entries[0].variantId).toBeNull();
      expect(entries[0].variantName).toBe('base');
      expect(entries[0].suffix).toBe('base');
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([0, 0, 0, 255]);
    });

    it('exports a document variant', () => {
      const { doc, pixelBuffers } = makeVariantDoc();
      const result = generateDocumentVariantExports(doc, pixelBuffers, ['var-left']);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as DocumentVariantExportEntry[];
      expect(entries).toHaveLength(1);
      expect(entries[0].variantId).toBe('var-left');
      expect(entries[0].suffix).toBe('walk-left');
      expect(entries[0].meta.name).toBe('sprite-walk-left');
      expect(samplePixel(entries[0].sheet, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('exports base + variants together', () => {
      const { doc, pixelBuffers } = makeVariantDoc();
      const result = generateDocumentVariantExports(doc, pixelBuffers, [null, 'var-left']);

      expect(Array.isArray(result)).toBe(true);
      const entries = result as DocumentVariantExportEntry[];
      expect(entries).toHaveLength(2);
      expect(entries[0].variantName).toBe('base');
      expect(entries[1].variantName).toBe('Walk Left');
    });

    it('returns error for unknown variant id', () => {
      const { doc, pixelBuffers } = makeVariantDoc();
      const result = generateDocumentVariantExports(doc, pixelBuffers, ['bogus']);
      expect('error' in result).toBe(true);
    });

    it('contextual filenames use variant name', () => {
      const { doc, pixelBuffers } = makeVariantDoc();
      const result = generateDocumentVariantExports(doc, pixelBuffers, ['var-left']);
      expect(Array.isArray(result)).toBe(true);
      const entries = result as DocumentVariantExportEntry[];
      expect(entries[0].meta.name).toBe('sprite-walk-left');
    });
  });
});
