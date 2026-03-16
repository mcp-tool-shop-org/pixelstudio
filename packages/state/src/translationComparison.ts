/**
 * Translation comparison utilities.
 *
 * Provides tools for concept→sprite translation analysis:
 * - Nearest-neighbor downscale (for reference only — NOT the intended workflow)
 * - Silhouette survival analysis (does the read survive at target resolution?)
 * - Side-by-side comparison layout generation
 * - Scale factor calculations
 */

import type { Rgba } from './spriteRaster';
import { getPixelIndex, isInBounds, silhouetteBuffer } from './spriteRaster';
import type { SpritePixelBuffer } from '@glyphstudio/domain';
import { createBlankPixelBuffer } from '@glyphstudio/domain';

/** Result of comparing concept silhouette vs sprite silhouette. */
export interface SilhouetteSurvivalResult {
  /** Percentage of concept silhouette pixels that map to filled sprite pixels (0–100) */
  coveragePercent: number;
  /** Number of filled pixels in concept silhouette (at target resolution) */
  conceptFilledCount: number;
  /** Number of filled pixels in sprite silhouette */
  spriteFilledCount: number;
  /** Target dimensions used */
  targetWidth: number;
  targetHeight: number;
  /** Scale factor from concept to target */
  scaleFactor: number;
}

/**
 * Nearest-neighbor downsample a buffer to target dimensions.
 * This is for REFERENCE comparison only — real translation is manual reinterpretation.
 */
export function nearestNeighborDownscale(
  source: SpritePixelBuffer,
  targetWidth: number,
  targetHeight: number,
): SpritePixelBuffer {
  const result = createBlankPixelBuffer(targetWidth, targetHeight);
  const scaleX = source.width / targetWidth;
  const scaleY = source.height / targetHeight;

  for (let ty = 0; ty < targetHeight; ty++) {
    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = Math.floor(tx * scaleX);
      const sy = Math.floor(ty * scaleY);
      const si = getPixelIndex(sx, sy, source.width);
      const ti = getPixelIndex(tx, ty, targetWidth);
      result.data[ti] = source.data[si];
      result.data[ti + 1] = source.data[si + 1];
      result.data[ti + 2] = source.data[si + 2];
      result.data[ti + 3] = source.data[si + 3];
    }
  }
  return result;
}

/**
 * Count non-transparent pixels in a buffer.
 * A pixel is considered filled if alpha > 0.
 */
export function countFilledPixels(buffer: SpritePixelBuffer): number {
  let count = 0;
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const i = getPixelIndex(x, y, buffer.width);
      if (buffer.data[i + 3] > 0) count++;
    }
  }
  return count;
}

/**
 * Analyze whether the silhouette read survives translation to a smaller resolution.
 *
 * Compares:
 * - The concept downscaled to target resolution (what naive shrinking gives you)
 * - The hand-built sprite at target resolution (what the artist actually made)
 *
 * High coverage = silhouette survived. Low coverage = artist needed to reinterpret.
 */
export function analyzeSilhouetteSurvival(
  conceptBuffer: SpritePixelBuffer,
  spriteBuffer: SpritePixelBuffer,
  silhouetteColor: Rgba = [0, 0, 0, 255],
): SilhouetteSurvivalResult {
  const targetWidth = spriteBuffer.width;
  const targetHeight = spriteBuffer.height;
  const scaleFactor = targetWidth / conceptBuffer.width;

  // Downscale concept to sprite resolution for comparison
  const downscaled = nearestNeighborDownscale(conceptBuffer, targetWidth, targetHeight);

  // Generate silhouettes for both
  const conceptSil = silhouetteBuffer(downscaled, silhouetteColor);
  const spriteSil = silhouetteBuffer(spriteBuffer, silhouetteColor);

  const conceptFilledCount = countFilledPixels(conceptSil);
  const spriteFilledCount = countFilledPixels(spriteSil);

  // Count overlap — sprite pixels that are also filled in the concept silhouette
  let overlapCount = 0;
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const i = getPixelIndex(x, y, targetWidth);
      const conceptFilled = conceptSil.data[i + 3] > 0;
      const spriteFilled = spriteSil.data[i + 3] > 0;
      if (conceptFilled && spriteFilled) overlapCount++;
    }
  }

  const maxFilled = Math.max(conceptFilledCount, spriteFilledCount, 1);
  const coveragePercent = Math.round((overlapCount / maxFilled) * 100);

  return {
    coveragePercent,
    conceptFilledCount,
    spriteFilledCount,
    targetWidth,
    targetHeight,
    scaleFactor,
  };
}

/**
 * Compute the integer scale factor for upscaling a sprite to sit alongside a concept.
 * The sprite is upscaled to approximately match the concept height.
 */
