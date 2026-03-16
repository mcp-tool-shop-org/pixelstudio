import { describe, it, expect } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeGetStateSummary,
  storeSetTool,
  storeSetSelection,
  storeDrawPixels,
} from './storeAdapter.js';

describe('storeGetStateSummary', () => {
  it('returns complete summary with no document', () => {
    const store = createHeadlessStore();
    const summary = storeGetStateSummary(store);
    expect(summary.document).toBeNull();
    expect(summary.tool.activeTool).toBe('pencil');
    expect(summary.selection).toBeNull();
    expect(summary.hasClipboard).toBe(false);
  });

  it('returns full state with document', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'StateSummary', 16, 16);
    storeSetTool(store, 'fill');
    storeDrawPixels(store, [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }]);

    const summary = storeGetStateSummary(store);
    expect(summary.document).not.toBeNull();
    expect(summary.document!.name).toBe('StateSummary');
    expect(summary.document!.width).toBe(16);
    expect(summary.tool.activeTool).toBe('fill');
    expect(summary.dirty).toBe(true);
    expect(summary.preview.isPlaying).toBe(false);
  });

  it('includes selection when present', () => {
    const store = createHeadlessStore();
    storeNewDocument(store, 'Sel', 8, 8);
    storeSetSelection(store, { x: 1, y: 1, width: 3, height: 3 });

    const summary = storeGetStateSummary(store);
    expect(summary.selection).not.toBeNull();
    expect(summary.selection!.rect).toEqual({ x: 1, y: 1, width: 3, height: 3 });
  });

  it('session isolation — different stores have independent state', () => {
    const store1 = createHeadlessStore();
    const store2 = createHeadlessStore();
    storeNewDocument(store1, 'A', 8, 8);
    storeNewDocument(store2, 'B', 16, 16);
    storeSetTool(store1, 'eraser');

    const s1 = storeGetStateSummary(store1);
    const s2 = storeGetStateSummary(store2);
    expect(s1.document!.name).toBe('A');
    expect(s2.document!.name).toBe('B');
    expect(s1.tool.activeTool).toBe('eraser');
    expect(s2.tool.activeTool).toBe('pencil');
  });
});
