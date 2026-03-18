import { describe, it, expect } from 'vitest';
import {
  createSpriteDocument,
  createSpriteFrame,
  createSpriteLayer,
  createBlankPixelBuffer,
} from '@glyphstudio/domain';
import type { SpriteDocument, SpritePixelBuffer } from '@glyphstudio/domain';
import {
  serializeSpriteFile,
  deserializeSpriteFile,
  encodePixelData,
  decodePixelData,
  GLYPH_FORMAT,
  GLYPH_SCHEMA_VERSION,
} from './spritePersistence';
import { setPixel, samplePixel } from './spriteRaster';
import type { Rgba } from './spriteRaster';

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];

/** Create a doc with pixel buffers for testing. */
function makeTestDocWithBuffers() {
  const doc = createSpriteDocument('test-sprite', 4, 4);
  const layerId = doc.frames[0].layers[0].id;
  const buf = createBlankPixelBuffer(4, 4);
  setPixel(buf, 0, 0, RED);
  setPixel(buf, 1, 1, GREEN);
  const pixelBuffers: Record<string, SpritePixelBuffer> = { [layerId]: buf };
  return { doc, pixelBuffers, layerId };
}

describe('spritePersistence', () => {
  // ── Base64 helpers ──

  describe('encodePixelData / decodePixelData', () => {
    it('roundtrips a small buffer', () => {
      const original = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128]);
      const encoded = encodePixelData(original);
      expect(typeof encoded).toBe('string');
      const decoded = decodePixelData(encoded);
      expect(decoded).toEqual(original);
    });

    it('roundtrips an empty buffer', () => {
      const original = new Uint8ClampedArray(0);
      const decoded = decodePixelData(encodePixelData(original));
      expect(decoded.length).toBe(0);
    });

    it('roundtrips a full 4x4 pixel buffer', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 2, 3, RED);
      const decoded = decodePixelData(encodePixelData(buf.data));
      expect(decoded).toEqual(buf.data);
    });
  });

  // ── Serialize / Deserialize roundtrip ──

  describe('serializeSpriteFile / deserializeSpriteFile', () => {
    it('roundtrips a basic document', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;

      expect(result.document.name).toBe('test-sprite');
      expect(result.document.width).toBe(4);
      expect(result.document.height).toBe(4);
      expect(result.document.frames).toHaveLength(1);
    });

    it('preserves pixel data', () => {
      const { doc, pixelBuffers, layerId } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;

      const restoredBuf = result.pixelBuffers[layerId];
      expect(restoredBuf).toBeDefined();
      expect(samplePixel(restoredBuf, 0, 0)).toEqual(RED);
      expect(samplePixel(restoredBuf, 1, 1)).toEqual(GREEN);
      expect(samplePixel(restoredBuf, 2, 2)).toEqual([0, 0, 0, 0]);
    });

    it('preserves frame durations', () => {
      const doc = createSpriteDocument('timing', 4, 4);
      doc.frames[0].durationMs = 250;
      const layerId = doc.frames[0].layers[0].id;
      const pixelBuffers = { [layerId]: createBlankPixelBuffer(4, 4) };

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.frames[0].durationMs).toBe(250);
    });

    it('preserves palette', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      doc.palette.colors[1].rgba = [42, 84, 126, 255];
      doc.palette.foregroundIndex = 3;

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.palette.colors[1].rgba).toEqual([42, 84, 126, 255]);
      expect(result.document.palette.foregroundIndex).toBe(3);
    });

    it('preserves layer names and visibility', () => {
      const doc = createSpriteDocument('layers', 4, 4);
      const frame = doc.frames[0];
      frame.layers[0].name = 'Background';
      frame.layers[0].visible = false;
      const secondLayer = createSpriteLayer(1, 'Foreground');
      frame.layers.push(secondLayer);

      const pixelBuffers: Record<string, SpritePixelBuffer> = {
        [frame.layers[0].id]: createBlankPixelBuffer(4, 4),
        [secondLayer.id]: createBlankPixelBuffer(4, 4),
      };

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.frames[0].layers).toHaveLength(2);
      expect(result.document.frames[0].layers[0].name).toBe('Background');
      expect(result.document.frames[0].layers[0].visible).toBe(false);
      expect(result.document.frames[0].layers[1].name).toBe('Foreground');
    });

    it('roundtrips multiple frames with multiple layers', () => {
      const doc = createSpriteDocument('multi', 4, 4);
      const f0 = doc.frames[0];
      const f1 = createSpriteFrame(1, 200);
      const f1Layer2 = createSpriteLayer(1, 'Overlay');
      f1.layers.push(f1Layer2);
      doc.frames.push(f1);

      const pixelBuffers: Record<string, SpritePixelBuffer> = {
        [f0.layers[0].id]: createBlankPixelBuffer(4, 4),
        [f1.layers[0].id]: createBlankPixelBuffer(4, 4),
        [f1Layer2.id]: createBlankPixelBuffer(4, 4),
      };

      setPixel(pixelBuffers[f1Layer2.id], 3, 3, GREEN);

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.frames).toHaveLength(2);
      expect(result.document.frames[1].durationMs).toBe(200);
      expect(result.document.frames[1].layers).toHaveLength(2);
      expect(samplePixel(result.pixelBuffers[f1Layer2.id], 3, 3)).toEqual(GREEN);
    });

    it('output is valid JSON with format and version', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe(GLYPH_FORMAT);
      expect(parsed.schemaVersion).toBe(GLYPH_SCHEMA_VERSION);
    });
  });

  // ── Error handling ──

  describe('deserializeSpriteFile errors', () => {
    it('rejects invalid JSON', () => {
      const result = deserializeSpriteFile('not json');
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('Invalid JSON');
    });

    it('rejects wrong format', () => {
      const result = deserializeSpriteFile(JSON.stringify({
        format: 'something-else',
        schemaVersion: 1,
        document: {},
        pixelBuffers: {},
      }));
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('Unknown format');
    });

    it('rejects future schema version', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const patched = json.replace('"schemaVersion": 1', '"schemaVersion": 999');
      const result = deserializeSpriteFile(patched);
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('999');
    });

    it('rejects missing document', () => {
      const result = deserializeSpriteFile(JSON.stringify({
        format: GLYPH_FORMAT,
        schemaVersion: 1,
        pixelBuffers: {},
      }));
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('document');
    });

    it('rejects document without frames', () => {
      const result = deserializeSpriteFile(JSON.stringify({
        format: GLYPH_FORMAT,
        schemaVersion: 1,
        document: { id: 'x', name: 'x', width: 4, height: 4, frames: [], palette: {}, createdAt: '', updatedAt: '' },
        pixelBuffers: {},
      }));
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('at least one frame');
    });

    it('rejects pixel buffer with wrong data length', () => {
      const { doc, pixelBuffers, layerId } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      // Tamper with the width to create a mismatch
      const parsed = JSON.parse(json);
      parsed.pixelBuffers[layerId].width = 8; // wrong — data is for 4x4
      const result = deserializeSpriteFile(JSON.stringify(parsed));
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('data length');
    });
  });

  // ── Palette sets persistence ──

  describe('palette sets persistence', () => {
    it('roundtrips palette sets', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      doc.paletteSets = [
        { id: 'ps1', name: 'Warm', colors: [{ rgba: [255, 128, 0, 255], name: 'Orange' }] },
        { id: 'ps2', name: 'Cool', colors: [{ rgba: [0, 128, 255, 255], name: 'Sky' }] },
      ];
      doc.activePaletteSetId = 'ps1';

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.paletteSets).toHaveLength(2);
      expect(result.document.paletteSets![0].name).toBe('Warm');
      expect(result.document.paletteSets![1].name).toBe('Cool');
      expect(result.document.activePaletteSetId).toBe('ps1');
    });

    it('defaults paletteSets to empty array for older files', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      // Simulate older file without paletteSets
      const parsed = JSON.parse(json);
      delete parsed.document.paletteSets;
      delete parsed.document.activePaletteSetId;
      const result = deserializeSpriteFile(JSON.stringify(parsed));

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.paletteSets).toEqual([]);
      expect(result.document.activePaletteSetId).toBeNull();
    });
  });

  // ── Variants persistence ──

  describe('variants persistence', () => {
    it('defaults variants to empty array for older files', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const parsed = JSON.parse(json);
      delete parsed.document.variants;
      delete parsed.document.activeVariantId;
      const result = deserializeSpriteFile(JSON.stringify(parsed));

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.variants).toEqual([]);
      expect(result.document.activeVariantId).toBeNull();
    });

    it('roundtrips variants with pixel buffers', () => {
      const { doc, pixelBuffers } = makeTestDocWithBuffers();
      const variantLayerId = 'var-layer-1';
      const variantBuf = createBlankPixelBuffer(4, 4);
      setPixel(variantBuf, 2, 2, RED);
      pixelBuffers[variantLayerId] = variantBuf;

      doc.variants = [{
        id: 'var1',
        name: 'Walk Left',
        frames: [{
          id: 'vf1',
          index: 0,
          durationMs: 100,
          layers: [{ id: variantLayerId, name: 'Layer 1', visible: true, index: 0 }],
        }],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];
      doc.activeVariantId = 'var1';

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);

      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.variants).toHaveLength(1);
      expect(result.document.variants![0].name).toBe('Walk Left');
      expect(result.document.activeVariantId).toBe('var1');
      expect(samplePixel(result.pixelBuffers[variantLayerId], 2, 2)).toEqual(RED);
    });
  });
});
