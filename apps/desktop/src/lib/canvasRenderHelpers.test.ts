import { describe, it, expect } from 'vitest';
import { buildFramePixelBuffer, buildTintedPixelBuffer, buildCheckerBuffer } from './canvasRenderHelpers';

// ---------------------------------------------------------------------------
// buildFramePixelBuffer
// ---------------------------------------------------------------------------

describe('buildFramePixelBuffer — normal mode', () => {
  it('returns a buffer of the correct length', () => {
    const src = new Array(4 * 4 * 4).fill(0);
    const buf = buildFramePixelBuffer(src, 4, 4, false, 0, 0, 0);
    expect(buf.length).toBe(4 * 4 * 4);
  });

  it('copies RGBA values unchanged for opaque pixels', () => {
    const src = [255, 128, 64, 255,  0, 0, 0, 0];
    const buf = buildFramePixelBuffer(src, 2, 1, false, 0, 0, 0);
    expect(buf[0]).toBe(255); // R
    expect(buf[1]).toBe(128); // G
    expect(buf[2]).toBe(64);  // B
    expect(buf[3]).toBe(255); // A
  });

  it('copies partial alpha unchanged', () => {
    const src = [200, 100, 50, 128,  0, 0, 0, 0];
    const buf = buildFramePixelBuffer(src, 2, 1, false, 0, 0, 0);
    expect(buf[3]).toBe(128);
  });

  it('copies transparent pixels as-is (RGB irrelevant when A=0 for compositing)', () => {
    // Normal mode is a straight byte copy — RGB values of transparent pixels
    // are preserved but are invisible since alpha=0 during canvas compositing.
    const src = [255, 255, 255, 0,  100, 200, 50, 0];
    const buf = buildFramePixelBuffer(src, 2, 1, false, 0, 0, 0);
    expect(buf[3]).toBe(0);  // alpha is 0 → invisible
    expect(buf[7]).toBe(0);  // alpha is 0 → invisible
  });

  it('handles a 1×1 opaque pixel', () => {
    const src = [10, 20, 30, 255];
    const buf = buildFramePixelBuffer(src, 1, 1, false, 0, 0, 0);
    expect(Array.from(buf)).toEqual([10, 20, 30, 255]);
  });
});

describe('buildFramePixelBuffer — silhouette mode', () => {
  it('replaces RGB with silhouette color for opaque pixels', () => {
    const src = [10, 20, 30, 255,  0, 0, 0, 0];
    const buf = buildFramePixelBuffer(src, 2, 1, true, 100, 150, 200);
    expect(buf[0]).toBe(100); // silR
    expect(buf[1]).toBe(150); // silG
    expect(buf[2]).toBe(200); // silB
    expect(buf[3]).toBe(255); // alpha preserved
  });

  it('preserves partial alpha in silhouette mode', () => {
    const src = [10, 20, 30, 77];
    const buf = buildFramePixelBuffer(src, 1, 1, true, 255, 0, 0);
    expect(buf[0]).toBe(255);
    expect(buf[3]).toBe(77); // alpha unchanged
  });

  it('leaves transparent pixels transparent in silhouette mode', () => {
    const src = [255, 255, 255, 0];
    const buf = buildFramePixelBuffer(src, 1, 1, true, 255, 0, 0);
    expect(buf[0]).toBe(0);
    expect(buf[3]).toBe(0);
  });

  it('silhouette mode replaces all opaque pixels regardless of original color', () => {
    const src = [
      255,   0,   0, 255,  // red
        0, 255,   0, 255,  // green
        0,   0, 255, 255,  // blue
    ];
    const buf = buildFramePixelBuffer(src, 3, 1, true, 50, 50, 50);
    for (let i = 0; i < 3; i++) {
      expect(buf[i * 4 + 0]).toBe(50); // all silR
      expect(buf[i * 4 + 1]).toBe(50); // all silG
      expect(buf[i * 4 + 2]).toBe(50); // all silB
      expect(buf[i * 4 + 3]).toBe(255);
    }
  });
});

// ---------------------------------------------------------------------------
// buildTintedPixelBuffer
// ---------------------------------------------------------------------------

describe('buildTintedPixelBuffer — blue tint (prev frame)', () => {
  it('returns buffer of correct length', () => {
    const src = new Array(2 * 2 * 4).fill(0);
    const buf = buildTintedPixelBuffer(src, 2, 2, 'blue');
    expect(buf.length).toBe(2 * 2 * 4);
  });

  it('reduces R and G to 30%, boosts B', () => {
    const src = [200, 100, 50, 255];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'blue');
    expect(buf[0]).toBe(Math.round(200 * 0.3)); // 60
    expect(buf[1]).toBe(Math.round(100 * 0.3)); // 30
    expect(buf[2]).toBe(Math.min(255, Math.round(50 * 0.5 + 128))); // 153
    expect(buf[3]).toBe(255);
  });

  it('clamps blue channel to 255', () => {
    const src = [0, 0, 255, 255];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'blue');
    // B = min(255, round(255*0.5 + 128)) = min(255, 255.5→256) = 255
    expect(buf[2]).toBe(255);
    expect(buf[2]).toBeLessThanOrEqual(255);
  });

  it('leaves transparent pixels unchanged (all zero)', () => {
    const src = [255, 255, 255, 0];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'blue');
    expect(buf[0]).toBe(0);
    expect(buf[3]).toBe(0);
  });

  it('preserves partial alpha', () => {
    const src = [100, 100, 100, 128];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'blue');
    expect(buf[3]).toBe(128);
  });
});

