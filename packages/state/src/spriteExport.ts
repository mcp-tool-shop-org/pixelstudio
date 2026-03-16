import type { SpriteDocument, SpriteSheetMeta, SpriteSheetFrameMeta } from '@glyphstudio/domain';

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
