/**
 * Pure pixel-buffer helpers for Canvas rendering.
 *
 * These functions produce Uint8ClampedArray buffers suitable for ImageData /
 * putImageData. They have no canvas, DOM, or React dependencies and are
 * fully unit-testable.
 */

// ---------------------------------------------------------------------------
// Frame pixel buffer
// ---------------------------------------------------------------------------

/**
 * Build an RGBA pixel buffer for the active canvas frame.
 *
 * In silhouette mode all opaque pixels are rendered in the silhouette color
 * while their alpha is preserved unchanged. Fully-transparent pixels remain
 * transparent in both modes.
 *
 * @param src            Raw RGBA byte array from the frame store (number[])
 * @param width          Frame width in pixels
 * @param height         Frame height in pixels
 * @param showSilhouette Override RGB channels with silhouette color when true
 * @param silR           Silhouette red   [0–255]
 * @param silG           Silhouette green [0–255]
 * @param silB           Silhouette blue  [0–255]
 */
export function buildFramePixelBuffer(
  src: number[],
  width: number,
  height: number,
  showSilhouette: boolean,
  silR: number,
  silG: number,
  silB: number,
): Uint8ClampedArray {
  const n = width * height * 4;
  const dst = new Uint8ClampedArray(n);

  if (showSilhouette) {
    for (let i = 0; i < n; i += 4) {
      const a = src[i + 3];
      if (a === 0) continue;
      dst[i]     = silR;
      dst[i + 1] = silG;
      dst[i + 2] = silB;
      dst[i + 3] = a;
    }
  } else {
    // Fast path: straight copy with no per-pixel branching
    for (let i = 0; i < n; i++) dst[i] = src[i];
  }

  return dst;
}

// ---------------------------------------------------------------------------
// Onion skin tinted pixel buffer
// ---------------------------------------------------------------------------

export type OnionTintMode = 'blue' | 'red';

/**
 * Build an RGBA pixel buffer for an onion skin frame with a color tint.
 *
 * Blue tint (previous frame): R×0.3, G×0.3, B×0.5+128
 * Red  tint (next frame):     R×0.5+128, G×0.3, B×0.3
 *
 * Matches the tint math used in Canvas.tsx onion skin rendering exactly,
 * so swapping in an offscreen canvas / drawImage produces identical output.
 *
 * @param src      Raw RGBA byte array (number[])
 * @param width    Frame width in pixels
 * @param height   Frame height in pixels
 * @param tintMode 'blue' for previous frame, 'red' for next frame
 */
export function buildTintedPixelBuffer(
  src: number[],
  width: number,
  height: number,
  tintMode: OnionTintMode,
): Uint8ClampedArray {
  const n = width * height * 4;
  const dst = new Uint8ClampedArray(n);

  for (let i = 0; i < n; i += 4) {
    const a = src[i + 3];
    if (a === 0) continue;

    if (tintMode === 'blue') {
      dst[i]     = Math.round(src[i]     * 0.3);
      dst[i + 1] = Math.round(src[i + 1] * 0.3);
      dst[i + 2] = Math.min(255, Math.round(src[i + 2] * 0.5 + 128));
    } else {
      dst[i]     = Math.min(255, Math.round(src[i]     * 0.5 + 128));
      dst[i + 1] = Math.round(src[i + 1] * 0.3);
      dst[i + 2] = Math.round(src[i + 2] * 0.3);
    }
    dst[i + 3] = a;
  }

  return dst;
}

// ---------------------------------------------------------------------------
// Checker background buffer
// ---------------------------------------------------------------------------

/**
 * Build an RGBA pixel buffer for a per-sprite-pixel transparency checker.
 *
 * Each sprite pixel alternates between the two checker colors based on
 * (px + py) % 2. The buffer is rendered at 1× sprite resolution and should
 * be uploaded to an offscreen canvas then drawn scaled-up by zoom.
 *
 * Cache key: frame width × height only — does not depend on zoom since the
 * scaled draw handles that.
 *
 * @param width      Frame width in sprite pixels
 * @param height     Frame height in sprite pixels
 * @param lightColor RGBA tuple for the lighter checker square  [R, G, B, A]
 * @param darkColor  RGBA tuple for the darker checker square   [R, G, B, A]
 */
export function buildCheckerBuffer(
  width: number,
  height: number,
  lightColor: [number, number, number, number],
  darkColor:  [number, number, number, number],
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const [r, g, b, a] = (px + py) % 2 === 0 ? lightColor : darkColor;
      dst[i]     = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }
  }
  return dst;
}
