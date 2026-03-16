import type { SpritePixelBuffer } from '@glyphstudio/domain';
import { createBlankPixelBuffer } from '@glyphstudio/domain';

// ── Validation ──

export interface SheetValidationResult {
  valid: boolean;
  /** Error message if invalid. */
  error?: string;
  /** Number of columns in the sheet. */
  cols: number;
  /** Number of rows in the sheet. */
  rows: number;
  /** Total frame count. */
  frameCount: number;
}

/**
 * Validate that a sprite sheet's dimensions are compatible with the given frame size.
 *
 * Requirements:
 * - All dimensions must be positive integers.
 * - Sheet width must be evenly divisible by frame width.
 * - Sheet height must be evenly divisible by frame height.
 */
export function validateSheetDimensions(
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameHeight: number,
): SheetValidationResult {
  const fail = (error: string): SheetValidationResult => ({
    valid: false,
    error,
    cols: 0,
    rows: 0,
    frameCount: 0,
  });

  if (frameWidth <= 0 || frameHeight <= 0) {
    return fail('Frame dimensions must be positive');
  }
  if (sheetWidth <= 0 || sheetHeight <= 0) {
    return fail('Sheet dimensions must be positive');
  }
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) {
    return fail('Frame dimensions must be integers');
  }
  if (!Number.isInteger(sheetWidth) || !Number.isInteger(sheetHeight)) {
    return fail('Sheet dimensions must be integers');
  }
  if (sheetWidth % frameWidth !== 0) {
    return fail(`Sheet width ${sheetWidth} is not divisible by frame width ${frameWidth}`);
  }
  if (sheetHeight % frameHeight !== 0) {
    return fail(`Sheet height ${sheetHeight} is not divisible by frame height ${frameHeight}`);
  }

  const cols = sheetWidth / frameWidth;
  const rows = sheetHeight / frameHeight;
  return { valid: true, cols, rows, frameCount: cols * rows };
}

// ── Slicing ──

/**
 * Slice a sprite sheet into individual frame buffers.
 *
 * Slicing order: left-to-right, top-to-bottom (row-major).
 * Frame 0 is the top-left cell, frame 1 is one cell to the right, etc.
 *
 * Returns null with an error message if dimensions are incompatible.
 */
export function sliceSpriteSheet(
  sheetData: Uint8ClampedArray,
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameHeight: number,
): { frames: SpritePixelBuffer[] } | { error: string } {
  const validation = validateSheetDimensions(sheetWidth, sheetHeight, frameWidth, frameHeight);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  if (sheetData.length !== sheetWidth * sheetHeight * 4) {
    return { error: `Sheet data length ${sheetData.length} does not match dimensions ${sheetWidth}x${sheetHeight}` };
  }

  const { cols, rows, frameCount } = validation;
  const frames: SpritePixelBuffer[] = [];

  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const buf = createBlankPixelBuffer(frameWidth, frameHeight);

    for (let py = 0; py < frameHeight; py++) {
      const srcRow = row * frameHeight + py;
      const srcOffset = (srcRow * sheetWidth + col * frameWidth) * 4;
      const dstOffset = py * frameWidth * 4;
      buf.data.set(
        sheetData.subarray(srcOffset, srcOffset + frameWidth * 4),
        dstOffset,
      );
    }

    frames.push(buf);
  }

  return { frames };
}

// ── Assembly ──

/**
 * Assemble frame buffers into a single sprite sheet buffer.
 *
 * Layout: horizontal strip (all frames in one row).
 * Sheet width = frameWidth × frameCount, height = frameHeight.
 *
 * Frame order matches the input array order exactly.
 */
export function assembleSpriteSheet(
  frames: SpritePixelBuffer[],
): SpritePixelBuffer | { error: string } {
  if (frames.length === 0) {
    return { error: 'No frames to assemble' };
  }

  const frameWidth = frames[0].width;
  const frameHeight = frames[0].height;

  // Verify all frames have same dimensions
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].width !== frameWidth || frames[i].height !== frameHeight) {
      return { error: `Frame ${i} dimensions (${frames[i].width}x${frames[i].height}) do not match frame 0 (${frameWidth}x${frameHeight})` };
    }
  }

  const sheetWidth = frameWidth * frames.length;
  const sheetHeight = frameHeight;
  const sheet = createBlankPixelBuffer(sheetWidth, sheetHeight);

  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi];
    for (let py = 0; py < frameHeight; py++) {
      const srcOffset = py * frameWidth * 4;
      const dstOffset = (py * sheetWidth + fi * frameWidth) * 4;
      sheet.data.set(
        frame.data.subarray(srcOffset, srcOffset + frameWidth * 4),
        dstOffset,
      );
    }
  }

  return sheet;
}

/**
 * Check if a result is an error (has an `error` property).
 */
export function isImportExportError(result: unknown): result is { error: string } {
  return typeof result === 'object' && result !== null && 'error' in result;
}
