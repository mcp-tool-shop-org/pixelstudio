import { describe, it, expect } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeCloseDocument,
  storeLoadDocument,
  storeSaveDocument,
  storeGetDocumentSummary,
  storeAddFrame,
  storeRemoveFrame,
  storeSetActiveFrame,
  storeSetFrameDuration,
  storeAddLayer,
  storeRemoveLayer,
  storeSetActiveLayer,
  storeToggleLayerVisibility,
  storeRenameLayer,
  storeSetForegroundColor,
  storeSetBackgroundColor,
  storeSwapColors,
} from './storeAdapter.js';

describe('HeadlessStore', () => {
  it('starts with null document', () => {
    const store = createHeadlessStore();
    expect(store.getState().document).toBeNull();
  });
});

describe('storeNewDocument', () => {
  it('creates a document with correct dimensions', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Test', 32, 32);
    const state = store.getState();
    expect(state.document).not.toBeNull();
    expect(state.document!.name).toBe('Test');
    expect(state.document!.width).toBe(32);
    expect(state.document!.height).toBe(32);
    expect(state.document!.frames).toHaveLength(1);
    expect(state.activeLayerId).not.toBeNull();
    expect(state.dirty).toBe(false);
  });
});

describe('storeCloseDocument', () => {
  it('resets to empty state', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Test', 16, 16);
    storeCloseDocument(store);
    expect(store.getState().document).toBeNull();
    expect(store.getState().activeLayerId).toBeNull();
  });
});

describe('storeGetDocumentSummary', () => {
  it('returns null when no document', () => {
    const store = createHeadlessStore();
    expect(storeGetDocumentSummary(store)).toBeNull();
  });

  it('returns structured summary with frames and layers', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'MySpriteDoc', 64, 48);
    const summary = storeGetDocumentSummary(store)!;
    expect(summary.name).toBe('MySpriteDoc');
    expect(summary.width).toBe(64);
    expect(summary.height).toBe(48);
    expect(summary.frameCount).toBe(1);
    expect(summary.frames[0].layerCount).toBe(1);
    expect(summary.frames[0].layers[0].name).toBe('Layer 1');
    expect(summary.palette.colorCount).toBe(10);
    expect(summary.dirty).toBe(false);
  });
});

describe('storeSaveDocument / storeLoadDocument', () => {
  it('roundtrips a document through save and load', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'RoundTrip', 16, 16);

    const saveResult = storeSaveDocument(store);
    expect('json' in saveResult).toBe(true);
    const json = (saveResult as { json: string }).json;

    // Load into a fresh store
    const store2 = createHeadlessStore();
    const err = storeLoadDocument(store2, json, '/test/roundtrip.glyph');
    expect(err).toBeNull();

    const summary = storeGetDocumentSummary(store2)!;
    expect(summary.name).toBe('RoundTrip');
    expect(summary.width).toBe(16);
    expect(summary.filePath).toBe('/test/roundtrip.glyph');
  });

  it('returns error for invalid JSON', () => {
    const store = createHeadlessStore();
    const err = storeLoadDocument(store, '{bad json', '/test/bad.glyph');
    expect(err).not.toBeNull();
  });

  it('returns error when no document to save', () => {
    const store = createHeadlessStore();
    const result = storeSaveDocument(store);
    expect('error' in result).toBe(true);
  });
});

describe('Frame operations', () => {
  it('adds a frame after the active frame', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Frames', 8, 8);
    const err = storeAddFrame(store);
    expect(err).toBeNull();
    expect(store.getState().document!.frames).toHaveLength(2);
    expect(store.getState().activeFrameIndex).toBe(1);
    expect(store.getState().dirty).toBe(true);
  });

  it('removes a frame', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Frames', 8, 8);
    storeAddFrame(store);
    const frameId = store.getState().document!.frames[1].id;
    const err = storeRemoveFrame(store, frameId);
    expect(err).toBeNull();
    expect(store.getState().document!.frames).toHaveLength(1);
  });

  it('refuses to remove the last frame', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Frames', 8, 8);
    const frameId = store.getState().document!.frames[0].id;
    const err = storeRemoveFrame(store, frameId);
    expect(err).toContain('Cannot remove');
  });

  it('sets active frame', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Frames', 8, 8);
    storeAddFrame(store);
    const err = storeSetActiveFrame(store, 0);
    expect(err).toBeNull();
    expect(store.getState().activeFrameIndex).toBe(0);
  });

  it('rejects out-of-range frame index', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Frames', 8, 8);
    expect(storeSetActiveFrame(store, 99)).toContain('out of range');
  });

  it('sets frame duration', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Frames', 8, 8);
    const frameId = store.getState().document!.frames[0].id;
    const err = storeSetFrameDuration(store, frameId, 200);
    expect(err).toBeNull();
    expect(store.getState().document!.frames[0].durationMs).toBe(200);
  });
});

describe('Layer operations', () => {
  it('adds a layer', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Layers', 8, 8);
    const err = storeAddLayer(store);
    expect(err).toBeNull();
    expect(store.getState().document!.frames[0].layers).toHaveLength(2);
    expect(store.getState().dirty).toBe(true);
  });

  it('removes a layer', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Layers', 8, 8);
    storeAddLayer(store);
    const layerId = store.getState().document!.frames[0].layers[1].id;
    const err = storeRemoveLayer(store, layerId);
    expect(err).toBeNull();
    expect(store.getState().document!.frames[0].layers).toHaveLength(1);
  });

  it('refuses to remove the last layer', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Layers', 8, 8);
    const layerId = store.getState().document!.frames[0].layers[0].id;
    const err = storeRemoveLayer(store, layerId);
    expect(err).toContain('Cannot remove');
  });

  it('sets active layer', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Layers', 8, 8);
    storeAddLayer(store);
    const firstLayerId = store.getState().document!.frames[0].layers[0].id;
    const err = storeSetActiveLayer(store, firstLayerId);
    expect(err).toBeNull();
    expect(store.getState().activeLayerId).toBe(firstLayerId);
  });

  it('toggles layer visibility', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Layers', 8, 8);
    const layerId = store.getState().document!.frames[0].layers[0].id;
    expect(store.getState().document!.frames[0].layers[0].visible).toBe(true);
    storeToggleLayerVisibility(store, layerId);
    expect(store.getState().document!.frames[0].layers[0].visible).toBe(false);
  });

  it('renames a layer', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Layers', 8, 8);
    const layerId = store.getState().document!.frames[0].layers[0].id;
    const err = storeRenameLayer(store, layerId, 'Background');
    expect(err).toBeNull();
    expect(store.getState().document!.frames[0].layers[0].name).toBe('Background');
  });
});

describe('Palette operations', () => {
  it('sets foreground color', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Palette', 8, 8);
    const err = storeSetForegroundColor(store, 3);
    expect(err).toBeNull();
    expect(store.getState().document!.palette.foregroundIndex).toBe(3);
  });

  it('rejects out-of-range color index', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Palette', 8, 8);
    expect(storeSetForegroundColor(store, 99)).toContain('out of range');
  });

  it('sets background color', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Palette', 8, 8);
    const err = storeSetBackgroundColor(store, 5);
    expect(err).toBeNull();
    expect(store.getState().document!.palette.backgroundIndex).toBe(5);
  });

  it('swaps foreground and background', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Palette', 8, 8);
    storeSetForegroundColor(store, 2);
    storeSetBackgroundColor(store, 7);
    storeSwapColors(store);
    expect(store.getState().document!.palette.foregroundIndex).toBe(7);
    expect(store.getState().document!.palette.backgroundIndex).toBe(2);
  });
});
