import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasViewStore, ZOOM_STEPS } from './canvasViewStore';

beforeEach(() => {
  // Reset to default zoom
  useCanvasViewStore.setState({ zoom: 8, panX: 0, panY: 0 });
});

describe('zoomIn', () => {
  it('steps to next zoom level', () => {
    useCanvasViewStore.setState({ zoom: 4 });
    useCanvasViewStore.getState().zoomIn();
    expect(useCanvasViewStore.getState().zoom).toBe(8);
  });

  it('stays at max when already at max zoom', () => {
    const maxZoom = ZOOM_STEPS[ZOOM_STEPS.length - 1];
    useCanvasViewStore.setState({ zoom: maxZoom });
    useCanvasViewStore.getState().zoomIn();
    expect(useCanvasViewStore.getState().zoom).toBe(maxZoom);
  });
});

describe('zoomOut', () => {
  it('steps to previous zoom level', () => {
    useCanvasViewStore.setState({ zoom: 8 });
    useCanvasViewStore.getState().zoomOut();
    expect(useCanvasViewStore.getState().zoom).toBe(4);
  });

  it('stays at min when already at min zoom', () => {
    const minZoom = ZOOM_STEPS[0];
    useCanvasViewStore.setState({ zoom: minZoom });
    useCanvasViewStore.getState().zoomOut();
    expect(useCanvasViewStore.getState().zoom).toBe(minZoom);
  });
});

describe('zoomToFit', () => {
  it('snaps to largest zoom step that fits', () => {
    // Canvas 64x64, viewport 640x640 → fitScale = 10, best step ≤ 10 = 8
    useCanvasViewStore.getState().zoomToFit(64, 64, 640, 640);
    expect(useCanvasViewStore.getState().zoom).toBe(8);
  });

  it('fits non-square canvas in viewport', () => {
    // Canvas 64x32, viewport 256x256 → scaleX=4, scaleY=8, fit=4
    useCanvasViewStore.getState().zoomToFit(64, 32, 256, 256);
    expect(useCanvasViewStore.getState().zoom).toBe(4);
  });

  it('resets pan on zoomToFit', () => {
    useCanvasViewStore.setState({ panX: 100, panY: -50 });
    useCanvasViewStore.getState().zoomToFit(64, 64, 512, 512);
    expect(useCanvasViewStore.getState().panX).toBe(0);
    expect(useCanvasViewStore.getState().panY).toBe(0);
  });

  it('picks minimum zoom for tiny viewport', () => {
    // Canvas 64x64, viewport 32x32 → fitScale = 0.5, best step ≤ 0.5 = none fits → 1
    // Actually ZOOM_STEPS starts at 1, 0.5 < 1, so none ≤ 0.5. Best stays at ZOOM_STEPS[0]=1
    useCanvasViewStore.getState().zoomToFit(64, 64, 32, 32);
    expect(useCanvasViewStore.getState().zoom).toBe(ZOOM_STEPS[0]);
  });
});

describe('panBy', () => {
  it('accumulates panning', () => {
    useCanvasViewStore.setState({ panX: 10, panY: 20 });
    useCanvasViewStore.getState().panBy(5, -10);
    expect(useCanvasViewStore.getState().panX).toBe(15);
    expect(useCanvasViewStore.getState().panY).toBe(10);
  });
});

describe('setZoom clamping', () => {
  it('clamps zoom below min to min', () => {
    useCanvasViewStore.getState().setZoom(0);
    expect(useCanvasViewStore.getState().zoom).toBe(ZOOM_STEPS[0]);
  });

  it('clamps zoom above max to max', () => {
    useCanvasViewStore.getState().setZoom(999);
    expect(useCanvasViewStore.getState().zoom).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  });
});

describe('toggleOverlay', () => {
  it('toggles pixel grid off and on', () => {
    expect(useCanvasViewStore.getState().showPixelGrid).toBe(true);
    useCanvasViewStore.getState().toggleOverlay('showPixelGrid');
    expect(useCanvasViewStore.getState().showPixelGrid).toBe(false);
    useCanvasViewStore.getState().toggleOverlay('showPixelGrid');
    expect(useCanvasViewStore.getState().showPixelGrid).toBe(true);
  });
});
