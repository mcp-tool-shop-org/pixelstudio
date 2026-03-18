/**
 * Palette remap engine — pure functions for recoloring pixel buffers.
 *
 * Exact RGBA matching only (no fuzzy/heuristic recoloring in v1).
 * Unmatched pixels pass through unchanged. Transparency preserved.
 */

import type { SpritePixelBuffer, SpriteColor, SpriteFrame } from '@glyphstudio/domain';
import { clonePixelBuffer, type Rgba } from './spriteRaster';

/** Serialize an RGBA tuple to a string key for map lookups. */
export function rgbaKey(rgba: Rgba): string {
  return `${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]}`;
}

/**
 * Build a color mapping from source palette to target palette.
 *
 * Maps each source color (by index) to the corresponding target color.
 * Only includes entries where the colors actually differ.
 * Target colors beyond source length are ignored.
 * Source colors beyond target length are unmapped (pass through).
 */
export function buildColorMap(
  sourceColors: SpriteColor[],
  targetColors: SpriteColor[],
): Map<string, Rgba> {
  const map = new Map<string, Rgba>();
  const count = Math.min(sourceColors.length, targetColors.length);

  for (let i = 0; i < count; i++) {
    const src = sourceColors[i].rgba;
    const dst = targetColors[i].rgba;
    // Skip identity mappings
    if (src[0] === dst[0] && src[1] === dst[1] && src[2] === dst[2] && src[3] === dst[3]) {
      continue;
    }
    map.set(rgbaKey(src), dst);
  }

  return map;
}

/**
 * Remap pixel buffer colors using a color map.
 *
 * Returns a new buffer — does not mutate the input.
 * Fully transparent pixels (alpha === 0) always pass through unchanged.
 * Pixels with no matching entry in the color map pass through unchanged.
 */
export function remapPixelBuffer(
  buffer: SpritePixelBuffer,
  colorMap: Map<string, Rgba>,
): SpritePixelBuffer {
  if (colorMap.size === 0) return clonePixelBuffer(buffer);

  const result = clonePixelBuffer(buffer);
  const { data, width, height } = result;
  const len = width * height * 4;

  for (let i = 0; i < len; i += 4) {
    // Skip fully transparent pixels
    if (data[i + 3] === 0) continue;

    const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
    const target = colorMap.get(key);
    if (target) {
      data[i] = target[0];
      data[i + 1] = target[1];
      data[i + 2] = target[2];
      data[i + 3] = target[3];
    }
  }

  return result;
}

/**
 * Remap pixel buffers for all layers across a range of frames.
 *
 * Returns a new pixelBuffers record with only the remapped entries replaced.
 * Does not mutate the input.
 */
export function remapFrameBuffers(
  frames: SpriteFrame[],
  pixelBuffers: Record<string, SpritePixelBuffer>,
  colorMap: Map<string, Rgba>,
  startFrame: number,
  endFrame: number,
): Record<string, SpritePixelBuffer> {
  if (colorMap.size === 0) return pixelBuffers;

  const result = { ...pixelBuffers };
  const start = Math.max(0, startFrame);
  const end = Math.min(frames.length - 1, endFrame);

  for (let i = start; i <= end; i++) {
    const frame = frames[i];
    for (const layer of frame.layers) {
      const buf = pixelBuffers[layer.id];
      if (buf) {
        result[layer.id] = remapPixelBuffer(buf, colorMap);
      }
    }
  }

  return result;
}
