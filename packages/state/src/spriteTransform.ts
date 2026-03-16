/**
 * Sprite transforms — whole-canvas operations that produce new pixel buffers.
 *
 * All functions are pure: they return new buffers, never mutate inputs.
 * Rotate direction: clockwise (CW). 90 CW = right turn.
 * Resize anchor: top-left origin. Crop trims bottom-right. Extend fills with transparent.
 */

import type { SpritePixelBuffer } from '@glyphstudio/domain';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { getPixelIndex } from './spriteRaster';

export type RotationAngle = 90 | 180 | 270;
export type FlipDirection = 'horizontal' | 'vertical';

/**
 * Rotate a pixel buffer clockwise by 90, 180, or 270 degrees.
 * 90 and 270 swap width/height. 180 preserves dimensions.
 */
export function rotateBuffer(buffer: SpritePixelBuffer, angle: RotationAngle): SpritePixelBuffer {
  const { width: srcW, height: srcH, data: srcData } = buffer;

  if (angle === 180) {
    // 180°: reverse all pixels
    const result = createBlankPixelBuffer(srcW, srcH);
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = getPixelIndex(x, y, srcW);
        const dstIdx = getPixelIndex(srcW - 1 - x, srcH - 1 - y, srcW);
        result.data[dstIdx] = srcData[srcIdx];
        result.data[dstIdx + 1] = srcData[srcIdx + 1];
        result.data[dstIdx + 2] = srcData[srcIdx + 2];
        result.data[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }
    return result;
  }

  // 90° CW or 270° CW — dimensions swap
  const dstW = srcH;
  const dstH = srcW;
  const result = createBlankPixelBuffer(dstW, dstH);

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const srcIdx = getPixelIndex(x, y, srcW);
      let dstX: number, dstY: number;

      if (angle === 90) {
        // 90° CW: (x, y) → (srcH - 1 - y, x)
        dstX = srcH - 1 - y;
        dstY = x;
      } else {
        // 270° CW: (x, y) → (y, srcW - 1 - x)
        dstX = y;
        dstY = srcW - 1 - x;
      }

      const dstIdx = getPixelIndex(dstX, dstY, dstW);
      result.data[dstIdx] = srcData[srcIdx];
      result.data[dstIdx + 1] = srcData[srcIdx + 1];
      result.data[dstIdx + 2] = srcData[srcIdx + 2];
      result.data[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }

  return result;
}

/**
 * Resize a pixel buffer. Top-left anchored.
 * - If new dimensions are smaller: crops from bottom-right.
 * - If new dimensions are larger: extends with transparent pixels.
 * - Existing content is preserved at its original position.
 */
export function resizeBuffer(
  buffer: SpritePixelBuffer,
  newWidth: number,
  newHeight: number,
): SpritePixelBuffer {
  if (newWidth < 1 || newHeight < 1) {
    throw new Error(`Invalid resize dimensions: ${newWidth}x${newHeight}`);
  }
  if (newWidth === buffer.width && newHeight === buffer.height) {
    // No-op: return clone
    return { width: buffer.width, height: buffer.height, data: new Uint8ClampedArray(buffer.data) };
  }

  const result = createBlankPixelBuffer(newWidth, newHeight);
  const copyW = Math.min(buffer.width, newWidth);
  const copyH = Math.min(buffer.height, newHeight);

  for (let y = 0; y < copyH; y++) {
    const srcStart = getPixelIndex(0, y, buffer.width);
    const dstStart = getPixelIndex(0, y, newWidth);
    result.data.set(
      buffer.data.subarray(srcStart, srcStart + copyW * 4),
      dstStart,
    );
  }

  return result;
}
