import type { SpritePixelBuffer, SpriteSelectionRect, SpriteLayer } from '@glyphstudio/domain';
import { createBlankPixelBuffer } from '@glyphstudio/domain';

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

/**
 * Remove L-shaped corners from a point sequence to produce pixel-perfect lines.
 *
 * An L-corner is three consecutive points where the middle one creates an
 * unnecessary right-angle step (the line goes horizontal then vertical, or vice versa).
 * Removing the middle point produces cleaner 1px strokes typical of pixel art.
 */
export function removeCorners(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;
  const result: [number, number][] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];

    // L-corner: one step is horizontal and the next is vertical (or vice versa)
    const isLCorner =
      (dx1 !== 0 && dy1 === 0 && dx2 === 0 && dy2 !== 0) ||
      (dx1 === 0 && dy1 !== 0 && dx2 !== 0 && dy2 === 0);

    if (!isLCorner) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
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

// ── Selection helpers ──

/**
 * Normalize a drag rectangle from two corner points into a positive-size rect.
 * The inputs are the start and end pixel coordinates of a drag gesture.
 */
export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SpriteSelectionRect {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return {
    x,
    y,
    width: Math.abs(x2 - x1) + 1,
    height: Math.abs(y2 - y1) + 1,
  };
}

/**
 * Extract pixels within a selection rectangle into a new buffer.
 * Out-of-bounds pixels are transparent.
 */
export function extractSelection(
  buffer: SpritePixelBuffer,
  rect: SpriteSelectionRect,
): SpritePixelBuffer {
  const result: SpritePixelBuffer = {
    width: rect.width,
    height: rect.height,
    data: new Uint8ClampedArray(rect.width * rect.height * 4),
  };
  for (let sy = 0; sy < rect.height; sy++) {
    for (let sx = 0; sx < rect.width; sx++) {
      const srcX = rect.x + sx;
      const srcY = rect.y + sy;
      if (!isInBounds(srcX, srcY, buffer.width, buffer.height)) continue;
      const srcIdx = getPixelIndex(srcX, srcY, buffer.width);
      const dstIdx = (sy * rect.width + sx) * 4;
      result.data[dstIdx] = buffer.data[srcIdx];
      result.data[dstIdx + 1] = buffer.data[srcIdx + 1];
      result.data[dstIdx + 2] = buffer.data[srcIdx + 2];
      result.data[dstIdx + 3] = buffer.data[srcIdx + 3];
    }
  }
  return result;
}

/**
 * Clear all pixels within a selection rectangle to transparent.
 * Mutates the buffer in place. Out-of-bounds pixels are ignored.
 */
export function clearSelectionArea(
  buffer: SpritePixelBuffer,
  rect: SpriteSelectionRect,
): void {
  for (let sy = 0; sy < rect.height; sy++) {
    for (let sx = 0; sx < rect.width; sx++) {
      const px = rect.x + sx;
      const py = rect.y + sy;
      if (!isInBounds(px, py, buffer.width, buffer.height)) continue;
      const idx = getPixelIndex(px, py, buffer.width);
      buffer.data[idx] = 0;
      buffer.data[idx + 1] = 0;
      buffer.data[idx + 2] = 0;
      buffer.data[idx + 3] = 0;
    }
  }
}

/**
 * Blit (paste) a source pixel buffer onto a destination buffer at the given position.
 * Only non-transparent source pixels are written. Mutates dest in place.
 */
export function blitSelection(
  dest: SpritePixelBuffer,
  source: SpritePixelBuffer,
  destX: number,
  destY: number,
): void {
  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const srcIdx = (sy * source.width + sx) * 4;
      const a = source.data[srcIdx + 3];
      if (a === 0) continue;
      const px = destX + sx;
      const py = destY + sy;
      if (!isInBounds(px, py, dest.width, dest.height)) continue;
      const dstIdx = getPixelIndex(px, py, dest.width);
      dest.data[dstIdx] = source.data[srcIdx];
      dest.data[dstIdx + 1] = source.data[srcIdx + 1];
      dest.data[dstIdx + 2] = source.data[srcIdx + 2];
      dest.data[dstIdx + 3] = source.data[srcIdx + 3];
    }
  }
}

// ── Buffer transforms ──

/** Flip a pixel buffer horizontally (mirror left-right). Returns a new buffer. */
export function flipBufferHorizontal(buffer: SpritePixelBuffer): SpritePixelBuffer {
  const { width, height } = buffer;
  const result: SpritePixelBuffer = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      result.data[dstIdx] = buffer.data[srcIdx];
      result.data[dstIdx + 1] = buffer.data[srcIdx + 1];
      result.data[dstIdx + 2] = buffer.data[srcIdx + 2];
      result.data[dstIdx + 3] = buffer.data[srcIdx + 3];
    }
  }
  return result;
}

/** Flip a pixel buffer vertically (mirror top-bottom). Returns a new buffer. */
export function flipBufferVertical(buffer: SpritePixelBuffer): SpritePixelBuffer {
  const { width, height } = buffer;
  const result: SpritePixelBuffer = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
  for (let y = 0; y < height; y++) {
    const srcRowStart = y * width * 4;
    const dstRowStart = (height - 1 - y) * width * 4;
    result.data.set(
      buffer.data.subarray(srcRowStart, srcRowStart + width * 4),
      dstRowStart,
    );
  }
  return result;
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

/**
 * Flatten visible layers into a single pixel buffer using simple alpha compositing.
 * Layers are composited in order (index 0 = bottom, last = top).
 * Hidden layers are skipped. Returns a blank buffer if no visible layers.
 */
export function flattenLayers(
  layers: SpriteLayer[],
  pixelBuffers: Record<string, SpritePixelBuffer>,
  width: number,
  height: number,
): SpritePixelBuffer {
  const result = createBlankPixelBuffer(width, height);
  const size = width * height * 4;

  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.sketch) continue;
    const buf = pixelBuffers[layer.id];
    if (!buf) continue;

    for (let i = 0; i < size; i += 4) {
      const srcA = buf.data[i + 3];
      if (srcA === 0) continue;

      if (srcA === 255) {
        // Fully opaque — overwrite
        result.data[i] = buf.data[i];
        result.data[i + 1] = buf.data[i + 1];
        result.data[i + 2] = buf.data[i + 2];
        result.data[i + 3] = 255;
      } else {
        // Alpha blend: src over dst
        const dstA = result.data[i + 3];
        const srcAf = srcA / 255;
        const dstAf = dstA / 255;
        const outAf = srcAf + dstAf * (1 - srcAf);
        if (outAf > 0) {
          result.data[i] = Math.round((buf.data[i] * srcAf + result.data[i] * dstAf * (1 - srcAf)) / outAf);
          result.data[i + 1] = Math.round((buf.data[i + 1] * srcAf + result.data[i + 1] * dstAf * (1 - srcAf)) / outAf);
          result.data[i + 2] = Math.round((buf.data[i + 2] * srcAf + result.data[i + 2] * dstAf * (1 - srcAf)) / outAf);
          result.data[i + 3] = Math.round(outAf * 255);
        }
      }
    }
  }

  return result;
}