describe('buildTintedPixelBuffer — red tint (next frame)', () => {
  it('boosts R, reduces G and B to 30%', () => {
    const src = [50, 100, 200, 255];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'red');
    expect(buf[0]).toBe(Math.min(255, Math.round(50  * 0.5 + 128))); // 153
    expect(buf[1]).toBe(Math.round(100 * 0.3));                       // 30
    expect(buf[2]).toBe(Math.round(200 * 0.3));                       // 60
    expect(buf[3]).toBe(255);
  });

  it('clamps red channel to 255', () => {
    const src = [255, 0, 0, 255];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'red');
    expect(buf[0]).toBe(255);
    expect(buf[0]).toBeLessThanOrEqual(255);
  });

  it('leaves transparent pixels unchanged', () => {
    const src = [255, 255, 255, 0];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'red');
    expect(buf[0]).toBe(0);
    expect(buf[3]).toBe(0);
  });

  it('preserves partial alpha', () => {
    const src = [100, 100, 100, 64];
    const buf = buildTintedPixelBuffer(src, 1, 1, 'red');
    expect(buf[3]).toBe(64);
  });
});

describe('buildTintedPixelBuffer — multi-pixel correctness', () => {
  it('handles a 2-pixel buffer where only one pixel is opaque', () => {
    const src = [255, 255, 255, 255,  0, 0, 0, 0];
    const buf = buildTintedPixelBuffer(src, 2, 1, 'blue');
    // Second pixel is transparent → all zero
    expect(buf[4]).toBe(0);
    expect(buf[7]).toBe(0);
    // First pixel is tinted
    expect(buf[3]).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// buildCheckerBuffer
// ---------------------------------------------------------------------------

const LIGHT: [number, number, number, number] = [42, 42, 46, 255];
const DARK:  [number, number, number, number] = [34, 34, 38, 255];

describe('buildCheckerBuffer', () => {
  it('returns buffer of correct length', () => {
    const buf = buildCheckerBuffer(4, 4, LIGHT, DARK);
    expect(buf.length).toBe(4 * 4 * 4);
  });

  it('pixel (0,0) uses light color — (0+0)%2 === 0', () => {
    const buf = buildCheckerBuffer(2, 2, LIGHT, DARK);
    expect(buf[0]).toBe(LIGHT[0]);
    expect(buf[1]).toBe(LIGHT[1]);
    expect(buf[2]).toBe(LIGHT[2]);
    expect(buf[3]).toBe(255);
  });

  it('pixel (1,0) uses dark color — (1+0)%2 === 1', () => {
    const buf = buildCheckerBuffer(2, 2, LIGHT, DARK);
    expect(buf[4]).toBe(DARK[0]);
    expect(buf[5]).toBe(DARK[1]);
    expect(buf[6]).toBe(DARK[2]);
  });

  it('pixel (0,1) uses dark color — (0+1)%2 === 1', () => {
    const buf = buildCheckerBuffer(2, 2, LIGHT, DARK);
    // Row 1, Col 0 → index 8
    expect(buf[8]).toBe(DARK[0]);
  });

  it('pixel (1,1) uses light color — (1+1)%2 === 0', () => {
    const buf = buildCheckerBuffer(2, 2, LIGHT, DARK);
    // Row 1, Col 1 → index 12
    expect(buf[12]).toBe(LIGHT[0]);
  });

  it('alternates correctly across a 4×1 row', () => {
    const buf = buildCheckerBuffer(4, 1, LIGHT, DARK);
    // px: 0=light, 1=dark, 2=light, 3=dark
    expect(buf[0]).toBe(LIGHT[0]);
    expect(buf[4]).toBe(DARK[0]);
    expect(buf[8]).toBe(LIGHT[0]);
    expect(buf[12]).toBe(DARK[0]);
  });

  it('alternates correctly down a 1×4 column', () => {
    const buf = buildCheckerBuffer(1, 4, LIGHT, DARK);
    // py: 0=light, 1=dark, 2=light, 3=dark
    expect(buf[0]).toBe(LIGHT[0]);
    expect(buf[4]).toBe(DARK[0]);
    expect(buf[8]).toBe(LIGHT[0]);
    expect(buf[12]).toBe(DARK[0]);
  });

  it('all pixels are fully opaque (alpha=255)', () => {
    const buf = buildCheckerBuffer(3, 3, LIGHT, DARK);
    for (let i = 3; i < buf.length; i += 4) {
      expect(buf[i]).toBe(255);
    }
  });

  it('1×1 frame gives a single light pixel', () => {
    const buf = buildCheckerBuffer(1, 1, LIGHT, DARK);
    expect(buf.length).toBe(4);
    expect(buf[0]).toBe(LIGHT[0]);
    expect(buf[3]).toBe(255);
  });
});
