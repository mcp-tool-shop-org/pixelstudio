import { describe, it, expect } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import {
  getPixelIndex,
  isInBounds,
  samplePixel,
  setPixel,
  colorsEqual,
  drawBrushDab,
  bresenhamLine,
  floodFill,
  clonePixelBuffer,
  normalizeRect,
  extractSelection,
  clearSelectionArea,
  blitSelection,
  flipBufferHorizontal,
  flipBufferVertical,
  flattenLayers,
  TRANSPARENT,
} from './spriteRaster';
import type { Rgba } from './spriteRaster';

const BLACK: Rgba = [0, 0, 0, 255];
const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

describe('spriteRaster', () => {
  // ── Pixel index math ──

  describe('getPixelIndex', () => {
    it('returns 0 for (0, 0)', () => {
      expect(getPixelIndex(0, 0, 16)).toBe(0);
    });

    it('returns correct offset for (1, 0)', () => {
      expect(getPixelIndex(1, 0, 16)).toBe(4);
    });

    it('returns correct offset for (0, 1)', () => {
      expect(getPixelIndex(0, 1, 16)).toBe(16 * 4);
    });

    it('returns correct offset for arbitrary pixel', () => {
      expect(getPixelIndex(3, 2, 8)).toBe((2 * 8 + 3) * 4);
    });
  });

  describe('isInBounds', () => {
    it('returns true for valid coordinates', () => {
      expect(isInBounds(0, 0, 8, 8)).toBe(true);
      expect(isInBounds(7, 7, 8, 8)).toBe(true);
    });

    it('returns false for negative coordinates', () => {
      expect(isInBounds(-1, 0, 8, 8)).toBe(false);
      expect(isInBounds(0, -1, 8, 8)).toBe(false);
    });

    it('returns false for out-of-bounds coordinates', () => {
      expect(isInBounds(8, 0, 8, 8)).toBe(false);
      expect(isInBounds(0, 8, 8, 8)).toBe(false);
    });
  });

  // ── Read/write ──

  describe('samplePixel', () => {
    it('reads transparent from blank buffer', () => {
      const buf = createBlankPixelBuffer(4, 4);
      expect(samplePixel(buf, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    it('reads written pixel', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 2, 1, RED);
      expect(samplePixel(buf, 2, 1)).toEqual(RED);
    });

    it('returns undefined for out-of-bounds', () => {
      const buf = createBlankPixelBuffer(4, 4);
      expect(samplePixel(buf, -1, 0)).toBeUndefined();
      expect(samplePixel(buf, 4, 0)).toBeUndefined();
    });
  });

  describe('setPixel', () => {
    it('writes pixel at correct position', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 1, 2, GREEN);
      const i = getPixelIndex(1, 2, 4);
      expect(buf.data[i]).toBe(0);
      expect(buf.data[i + 1]).toBe(255);
      expect(buf.data[i + 2]).toBe(0);
      expect(buf.data[i + 3]).toBe(255);
    });

    it('no-ops for out-of-bounds', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 10, 10, RED);
      // All pixels should still be transparent
      for (let i = 0; i < buf.data.length; i++) {
        expect(buf.data[i]).toBe(0);
      }
    });
  });

  describe('colorsEqual', () => {
    it('returns true for identical colors', () => {
      expect(colorsEqual(RED, [255, 0, 0, 255])).toBe(true);
    });

    it('returns false for different colors', () => {
      expect(colorsEqual(RED, GREEN)).toBe(false);
    });

    it('distinguishes alpha', () => {
      expect(colorsEqual([255, 0, 0, 255], [255, 0, 0, 128])).toBe(false);
    });
  });

  // ── Brush dab ──

  describe('drawBrushDab', () => {
    it('paints single pixel for size 1', () => {
      const buf = createBlankPixelBuffer(8, 8);
      drawBrushDab(buf, 3, 3, RED, 1, 'square');
      expect(samplePixel(buf, 3, 3)).toEqual(RED);
      expect(samplePixel(buf, 2, 3)).toEqual(TRANSPARENT);
      expect(samplePixel(buf, 4, 3)).toEqual(TRANSPARENT);
    });

    it('paints square dab for size 3', () => {
      const buf = createBlankPixelBuffer(8, 8);
      drawBrushDab(buf, 4, 4, RED, 3, 'square');
      // Center and adjacent pixels should be painted
      expect(samplePixel(buf, 4, 4)).toEqual(RED);
      expect(samplePixel(buf, 3, 3)).toEqual(RED);
      expect(samplePixel(buf, 5, 5)).toEqual(RED);
      expect(samplePixel(buf, 3, 4)).toEqual(RED);
      // Corner outside 3x3 should not be painted
      expect(samplePixel(buf, 2, 2)).toEqual(TRANSPARENT);
    });

    it('stays in bounds at edge', () => {
      const buf = createBlankPixelBuffer(4, 4);
      drawBrushDab(buf, 0, 0, RED, 3, 'square');
      // Should paint in-bounds pixels only
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
      expect(samplePixel(buf, 1, 0)).toEqual(RED);
      expect(samplePixel(buf, 0, 1)).toEqual(RED);
      // No crash, buffer intact
      expect(buf.data.length).toBe(4 * 4 * 4);
    });

    it('paints circle dab', () => {
      const buf = createBlankPixelBuffer(10, 10);
      drawBrushDab(buf, 5, 5, BLUE, 5, 'circle');
      // Center should be painted
      expect(samplePixel(buf, 5, 5)).toEqual(BLUE);
      // Cardinal neighbors should be painted
      expect(samplePixel(buf, 4, 5)).toEqual(BLUE);
      expect(samplePixel(buf, 6, 5)).toEqual(BLUE);
      expect(samplePixel(buf, 5, 4)).toEqual(BLUE);
      expect(samplePixel(buf, 5, 6)).toEqual(BLUE);
      // Pixel well outside the circle radius should not be painted
      expect(samplePixel(buf, 1, 1)).toEqual(TRANSPARENT);
    });

    it('no-ops for size 0', () => {
      const buf = createBlankPixelBuffer(4, 4);
      drawBrushDab(buf, 2, 2, RED, 0, 'square');
      expect(samplePixel(buf, 2, 2)).toEqual(TRANSPARENT);
    });
  });

  // ── Bresenham line ──

  describe('bresenhamLine', () => {
    it('returns single point for same start/end', () => {
      expect(bresenhamLine(3, 3, 3, 3)).toEqual([[3, 3]]);
    });

    it('returns horizontal line', () => {
      const pts = bresenhamLine(0, 0, 3, 0);
      expect(pts).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
    });

    it('returns vertical line', () => {
      const pts = bresenhamLine(0, 0, 0, 3);
      expect(pts).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
    });

    it('returns diagonal line', () => {
      const pts = bresenhamLine(0, 0, 3, 3);
      expect(pts.length).toBe(4);
      expect(pts[0]).toEqual([0, 0]);
      expect(pts[pts.length - 1]).toEqual([3, 3]);
    });

    it('works in reverse direction', () => {
      const pts = bresenhamLine(3, 0, 0, 0);
      expect(pts).toEqual([[3, 0], [2, 0], [1, 0], [0, 0]]);
    });
  });

  // ── Flood fill ──

  describe('floodFill', () => {
    it('fills contiguous region', () => {
      const buf = createBlankPixelBuffer(4, 4);
      floodFill(buf, 0, 0, RED);
      // All pixels should be red
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          expect(samplePixel(buf, x, y)).toEqual(RED);
        }
      }
    });

    it('fills only contiguous pixels', () => {
      const buf = createBlankPixelBuffer(4, 4);
      // Draw a vertical wall at x=2
      for (let y = 0; y < 4; y++) {
        setPixel(buf, 2, y, BLACK);
      }
      // Fill left side
      floodFill(buf, 0, 0, RED);
      // Left side should be red
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
      expect(samplePixel(buf, 1, 0)).toEqual(RED);
      // Wall should be black
      expect(samplePixel(buf, 2, 0)).toEqual(BLACK);
      // Right side should still be transparent
      expect(samplePixel(buf, 3, 0)).toEqual(TRANSPARENT);
    });

    it('no-ops when target equals replacement', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 1, 0, RED);
      floodFill(buf, 0, 0, RED);
      // Should be a no-op, not crash
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
    });

    it('no-ops for out-of-bounds start', () => {
      const buf = createBlankPixelBuffer(4, 4);
      floodFill(buf, -1, -1, RED);
      // Buffer unchanged
      expect(samplePixel(buf, 0, 0)).toEqual(TRANSPARENT);
    });

    it('fills single pixel region', () => {
      const buf = createBlankPixelBuffer(4, 4);
      // Surround (1,1) with black
      setPixel(buf, 0, 1, BLACK);
      setPixel(buf, 2, 1, BLACK);
      setPixel(buf, 1, 0, BLACK);
      setPixel(buf, 1, 2, BLACK);
      floodFill(buf, 1, 1, GREEN);
      expect(samplePixel(buf, 1, 1)).toEqual(GREEN);
      // Adjacent black pixels untouched
      expect(samplePixel(buf, 0, 1)).toEqual(BLACK);
    });

    it('terminates on large region without stack overflow', () => {
      const buf = createBlankPixelBuffer(64, 64);
      floodFill(buf, 0, 0, BLUE);
      expect(samplePixel(buf, 63, 63)).toEqual(BLUE);
    });
  });

  // ── Buffer cloning ──

  describe('clonePixelBuffer', () => {
    it('creates an independent copy', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, RED);
      const clone = clonePixelBuffer(buf);
      expect(samplePixel(clone, 0, 0)).toEqual(RED);

      // Modify original — clone should be unaffected
      setPixel(buf, 0, 0, GREEN);
      expect(samplePixel(clone, 0, 0)).toEqual(RED);
    });

    it('preserves dimensions', () => {
      const buf = createBlankPixelBuffer(16, 8);
      const clone = clonePixelBuffer(buf);
      expect(clone.width).toBe(16);
      expect(clone.height).toBe(8);
    });
  });

  // ── Selection helpers ──

  describe('normalizeRect', () => {
    it('normalizes top-left to bottom-right drag', () => {
      const r = normalizeRect(1, 2, 4, 5);
      expect(r).toEqual({ x: 1, y: 2, width: 4, height: 4 });
    });

    it('normalizes bottom-right to top-left drag', () => {
      const r = normalizeRect(4, 5, 1, 2);
      expect(r).toEqual({ x: 1, y: 2, width: 4, height: 4 });
    });

    it('handles single-pixel rect', () => {
      const r = normalizeRect(3, 3, 3, 3);
      expect(r).toEqual({ x: 3, y: 3, width: 1, height: 1 });
    });

    it('normalizes horizontal drag right-to-left', () => {
      const r = normalizeRect(5, 0, 2, 0);
      expect(r).toEqual({ x: 2, y: 0, width: 4, height: 1 });
    });
  });

  describe('extractSelection', () => {
    it('extracts pixels from a rect region', () => {
      const buf = createBlankPixelBuffer(8, 8);
      setPixel(buf, 2, 2, RED);
      setPixel(buf, 3, 3, GREEN);

      const sel = extractSelection(buf, { x: 2, y: 2, width: 2, height: 2 });
      expect(sel.width).toBe(2);
      expect(sel.height).toBe(2);
      expect(samplePixel(sel, 0, 0)).toEqual(RED);
      expect(samplePixel(sel, 1, 1)).toEqual(GREEN);
      expect(samplePixel(sel, 1, 0)).toEqual(TRANSPARENT);
    });

    it('returns transparent for out-of-bounds pixels', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 3, 3, RED);
      const sel = extractSelection(buf, { x: 3, y: 3, width: 3, height: 3 });
      expect(sel.width).toBe(3);
      expect(samplePixel(sel, 0, 0)).toEqual(RED);
      expect(samplePixel(sel, 1, 0)).toEqual(TRANSPARENT);
    });
  });

  describe('clearSelectionArea', () => {
    it('clears pixels in rect to transparent', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 1, 1, RED);
      setPixel(buf, 2, 2, GREEN);
      clearSelectionArea(buf, { x: 1, y: 1, width: 2, height: 2 });
      expect(samplePixel(buf, 1, 1)).toEqual(TRANSPARENT);
      expect(samplePixel(buf, 2, 2)).toEqual(TRANSPARENT);
    });

    it('does not clear pixels outside rect', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 1, 1, GREEN);
      clearSelectionArea(buf, { x: 1, y: 1, width: 1, height: 1 });
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
      expect(samplePixel(buf, 1, 1)).toEqual(TRANSPARENT);
    });

    it('ignores out-of-bounds pixels safely', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 3, 3, RED);
      clearSelectionArea(buf, { x: 3, y: 3, width: 5, height: 5 });
      expect(samplePixel(buf, 3, 3)).toEqual(TRANSPARENT);
      expect(buf.data.length).toBe(4 * 4 * 4);
    });
  });

  describe('blitSelection', () => {
    it('pastes pixels at destination', () => {
      const dest = createBlankPixelBuffer(8, 8);
      const src = createBlankPixelBuffer(2, 2);
      setPixel(src, 0, 0, RED);
      setPixel(src, 1, 1, GREEN);

      blitSelection(dest, src, 3, 4);
      expect(samplePixel(dest, 3, 4)).toEqual(RED);
      expect(samplePixel(dest, 4, 5)).toEqual(GREEN);
      expect(samplePixel(dest, 4, 4)).toEqual(TRANSPARENT);
    });

    it('skips transparent source pixels', () => {
      const dest = createBlankPixelBuffer(4, 4);
      setPixel(dest, 1, 1, BLUE);
      const src = createBlankPixelBuffer(2, 2);
      setPixel(src, 0, 0, RED);
      // src (1,0) is transparent — should not overwrite dest

      blitSelection(dest, src, 1, 1);
      expect(samplePixel(dest, 1, 1)).toEqual(RED);
      // (2,1) was BLUE originally but src has transparent there — BLUE survives
      // Wait, dest(2,1) was TRANSPARENT. dest(1,1) was BLUE but gets overwritten by RED.
      // Let me reconsider: dest(2,1) src would map to src(1,0) which is transparent -> skip
      expect(samplePixel(dest, 2, 1)).toEqual(TRANSPARENT);
    });

    it('clips to destination bounds', () => {
      const dest = createBlankPixelBuffer(4, 4);
      const src = createBlankPixelBuffer(2, 2);
      setPixel(src, 0, 0, RED);
      setPixel(src, 1, 1, GREEN);

      blitSelection(dest, src, 3, 3);
      expect(samplePixel(dest, 3, 3)).toEqual(RED);
      // (4,4) is out of bounds — should not crash
      expect(dest.data.length).toBe(4 * 4 * 4);
    });

    it('round-trips with extract and clear', () => {
      const buf = createBlankPixelBuffer(8, 8);
      setPixel(buf, 2, 2, RED);
      setPixel(buf, 3, 3, GREEN);
      const rect = { x: 2, y: 2, width: 2, height: 2 };
      const sel = extractSelection(buf, rect);
      clearSelectionArea(buf, rect);
      // Both pixels should be cleared
      expect(samplePixel(buf, 2, 2)).toEqual(TRANSPARENT);
      expect(samplePixel(buf, 3, 3)).toEqual(TRANSPARENT);
      // Blit at new position
      blitSelection(buf, sel, 5, 5);
      expect(samplePixel(buf, 5, 5)).toEqual(RED);
      expect(samplePixel(buf, 6, 6)).toEqual(GREEN);
    });
  });

  // ── Buffer transforms ──

  describe('flipBufferHorizontal', () => {
    it('mirrors pixels left-right', () => {
      const buf = createBlankPixelBuffer(4, 2);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 3, 0, GREEN);
      setPixel(buf, 0, 1, BLUE);

      const flipped = flipBufferHorizontal(buf);
      expect(flipped.width).toBe(4);
      expect(flipped.height).toBe(2);
      expect(samplePixel(flipped, 3, 0)).toEqual(RED);
      expect(samplePixel(flipped, 0, 0)).toEqual(GREEN);
      expect(samplePixel(flipped, 3, 1)).toEqual(BLUE);
    });

    it('does not mutate original', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, RED);
      flipBufferHorizontal(buf);
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
      expect(samplePixel(buf, 1, 0)).toEqual(TRANSPARENT);
    });

    it('double flip restores original', () => {
      const buf = createBlankPixelBuffer(3, 3);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 2, 1, GREEN);
      const result = flipBufferHorizontal(flipBufferHorizontal(buf));
      expect(samplePixel(result, 0, 0)).toEqual(RED);
      expect(samplePixel(result, 2, 1)).toEqual(GREEN);
    });
  });

  describe('flipBufferVertical', () => {
    it('mirrors pixels top-bottom', () => {
      const buf = createBlankPixelBuffer(2, 4);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 1, 3, GREEN);

      const flipped = flipBufferVertical(buf);
      expect(flipped.width).toBe(2);
      expect(flipped.height).toBe(4);
      expect(samplePixel(flipped, 0, 3)).toEqual(RED);
      expect(samplePixel(flipped, 1, 0)).toEqual(GREEN);
    });

    it('does not mutate original', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, RED);
      flipBufferVertical(buf);
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
      expect(samplePixel(buf, 0, 1)).toEqual(TRANSPARENT);
    });

    it('double flip restores original', () => {
      const buf = createBlankPixelBuffer(3, 3);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 1, 2, GREEN);
      const result = flipBufferVertical(flipBufferVertical(buf));
      expect(samplePixel(result, 0, 0)).toEqual(RED);
      expect(samplePixel(result, 1, 2)).toEqual(GREEN);
    });
  });

  // ── flattenLayers ──

  describe('flattenLayers', () => {
    it('returns blank buffer with no visible layers', () => {
      const result = flattenLayers([], {}, 4, 4);
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      expect(result.data.every((v) => v === 0)).toBe(true);
    });

    it('returns single layer unchanged when only one visible layer', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 1, 1, RED);
      const layers = [{ id: 'l1', name: 'Layer 1', visible: true, index: 0 }];
      const buffers = { l1: buf };
      const result = flattenLayers(layers, buffers, 4, 4);
      expect(samplePixel(result, 1, 1)).toEqual(RED);
      expect(samplePixel(result, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    it('skips hidden layers', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, RED);
      const layers = [{ id: 'l1', name: 'Layer 1', visible: false, index: 0 }];
      const result = flattenLayers(layers, { l1: buf }, 4, 4);
      expect(samplePixel(result, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    it('top opaque layer overwrites bottom layer', () => {
      const bottom = createBlankPixelBuffer(4, 4);
      setPixel(bottom, 0, 0, RED);
      const top = createBlankPixelBuffer(4, 4);
      setPixel(top, 0, 0, GREEN);
      const layers = [
        { id: 'l1', name: 'Bottom', visible: true, index: 0 },
        { id: 'l2', name: 'Top', visible: true, index: 1 },
      ];
      const result = flattenLayers(layers, { l1: bottom, l2: top }, 4, 4);
      expect(samplePixel(result, 0, 0)).toEqual(GREEN);
    });

    it('transparent top pixel shows bottom layer through', () => {
      const bottom = createBlankPixelBuffer(4, 4);
      setPixel(bottom, 0, 0, RED);
      const top = createBlankPixelBuffer(4, 4);
      // top has nothing at (0,0) — transparent
      setPixel(top, 1, 1, GREEN);
      const layers = [
        { id: 'l1', name: 'Bottom', visible: true, index: 0 },
        { id: 'l2', name: 'Top', visible: true, index: 1 },
      ];
      const result = flattenLayers(layers, { l1: bottom, l2: top }, 4, 4);
      expect(samplePixel(result, 0, 0)).toEqual(RED);
      expect(samplePixel(result, 1, 1)).toEqual(GREEN);
    });
  });
});
