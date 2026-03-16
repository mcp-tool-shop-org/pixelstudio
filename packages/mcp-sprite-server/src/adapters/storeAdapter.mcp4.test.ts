/**
 * Tests for MCP.4 — analysis, transforms, and missing editor primitives.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeDrawPixels,
  storeAddFrame,
  storeAnalyzeBounds,
  storeAnalyzeColors,
  storeCompareFrames,
  storeFlipCanvas,
  storeRotateCanvas,
  storeResizeCanvas,
  storeDuplicateFrame,
  storeMoveFrame,
  storeDuplicateLayer,
  storeMoveLayer,
  storeUndo,
  storeGetHistorySummary,
  storeGetDocumentSummary,
} from './storeAdapter.js';
import type { HeadlessStore } from './storeAdapter.js';
import { samplePixel } from '@glyphstudio/state';

describe('storeAnalyzeBounds', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 8, 8);
  });

  it('returns empty bounds for blank frame', () => {
    const result = storeAnalyzeBounds(store);
    expect(typeof result).not.toBe('string');
    if (typeof result === 'string') return;
    expect(result.empty).toBe(true);
    expect(result.opaquePixelCount).toBe(0);
  });

  it('finds bounds of drawn pixels', () => {
    storeDrawPixels(store, [
      { x: 1, y: 2, rgba: [255, 0, 0, 255] },
      { x: 5, y: 6, rgba: [0, 255, 0, 255] },
    ]);
    const result = storeAnalyzeBounds(store);
    if (typeof result === 'string') throw new Error(result);
    expect(result.minX).toBe(1);
    expect(result.minY).toBe(2);
    expect(result.maxX).toBe(5);
    expect(result.maxY).toBe(6);
    expect(result.opaquePixelCount).toBe(2);
  });

  it('analyzes specific frame by index', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeAddFrame(store);
    // Frame 1 is blank
    const result = storeAnalyzeBounds(store, 1);
    if (typeof result === 'string') throw new Error(result);
    expect(result.empty).toBe(true);
  });
});

describe('storeAnalyzeColors', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('counts unique colors', () => {
    storeDrawPixels(store, [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 1, y: 0, rgba: [255, 0, 0, 255] },
      { x: 2, y: 0, rgba: [0, 255, 0, 255] },
    ]);
    const result = storeAnalyzeColors(store);
    if (typeof result === 'string') throw new Error(result);
    expect(result.uniqueColors).toBe(3); // red, green, transparent
    expect(result.opaquePixelCount).toBe(3);
    expect(result.transparentPixelCount).toBe(13);
  });
});

describe('storeCompareFrames', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 8, 8);
    storeAddFrame(store);
  });

  it('detects identical blank frames', () => {
    store.setState({ activeFrameIndex: 0 });
    const result = storeCompareFrames(store, 0, 1);
    if (typeof result === 'string') throw new Error(result);
    expect(result.identical).toBe(true);
  });

  it('detects differences between frames', () => {
    store.setState({ activeFrameIndex: 0 });
    const doc = store.getState().document!;
    const layerId = doc.frames[0].layers[0].id;
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }], layerId);

    const result = storeCompareFrames(store, 0, 1);
    if (typeof result === 'string') throw new Error(result);
    expect(result.identical).toBe(false);
    expect(result.changedPixelCount).toBe(1);
  });
});

describe('storeFlipCanvas', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('flips all buffers horizontally', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeFlipCanvas(store, 'horizontal');

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 3, 0)).toEqual([255, 0, 0, 255]);
    expect(samplePixel(buf, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('flips all buffers vertically', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeFlipCanvas(store, 'vertical');

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 0, 3)).toEqual([255, 0, 0, 255]);
    expect(samplePixel(buf, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('supports undo', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeFlipCanvas(store, 'horizontal');
    storeUndo(store);

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 0, 0)).toEqual([255, 0, 0, 255]);
  });
});

describe('storeRotateCanvas', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 2);
  });

  it('rotates 90° CW — swaps dimensions', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeRotateCanvas(store, 90);

    const doc = store.getState().document!;
    expect(doc.width).toBe(2);
    expect(doc.height).toBe(4);

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 1, 0)).toEqual([255, 0, 0, 255]);
  });

  it('rotates 180° — preserves dimensions', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeRotateCanvas(store, 180);

    const doc = store.getState().document!;
    expect(doc.width).toBe(4);
    expect(doc.height).toBe(2);

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 3, 1)).toEqual([255, 0, 0, 255]);
  });

  it('supports undo — restores original dimensions', () => {
    storeRotateCanvas(store, 90);
    expect(store.getState().document!.width).toBe(2);
    storeUndo(store);
    expect(store.getState().document!.width).toBe(4);
    expect(store.getState().document!.height).toBe(2);
  });
});

describe('storeResizeCanvas', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('grows canvas — preserves existing pixels', () => {
    storeDrawPixels(store, [{ x: 1, y: 1, rgba: [255, 0, 0, 255] }]);
    storeResizeCanvas(store, 8, 8);

    const doc = store.getState().document!;
    expect(doc.width).toBe(8);
    expect(doc.height).toBe(8);

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(samplePixel(buf, 7, 7)).toEqual([0, 0, 0, 0]);
  });

  it('shrinks canvas — crops bottom-right', () => {
    storeDrawPixels(store, [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 3, y: 3, rgba: [0, 255, 0, 255] },
    ]);
    storeResizeCanvas(store, 2, 2);

    const buf = store.getState().pixelBuffers[store.getState().activeLayerId!];
    expect(samplePixel(buf, 0, 0)).toEqual([255, 0, 0, 255]);
    // (3,3) is gone
    expect(buf.width).toBe(2);
  });

  it('supports undo', () => {
    storeResizeCanvas(store, 8, 8);
    storeUndo(store);
    expect(store.getState().document!.width).toBe(4);
    expect(store.getState().document!.height).toBe(4);
  });
});

describe('storeDuplicateFrame', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('duplicates active frame with pixel data', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeDuplicateFrame(store);

    const doc = store.getState().document!;
    expect(doc.frames.length).toBe(2);
    expect(store.getState().activeFrameIndex).toBe(1);

    // New frame should have the same pixel data
    const newLayerId = doc.frames[1].layers[0].id;
    const buf = store.getState().pixelBuffers[newLayerId];
    expect(samplePixel(buf, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('supports undo', () => {
    storeDuplicateFrame(store);
    expect(store.getState().document!.frames.length).toBe(2);
    storeUndo(store);
    expect(store.getState().document!.frames.length).toBe(1);
  });
});

describe('storeMoveFrame', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
    storeAddFrame(store);
    storeAddFrame(store);
    // Now 3 frames, active at index 2
  });

  it('moves frame to a different position', () => {
    // Draw on frame 2 so we can track it
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    const frame2Id = store.getState().document!.frames[2].id;

    storeMoveFrame(store, 2, 0);
    // Frame that was at index 2 should now be at index 0
    expect(store.getState().document!.frames[0].id).toBe(frame2Id);
  });

  it('rejects out-of-range indices', () => {
    const err = storeMoveFrame(store, 5, 0);
    expect(err).toContain('out of range');
  });
});

describe('storeDuplicateLayer', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('duplicates active layer with pixel data', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeDuplicateLayer(store);

    const doc = store.getState().document!;
    expect(doc.frames[0].layers.length).toBe(2);

    // New layer should have the same pixel data
    const newLayerId = doc.frames[0].layers[1].id;
    const buf = store.getState().pixelBuffers[newLayerId];
    expect(samplePixel(buf, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('names the copy with " copy" suffix', () => {
    storeDuplicateLayer(store);
    const layers = store.getState().document!.frames[0].layers;
    expect(layers[1].name).toBe('Layer 1 copy');
  });

  it('supports undo', () => {
    storeDuplicateLayer(store);
    expect(store.getState().document!.frames[0].layers.length).toBe(2);
    storeUndo(store);
    expect(store.getState().document!.frames[0].layers.length).toBe(1);
  });
});

describe('storeMoveLayer', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
    // Add a second layer
    storeDuplicateLayer(store);
  });

  it('moves layer to a different position', () => {
    const layers = store.getState().document!.frames[0].layers;
    const topLayerId = layers[1].id;

    storeMoveLayer(store, 1, 0);
    const updated = store.getState().document!.frames[0].layers;
    expect(updated[0].id).toBe(topLayerId);
  });

  it('rejects out-of-range indices', () => {
    const err = storeMoveLayer(store, 5, 0);
    expect(err).toContain('out of range');
  });
});
