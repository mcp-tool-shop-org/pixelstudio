/**
 * Sprite analysis — deterministic, pure functions for inspecting pixel buffers.
 *
 * No store dependency. Operates on SpritePixelBuffer directly.
 */

import type { SpritePixelBuffer } from '@glyphstudio/domain';
import { getPixelIndex } from './spriteRaster';

// ── Types ──

export interface SpriteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  /** Total number of non-transparent pixels. */
  opaquePixelCount: number;
  /** True if the buffer is entirely transparent. */
  empty: boolean;
}

export interface SpriteColorEntry {
  rgba: [number, number, number, number];
  /** CSS hex string: #RRGGBBAA */
  hex: string;
  count: number;
}

export interface SpriteColorAnalysis {
  uniqueColors: number;
  /** Sorted descending by count (most frequent first). */
  histogram: SpriteColorEntry[];
  opaquePixelCount: number;
  transparentPixelCount: number;
  totalPixels: number;
}

export interface SpriteFrameDiff {
  /** Number of pixels that differ between the two buffers. */
  changedPixelCount: number;
  /** Total pixels compared. */
  totalPixels: number;
  /** Bounding box of changed region, or null if identical. */
  changedBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** True if the two buffers are identical. */
  identical: boolean;
  /** Percentage of pixels that changed (0–100, 2 decimal places). */
  changedPercent: number;
}

// ── Helpers ──

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  return '#' + [r, g, b, a].map((c) => c.toString(16).padStart(2, '0')).join('');
}

function rgbaToKey(r: number, g: number, b: number, a: number): number {
  // Pack RGBA into a single 32-bit integer for fast Map keying
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

// ── Analysis functions ──

/**
 * Find the bounding box of non-transparent pixels in a buffer.
 * Returns exact bounds with opaque pixel count.
 */
export function analyzeSpriteBounds(buffer: SpritePixelBuffer): SpriteBounds {
  const { width, height, data } = buffer;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaqueCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = getPixelIndex(x, y, width);
      if (data[i + 3] > 0) {
        opaqueCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (opaqueCount === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, opaquePixelCount: 0, empty: true };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    opaquePixelCount: opaqueCount,
    empty: false,
  };
}

/**
 * Count unique colors and produce a frequency histogram.
 * Exact counts, no fuzzy grouping.
 */
export function analyzeSpriteColors(buffer: SpritePixelBuffer): SpriteColorAnalysis {
  const { width, height, data } = buffer;
  const totalPixels = width * height;
  const colorMap = new Map<number, { r: number; g: number; b: number; a: number; count: number }>();
  let opaqueCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a > 0) opaqueCount++;

    const key = rgbaToKey(r, g, b, a);
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, a, count: 1 });
    }
  }

  const histogram: SpriteColorEntry[] = [];
  for (const entry of colorMap.values()) {
    histogram.push({
      rgba: [entry.r, entry.g, entry.b, entry.a],
      hex: rgbaToHex(entry.r, entry.g, entry.b, entry.a),
      count: entry.count,
    });
  }
  histogram.sort((a, b) => b.count - a.count);

  return {
    uniqueColors: colorMap.size,
    histogram,
    opaquePixelCount: opaqueCount,
    transparentPixelCount: totalPixels - opaqueCount,
    totalPixels,
  };
}

/**
 * Compare two pixel buffers and return an exact diff.
 * Buffers must have the same dimensions.
 */
export function compareFrames(
  a: SpritePixelBuffer,
  b: SpritePixelBuffer,
): SpriteFrameDiff {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`Cannot compare buffers of different dimensions: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }

  const { width, height } = a;
  const totalPixels = width * height;
  let changedCount = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = getPixelIndex(x, y, width);
      if (
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2] ||
        a.data[i + 3] !== b.data[i + 3]
      ) {
        changedCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const identical = changedCount === 0;
  return {
    changedPixelCount: changedCount,
    totalPixels,
    changedBounds: identical ? null : { minX, minY, maxX, maxY },
    identical,
    changedPercent: Math.round((changedCount / totalPixels) * 10000) / 100,
  };
}
