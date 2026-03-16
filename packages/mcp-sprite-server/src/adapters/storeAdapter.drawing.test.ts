import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeDrawPixels,
  storeDrawLine,
  storeFill,
  storeErasePixels,
  storeSamplePixel,
  storeAddFrame,
  storeAddLayer,
  storeSetActiveLayer,
  type HeadlessStore,
} from './storeAdapter.js';

describe('Drawing operations', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'DrawTest', 8, 8);
  });

  describe('storeDrawPixels', () => {
    it('draws a batch of pixels', () => {
      const result = storeDrawPixels(store, [
        { x: 0, y: 0, rgba: [255, 0, 0, 255] },
        { x: 1, y: 0, rgba: [0, 255, 0, 255] },
        { x: 2, y: 0, rgba: [0, 0, 255, 255] },
      ]);
      expect('bounds' in result).toBe(true);
      const { bounds } = result as { bounds: { minX: number; minY: number; maxX: number; maxY: number; pixelCount: number } };
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(2);
      expect(bounds.pixelCount).toBe(3);
      expect(store.getState().dirty).toBe(true);
    });

    it('skips out-of-bounds pixels silently', () => {
      const result = storeDrawPixels(store, [
        { x: -1, y: 0, rgba: [255, 0, 0, 255] },
        { x: 100, y: 0, rgba: [255, 0, 0, 255] },
        { x: 3, y: 3, rgba: [0, 255, 0, 255] },
      ]);
      expect('bounds' in result).toBe(true);
      expect((result as any).bounds.pixelCount).toBe(1);
    });

    it('verifies drawn pixels with sample', () => {
      storeDrawPixels(store, [{ x: 4, y: 4, rgba: [128, 64, 32, 200] }]);
      const sample = storeSamplePixel(store, 4, 4);
      expect('rgba' in sample).toBe(true);
      expect((sample as any).rgba).toEqual([128, 64, 32, 200]);
    });

    it('does not affect other layers', () => {
      // Add a second layer
      storeAddLayer(store);
      const state = store.getState();
      const frame = state.document!.frames[0];
      const layer0 = frame.layers[0].id;
      const layer1 = frame.layers[1].id;

      // Draw on layer1 (active)
      storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);

      // Sample layer0 — should still be transparent
      const sample0 = storeSamplePixel(store, 0, 0, layer0);
      expect((sample0 as any).rgba).toEqual([0, 0, 0, 0]);

      // Sample layer1 — should be red
      const sample1 = storeSamplePixel(store, 0, 0, layer1);
      expect((sample1 as any).rgba).toEqual([255, 0, 0, 255]);
    });

    it('returns error when no document', () => {
      const empty = createHeadlessStore();
      const result = storeDrawPixels(empty, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
      expect('error' in result).toBe(true);
    });
  });

  describe('storeDrawLine', () => {
    it('draws a horizontal line', () => {
      const result = storeDrawLine(store, 0, 0, 4, 0, [255, 255, 255, 255]);
      expect('bounds' in result).toBe(true);
      expect((result as any).bounds.pixelCount).toBe(5);

      // Verify all points
      for (let x = 0; x <= 4; x++) {
        const s = storeSamplePixel(store, x, 0);
        expect((s as any).rgba).toEqual([255, 255, 255, 255]);
      }
    });

    it('draws a diagonal line', () => {
      const result = storeDrawLine(store, 0, 0, 3, 3, [255, 0, 0, 255]);
      expect('bounds' in result).toBe(true);
      expect((result as any).bounds.pixelCount).toBe(4);
    });
  });

  describe('storeFill', () => {
    it('fills a contiguous region', () => {
      const result = storeFill(store, 0, 0, [255, 0, 0, 255]);
      expect('filled' in result).toBe(true);

      // Every pixel should be red (entire canvas was transparent)
      const s = storeSamplePixel(store, 7, 7);
      expect((s as any).rgba).toEqual([255, 0, 0, 255]);
    });

    it('fills only contiguous pixels', () => {
      // Draw a barrier
      storeDrawLine(store, 0, 4, 7, 4, [0, 0, 0, 255]);
      // Fill top half
      storeFill(store, 0, 0, [255, 0, 0, 255]);
      // Bottom should still be transparent
      const bottom = storeSamplePixel(store, 0, 5);
      expect((bottom as any).rgba).toEqual([0, 0, 0, 0]);
    });

    it('rejects out-of-bounds coordinates', () => {
      const result = storeFill(store, -1, 0, [255, 0, 0, 255]);
      expect('error' in result).toBe(true);
    });
  });

  describe('storeErasePixels', () => {
    it('erases pixels to transparent', () => {
      storeDrawPixels(store, [{ x: 3, y: 3, rgba: [255, 0, 0, 255] }]);
      storeErasePixels(store, [{ x: 3, y: 3 }]);
      const s = storeSamplePixel(store, 3, 3);
      expect((s as any).rgba).toEqual([0, 0, 0, 0]);
    });
  });

  describe('storeSamplePixel', () => {
    it('returns color of a drawn pixel', () => {
      storeDrawPixels(store, [{ x: 1, y: 1, rgba: [10, 20, 30, 40] }]);
      const result = storeSamplePixel(store, 1, 1);
      expect((result as any).rgba).toEqual([10, 20, 30, 40]);
    });

    it('returns transparent for blank pixel', () => {
      const result = storeSamplePixel(store, 0, 0);
      expect((result as any).rgba).toEqual([0, 0, 0, 0]);
    });

    it('returns error for out-of-bounds', () => {
      const result = storeSamplePixel(store, -1, 0);
      expect('error' in result).toBe(true);
    });

    it('does not modify any state', () => {
      const before = store.getState().dirty;
      storeSamplePixel(store, 0, 0);
      expect(store.getState().dirty).toBe(before);
    });
  });

  describe('frame/layer targeting', () => {
    it('draws on a specific layer by ID', () => {
      storeAddLayer(store);
      const frame = store.getState().document!.frames[0];
      const layer0Id = frame.layers[0].id;

      // Draw on layer0 explicitly (not active — active is layer1)
      storeDrawPixels(store, [{ x: 0, y: 0, rgba: [0, 255, 0, 255] }], layer0Id);

      const sample = storeSamplePixel(store, 0, 0, layer0Id);
      expect((sample as any).rgba).toEqual([0, 255, 0, 255]);
    });

    it('non-targeted frames remain unchanged', () => {
      storeAddFrame(store);
      // Now on frame 1 — draw there
      storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);

      // Switch back to frame 0 and check
      const frame0Layer = store.getState().document!.frames[0].layers[0].id;
      const sample = storeSamplePixel(store, 0, 0, frame0Layer);
      expect((sample as any).rgba).toEqual([0, 0, 0, 0]);
    });
  });
});
