/**
 * Tests for sprite analysis — bounds, colors, frame comparison.
 */
import { describe, it, expect } from 'vitest';
import { analyzeSpriteBounds, analyzeSpriteColors, compareFrames } from './spriteAnalysis';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { setPixel, clonePixelBuffer } from './spriteRaster';
import type { Rgba } from './spriteRaster';

function makeBuffer(w = 8, h = 8) {
  return createBlankPixelBuffer(w, h);
}

function drawPixel(buf: ReturnType<typeof makeBuffer>, x: number, y: number, rgba: Rgba) {
  setPixel(buf, x, y, rgba);
}

describe('analyzeSpriteBounds', () => {
  it('returns empty for a blank buffer', () => {
    const buf = makeBuffer();
    const bounds = analyzeSpriteBounds(buf);
    expect(bounds.empty).toBe(true);
    expect(bounds.opaquePixelCount).toBe(0);
    expect(bounds.width).toBe(0);
    expect(bounds.height).toBe(0);
  });

  it('finds bounds of a single pixel', () => {
    const buf = makeBuffer();
    drawPixel(buf, 3, 5, [255, 0, 0, 255]);
    const bounds = analyzeSpriteBounds(buf);
    expect(bounds.empty).toBe(false);
    expect(bounds.minX).toBe(3);
    expect(bounds.minY).toBe(5);
    expect(bounds.maxX).toBe(3);
    expect(bounds.maxY).toBe(5);
    expect(bounds.width).toBe(1);
    expect(bounds.height).toBe(1);
    expect(bounds.opaquePixelCount).toBe(1);
  });

  it('finds bounds of multiple pixels', () => {
    const buf = makeBuffer();
    drawPixel(buf, 1, 2, [255, 0, 0, 255]);
    drawPixel(buf, 6, 7, [0, 255, 0, 255]);
    drawPixel(buf, 4, 4, [0, 0, 255, 128]); // semi-transparent counts
    const bounds = analyzeSpriteBounds(buf);
    expect(bounds.minX).toBe(1);
    expect(bounds.minY).toBe(2);
    expect(bounds.maxX).toBe(6);
    expect(bounds.maxY).toBe(7);
    expect(bounds.width).toBe(6);
    expect(bounds.height).toBe(6);
    expect(bounds.opaquePixelCount).toBe(3);
  });

  it('ignores fully transparent pixels (alpha=0)', () => {
    const buf = makeBuffer();
    drawPixel(buf, 0, 0, [255, 0, 0, 0]); // transparent
    drawPixel(buf, 5, 5, [0, 255, 0, 255]); // opaque
    const bounds = analyzeSpriteBounds(buf);
    expect(bounds.minX).toBe(5);
    expect(bounds.maxX).toBe(5);
    expect(bounds.opaquePixelCount).toBe(1);
  });
});

describe('analyzeSpriteColors', () => {
  it('returns one color for blank buffer (transparent)', () => {
    const buf = makeBuffer(2, 2);
    const result = analyzeSpriteColors(buf);
    expect(result.uniqueColors).toBe(1);
    expect(result.totalPixels).toBe(4);
    expect(result.transparentPixelCount).toBe(4);
    expect(result.opaquePixelCount).toBe(0);
    expect(result.histogram[0].rgba).toEqual([0, 0, 0, 0]);
    expect(result.histogram[0].count).toBe(4);
  });

  it('counts exact unique colors', () => {
    const buf = makeBuffer(4, 1);
    drawPixel(buf, 0, 0, [255, 0, 0, 255]);
    drawPixel(buf, 1, 0, [255, 0, 0, 255]); // same red
    drawPixel(buf, 2, 0, [0, 255, 0, 255]); // green
    // pixel 3 stays transparent
    const result = analyzeSpriteColors(buf);
    expect(result.uniqueColors).toBe(3); // red, green, transparent
    expect(result.opaquePixelCount).toBe(3);
    expect(result.transparentPixelCount).toBe(1);
  });

  it('sorts histogram by frequency descending', () => {
    const buf = makeBuffer(4, 1);
    drawPixel(buf, 0, 0, [255, 0, 0, 255]);
    drawPixel(buf, 1, 0, [255, 0, 0, 255]);
    drawPixel(buf, 2, 0, [255, 0, 0, 255]);
    drawPixel(buf, 3, 0, [0, 255, 0, 255]);
    const result = analyzeSpriteColors(buf);
    expect(result.histogram[0].count).toBe(3);
    expect(result.histogram[0].rgba).toEqual([255, 0, 0, 255]);
    expect(result.histogram[1].count).toBe(1);
  });

  it('produces correct hex strings', () => {
    const buf = makeBuffer(1, 1);
    drawPixel(buf, 0, 0, [255, 128, 0, 255]);
    const result = analyzeSpriteColors(buf);
    expect(result.histogram[0].hex).toBe('#ff8000ff');
  });
});

describe('compareFrames', () => {
  it('returns identical for two blank buffers', () => {
    const a = makeBuffer();
    const b = makeBuffer();
    const diff = compareFrames(a, b);
    expect(diff.identical).toBe(true);
    expect(diff.changedPixelCount).toBe(0);
    expect(diff.changedBounds).toBeNull();
    expect(diff.changedPercent).toBe(0);
  });

  it('detects single pixel difference', () => {
    const a = makeBuffer();
    const b = clonePixelBuffer(a);
    drawPixel(b, 3, 3, [255, 0, 0, 255]);
    const diff = compareFrames(a, b);
    expect(diff.identical).toBe(false);
    expect(diff.changedPixelCount).toBe(1);
    expect(diff.changedBounds).toEqual({ minX: 3, minY: 3, maxX: 3, maxY: 3 });
    expect(diff.totalPixels).toBe(64);
  });

  it('computes correct changed percent', () => {
    const a = makeBuffer(10, 10);
    const b = clonePixelBuffer(a);
    // Change 10 pixels
    for (let i = 0; i < 10; i++) {
      drawPixel(b, i, 0, [255, 0, 0, 255]);
    }
    const diff = compareFrames(a, b);
    expect(diff.changedPixelCount).toBe(10);
    expect(diff.changedPercent).toBe(10);
  });

  it('returns changed bounds spanning all differences', () => {
    const a = makeBuffer();
    const b = clonePixelBuffer(a);
    drawPixel(b, 1, 1, [255, 0, 0, 255]);
    drawPixel(b, 6, 6, [0, 255, 0, 255]);
    const diff = compareFrames(a, b);
    expect(diff.changedBounds).toEqual({ minX: 1, minY: 1, maxX: 6, maxY: 6 });
    expect(diff.changedPixelCount).toBe(2);
  });

  it('throws on dimension mismatch', () => {
    const a = makeBuffer(4, 4);
    const b = makeBuffer(8, 8);
    expect(() => compareFrames(a, b)).toThrow('Cannot compare buffers of different dimensions');
  });

  it('detects identical cloned buffers as identical', () => {
    const a = makeBuffer();
    drawPixel(a, 0, 0, [255, 0, 0, 255]);
    drawPixel(a, 7, 7, [0, 255, 0, 255]);
    const b = clonePixelBuffer(a);
    const diff = compareFrames(a, b);
    expect(diff.identical).toBe(true);
  });
});
