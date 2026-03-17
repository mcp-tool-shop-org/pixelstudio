/**
 * Vector regeneration — re-rasterize a sprite from its vector source.
 *
 * When a sprite was created via handoff from a vector master, this module
 * provides the ability to re-rasterize from the source, replacing the
 * sprite's pixel data while preserving the document structure.
 */

import type {
  VectorMasterDocument,
  SpritePixelBuffer,
  VectorSourceLink,
  SizeProfile,
} from '@glyphstudio/domain';
import { rasterizeVectorMaster } from './vectorRasterize';
import { extractPaletteFromBuffer } from './vectorHandoff';

/** Result of a regeneration attempt. */
export interface RegenerateResult {
  /** Whether regeneration succeeded. */
  success: boolean;
  /** Error message if it failed. */
  error?: string;
  /** The new pixel buffer (only if success). */
  pixelBuffer?: SpritePixelBuffer;
  /** Updated source link (only if success). */
  updatedLink?: VectorSourceLink;
}

/**
 * Re-rasterize a sprite from its vector master source.
 *
 * @param vectorDoc - The current vector master document
 * @param sourceLink - The existing source link from the sprite
 * @param profiles - Available size profiles (to find the target profile)
 * @returns RegenerateResult with the new pixel buffer or error
 */
export function regenerateFromVector(
  vectorDoc: VectorMasterDocument | null,
  sourceLink: VectorSourceLink | null,
  profiles: readonly SizeProfile[],
): RegenerateResult {
  if (!sourceLink) {
    return { success: false, error: 'No vector source link — this sprite was not created from a vector master.' };
  }

  if (!vectorDoc) {
    return { success: false, error: 'Vector master document is not open. Open the source document first.' };
  }

  const profile = profiles.find((p) => p.id === sourceLink.profileId);
  if (!profile) {
    return { success: false, error: `Size profile "${sourceLink.profileId}" not found. It may have been removed.` };
  }

  const pixelBuffer = rasterizeVectorMaster(vectorDoc, profile.targetWidth, profile.targetHeight);

  const updatedLink: VectorSourceLink = {
    ...sourceLink,
    rasterizedAt: new Date().toISOString(),
  };

  return {
    success: true,
    pixelBuffer,
    updatedLink,
  };
}

/**
 * Check if regeneration is available for a given source link.
 *
 * Returns a human-readable status message.
 */
export function checkRegenerationStatus(
  vectorDoc: VectorMasterDocument | null,
  sourceLink: VectorSourceLink | null,
): { canRegenerate: boolean; reason: string } {
  if (!sourceLink) {
    return { canRegenerate: false, reason: 'No vector source link.' };
  }
  if (!vectorDoc) {
    return { canRegenerate: false, reason: 'Vector master not open.' };
  }
  return { canRegenerate: true, reason: 'Ready to regenerate.' };
}
