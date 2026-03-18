import type { SpriteDocument, SpritePixelBuffer, SpriteSheetMeta, SpriteSheetFrameMeta, PaletteSet } from '@glyphstudio/domain';
import { buildColorMap, remapFrameBuffers } from './paletteRemap';
import { flattenLayers } from './spriteRaster';
import { assembleSpriteSheet } from './spriteImportExport';

// gifenc has no type declarations — minimal typed imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/**
 * Generate JSON metadata for a horizontal sprite sheet export.
 *
 * Pure function — no side effects, no pixel data, no store access.
 * Takes the document structure and produces a manifest describing
 * frame positions and timing for runtimes to consume.
 *
 * Returns an error string if the document has no frames.
 */
export function generateSpriteSheetMeta(
  doc: SpriteDocument,
): SpriteSheetMeta | { error: string } {
  if (doc.frames.length === 0) {
    return { error: 'No frames to export' };
  }

  const frameWidth = doc.width;
  const frameHeight = doc.height;
  const frameCount = doc.frames.length;
  const sheetWidth = frameWidth * frameCount;
  const sheetHeight = frameHeight;

  const frames: SpriteSheetFrameMeta[] = doc.frames.map((f, i) => ({
    index: i,
    x: i * frameWidth,
    y: 0,
    w: frameWidth,
    h: frameHeight,
    durationMs: f.durationMs,
  }));

  return {
    format: 'glyphstudio-sprite-sheet',
    version: 1,
    name: doc.name,
    sheetWidth,
    sheetHeight,
    frameWidth,
    frameHeight,
    frameCount,
    layout: 'horizontal',
    frames,
  };
}

// ── GIF encoding ──

/**
 * Encode an animated GIF from flattened frame buffers and durations.
 *
 * Pure function — takes pre-flattened RGBA buffers (one per frame) and
 * per-frame durations. Returns a Uint8Array containing the GIF binary.
 *
 * Handles transparency: pixels with alpha === 0 are mapped to a
 * transparent index in the GIF palette.
 *
 * @param frameBuffers - Flattened RGBA pixel buffers, one per frame.
 * @param frameDurations - Duration in milliseconds for each frame.
 * @param loop - Whether the GIF loops. true = loop forever (default).
 * @returns Uint8Array of GIF binary data, or an error object.
 */
export function encodeAnimatedGif(
  frameBuffers: SpritePixelBuffer[],
  frameDurations: number[],
  loop: boolean = true,
): Uint8Array | { error: string } {
  if (frameBuffers.length === 0) {
    return { error: 'No frames to encode' };
  }
  if (frameBuffers.length !== frameDurations.length) {
    return { error: 'Frame buffer count does not match duration count' };
  }

  const width = frameBuffers[0].width;
  const height = frameBuffers[0].height;

  // Verify all frames have same dimensions
  for (let i = 1; i < frameBuffers.length; i++) {
    if (frameBuffers[i].width !== width || frameBuffers[i].height !== height) {
      return { error: `Frame ${i} dimensions (${frameBuffers[i].width}x${frameBuffers[i].height}) do not match frame 0 (${width}x${height})` };
    }
  }

  const gif = GIFEncoder({ auto: true });

  for (let i = 0; i < frameBuffers.length; i++) {
    const rgba = frameBuffers[i].data;
    const delay = frameDurations[i];

    // Check if any pixel has alpha < 255
    let hasTransparency = false;
    for (let p = 3; p < rgba.length; p += 4) {
      if (rgba[p] < 128) {
        hasTransparency = true;
        break;
      }
    }

    // Quantize RGBA to a 256-color palette
    // gifenc's quantize expects a flat RGBA array and max colors
    const maxColors = hasTransparency ? 255 : 256;
    const palette: number[][] = quantize(rgba, maxColors);

    if (hasTransparency) {
      // Append a transparent entry at the end of the palette
      palette.push([0, 0, 0]);
    }

    // Map each RGBA pixel to its palette index
    const index: Uint8Array = applyPalette(rgba, palette);

    // Override transparent pixels to point to the transparent index
    if (hasTransparency) {
      const transparentIndex = palette.length - 1;
      for (let p = 0; p < index.length; p++) {
        if (rgba[p * 4 + 3] < 128) {
          index[p] = transparentIndex;
        }
      }

      gif.writeFrame(index, width, height, {
        palette,
        delay,
        transparent: true,
        transparentIndex: palette.length - 1,
        repeat: loop ? 0 : -1,
        dispose: 2, // restore to background for transparency
      });
    } else {
      gif.writeFrame(index, width, height, {
        palette,
        delay,
        repeat: loop ? 0 : -1,
      });
    }
  }

  gif.finish();
  return gif.bytes();
}

// ── Multi-variant export ──

/** Sanitize a name for use in filenames. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

/** Result for a single variant export. */
export interface VariantExportEntry {
  paletteSetId: string;
  paletteSetName: string;
  suffix: string;
  sheet: SpritePixelBuffer;
  meta: SpriteSheetMeta;
}

/**
 * Generate sprite sheet exports for one or more palette set variants.
 *
 * For each palette set, remaps all frame buffers using the color map
 * from the document's base palette to the set's colors, then assembles
 * a sprite sheet with metadata.
 *
 * Returns an array of VariantExportEntry or an error string.
 */
export function generateVariantExports(
  doc: SpriteDocument,
  pixelBuffers: Record<string, SpritePixelBuffer>,
  paletteSetIds: string[],
): VariantExportEntry[] | { error: string } {
  if (doc.frames.length === 0) {
    return { error: 'No frames to export' };
  }
  if (paletteSetIds.length === 0) {
    return { error: 'No palette sets selected' };
  }

  const paletteSets = doc.paletteSets ?? [];
  const results: VariantExportEntry[] = [];

  for (const psId of paletteSetIds) {
    const ps = paletteSets.find((p) => p.id === psId);
    if (!ps) {
      return { error: `Palette set "${psId}" not found` };
    }

    const colorMap = buildColorMap(doc.palette.colors, ps.colors);
    const remappedBuffers = colorMap.size > 0
      ? remapFrameBuffers(doc.frames, pixelBuffers, colorMap, 0, doc.frames.length - 1)
      : pixelBuffers;

    // Flatten layers for each frame
    const frameBuffers = doc.frames.map((f) =>
      flattenLayers(f.layers, remappedBuffers, doc.width, doc.height),
    );

    const sheet = assembleSpriteSheet(frameBuffers);
    if ('error' in sheet) return sheet;

    const meta = generateSpriteSheetMeta(doc);
    if ('error' in meta) return meta;

    const suffix = sanitizeFilename(ps.name);
    results.push({
      paletteSetId: ps.id,
      paletteSetName: ps.name,
      suffix,
      sheet,
      meta: { ...meta, name: `${doc.name}-${suffix}` },
    });
  }

  return results;
}