export function computeComparisonScale(
  conceptHeight: number,
  spriteHeight: number,
): number {
  if (spriteHeight <= 0) return 1;
  return Math.max(1, Math.floor(conceptHeight / spriteHeight));
}

/**
 * Upscale a buffer by an integer factor (pixel-perfect, no interpolation).
 * Each source pixel becomes a scale×scale block.
 */
export function pixelPerfectUpscale(
  source: SpritePixelBuffer,
  scale: number,
): SpritePixelBuffer {
  if (scale <= 1) {
    // Clone to avoid aliasing
    const clone = createBlankPixelBuffer(source.width, source.height);
    clone.data.set(source.data);
    return clone;
  }

  const tw = source.width * scale;
  const th = source.height * scale;
  const result = createBlankPixelBuffer(tw, th);

  for (let sy = 0; sy < source.height; sy++) {
    for (let sx = 0; sx < source.width; sx++) {
      const si = getPixelIndex(sx, sy, source.width);
      const r = source.data[si];
      const g = source.data[si + 1];
      const b = source.data[si + 2];
      const a = source.data[si + 3];

      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ti = getPixelIndex(sx * scale + dx, sy * scale + dy, tw);
          result.data[ti] = r;
          result.data[ti + 1] = g;
          result.data[ti + 2] = b;
          result.data[ti + 3] = a;
        }
      }
    }
  }
  return result;
}

/**
 * Generate a side-by-side comparison image:
 * [concept] [gap] [sprite upscaled to match] [gap] [concept silhouette] [gap] [sprite silhouette upscaled]
 *
 * The sprite is pixel-perfect upscaled so both halves are visually comparable.
 */
export function generateComparisonLayout(
  conceptBuffer: SpritePixelBuffer,
  spriteBuffer: SpritePixelBuffer,
  options: {
    gap?: number;
    silhouetteColor?: Rgba;
    backgroundColor?: Rgba;
    includesilhouettes?: boolean;
  } = {},
): SpritePixelBuffer {
  const {
    gap = 8,
    silhouetteColor = [0, 0, 0, 255],
    backgroundColor = [40, 40, 40, 255],
    includesilhouettes = true,
  } = options;

  const scale = computeComparisonScale(conceptBuffer.height, spriteBuffer.height);
  const upscaled = pixelPerfectUpscale(spriteBuffer, scale);

  const panels: SpritePixelBuffer[] = [conceptBuffer, upscaled];

  if (includesilhouettes) {
    const conceptSil = silhouetteBuffer(conceptBuffer, silhouetteColor);
    const spriteSilRaw = silhouetteBuffer(spriteBuffer, silhouetteColor);
    const spriteSilUp = pixelPerfectUpscale(spriteSilRaw, scale);
    panels.push(conceptSil, spriteSilUp);
  }

  // Calculate total dimensions
  const maxHeight = Math.max(...panels.map((p) => p.height));
  const totalWidth = panels.reduce((sum, p) => sum + p.width, 0) + gap * (panels.length - 1);
  const result = createBlankPixelBuffer(totalWidth, maxHeight);

  // Fill background
  for (let y = 0; y < maxHeight; y++) {
    for (let x = 0; x < totalWidth; x++) {
      const i = getPixelIndex(x, y, totalWidth);
      result.data[i] = backgroundColor[0];
      result.data[i + 1] = backgroundColor[1];
      result.data[i + 2] = backgroundColor[2];
      result.data[i + 3] = backgroundColor[3];
    }
  }

  // Blit each panel
  let offsetX = 0;
  for (const panel of panels) {
    const yOffset = Math.floor((maxHeight - panel.height) / 2);
    for (let py = 0; py < panel.height; py++) {
      for (let px = 0; px < panel.width; px++) {
        const si = getPixelIndex(px, py, panel.width);
        const a = panel.data[si + 3];
        if (a === 0) continue;
        const tx = offsetX + px;
        const ty = yOffset + py;
        if (isInBounds(tx, ty, totalWidth, maxHeight)) {
          const ti = getPixelIndex(tx, ty, totalWidth);
          if (a === 255) {
            result.data[ti] = panel.data[si];
            result.data[ti + 1] = panel.data[si + 1];
            result.data[ti + 2] = panel.data[si + 2];
            result.data[ti + 3] = 255;
          } else {
            // Alpha blend over background
            const srcA = a / 255;
            const dstA = 1 - srcA;
            result.data[ti] = Math.round(panel.data[si] * srcA + result.data[ti] * dstA);
            result.data[ti + 1] = Math.round(panel.data[si + 1] * srcA + result.data[ti + 1] * dstA);
            result.data[ti + 2] = Math.round(panel.data[si + 2] * srcA + result.data[ti + 2] * dstA);
            result.data[ti + 3] = 255;
          }
        }
      }
    }
    offsetX += panel.width + gap;
  }

  return result;
}
