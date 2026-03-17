/**
 * Visual Copilot — Ollama vision integration.
 *
 * Handles the "What does this read as?" question by sending a
 * rasterized canvas image to Ollama's vision model.
 *
 * Ollama-first, local-only, no cloud APIs.
 */

import type { SpritePixelBuffer } from '@glyphstudio/domain';

// ── Types ──

export interface OllamaVisionConfig {
  /** Ollama API base URL (default: http://localhost:11434). */
  baseUrl: string;
  /** Vision model to use (default: llava). */
  model: string;
  /** Request timeout in ms (default: 30000). */
  timeoutMs: number;
}

export const DEFAULT_OLLAMA_CONFIG: OllamaVisionConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'llava',
  timeoutMs: 30000,
};

export interface VisionResponse {
  /** What the model thinks the image depicts. */
  description: string;
  /** Whether the request succeeded. */
  ok: boolean;
  /** Error message if failed. */
  error: string | null;
  /** Model used. */
  model: string;
  /** Response time in ms. */
  responseTimeMs: number;
}

// ── Pixel buffer to base64 PNG ──

/**
 * Convert a raw RGBA pixel buffer to a base64-encoded PNG.
 *
 * Uses a minimal PNG encoder (no external deps).
 * Ollama's /api/generate accepts base64 images.
 */
export function pixelBufferToBase64Png(buf: SpritePixelBuffer): string {
  const { width, height, data } = buf;

  // Build raw image data with filter byte per row
  const rawRows: number[] = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawRows.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
  }

  // Deflate (store-only, no compression — simple and correct)
  const rawData = new Uint8Array(rawRows);
  const deflated = deflateStore(rawData);

  // Build PNG file
  const chunks: Uint8Array[] = [];

  // Signature
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(pngChunk('IHDR', ihdr));

  // IDAT
  chunks.push(pngChunk('IDAT', deflated));

  // IEND
  chunks.push(pngChunk('IEND', new Uint8Array(0)));

  // Concatenate
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const png = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }

  // Base64 encode
  return uint8ToBase64(png);
}

// ── PNG helpers ──

function writeU32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeU32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeU32BE(chunk, 8 + data.length, crc);
  return chunk;
}

/** Deflate with store-only blocks (no compression). */
function deflateStore(data: Uint8Array): Uint8Array {
  // zlib header (CM=8, CINFO=7, FCHECK) + store blocks + adler32
  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(data.length / maxBlockSize) || 1;
  const out = new Uint8Array(2 + numBlocks * 5 + data.length + 4);
  let pos = 0;

  // zlib header
  out[pos++] = 0x78; // CMF
  out[pos++] = 0x01; // FLG (FCHECK)

  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlockSize;
    const end = Math.min(start + maxBlockSize, data.length);
    const blockLen = end - start;
    const isLast = i === numBlocks - 1;

    out[pos++] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE=00 (store)
    out[pos++] = blockLen & 0xff;
    out[pos++] = (blockLen >>> 8) & 0xff;
    out[pos++] = ~blockLen & 0xff;
    out[pos++] = (~blockLen >>> 8) & 0xff;
    out.set(data.subarray(start, end), pos);
    pos += blockLen;
  }

  // Adler-32 checksum
  const adler = adler32(data);
  writeU32BE(out, pos, adler);
  pos += 4;

  return out.subarray(0, pos);
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

// CRC32 lookup table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

// ── Ollama API ──

/**
 * Ask Ollama vision "What does this read as?" for a sprite.
 *
 * Sends the rasterized pixel buffer as a PNG to the local Ollama API.
 */
export async function askVisionWhatDoesThisReadAs(
  buf: SpritePixelBuffer,
  config: OllamaVisionConfig = DEFAULT_OLLAMA_CONFIG,
): Promise<VisionResponse> {
  const startTime = Date.now();

  try {
    const base64Image = pixelBufferToBase64Png(buf);

    const prompt = [
      'You are analyzing a pixel art sprite designed for a 2D game.',
      'This image is a small sprite that has been upscaled for visibility.',
      'What character, creature, or object does this look like?',
      'What are its most distinctive visual features?',
      'Is the silhouette clear and readable?',
      'Answer in 2-3 concise sentences.',
    ].join(' ');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        images: [base64Image],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      return {
        description: '',
        ok: false,
        error: `Ollama returned ${response.status}: ${text.slice(0, 200)}`,
        model: config.model,
        responseTimeMs: Date.now() - startTime,
      };
    }

    const json = await response.json();

    return {
      description: json.response?.trim() ?? '',
      ok: true,
      error: null,
      model: config.model,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      description: '',
      ok: false,
      error: message.includes('abort')
        ? `Ollama timed out after ${config.timeoutMs}ms`
        : `Ollama connection failed: ${message}`,
      model: config.model,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Check if Ollama is running and the vision model is available.
 */
export async function checkOllamaAvailability(
  config: OllamaVisionConfig = DEFAULT_OLLAMA_CONFIG,
): Promise<{ available: boolean; models: string[]; error: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.baseUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { available: false, models: [], error: `Ollama returned ${response.status}` };
    }

    const json = await response.json();
    const models: string[] = (json.models ?? []).map((m: { name: string }) => m.name);

    return {
      available: models.some((m) => m.startsWith(config.model)),
      models,
      error: null,
    };
  } catch (err: unknown) {
    return {
      available: false,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
