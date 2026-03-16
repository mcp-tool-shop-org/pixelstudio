import { describe, it, expect } from 'vitest';
import { pointerToPixel, getSpriteOrigin, pixelToCanvas } from './spriteCanvasMath';
import type { SpriteViewport } from './spriteCanvasMath';

function makeViewport(overrides: Partial<SpriteViewport> = {}): SpriteViewport {
  return {
    zoom: 8,
    panX: 0,
    panY: 0,
    spriteWidth: 16,
    spriteHeight: 16,
    canvasWidth: 256,
    canvasHeight: 256,
    ...overrides,
  };
}

describe('spriteCanvasMath', () => {
  describe('getSpriteOrigin', () => {
    it('centers sprite in canvas with no pan', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      // 16 * 8 = 128 sprite area, (256 - 128) / 2 = 64
      expect(originX).toBe(64);
      expect(originY).toBe(64);
    });

    it('applies pan offset', () => {
      const vp = makeViewport({ panX: 20, panY: -10 });
      const { originX, originY } = getSpriteOrigin(vp);
      expect(originX).toBe(64 + 20);
      expect(originY).toBe(64 - 10);
    });
  });

  describe('pointerToPixel', () => {
    it('maps center of first pixel correctly', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pointerToPixel(originX + 4, originY + 4, vp);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('maps second pixel correctly', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pointerToPixel(originX + 8 + 1, originY + 1, vp);
      expect(result).toEqual({ x: 1, y: 0 });
    });

    it('maps last pixel correctly', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pointerToPixel(originX + 15 * 8 + 1, originY + 15 * 8 + 1, vp);
      expect(result).toEqual({ x: 15, y: 15 });
    });

    it('returns null for pointer left of sprite', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      expect(pointerToPixel(originX - 1, originY, vp)).toBeNull();
    });

    it('returns null for pointer below sprite', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      expect(pointerToPixel(originX, originY + 16 * 8, vp)).toBeNull();
    });

    it('handles zoom 1', () => {
      const vp = makeViewport({ zoom: 1 });
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pointerToPixel(originX + 5, originY + 3, vp);
      expect(result).toEqual({ x: 5, y: 3 });
    });

    it('handles pan offset', () => {
      const vp = makeViewport({ panX: 100, panY: -50 });
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pointerToPixel(originX + 1, originY + 1, vp);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('same pointer position always resolves to same pixel', () => {
      const vp = makeViewport();
      const result1 = pointerToPixel(100, 100, vp);
      const result2 = pointerToPixel(100, 100, vp);
      expect(result1).toEqual(result2);
    });
  });

  describe('pixelToCanvas', () => {
    it('maps pixel (0,0) to sprite origin', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pixelToCanvas(0, 0, vp);
      expect(result.screenX).toBe(originX);
      expect(result.screenY).toBe(originY);
    });

    it('maps pixel (1,0) to one zoom step right', () => {
      const vp = makeViewport();
      const { originX, originY } = getSpriteOrigin(vp);
      const result = pixelToCanvas(1, 0, vp);
      expect(result.screenX).toBe(originX + 8);
      expect(result.screenY).toBe(originY);
    });
  });
});
