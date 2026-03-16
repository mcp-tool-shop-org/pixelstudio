import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeSetTool,
  storeGetTool,
  storeSetBrushSize,
  storeSetBrushShape,
  storeSetPixelPerfect,
  storeSetOnionSkin,
  storeGetOnionSkin,
  storeSetZoom,
  storeSetPan,
  storeResetView,
  storeSamplePixel,
  type HeadlessStore,
} from './storeAdapter.js';

describe('Tool settings operations', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'ToolTest', 8, 8);
  });

  it('switches active tool', () => {
    storeSetTool(store, 'eraser');
    expect(storeGetTool(store).activeTool).toBe('eraser');
  });

  it('rejects invalid tool', () => {
    const err = storeSetTool(store, 'laser' as any);
    expect(err).toContain('Invalid');
  });

  it('sets brush size', () => {
    storeSetBrushSize(store, 5);
    expect(storeGetTool(store).brushSize).toBe(5);
  });

  it('rejects brush size < 1', () => {
    expect(storeSetBrushSize(store, 0)).toContain('at least 1');
  });

  it('sets brush shape', () => {
    storeSetBrushShape(store, 'circle');
    expect(storeGetTool(store).brushShape).toBe('circle');
  });

  it('toggles pixel-perfect', () => {
    storeSetPixelPerfect(store, true);
    expect(storeGetTool(store).pixelPerfect).toBe(true);
    storeSetPixelPerfect(store, false);
    expect(storeGetTool(store).pixelPerfect).toBe(false);
  });

  it('tool changes do not mutate pixels', () => {
    const dirtyBefore = store.getState().dirty;
    storeSetTool(store, 'fill');
    storeSetBrushSize(store, 10);
    storeSetBrushShape(store, 'circle');
    storeSetPixelPerfect(store, true);
    expect(store.getState().dirty).toBe(dirtyBefore);
    expect((storeSamplePixel(store, 0, 0) as any).rgba).toEqual([0, 0, 0, 0]);
  });
});

describe('Onion skin operations', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'OnionTest', 8, 8);
  });

  it('updates onion skin settings', () => {
    storeSetOnionSkin(store, { enabled: true, framesBefore: 3, opacity: 0.5 });
    const onion = storeGetOnionSkin(store);
    expect(onion.enabled).toBe(true);
    expect(onion.framesBefore).toBe(3);
    expect(onion.opacity).toBe(0.5);
    expect(onion.framesAfter).toBe(1); // default unchanged
  });

  it('round-trips onion settings', () => {
    storeSetOnionSkin(store, { enabled: true, framesBefore: 2, framesAfter: 3, opacity: 0.7 });
    const onion = storeGetOnionSkin(store);
    expect(onion).toEqual({ enabled: true, framesBefore: 2, framesAfter: 3, opacity: 0.7 });
  });

  it('onion settings do not mutate document', () => {
    const updatedBefore = store.getState().document!.updatedAt;
    storeSetOnionSkin(store, { enabled: true });
    expect(store.getState().document!.updatedAt).toBe(updatedBefore);
  });
});

describe('View controls', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'ViewTest', 8, 8);
  });

  it('sets zoom', () => {
    storeSetZoom(store, 16);
    expect(store.getState().zoom).toBe(16);
  });

  it('rejects zoom out of range', () => {
    expect(storeSetZoom(store, 0)).toContain('between');
    expect(storeSetZoom(store, 100)).toContain('between');
  });

  it('sets pan', () => {
    storeSetPan(store, 100, -50);
    expect(store.getState().panX).toBe(100);
    expect(store.getState().panY).toBe(-50);
  });

  it('resets view', () => {
    storeSetZoom(store, 32);
    storeSetPan(store, 200, 200);
    storeResetView(store);
    expect(store.getState().zoom).toBe(8);
    expect(store.getState().panX).toBe(0);
    expect(store.getState().panY).toBe(0);
  });

  it('view controls do not mutate document pixels', () => {
    storeSetZoom(store, 32);
    storeSetPan(store, 100, 100);
    expect(store.getState().dirty).toBe(false);
    expect((storeSamplePixel(store, 0, 0) as any).rgba).toEqual([0, 0, 0, 0]);
  });
});
