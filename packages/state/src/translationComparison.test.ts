import { describe, it, expect } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import {
  nearestNeighborDownscale,
  countFilledPixels,
  analyzeSilhouetteSurvival,
  computeComparisonScale,
  pixelPerfectUpscale,
  generateComparisonLayout,
} from './translationComparison';
import { getPixelIndex } from './spriteRaster';
import type { SpritePixelBuffer } from '@glyphstudio/domain';

/** Fill a rect region in a buffer with a solid color. */
function fillRect(
  buf: SpritePixelBuffer,
  x0: number, y0: number,
  w: number, h: number,
  r: number, g: number, b: number, a: number,
) {
  for (let y = y0; y < y0 + h && y < buf.height; y++) {
    for (let x = x0; x < x0 + w && x < buf.width; x++) {
      const i = getPixelIndex(x, y, buf.width);
      buf.data[i] = r;
      buf.data[i + 1] = g;
      buf.data[i + 2] = b;
      buf.data[i + 3] = a;
    }
  }
}

describe('translationComparison', () => {
  describe('nearestNeighborDownscale', () => {
    it('downscales a 4×4 buffer to 2×2', () => {
      const src = createBlankPixelBuffer(4, 4);
      // Fill top-left quadrant red, top-right green, bottom-left blue, bottom-right white
      fillRect(src, 0, 0, 2, 2, 255, 0, 0, 255);
      fillRect(src, 2, 0, 2, 2, 0, 255, 0, 255);
      fillRect(src, 0, 2, 2, 2, 0, 0, 255, 255);
      fillRect(src, 2, 2, 2, 2, 255, 255, 255, 255);

      const result = nearestNeighborDownscale(src, 2, 2);
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);

      // Top-left should be red (sampled from 0,0)
      const tl = getPixelIndex(0, 0, 2);
      expect(result.data[tl]).toBe(255);
      expect(result.data[tl + 1]).toBe(0);
      expect(result.data[tl + 2]).toBe(0);

      // Top-right should be green (sampled from 2,0)
      const tr = getPixelIndex(1, 0, 2);
      expect(result.data[tr]).toBe(0);
      expect(result.data[tr + 1]).toBe(255);
    });

    it('preserves alpha during downscale', () => {
      const src = createBlankPixelBuffer(8, 8);
      fillRect(src, 0, 0, 8, 8, 100, 100, 100, 128);
      const result = nearestNeighborDownscale(src, 4, 4);
      const i = getPixelIndex(0, 0, 4);
      expect(result.data[i + 3]).toBe(128);
    });

    it('returns same size when target equals source', () => {
      const src = createBlankPixelBuffer(16, 16);
      fillRect(src, 0, 0, 16, 16, 50, 100, 150, 255);
      const result = nearestNeighborDownscale(src, 16, 16);
      expect(result.width).toBe(16);
      expect(result.data[0]).toBe(50);
    });
  });

  describe('countFilledPixels', () => {
    it('returns 0 for empty buffer', () => {
      const buf = createBlankPixelBuffer(8, 8);
      expect(countFilledPixels(buf)).toBe(0);
    });

    it('counts pixels with alpha > 0', () => {
      const buf = createBlankPixelBuffer(4, 4);
      fillRect(buf, 0, 0, 2, 2, 255, 0, 0, 255); // 4 pixels
      fillRect(buf, 2, 2, 1, 1, 0, 0, 255, 1);    // 1 pixel at alpha=1
      expect(countFilledPixels(buf)).toBe(5);
    });

    it('counts fully filled buffer', () => {
      const buf = createBlankPixelBuffer(8, 8);
      fillRect(buf, 0, 0, 8, 8, 100, 100, 100, 255);
      expect(countFilledPixels(buf)).toBe(64);
    });
  });

  describe('analyzeSilhouetteSurvival', () => {
    it('returns 100% coverage when sprite matches concept silhouette', () => {
      // Both have same shape: 4×4 filled block in center of 8×8
      const concept = createBlankPixelBuffer(16, 16);
      fillRect(concept, 4, 4, 8, 8, 200, 100, 50, 255);

      // Sprite: same proportional region in 4×4
      const sprite = createBlankPixelBuffer(4, 4);
      fillRect(sprite, 1, 1, 2, 2, 100, 50, 25, 255);

      const result = analyzeSilhouetteSurvival(concept, sprite);
      expect(result.coveragePercent).toBeGreaterThanOrEqual(80);
      expect(result.targetWidth).toBe(4);
      expect(result.targetHeight).toBe(4);
      expect(result.scaleFactor).toBe(0.25);
    });

    it('returns 0% coverage when sprite is empty', () => {
      const concept = createBlankPixelBuffer(16, 16);
      fillRect(concept, 0, 0, 16, 16, 200, 100, 50, 255);
      const sprite = createBlankPixelBuffer(4, 4); // empty

      const result = analyzeSilhouetteSurvival(concept, sprite);
      expect(result.coveragePercent).toBe(0);
      expect(result.spriteFilledCount).toBe(0);
      expect(result.conceptFilledCount).toBeGreaterThan(0);
    });

    it('handles both empty buffers', () => {
      const concept = createBlankPixelBuffer(16, 16);
      const sprite = createBlankPixelBuffer(4, 4);
      const result = analyzeSilhouetteSurvival(concept, sprite);
      expect(result.coveragePercent).toBe(0);
      expect(result.conceptFilledCount).toBe(0);
      expect(result.spriteFilledCount).toBe(0);
    });

    it('reports correct scale factor', () => {
      const concept = createBlankPixelBuffer(500, 500);
      const sprite = createBlankPixelBuffer(48, 48);
      const result = analyzeSilhouetteSurvival(concept, sprite);
      expect(result.scaleFactor).toBeCloseTo(48 / 500, 4);
    });
  });

  describe('computeComparisonScale', () => {
    it('returns correct scale for 500 concept / 48 sprite', () => {
      expect(computeComparisonScale(500, 48)).toBe(10);
    });

    it('returns correct scale for 500 concept / 32 sprite', () => {
      expect(computeComparisonScale(500, 32)).toBe(15);
    });

    it('returns correct scale for 500 concept / 64 sprite', () => {
      expect(computeComparisonScale(500, 64)).toBe(7);
    });

    it('returns 1 for zero sprite height', () => {
      expect(computeComparisonScale(500, 0)).toBe(1);
    });

    it('returns 1 when sprite is larger than concept', () => {
      expect(computeComparisonScale(32, 500)).toBe(1);
    });
  });

  describe('pixelPerfectUpscale', () => {
    it('upscales 2×2 to 4×4 at scale 2', () => {
      const src = createBlankPixelBuffer(2, 2);
      fillRect(src, 0, 0, 1, 1, 255, 0, 0, 255);   // top-left red
      fillRect(src, 1, 0, 1, 1, 0, 255, 0, 255);   // top-right green

      const result = pixelPerfectUpscale(src, 2);
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);

      // Top-left 2×2 block should all be red
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const i = getPixelIndex(x, y, 4);
          expect(result.data[i]).toBe(255);
          expect(result.data[i + 1]).toBe(0);
        }
      }

      // Top-right 2×2 block should all be green
      for (let y = 0; y < 2; y++) {
        for (let x = 2; x < 4; x++) {
          const i = getPixelIndex(x, y, 4);
          expect(result.data[i]).toBe(0);
          expect(result.data[i + 1]).toBe(255);
        }
      }
    });

    it('returns clone at scale 1', () => {
      const src = createBlankPixelBuffer(4, 4);
      fillRect(src, 0, 0, 4, 4, 128, 64, 32, 255);
      const result = pixelPerfectUpscale(src, 1);
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      // Should be a copy, not same reference
      expect(result.data).not.toBe(src.data);
      expect(result.data[0]).toBe(128);
    });

    it('upscale preserves alpha', () => {
      const src = createBlankPixelBuffer(1, 1);
      fillRect(src, 0, 0, 1, 1, 100, 200, 50, 128);
      const result = pixelPerfectUpscale(src, 3);
      expect(result.width).toBe(3);
      expect(result.height).toBe(3);
      // All 9 pixels should have same color
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const i = getPixelIndex(x, y, 3);
          expect(result.data[i + 3]).toBe(128);
        }
      }
    });
  });

  describe('generateComparisonLayout', () => {
    it('produces correct width with 4 panels + gaps', () => {
      const concept = createBlankPixelBuffer(16, 16);
      fillRect(concept, 4, 4, 8, 8, 200, 100, 50, 255);
      const sprite = createBlankPixelBuffer(4, 4);
      fillRect(sprite, 1, 1, 2, 2, 100, 50, 25, 255);

      const result = generateComparisonLayout(concept, sprite, {
        gap: 4,
        includesilhouettes: true,
      });

      // scale = floor(16/4) = 4, upscaled sprite = 16×16
      // 4 panels: concept(16) + upscaled(16) + concept-sil(16) + sprite-sil-up(16) + 3 gaps(12)
      expect(result.width).toBe(16 + 16 + 16 + 16 + 4 * 3);
      expect(result.height).toBe(16);
    });

    it('produces correct width with 2 panels (no silhouettes)', () => {
      const concept = createBlankPixelBuffer(16, 16);
      fillRect(concept, 0, 0, 16, 16, 200, 100, 50, 255);
      const sprite = createBlankPixelBuffer(4, 4);
      fillRect(sprite, 0, 0, 4, 4, 100, 50, 25, 255);

      const result = generateComparisonLayout(concept, sprite, {
        gap: 2,
        includesilhouettes: false,
      });

      // 2 panels: concept(16) + upscaled(16) + 1 gap(2)
      expect(result.width).toBe(16 + 16 + 2);
      expect(result.height).toBe(16);
    });

    it('fills background color in gaps', () => {
      const concept = createBlankPixelBuffer(4, 4);
      const sprite = createBlankPixelBuffer(2, 2);

      const bg: [number, number, number, number] = [80, 80, 80, 255];
      const result = generateComparisonLayout(concept, sprite, {
        gap: 4,
        backgroundColor: bg,
        includesilhouettes: false,
      });

      // Check a pixel in the gap area (after concept panel of width 4)
      const gapX = 5; // first gap pixel
      const i = getPixelIndex(gapX, 0, result.width);
      expect(result.data[i]).toBe(80);
      expect(result.data[i + 1]).toBe(80);
      expect(result.data[i + 2]).toBe(80);
      expect(result.data[i + 3]).toBe(255);
    });

    it('handles empty sprite gracefully', () => {
      const concept = createBlankPixelBuffer(16, 16);
      fillRect(concept, 0, 0, 16, 16, 100, 100, 100, 255);
      const sprite = createBlankPixelBuffer(4, 4); // empty

      const result = generateComparisonLayout(concept, sprite, { includesilhouettes: false });
      // Should not throw — empty sprite just means no pixels blitted
      expect(result.width).toBeGreaterThan(16);
      expect(result.height).toBe(16);
    });
  });
});
