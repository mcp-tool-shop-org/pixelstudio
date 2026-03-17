import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasPointerHandlers } from './useCanvasPointerHandlers';
import { useSelectionStore } from '@glyphstudio/state';

// Tauri invoke is mocked globally in setup
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ width: 16, height: 16, data: [], canUndo: false, canRedo: false }),
}));

function makeCanvasRef() {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
  canvas.setPointerCapture = vi.fn();
  return { current: canvas } as React.RefObject<HTMLCanvasElement>;
}

function makeRenderRef() {
  const fn = vi.fn();
  return { current: fn } as React.RefObject<() => void>;
}

describe('useCanvasPointerHandlers', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      hasSelection: false,
      selectionBounds: null,
      isTransforming: false,
      transformPreview: null,
      selectionMode: 'replace',
      isFloating: false,
    });
  });

  it('mounts and returns expected shape', () => {
    const { result } = renderHook(() =>
      useCanvasPointerHandlers({ canvasRef: makeCanvasRef(), renderRef: makeRenderRef() }),
    );
    expect(typeof result.current.handlePointerDown).toBe('function');
    expect(typeof result.current.handlePointerMove).toBe('function');
    expect(typeof result.current.handlePointerUp).toBe('function');
    expect(result.current.dragSelection).toBeNull();
    expect(Array.isArray(result.current.sliceRegions)).toBe(true);
    expect(result.current.hoveredPixel).toBeNull();
    expect(typeof result.current.clearHoveredPixel).toBe('function');
    expect(typeof result.current.loadSliceRegions).toBe('function');
  });

  it('clearHoveredPixel sets hoveredPixel to null', async () => {
    const { result } = renderHook(() =>
      useCanvasPointerHandlers({ canvasRef: makeCanvasRef(), renderRef: makeRenderRef() }),
    );
    // hoveredPixel starts null; clearHoveredPixel should not throw
    act(() => { result.current.clearHoveredPixel(); });
    expect(result.current.hoveredPixel).toBeNull();
  });

  it('exposes drag refs used by the render callback', () => {
    const { result } = renderHook(() =>
      useCanvasPointerHandlers({ canvasRef: makeCanvasRef(), renderRef: makeRenderRef() }),
    );
    expect(result.current.isShapeDraggingRef).toBeDefined();
    expect(result.current.shapeStartRef).toBeDefined();
    expect(result.current.shapeEndRef).toBeDefined();
    expect(result.current.isLassoDraggingRef).toBeDefined();
    expect(result.current.lassoPointsRef).toBeDefined();
    expect(result.current.isSliceDraggingRef).toBeDefined();
    expect(result.current.sliceStartRef).toBeDefined();
    expect(result.current.sliceEndRef).toBeDefined();
    expect(result.current.measureStartRef).toBeDefined();
    expect(result.current.measureEndRef).toBeDefined();
  });

  it('exposes isPanningRef and isDrawingRef for keyboard handler', () => {
    const { result } = renderHook(() =>
      useCanvasPointerHandlers({ canvasRef: makeCanvasRef(), renderRef: makeRenderRef() }),
    );
    expect(result.current.isPanningRef).toBeDefined();
    expect(result.current.isDrawingRef).toBeDefined();
    expect(result.current.isPanningRef.current).toBe(false);
    expect(result.current.isDrawingRef.current).toBe(false);
  });
});
