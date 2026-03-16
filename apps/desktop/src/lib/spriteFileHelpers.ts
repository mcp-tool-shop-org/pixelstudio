import type { SpritePixelBuffer } from '@glyphstudio/domain';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

/** File filter for .glyph files in Tauri dialogs. */
const GLYPH_FILTER = { name: 'GlyphStudio Sprite', extensions: ['glyph'] };

/**
 * Save a sprite file using Tauri's native save dialog.
 *
 * If filePath is provided, saves directly without showing the dialog.
 * Returns the saved path, or null if the user cancelled.
 */
export async function saveSpriteFile(
  json: string,
  existingPath: string | null,
): Promise<string | null> {
  const filePath = existingPath ?? await save({
    filters: [GLYPH_FILTER],
    defaultPath: 'sprite.glyph',
  });
  if (!filePath) return null;

  await writeTextFile(filePath, json);
  return filePath;
}

/**
 * Save-as: always shows the dialog, even if a path already exists.
 */
export async function saveSpriteFileAs(json: string): Promise<string | null> {
  const filePath = await save({
    filters: [GLYPH_FILTER],
    defaultPath: 'sprite.glyph',
  });
  if (!filePath) return null;

  await writeTextFile(filePath, json);
  return filePath;
}

/**
 * Open a .glyph file using Tauri's native open dialog.
 * Returns { json, filePath } or null if the user cancelled.
 */
export async function openSpriteFile(): Promise<{ json: string; filePath: string } | null> {
  const selected = await open({
    filters: [GLYPH_FILTER],
    multiple: false,
  });
  if (!selected) return null;

  const filePath = typeof selected === 'string' ? selected : selected;
  const json = await readTextFile(filePath);
  return { json, filePath };
}

/**
 * Encode a pixel buffer as a PNG blob using an offscreen canvas.
 */
export function pixelBufferToPngBlob(buffer: SpritePixelBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas 2D context'));
      return;
    }
    const imageData = new ImageData(
      new Uint8ClampedArray(buffer.data),
      buffer.width,
      buffer.height,
    );
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG blob'));
      }
    }, 'image/png');
  });
}

/**
 * Decode an image file (PNG, etc.) into raw RGBA pixel data.
 * Returns the width, height, and pixel data.
 */
export function decodeImageFile(file: File): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get canvas 2D context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({
        data: imageData.data,
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image file'));
    };
    img.src = url;
  });
}

/**
 * Trigger a browser download for a blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
