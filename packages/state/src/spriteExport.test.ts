import { describe, it, expect } from 'vitest';
import {
  createSpriteDocument,
  createSpriteFrame,
  createBlankPixelBuffer,
} from '@glyphstudio/domain';
import type { SpriteDocument, SpritePixelBuffer, SpriteSheetMeta } from '@glyphstudio/domain';
import { generateSpriteSheetMeta, encodeAnimatedGif } from './spriteExport';
import { isImportExportError } from './spriteImportExport';

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
});
