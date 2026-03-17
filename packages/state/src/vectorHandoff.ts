/**
 * Vector-to-sprite handoff — rasterizes a vector master at a chosen
 * size profile and produces a ready-to-edit SpriteDocument + pixel buffer.
 *
 * This is the bridge from the vector design workspace to the pixel
 * cleanup workspace. The handoff preserves provenance via VectorSourceLink.
 */

import type {
  VectorMasterDocument,
  SizeProfile,
  SpriteDocument,
  SpritePixelBuffer,
  SpriteColor,
  VectorSourceLink,
  Rgba,
} from '@glyphstudio/domain';
import { createSpriteDocument } from '@glyphstudio/domain';
import { rasterizeVectorMaster } from './vectorRasterize';

/** Result of a vector-to-sprite handoff. */
export interface VectorHandoffResult {
  /** The new sprite document (1 frame, 1 layer). */
  document: SpriteDocument;
  /** Pixel buffer for the first layer, keyed by layer ID. */
  pixelBuffers: Record<string, SpritePixelBuffer>;
  /** Provenance link back to the vector source. */
  sourceLink: VectorSourceLink;
}

/**
 * Extract unique opaque colors from a pixel buffer.
 * Returns SpriteColor entries suitable for the sprite palette.
 */
export function extractPaletteFromBuffer(buf: SpritePixelBuffer): SpriteColor[] {
  const seen = new Set<string>();
  const colors: SpriteColor[] = [
    { rgba: [0, 0, 0, 0] }, // index 0 = transparent
  ];

  for (let i = 0; i < buf.data.length; i += 4) {
    const a = buf.data[i + 3];
    if (a === 0) continue;
    const key = `${buf.data[i]},${buf.data[i + 1]},${buf.data[i + 2]},${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push({
      rgba: [buf.data[i], buf.data[i + 1], buf.data[i + 2], a] as Rgba,
    });
  }

  return colors;
}

/**
 * Perform the vector-to-sprite handoff.
 *
 * Rasterizes the vector master document at the given size profile,
 * creates a SpriteDocument with a single frame and layer containing
 * the rasterized pixels, and records provenance.
 *
 * @param doc - The vector master document
 * @param profile - Target size profile for rasterization
 * @param sourceFile - Path/ID of the source .glyphvec file (for provenance)
 * @returns Ready-to-load sprite document, pixel buffers, and source link
 */
export function vectorToSpriteHandoff(
  doc: VectorMasterDocument,
  profile: SizeProfile,
  sourceFile: string = '',
): VectorHandoffResult {
  // Rasterize the vector master at the target size
  const rasterized = rasterizeVectorMaster(doc, profile.targetWidth, profile.targetHeight);

  // Create a sprite document at the target dimensions
  const spriteName = `${doc.name} — ${profile.targetWidth}×${profile.targetHeight}`;
  const spriteDoc = createSpriteDocument(spriteName, profile.targetWidth, profile.targetHeight);

  // Extract palette from rasterized pixels
  const paletteColors = extractPaletteFromBuffer(rasterized);
  spriteDoc.palette = {
    colors: paletteColors,
    foregroundIndex: paletteColors.length > 1 ? 1 : 0,
    backgroundIndex: 0,
  };

  // Map the rasterized buffer to the first layer
  const firstLayer = spriteDoc.frames[0].layers[0];
  const pixelBuffers: Record<string, SpritePixelBuffer> = {
    [firstLayer.id]: rasterized,
  };

  // Create provenance link
  const sourceLink: VectorSourceLink = {
    sourceFile,
    sourceArtboardWidth: doc.artboardWidth,
    sourceArtboardHeight: doc.artboardHeight,
    profileId: profile.id,
    rasterizedAt: new Date().toISOString(),
  };

  return {
    document: spriteDoc,
    pixelBuffers,
    sourceLink,
  };
}
