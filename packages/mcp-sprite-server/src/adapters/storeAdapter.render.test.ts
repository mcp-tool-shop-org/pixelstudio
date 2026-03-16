/**
 * Tests for render, import/export adapter functions (MCP.3).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeDrawPixels,
  storeAddFrame,
  storeRenderFrame,
  storeRenderSheet,
  storeImportSheet,
  storeExportMetadataJson,
  storeExportSpriteSheet,
  storeExportGif,
  storeExportSheetWithMeta,
  storeAddLayer,
  storeToggleLayerVisibility,
} from './storeAdapter.js';
import type { HeadlessStore } from './storeAdapter.js';

describe('storeRenderFrame', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('renders the active frame', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    const result = storeRenderFrame(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.frameIndex).toBe(0);
    // Check the pixel at (0,0) is red
    expect(result.rgba[0]).toBe(255);
    expect(result.rgba[1]).toBe(0);
    expect(result.rgba[2]).toBe(0);
    expect(result.rgba[3]).toBe(255);
  });

  it('renders a specific frame by index', () => {
    storeAddFrame(store);
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [0, 255, 0, 255] }]);
    const result = storeRenderFrame(store, 1);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.frameIndex).toBe(1);
    expect(result.rgba[0]).toBe(0);
    expect(result.rgba[1]).toBe(255);
  });

  it('errors on out-of-range frame index', () => {
    const result = storeRenderFrame(store, 99);
    expect('error' in result).toBe(true);
  });

  it('errors with no document', () => {
    const empty = createHeadlessStore();
    const result = storeRenderFrame(empty);
    expect('error' in result).toBe(true);
  });

  it('excludes hidden layers from render', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeAddLayer(store);
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [0, 255, 0, 255] }]);
    // Hide top layer
    const state = store.getState();
    const frame = state.document!.frames[0];
    const topLayerId = frame.layers[frame.layers.length - 1].id;
    storeToggleLayerVisibility(store, topLayerId);

    const result = storeRenderFrame(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    // Should see red from bottom layer, not green from hidden top layer
    expect(result.rgba[0]).toBe(255);
    expect(result.rgba[1]).toBe(0);
  });
});

describe('storeRenderSheet', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('creates a horizontal sheet from all frames', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeAddFrame(store);
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [0, 255, 0, 255] }]);

    const result = storeRenderSheet(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.width).toBe(8); // 2 frames * 4px wide
    expect(result.height).toBe(4);
    expect(result.frameCount).toBe(2);
  });

  it('single frame sheet has same dimensions as frame', () => {
    const result = storeRenderSheet(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.frameCount).toBe(1);
  });
});

describe('storeImportSheet', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'Test', 4, 4);
  });

  it('imports a 2-frame sheet', () => {
    // Create a 8x4 sheet (2 frames of 4x4)
    const sheetData = new Uint8ClampedArray(8 * 4 * 4);
    // Frame 1: red at (0,0)
    sheetData[0] = 255; sheetData[3] = 255;
    // Frame 2: green at (0,0) — offset by 4*4 = 16 bytes for first pixel of frame 2
    const frame2Offset = 4 * 4; // 4px wide * 4 channels
    sheetData[frame2Offset + 1] = 255; sheetData[frame2Offset + 3] = 255;

    const result = storeImportSheet(store, sheetData, 8, 4, 4, 4);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.frameCount).toBe(2);

    // Verify frame 0 has the red pixel
    const f0 = storeRenderFrame(store, 0);
    expect('error' in f0).toBe(false);
    if ('error' in f0) return;
    expect(f0.rgba[0]).toBe(255);
    expect(f0.rgba[1]).toBe(0);

    // Verify frame 1 has the green pixel
    const f1 = storeRenderFrame(store, 1);
    expect('error' in f1).toBe(false);
    if ('error' in f1) return;
    expect(f1.rgba[0]).toBe(0);
    expect(f1.rgba[1]).toBe(255);
  });

  it('rejects dimension mismatch', () => {
    const sheetData = new Uint8ClampedArray(8 * 8 * 4);
    const result = storeImportSheet(store, sheetData, 8, 8, 8, 8);
    expect('error' in result).toBe(true);
  });

  it('round-trips through export then import', () => {
    storeDrawPixels(store, [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 1, y: 1, rgba: [0, 255, 0, 255] },
    ]);
    storeAddFrame(store);
    storeDrawPixels(store, [{ x: 2, y: 2, rgba: [0, 0, 255, 255] }]);

    // Export as sheet
    const sheet = storeExportSpriteSheet(store);
    expect('error' in sheet).toBe(false);
    if ('error' in sheet) return;

    // Create a fresh document and import
    storeNewDocument(store, 'Imported', 4, 4);
    const result = storeImportSheet(store, sheet.data, sheet.width, sheet.height, 4, 4);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.frameCount).toBe(2);

    // Verify frame 0 pixel
    const f0 = storeRenderFrame(store, 0);
    if ('error' in f0) return;
    expect(f0.rgba[0]).toBe(255); // red
    expect(f0.rgba[1]).toBe(0);

    // Verify frame 1 pixel
    const f1 = storeRenderFrame(store, 1);
    if ('error' in f1) return;
    const idx = (2 * 4 + 2) * 4; // (2,2) pixel
    expect(f1.rgba[idx + 2]).toBe(255); // blue
  });
});

describe('storeExportMetadataJson', () => {
  it('returns correct metadata structure', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'MetaTest', 16, 16);
    storeAddFrame(store);

    const result = storeExportMetadataJson(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.meta.format).toBe('glyphstudio-sprite-sheet');
    expect(result.meta.frameWidth).toBe(16);
    expect(result.meta.frameHeight).toBe(16);
    expect(result.meta.frameCount).toBe(2);
    expect(result.meta.sheetWidth).toBe(32);
    expect(result.meta.layout).toBe('horizontal');
    expect(result.meta.frames).toHaveLength(2);
    expect(result.meta.frames[0].x).toBe(0);
    expect(result.meta.frames[1].x).toBe(16);

    // JSON is valid
    const parsed = JSON.parse(result.json);
    expect(parsed.format).toBe('glyphstudio-sprite-sheet');
  });
});

describe('storeExportSheetWithMeta', () => {
  it('returns sheet buffer and metadata together', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Combo', 8, 8);
    storeAddFrame(store);

    const result = storeExportSheetWithMeta(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.sheet.width).toBe(16);
    expect(result.sheet.height).toBe(8);
    expect(result.meta.frameCount).toBe(2);
  });
});

describe('storeExportGif', () => {
  it('produces non-empty GIF bytes', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'GifTest', 4, 4);
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeAddFrame(store);
    storeDrawPixels(store, [{ x: 1, y: 1, rgba: [0, 255, 0, 255] }]);

    const result = storeExportGif(store);
    expect(result instanceof Uint8Array).toBe(true);
    if (!(result instanceof Uint8Array)) return;
    // GIF magic bytes
    expect(result[0]).toBe(0x47); // G
    expect(result[1]).toBe(0x49); // I
    expect(result[2]).toBe(0x46); // F
    expect(result.length).toBeGreaterThan(10);
  });
});

describe('transparency preservation', () => {
  it('preserves transparent pixels through render', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Trans', 4, 4);
    // Draw one pixel, rest should be transparent
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);

    const result = storeRenderFrame(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    // Pixel (1,0) should be fully transparent
    expect(result.rgba[4]).toBe(0);
    expect(result.rgba[5]).toBe(0);
    expect(result.rgba[6]).toBe(0);
    expect(result.rgba[7]).toBe(0);
  });
});

describe('view state exclusion', () => {
  it('render does not include view state in output', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'ViewTest', 4, 4);

    // Modify view state
    store.setState({ zoom: 32, panX: 100, panY: 200, showGrid: true });

    const result = storeRenderFrame(store);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    // Output is just pixel data — no zoom, pan, grid in the result
    expect(result).not.toHaveProperty('zoom');
    expect(result).not.toHaveProperty('panX');
    expect(result).not.toHaveProperty('showGrid');
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });
});
