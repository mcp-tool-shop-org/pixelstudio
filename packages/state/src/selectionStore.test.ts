import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selectionStore';

beforeEach(() => {
  useSelectionStore.getState().clearSelection();
});

describe('setSelection', () => {
  it('sets selection bounds and hasSelection flag', () => {
    useSelectionStore.getState().setSelection({ x: 10, y: 20, width: 30, height: 40 });
    const s = useSelectionStore.getState();
    expect(s.hasSelection).toBe(true);
    expect(s.selectionBounds).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('clears selection when null', () => {
    useSelectionStore.getState().setSelection({ x: 10, y: 20, width: 30, height: 40 });
    useSelectionStore.getState().setSelection(null);
    expect(useSelectionStore.getState().hasSelection).toBe(false);
    expect(useSelectionStore.getState().selectionBounds).toBeNull();
  });
});

describe('clearSelection', () => {
  it('clears entire selection state including transform', () => {
    useSelectionStore.getState().setSelection({ x: 0, y: 0, width: 10, height: 10 });
    useSelectionStore.getState().setTransform({
      sourceX: 0, sourceY: 0,
      payloadWidth: 10, payloadHeight: 10,
      offsetX: 5, offsetY: 5,
      payloadData: [255, 0, 0, 255],
    });
    useSelectionStore.getState().clearSelection();
    const s = useSelectionStore.getState();
    expect(s.hasSelection).toBe(false);
    expect(s.selectionBounds).toBeNull();
    expect(s.isFloating).toBe(false);
    expect(s.isTransforming).toBe(false);
    expect(s.transformPreview).toBeNull();
  });
});

describe('selectionMode', () => {
  it('defaults to replace', () => {
    expect(useSelectionStore.getState().selectionMode).toBe('replace');
  });

  it('can be changed to subtract', () => {
    useSelectionStore.getState().setSelectionMode('subtract');
    expect(useSelectionStore.getState().selectionMode).toBe('subtract');
  });
});

describe('transform lifecycle', () => {
  it('setTransform marks isTransforming', () => {
    useSelectionStore.getState().setTransform({
      sourceX: 0, sourceY: 0,
      payloadWidth: 10, payloadHeight: 10,
      offsetX: 0, offsetY: 0,
      payloadData: [],
    });
    expect(useSelectionStore.getState().isTransforming).toBe(true);
    expect(useSelectionStore.getState().transformPreview).not.toBeNull();
  });

  it('clearTransform removes transform but preserves selection', () => {
    useSelectionStore.getState().setSelection({ x: 0, y: 0, width: 10, height: 10 });
    useSelectionStore.getState().setTransform({
      sourceX: 0, sourceY: 0,
      payloadWidth: 10, payloadHeight: 10,
      offsetX: 0, offsetY: 0,
      payloadData: [],
    });
    useSelectionStore.getState().clearTransform();
    expect(useSelectionStore.getState().isTransforming).toBe(false);
    expect(useSelectionStore.getState().transformPreview).toBeNull();
    // selection still exists
    expect(useSelectionStore.getState().hasSelection).toBe(true);
  });
});
