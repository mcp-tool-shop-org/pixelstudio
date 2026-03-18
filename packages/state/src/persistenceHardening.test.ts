/**
 * Persistence hardening tests — save/load edge cases for authored structures.
 *
 * Verifies backward compatibility, migration defaults, and roundtrip
 * integrity for all authored structure types.
 */

import { describe, it, expect } from 'vitest';
import { createSpriteDocument, createBlankPixelBuffer } from '@glyphstudio/domain';
import type { SpriteDocument, SpritePixelBuffer } from '@glyphstudio/domain';
import { serializeSpriteFile, deserializeSpriteFile, GLYPH_FORMAT, GLYPH_SCHEMA_VERSION } from './spritePersistence';
import { setPixel, samplePixel } from './spriteRaster';

function makeDoc(): { doc: SpriteDocument; pixelBuffers: Record<string, SpritePixelBuffer> } {
  const doc = createSpriteDocument('test', 4, 4);
  const layerId = doc.frames[0].layers[0].id;
  const buf = createBlankPixelBuffer(4, 4);
  setPixel(buf, 0, 0, [255, 0, 0, 255]);
  return { doc, pixelBuffers: { [layerId]: buf } };
}

describe('Persistence Hardening', () => {
  describe('backward compatibility — missing optional fields', () => {
    it('loads file without paletteSets field', () => {
      const { doc, pixelBuffers } = makeDoc();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const parsed = JSON.parse(json);
      delete parsed.document.paletteSets;
      delete parsed.document.activePaletteSetId;
      const result = deserializeSpriteFile(JSON.stringify(parsed));
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.paletteSets).toEqual([]);
      expect(result.document.activePaletteSetId).toBeNull();
    });

    it('loads file without variants field', () => {
      const { doc, pixelBuffers } = makeDoc();
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

    it('loads file without both new fields', () => {
      const { doc, pixelBuffers } = makeDoc();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const parsed = JSON.parse(json);
      delete parsed.document.paletteSets;
      delete parsed.document.activePaletteSetId;
      delete parsed.document.variants;
      delete parsed.document.activeVariantId;
      const result = deserializeSpriteFile(JSON.stringify(parsed));
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.paletteSets).toEqual([]);
      expect(result.document.variants).toEqual([]);
    });
  });

  describe('authored structure roundtrip', () => {
    it('preserves palette sets through save/load', () => {
      const { doc, pixelBuffers } = makeDoc();
      doc.paletteSets = [
        { id: 'ps1', name: 'Warm', colors: [{ rgba: [255, 128, 0, 255], name: 'Orange' }] },
        { id: 'ps2', name: 'Cool', colors: [{ rgba: [0, 128, 255, 255] }] },
      ];
      doc.activePaletteSetId = 'ps1';

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.paletteSets).toHaveLength(2);
      expect(result.document.paletteSets![0].colors[0].name).toBe('Orange');
      expect(result.document.activePaletteSetId).toBe('ps1');
    });

    it('preserves variants with pixel buffers through save/load', () => {
      const { doc, pixelBuffers } = makeDoc();
      const varLayerId = 'var-layer';
      const varBuf = createBlankPixelBuffer(4, 4);
      setPixel(varBuf, 2, 2, [0, 255, 0, 255]);
      pixelBuffers[varLayerId] = varBuf;

      doc.variants = [{
        id: 'v1', name: 'Left',
        frames: [{
          id: 'vf1', index: 0, durationMs: 100,
          layers: [{ id: varLayerId, name: 'Layer 1', visible: true, index: 0 }],
        }],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }];

      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.variants).toHaveLength(1);
      expect(samplePixel(result.pixelBuffers[varLayerId], 2, 2)).toEqual([0, 255, 0, 255]);
    });

    it('preserves frame timing through save/load', () => {
      const { doc, pixelBuffers } = makeDoc();
      doc.frames[0].durationMs = 250;
      const json = serializeSpriteFile(doc, pixelBuffers);
      const result = deserializeSpriteFile(json);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.document.frames[0].durationMs).toBe(250);
    });
  });

  describe('error resilience', () => {
    it('rejects corrupted pixel buffer data gracefully', () => {
      const { doc, pixelBuffers } = makeDoc();
      const json = serializeSpriteFile(doc, pixelBuffers);
      const parsed = JSON.parse(json);
      const layerId = doc.frames[0].layers[0].id;
      parsed.pixelBuffers[layerId].width = 999; // mismatch
      const result = deserializeSpriteFile(JSON.stringify(parsed));
      expect('error' in result).toBe(true);
    });

    it('rejects missing document', () => {
      const result = deserializeSpriteFile(JSON.stringify({
        format: GLYPH_FORMAT,
        schemaVersion: GLYPH_SCHEMA_VERSION,
        pixelBuffers: {},
      }));
      expect('error' in result).toBe(true);
    });

    it('rejects empty frames', () => {
      const result = deserializeSpriteFile(JSON.stringify({
        format: GLYPH_FORMAT,
        schemaVersion: GLYPH_SCHEMA_VERSION,
        document: { id: 'x', name: 'x', width: 4, height: 4, frames: [], palette: {}, createdAt: '', updatedAt: '' },
        pixelBuffers: {},
      }));
      expect('error' in result).toBe(true);
    });
  });
});
