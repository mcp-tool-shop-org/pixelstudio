import { describe, it, expect } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import {
  validateSheetDimensions,
  sliceSpriteSheet,
  assembleSpriteSheet,
  isImportExportError,
} from './spriteImportExport';
import { setPixel, samplePixel } from './spriteRaster';
import type { Rgba } from './spriteRaster';

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

describe('spriteImportExport', () => {
  // ── Validation ──

  describe('validateSheetDimensions', () => {
    it('validates compatible dimensions', () => {
      const r = validateSheetDimensions(64, 16, 16, 16);
      expect(r.valid).toBe(true);
      expect(r.cols).toBe(4);
      expect(r.rows).toBe(1);
      expect(r.frameCount).toBe(4);
    });

    it('validates multi-row sheet', () => {
      const r = validateSheetDimensions(32, 32, 16, 16);
      expect(r.valid).toBe(true);
      expect(r.cols).toBe(2);
      expect(r.rows).toBe(2);
      expect(r.frameCount).toBe(4);
    });

    it('validates single-frame sheet', () => {
      const r = validateSheetDimensions(16, 16, 16, 16);
      expect(r.valid).toBe(true);
      expect(r.frameCount).toBe(1);
    });

    it('rejects incompatible width', () => {
      const r = validateSheetDimensions(50, 16, 16, 16);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('not divisible');
    });

    it('rejects incompatible height', () => {
      const r = validateSheetDimensions(32, 30, 16, 16);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('not divisible');
    });

    it('rejects zero frame dimensions', () => {
      const r = validateSheetDimensions(32, 32, 0, 16);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('positive');
    });

    it('rejects negative dimensions', () => {
      const r = validateSheetDimensions(-32, 32, 16, 16);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('positive');
    });

    it('rejects non-integer dimensions', () => {
      const r = validateSheetDimensions(32, 32, 16.5, 16);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('integer');
    });
  });

  // ── Slicing ──

  describe('sliceSpriteSheet', () => {
    it('slices horizontal strip into frames', () => {
      // 2 frames side by side, each 2x2
      const sheetW = 4;
      const sheetH = 2;
      const sheetData = new Uint8ClampedArray(sheetW * sheetH * 4);

      // Frame 0 (left): set (0,0) to RED
      const idx00 = 0;
      sheetData[idx00] = 255; sheetData[idx00 + 3] = 255;

      // Frame 1 (right): set (0,0) relative = sheet (2,0) to GREEN
      const idx20 = (0 * sheetW + 2) * 4;
      sheetData[idx20 + 1] = 255; sheetData[idx20 + 3] = 255;

      const result = sliceSpriteSheet(sheetData, sheetW, sheetH, 2, 2);
      expect(isImportExportError(result)).toBe(false);
      if (isImportExportError(result)) return;

      expect(result.frames).toHaveLength(2);
      expect(result.frames[0].width).toBe(2);
      expect(result.frames[0].height).toBe(2);
      expect(samplePixel(result.frames[0], 0, 0)).toEqual(RED);
      expect(samplePixel(result.frames[1], 0, 0)).toEqual(GREEN);
    });

    it('slices multi-row sheet in row-major order', () => {
      // 4 frames in 2x2 grid, each 2x2
      const sheetW = 4;
      const sheetH = 4;
      const sheetData = new Uint8ClampedArray(sheetW * sheetH * 4);

      // Frame 0 = top-left: RED at (0,0)
      sheetData[0] = 255; sheetData[3] = 255;

      // Frame 1 = top-right: GREEN at (0,0) = sheet (2,0)
      const i1 = (0 * sheetW + 2) * 4;
      sheetData[i1 + 1] = 255; sheetData[i1 + 3] = 255;

      // Frame 2 = bottom-left: BLUE at (0,0) = sheet (0,2)
      const i2 = (2 * sheetW + 0) * 4;
      sheetData[i2 + 2] = 255; sheetData[i2 + 3] = 255;

      const result = sliceSpriteSheet(sheetData, sheetW, sheetH, 2, 2);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(result.frames).toHaveLength(4);
      expect(samplePixel(result.frames[0], 0, 0)).toEqual(RED);
      expect(samplePixel(result.frames[1], 0, 0)).toEqual(GREEN);
      expect(samplePixel(result.frames[2], 0, 0)).toEqual(BLUE);
    });

    it('preserves transparency', () => {
      const sheetData = new Uint8ClampedArray(4 * 2 * 4); // 2 frames of 2x2
      // All transparent by default
      const result = sliceSpriteSheet(sheetData, 4, 2, 2, 2);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(result.frames).toHaveLength(2);
      expect(samplePixel(result.frames[0], 0, 0)).toEqual(TRANSPARENT);
      expect(samplePixel(result.frames[1], 1, 1)).toEqual(TRANSPARENT);
    });

    it('fails on incompatible dimensions', () => {
      const sheetData = new Uint8ClampedArray(50 * 16 * 4);
      const result = sliceSpriteSheet(sheetData, 50, 16, 16, 16);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('not divisible');
      }
    });

    it('fails on data length mismatch', () => {
      const sheetData = new Uint8ClampedArray(10); // too short
      const result = sliceSpriteSheet(sheetData, 4, 2, 2, 2);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('does not match');
      }
    });

    it('single frame import works', () => {
      const sheetData = new Uint8ClampedArray(2 * 2 * 4);
      sheetData[0] = 128; sheetData[1] = 64; sheetData[2] = 32; sheetData[3] = 255;
      const result = sliceSpriteSheet(sheetData, 2, 2, 2, 2);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(result.frames).toHaveLength(1);
      expect(samplePixel(result.frames[0], 0, 0)).toEqual([128, 64, 32, 255]);
    });
  });

  // ── Assembly ──

  describe('assembleSpriteSheet', () => {
    it('assembles frames into horizontal strip', () => {
      const f0 = createBlankPixelBuffer(2, 2);
      setPixel(f0, 0, 0, RED);
      const f1 = createBlankPixelBuffer(2, 2);
      setPixel(f1, 0, 0, GREEN);

      const result = assembleSpriteSheet([f0, f1]);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(result.width).toBe(4);
      expect(result.height).toBe(2);
      // Frame 0 at (0,0)
      expect(samplePixel(result, 0, 0)).toEqual(RED);
      // Frame 1 at (2,0)
      expect(samplePixel(result, 2, 0)).toEqual(GREEN);
    });

    it('preserves frame order exactly', () => {
      const f0 = createBlankPixelBuffer(2, 2);
      setPixel(f0, 0, 0, RED);
      const f1 = createBlankPixelBuffer(2, 2);
      setPixel(f1, 0, 0, GREEN);
      const f2 = createBlankPixelBuffer(2, 2);
      setPixel(f2, 0, 0, BLUE);

      const result = assembleSpriteSheet([f0, f1, f2]);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(result.width).toBe(6);
      expect(samplePixel(result, 0, 0)).toEqual(RED);
      expect(samplePixel(result, 2, 0)).toEqual(GREEN);
      expect(samplePixel(result, 4, 0)).toEqual(BLUE);
    });

    it('preserves transparency', () => {
      const f0 = createBlankPixelBuffer(2, 2);
      // All transparent
      const result = assembleSpriteSheet([f0]);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(samplePixel(result, 0, 0)).toEqual(TRANSPARENT);
      expect(samplePixel(result, 1, 1)).toEqual(TRANSPARENT);
    });

    it('single frame produces same-size sheet', () => {
      const f0 = createBlankPixelBuffer(4, 4);
      setPixel(f0, 2, 2, RED);
      const result = assembleSpriteSheet([f0]);
      if (isImportExportError(result)) { expect.unreachable(); return; }

      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      expect(samplePixel(result, 2, 2)).toEqual(RED);
    });

    it('fails on empty frame array', () => {
      const result = assembleSpriteSheet([]);
      expect(isImportExportError(result)).toBe(true);
    });

    it('fails on mismatched frame dimensions', () => {
      const f0 = createBlankPixelBuffer(2, 2);
      const f1 = createBlankPixelBuffer(4, 4);
      const result = assembleSpriteSheet([f0, f1]);
      expect(isImportExportError(result)).toBe(true);
      if (isImportExportError(result)) {
        expect(result.error).toContain('do not match');
      }
    });

    it('round-trips with slice', () => {
      // Create 3 frames, assemble, slice, verify
      const f0 = createBlankPixelBuffer(4, 4);
      setPixel(f0, 0, 0, RED);
      setPixel(f0, 3, 3, [100, 100, 100, 255]);
      const f1 = createBlankPixelBuffer(4, 4);
      setPixel(f1, 1, 1, GREEN);
      const f2 = createBlankPixelBuffer(4, 4);
      setPixel(f2, 2, 2, BLUE);

      const sheet = assembleSpriteSheet([f0, f1, f2]);
      if (isImportExportError(sheet)) { expect.unreachable(); return; }

      const sliced = sliceSpriteSheet(sheet.data, sheet.width, sheet.height, 4, 4);
      if (isImportExportError(sliced)) { expect.unreachable(); return; }

      expect(sliced.frames).toHaveLength(3);
      expect(samplePixel(sliced.frames[0], 0, 0)).toEqual(RED);
      expect(samplePixel(sliced.frames[0], 3, 3)).toEqual([100, 100, 100, 255]);
      expect(samplePixel(sliced.frames[1], 1, 1)).toEqual(GREEN);
      expect(samplePixel(sliced.frames[2], 2, 2)).toEqual(BLUE);
    });
  });

  // ── Helper ──

  describe('isImportExportError', () => {
    it('returns true for error objects', () => {
      expect(isImportExportError({ error: 'bad' })).toBe(true);
    });

    it('returns false for frame results', () => {
      expect(isImportExportError({ frames: [] })).toBe(false);
    });

    it('returns false for pixel buffers', () => {
      expect(isImportExportError(createBlankPixelBuffer(2, 2))).toBe(false);
    });
  });
});
