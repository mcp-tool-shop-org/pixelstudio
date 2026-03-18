import { describe, it, expect } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { setPixel } from './spriteRaster';
import type { Rgba } from './spriteRaster';
import { createPartFromSelection } from './partPromotion';

const RED: Rgba = [255, 0, 0, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

describe('partPromotion', () => {
  describe('createPartFromSelection', () => {
    it('creates a Part with correct dimensions', () => {
      const buf = createBlankPixelBuffer(8, 6);
      const part = createPartFromSelection(buf, 'Head');
      expect(part.width).toBe(8);
      expect(part.height).toBe(6);
      expect(part.name).toBe('Head');
    });

    it('copies pixel data to number array', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, RED);
      const part = createPartFromSelection(buf, 'Red Dot');
      expect(part.pixelData.length).toBe(2 * 2 * 4);
      // Verify red pixel at position 0
      expect(part.pixelData[0]).toBe(255);
      expect(part.pixelData[1]).toBe(0);
      expect(part.pixelData[2]).toBe(0);
      expect(part.pixelData[3]).toBe(255);
    });

    it('does not alias the source buffer', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, RED);
      const part = createPartFromSelection(buf, 'Copy');
      // Mutate the part data — source should be unaffected
      part.pixelData[0] = 0;
      expect(buf.data[0]).toBe(255);
    });

    it('preserves transparent pixels', () => {
      const buf = createBlankPixelBuffer(2, 2);
      // Default is transparent
      const part = createPartFromSelection(buf, 'Transparent');
      expect(part.pixelData[0]).toBe(0);
      expect(part.pixelData[1]).toBe(0);
      expect(part.pixelData[2]).toBe(0);
      expect(part.pixelData[3]).toBe(0);
    });

    it('generates unique ID and timestamps', () => {
      const buf = createBlankPixelBuffer(1, 1);
      const part = createPartFromSelection(buf, 'Test');
      expect(part.id).toMatch(/^part_/);
      expect(part.createdAt).toBeTruthy();
      expect(part.updatedAt).toBeTruthy();
    });

    it('two calls produce different IDs', () => {
      const buf = createBlankPixelBuffer(1, 1);
      const p1 = createPartFromSelection(buf, 'A');
      const p2 = createPartFromSelection(buf, 'B');
      expect(p1.id).not.toBe(p2.id);
    });
  });
});
