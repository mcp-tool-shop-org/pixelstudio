import type { SpriteDocument, SpritePixelBuffer, SpritePalette, SpriteFrame, SpriteLayer } from '@glyphstudio/domain';

/** Current schema version for .glyph files. */
export const GLYPH_SCHEMA_VERSION = 1;

/** Format identifier for .glyph files. */
export const GLYPH_FORMAT = 'glyphstudio-sprite';

// ── Base64 helpers ──

/** Encode a Uint8ClampedArray to a base64 string. */
export function encodePixelData(data: Uint8ClampedArray): string {
  // Build a binary string from the byte array
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/** Decode a base64 string back to a Uint8ClampedArray. */
export function decodePixelData(base64: string): Uint8ClampedArray {
  const binary = atob(base64);
  const bytes = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Serialized types ──

/** Serialized pixel buffer — data stored as base64 string. */
interface SerializedPixelBuffer {
  width: number;
  height: number;
  data: string; // base64
}

/** Top-level .glyph file structure. */
interface GlyphFile {
  format: typeof GLYPH_FORMAT;
  schemaVersion: number;
  document: SpriteDocument;
  pixelBuffers: Record<string, SerializedPixelBuffer>;
}

// ── Serialize ──

/**
 * Serialize a sprite document and pixel buffers to a .glyph JSON string.
 *
 * Pure function — no I/O, no store access.
 */
export function serializeSpriteFile(
  doc: SpriteDocument,
  pixelBuffers: Record<string, SpritePixelBuffer>,
): string {
  const serializedBuffers: Record<string, SerializedPixelBuffer> = {};

  for (const [key, buf] of Object.entries(pixelBuffers)) {
    serializedBuffers[key] = {
      width: buf.width,
      height: buf.height,
      data: encodePixelData(buf.data),
    };
  }

  const file: GlyphFile = {
    format: GLYPH_FORMAT,
    schemaVersion: GLYPH_SCHEMA_VERSION,
    document: {
      ...doc,
      updatedAt: new Date().toISOString(),
    },
    pixelBuffers: serializedBuffers,
  };

  return JSON.stringify(file, null, 2);
}

// ── Deserialize ──

/**
 * Deserialize a .glyph JSON string back to a document and pixel buffers.
 *
 * Validates format identifier and schema version.
 * Returns an error object if the file is invalid.
 */
export function deserializeSpriteFile(
  json: string,
): { document: SpriteDocument; pixelBuffers: Record<string, SpritePixelBuffer> } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { error: 'Invalid JSON' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { error: 'File is not a valid object' };
  }

  const file = parsed as Record<string, unknown>;

  // Validate format
  if (file.format !== GLYPH_FORMAT) {
    return { error: `Unknown format: ${String(file.format)}. Expected "${GLYPH_FORMAT}"` };
  }

  // Validate schema version
  const version = file.schemaVersion;
  if (typeof version !== 'number' || version < 1) {
    return { error: 'Invalid schema version' };
  }
  if (version > GLYPH_SCHEMA_VERSION) {
    return { error: `Schema version ${version} is newer than supported (${GLYPH_SCHEMA_VERSION}). Please update GlyphStudio.` };
  }

  // Validate document
  const doc = file.document;
  if (typeof doc !== 'object' || doc === null) {
    return { error: 'Missing or invalid document' };
  }

  const document = doc as SpriteDocument;

  // Backward compatibility: default paletteSets for older files
  if (!Array.isArray(document.paletteSets)) {
    document.paletteSets = [];
  }
  if (document.activePaletteSetId === undefined) {
    document.activePaletteSetId = null;
  }
  // Backward compatibility: default variants for older files
  if (!Array.isArray(document.variants)) {
    document.variants = [];
  }
  if (document.activeVariantId === undefined) {
    document.activeVariantId = null;
  }

  // Basic document validation
  if (!document.id || typeof document.id !== 'string') {
    return { error: 'Document missing id' };
  }
  if (!document.name || typeof document.name !== 'string') {
    return { error: 'Document missing name' };
  }
  if (typeof document.width !== 'number' || typeof document.height !== 'number') {
    return { error: 'Document missing dimensions' };
  }
  if (!Array.isArray(document.frames) || document.frames.length === 0) {
    return { error: 'Document must have at least one frame' };
  }

  // Decode pixel buffers
  const rawBuffers = file.pixelBuffers;
  if (typeof rawBuffers !== 'object' || rawBuffers === null) {
    return { error: 'Missing or invalid pixelBuffers' };
  }

  const pixelBuffers: Record<string, SpritePixelBuffer> = {};

  for (const [key, val] of Object.entries(rawBuffers as Record<string, unknown>)) {
    const buf = val as { width?: number; height?: number; data?: string };
    if (typeof buf.width !== 'number' || typeof buf.height !== 'number' || typeof buf.data !== 'string') {
      return { error: `Invalid pixel buffer for key "${key}"` };
    }

    try {
      const data = decodePixelData(buf.data);
      const expectedLength = buf.width * buf.height * 4;
      if (data.length !== expectedLength) {
        return { error: `Pixel buffer "${key}" data length ${data.length} does not match dimensions ${buf.width}x${buf.height} (expected ${expectedLength})` };
      }
      pixelBuffers[key] = { width: buf.width, height: buf.height, data };
    } catch {
      return { error: `Failed to decode pixel data for key "${key}"` };
    }
  }

  return { document, pixelBuffers };
}
