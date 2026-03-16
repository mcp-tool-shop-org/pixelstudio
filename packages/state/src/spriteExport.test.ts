import { describe, it, expect } from 'vitest';
import {
  createSpriteDocument,
  createSpriteFrame,
} from '@glyphstudio/domain';
import type { SpriteDocument, SpriteSheetMeta } from '@glyphstudio/domain';
import { generateSpriteSheetMeta } from './spriteExport';
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
});
