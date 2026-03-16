import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeDrawPixels,
  storeSamplePixel,
  storeSetSelection,
  storeClearSelection,
  storeGetSelection,
  storeCopySelection,
  storeCutSelection,
  storePasteSelection,
  storeFlipSelectionHorizontal,
  storeFlipSelectionVertical,
  storeCommitSelection,
  type HeadlessStore,
} from './storeAdapter.js';

describe('Selection operations', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'SelectionTest', 8, 8);
  });

  it('sets a rectangular selection', () => {
    const err = storeSetSelection(store, { x: 1, y: 1, width: 3, height: 3 });
    expect(err).toBeNull();
    const sel = storeGetSelection(store);
    expect(sel).not.toBeNull();
    expect(sel!.rect).toEqual({ x: 1, y: 1, width: 3, height: 3 });
  });

  it('clears selection without mutating pixels', () => {
    storeDrawPixels(store, [{ x: 2, y: 2, rgba: [255, 0, 0, 255] }]);
    storeSetSelection(store, { x: 0, y: 0, width: 4, height: 4 });
    storeClearSelection(store);
    expect(storeGetSelection(store)).toBeNull();
    // Pixel should still be there
    const s = storeSamplePixel(store, 2, 2);
    expect((s as any).rgba).toEqual([255, 0, 0, 255]);
  });

  it('copy does not mutate pixels', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeSetSelection(store, { x: 0, y: 0, width: 2, height: 2 });
    const err = storeCopySelection(store);
    expect(err).toBeNull();
    // Pixel still there
    const s = storeSamplePixel(store, 0, 0);
    expect((s as any).rgba).toEqual([255, 0, 0, 255]);
    // Clipboard exists
    expect(store.getState().clipboardBuffer).not.toBeNull();
  });

  it('cut removes selected pixels', () => {
    storeDrawPixels(store, [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 1, y: 0, rgba: [0, 255, 0, 255] },
    ]);
    storeSetSelection(store, { x: 0, y: 0, width: 2, height: 1 });
    const err = storeCutSelection(store);
    expect(err).toBeNull();
    // Pixels should be cleared
    expect((storeSamplePixel(store, 0, 0) as any).rgba).toEqual([0, 0, 0, 0]);
    expect((storeSamplePixel(store, 1, 0) as any).rgba).toEqual([0, 0, 0, 0]);
    expect(store.getState().dirty).toBe(true);
  });

  it('paste from clipboard creates a selection', () => {
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);
    storeSetSelection(store, { x: 0, y: 0, width: 1, height: 1 });
    storeCopySelection(store);
    storeClearSelection(store);

    const err = storePasteSelection(store);
    expect(err).toBeNull();
    const sel = storeGetSelection(store);
    expect(sel).not.toBeNull();
    expect(sel!.rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('paste fails with empty clipboard', () => {
    const err = storePasteSelection(store);
    expect(err).toContain('empty');
  });

  it('flip horizontal is exact', () => {
    // Draw a 2x1 selection: red at (0,0), green at (1,0)
    storeDrawPixels(store, [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 1, y: 0, rgba: [0, 255, 0, 255] },
    ]);
    storeSetSelection(store, { x: 0, y: 0, width: 2, height: 1 });
    storeFlipSelectionHorizontal(store);

    // Commit and verify the flipped result
    storeCommitSelection(store);
    expect((storeSamplePixel(store, 0, 0) as any).rgba).toEqual([0, 255, 0, 255]);
    expect((storeSamplePixel(store, 1, 0) as any).rgba).toEqual([255, 0, 0, 255]);
  });

  it('flip vertical is exact', () => {
    storeDrawPixels(store, [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 0, y: 1, rgba: [0, 255, 0, 255] },
    ]);
    storeSetSelection(store, { x: 0, y: 0, width: 1, height: 2 });
    storeFlipSelectionVertical(store);

    storeCommitSelection(store);
    expect((storeSamplePixel(store, 0, 0) as any).rgba).toEqual([0, 255, 0, 255]);
    expect((storeSamplePixel(store, 0, 1) as any).rgba).toEqual([255, 0, 0, 255]);
  });

  it('commit blits selection onto layer', () => {
    storeDrawPixels(store, [{ x: 3, y: 3, rgba: [255, 0, 0, 255] }]);
    storeSetSelection(store, { x: 3, y: 3, width: 1, height: 1 });
    storeCopySelection(store);
    storeClearSelection(store);
    storePasteSelection(store);
    // Selection is at (0,0) — commit should write red pixel at (0,0)
    storeCommitSelection(store);

    expect((storeSamplePixel(store, 0, 0) as any).rgba).toEqual([255, 0, 0, 255]);
    expect(storeGetSelection(store)).toBeNull();
    expect(store.getState().dirty).toBe(true);
  });

  it('selection remains frame-local and layer-local', () => {
    storeSetSelection(store, { x: 0, y: 0, width: 4, height: 4 });
    expect(storeGetSelection(store)).not.toBeNull();
    // Selection is editor state — doesn't persist in document frames
    expect(store.getState().document!.frames[0]).toBeDefined();
  });
});
