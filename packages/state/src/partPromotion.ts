/**
 * Part promotion — convert a selection buffer into a reusable Part.
 *
 * Pure function. Converts Uint8ClampedArray pixel data to number[]
 * for JSON/localStorage serialization.
 */

import type { SpritePixelBuffer } from '@glyphstudio/domain';
import type { Part } from '@glyphstudio/domain';
import { generatePartId } from '@glyphstudio/domain';

/**
 * Create a Part from a selection pixel buffer.
 *
 * Copies pixel data (does not alias the source buffer).
 * Sets timestamps to now.
 */
export function createPartFromSelection(
  selectionBuffer: SpritePixelBuffer,
  name: string,
): Part {
  const now = new Date().toISOString();
  return {
    id: generatePartId(),
    name,
    width: selectionBuffer.width,
    height: selectionBuffer.height,
    pixelData: Array.from(selectionBuffer.data),
    createdAt: now,
    updatedAt: now,
  };
}
