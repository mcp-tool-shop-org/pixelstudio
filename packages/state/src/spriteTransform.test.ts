/**
 * Tests for sprite transforms — rotate, resize.
 */
import { describe, it, expect } from 'vitest';
import { rotateBuffer, resizeBuffer } from './spriteTransform';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { setPixel, samplePixel } from './spriteRaster';
import type { Rgba } from './spriteRaster';

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

function makeBuffer(w: number, h: number, pixels: Array<[number, number, Rgba]> = []) {
  const buf = createBlankPixelBuffer(w, h);
  for (const [x, y, rgba] of pixels) setPixel(buf, x, y, rgba);
  return buf;
}

describe('rotateBuffer', () => {
  it('rotates 90° CW — swaps dimensions', () => {
    // 4x2 buffer with red at (0,0) and green at (3,1)
    const buf = makeBuffer(4, 2, [[0, 0, RED], [3, 1, GREEN]]);
    const rotated = rotateBuffer(buf, 90);

    expect(rotated.width).toBe(2); // srcH
    expect(rotated.height).toBe(4); // srcW

    // (0,0) → 90° CW → (1, 0) in 2x4 output
    expect(samplePixel(rotated, 1, 0)).toEqual(RED);
    // (3,1) → 90° CW → (0, 3) in 2x4 output
    expect(samplePixel(rotated, 0, 3)).toEqual(GREEN);
  });

  it('rotates 180° — preserves dimensions', () => {
    const buf = makeBuffer(4, 4, [[0, 0, RED], [3, 3, GREEN]]);
    const rotated = rotateBuffer(buf, 180);

    expect(rotated.width).toBe(4);
    expect(rotated.height).toBe(4);

    // (0,0) → 180° → (3,3)
    expect(samplePixel(rotated, 3, 3)).toEqual(RED);
    // (3,3) → 180° → (0,0)
    expect(samplePixel(rotated, 0, 0)).toEqual(GREEN);
  });

  it('rotates 270° CW — swaps dimensions', () => {
    const buf = makeBuffer(4, 2, [[0, 0, RED], [3, 1, GREEN]]);
    const rotated = rotateBuffer(buf, 270);

    expect(rotated.width).toBe(2); // srcH
    expect(rotated.height).toBe(4); // srcW

    // (0,0) → 270° CW → (0, 3) in 2x4 output
    expect(samplePixel(rotated, 0, 3)).toEqual(RED);
    // (3,1) → 270° CW → (1, 0) in 2x4 output
    expect(samplePixel(rotated, 1, 0)).toEqual(GREEN);
  });

  it('360° = two 180° rotations returns to original', () => {
    const buf = makeBuffer(3, 3, [[0, 0, RED], [2, 1, GREEN], [1, 2, BLUE]]);
    const rotated = rotateBuffer(rotateBuffer(buf, 180), 180);

    expect(samplePixel(rotated, 0, 0)).toEqual(RED);
    expect(samplePixel(rotated, 2, 1)).toEqual(GREEN);
    expect(samplePixel(rotated, 1, 2)).toEqual(BLUE);
  });

  it('four 90° rotations return to original', () => {
    const buf = makeBuffer(3, 5, [[0, 0, RED], [2, 4, GREEN]]);
    let r = buf;
    for (let i = 0; i < 4; i++) r = rotateBuffer(r, 90);

    expect(r.width).toBe(3);
    expect(r.height).toBe(5);
    expect(samplePixel(r, 0, 0)).toEqual(RED);
    expect(samplePixel(r, 2, 4)).toEqual(GREEN);
  });
});

describe('resizeBuffer', () => {
  it('crops when shrinking', () => {
    const buf = makeBuffer(4, 4, [[0, 0, RED], [3, 3, GREEN]]);
    const resized = resizeBuffer(buf, 2, 2);

    expect(resized.width).toBe(2);
    expect(resized.height).toBe(2);
    expect(samplePixel(resized, 0, 0)).toEqual(RED);
    // (3,3) is outside 2x2 — gone
    expect(samplePixel(resized, 1, 1)).toEqual(TRANSPARENT);
  });

  it('extends with transparent when growing', () => {
    const buf = makeBuffer(2, 2, [[0, 0, RED], [1, 1, GREEN]]);
    const resized = resizeBuffer(buf, 4, 4);

    expect(resized.width).toBe(4);
    expect(resized.height).toBe(4);
    expect(samplePixel(resized, 0, 0)).toEqual(RED);
    expect(samplePixel(resized, 1, 1)).toEqual(GREEN);
    expect(samplePixel(resized, 3, 3)).toEqual(TRANSPARENT);
  });

  it('preserves content at original position (top-left anchor)', () => {
    const buf = makeBuffer(4, 4, [[1, 1, BLUE]]);
    const resized = resizeBuffer(buf, 8, 8);
    expect(samplePixel(resized, 1, 1)).toEqual(BLUE);
  });

  it('no-op resize returns clone', () => {
    const buf = makeBuffer(4, 4, [[2, 2, RED]]);
    const resized = resizeBuffer(buf, 4, 4);
    expect(resized.width).toBe(4);
    expect(samplePixel(resized, 2, 2)).toEqual(RED);
    // Verify it's a clone, not the same reference
    setPixel(buf, 2, 2, GREEN);
    expect(samplePixel(resized, 2, 2)).toEqual(RED);
  });

  it('throws on invalid dimensions', () => {
    const buf = makeBuffer(4, 4);
    expect(() => resizeBuffer(buf, 0, 4)).toThrow('Invalid resize dimensions');
    expect(() => resizeBuffer(buf, 4, -1)).toThrow('Invalid resize dimensions');
  });

  it('handles asymmetric resize (wider, shorter)', () => {
    const buf = makeBuffer(4, 4, [[0, 0, RED], [3, 3, GREEN]]);
    const resized = resizeBuffer(buf, 8, 2);
    expect(resized.width).toBe(8);
    expect(resized.height).toBe(2);
    expect(samplePixel(resized, 0, 0)).toEqual(RED);
    // (3,3) is below y=2 cutoff
    expect(samplePixel(resized, 3, 1)).toEqual(TRANSPARENT);
  });
});
