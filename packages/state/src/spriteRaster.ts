import type { SpritePixelBuffer } from '@glyphstudio/domain';

/** RGBA color tuple — each channel 0–255. */
export type Rgba = [number, number, number, number];

/** Transparent black. */
export const TRANSPARENT: Rgba = [0, 0, 0, 0];

// ── Pixel index math ──

/** Get the byte offset for pixel (x, y) in a row-major RGBA buffer. */
export function getPixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

/** Check whether (x, y) is within the buffer bounds. */
export function isInBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

// ── Read/write ──

/** Read the RGBA color at (x, y). Returns undefined if out of bounds. */
export function samplePixel(
  buffer: SpritePixelBuffer,
  x: number,
  y: number,
): Rgba | undefined {
  if (!isInBounds(x, y, buffer.width, buffer.height)) return undefined;
  const i = getPixelIndex(x, y, buffer.width);
  return [buffer.data[i], buffer.data[i + 1], buffer.data[i + 2], buffer.data[i + 3]];
}

/** Write an RGBA color at (x, y). No-ops if out of bounds. */
export function setPixel(
  buffer: SpritePixelBuffer,
  x: number,
  y: number,
  color: Rgba,
): void {
  if (!isInBounds(x, y, buffer.width, buffer.height)) return;
  const i = getPixelIndex(x, y, buffer.width);
  buffer.data[i] = color[0];
  buffer.data[i + 1] = color[1];
  buffer.data[i + 2] = color[2];
  buffer.data[i + 3] = color[3];
}

/** Check if two RGBA colors are identical. */
export function colorsEqual(a: Rgba, b: Rgba): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

// ── Brush dab ──

/**
 * Paint a brush dab centered at (cx, cy).
 *
 * - size 1: single pixel at (cx, cy)
 * - size N square: fills an NxN block centered on (cx, cy)
 * - size N circle: fills pixels within radius N/2 of center
 *
 * Out-of-bounds pixels are silently skipped.
 */
export function drawBrushDab(
  buffer: SpritePixelBuffer,
  cx: number,
  cy: number,
  color: Rgba,
  brushSize: number,
  brushShape: 'square' | 'circle',
): void {
  if (brushSize <= 0) return;

  if (brushSize === 1) {
    setPixel(buffer, cx, cy, color);
    return;
  }

  const half = Math.floor(brushSize / 2);
  const radiusSq = (brushSize / 2) * (brushSize / 2);

  for (let dy = -half; dy < brushSize - half; dy++) {
    for (let dx = -half; dx < brushSize - half; dx++) {
      if (brushShape === 'circle') {
        const distSq = (dx + 0.5) * (dx + 0.5) + (dy + 0.5) * (dy + 0.5);
        if (distSq > radiusSq) continue;
      }
      setPixel(buffer, cx + dx, cy + dy, color);
    }
  }
}

// ── Bresenham line ──

/** Generate all integer pixel coordinates along a line from (x0,y0) to (x1,y1). */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number][] {
  const points: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = x0;
  let cy = y0;

  for (;;) {
    points.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

// ── Flood fill ──

/**
 * 4-direction contiguous flood fill.
 *
 * Fills all pixels connected to (startX, startY) that match the target color
 * with the replacement color. No-ops when target equals replacement.
 *
 * Uses an iterative queue to avoid stack overflow on large regions.
 */
export function floodFill(
  buffer: SpritePixelBuffer,
  startX: number,
  startY: number,
  replacementColor: Rgba,
): void {
  if (!isInBounds(startX, startY, buffer.width, buffer.height)) return;

  const targetColor = samplePixel(buffer, startX, startY)!;
  if (colorsEqual(targetColor, replacementColor)) return;

  const { width, height } = buffer;
  const visited = new Uint8Array(width * height);
  const queue: [number, number][] = [[startX, startY]];

  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    const flatIdx = y * width + x;

    if (visited[flatIdx]) continue;
    visited[flatIdx] = 1;

    const current = samplePixel(buffer, x, y)!;
    if (!colorsEqual(current, targetColor)) continue;

    setPixel(buffer, x, y, replacementColor);

    if (x > 0) queue.push([x - 1, y]);
    if (x < width - 1) queue.push([x + 1, y]);
    if (y > 0) queue.push([x, y - 1]);
    if (y < height - 1) queue.push([x, y + 1]);
  }
}

// ── Buffer cloning ──

/** Deep-clone a pixel buffer. */
export function clonePixelBuffer(buffer: SpritePixelBuffer): SpritePixelBuffer {
  return {
    width: buffer.width,
    height: buffer.height,
    data: new Uint8ClampedArray(buffer.data),
  };
}
