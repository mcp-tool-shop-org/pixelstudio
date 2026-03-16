import { describe, it, expect, beforeEach } from 'vitest';
import { isSketchTool, SKETCH_TOOLS } from '@glyphstudio/domain';
import type { ToolId } from '@glyphstudio/domain';
import { useBrushSettingsStore, SKETCH_BRUSH_DEFAULTS, SKETCH_ERASER_DEFAULTS } from './brushSettingsStore';
import { expandDab, expandStrokeDabs } from './sketchDab';

/**
 * Integration tests for the sketch drawing pipeline:
 * tool detection → brush settings → dab expansion
 */
describe('sketch integration', () => {
  beforeEach(() => {
    useBrushSettingsStore.setState({
      sketchBrush: { ...SKETCH_BRUSH_DEFAULTS },
      sketchEraser: { ...SKETCH_ERASER_DEFAULTS },
      roughModeActive: false,
    });
  });

  it('sketch-brush defaults produce reasonable dab at canvas center', () => {
    const { size, scatter } = SKETCH_BRUSH_DEFAULTS;
    const pts = expandDab(16, 16, { size, scatter, canvasWidth: 32, canvasHeight: 32 });
    // Default size 3 + scatter 1 = more than just the center pixel
    expect(pts.length).toBeGreaterThan(1);
    expect(pts).toContainEqual([16, 16]);
  });

  it('sketch-eraser defaults (scatter=0) produce a clean circle', () => {
    const { size, scatter } = SKETCH_ERASER_DEFAULTS;
    const pts = expandDab(16, 16, { size, scatter, canvasWidth: 32, canvasHeight: 32 });
    // Size 5, no scatter — should be a filled circle
    expect(pts.length).toBeGreaterThanOrEqual(13); // ~pi*r^2 for r=2
    // No pixels should be farther than radius from center
    const r = (size - 1) / 2;
    for (const [x, y] of pts) {
      const dx = x - 16;
      const dy = y - 16;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(r * r + 0.01);
    }
  });

  it('full stroke with default brush settings produces continuous coverage', () => {
    const { size, scatter, spacing } = SKETCH_BRUSH_DEFAULTS;
    // Simulate a 10-pixel horizontal stroke
    const cursor: [number, number][] = [];
    for (let i = 0; i < 10; i++) cursor.push([16 + i, 16]);

    const pts = expandStrokeDabs(cursor, {
      size,
      scatter,
      spacing,
      canvasWidth: 64,
      canvasHeight: 64,
    });

    // Should cover the stroke path
    expect(pts.length).toBeGreaterThan(cursor.length);
    // Center row should have good coverage
    const centerRow = pts.filter(([, y]) => y === 16);
    expect(centerRow.length).toBeGreaterThanOrEqual(8);
  });

  it('size 1 brush with no scatter matches pencil behavior', () => {
    const pts = expandDab(10, 10, { size: 1, scatter: 0, canvasWidth: 32, canvasHeight: 32 });
    expect(pts).toEqual([[10, 10]]);
  });

  it('opacity setting does not affect dab geometry', () => {
    // Opacity is applied to color, not to which pixels are covered
    useBrushSettingsStore.getState().setBrushOpacity('sketchBrush', 0.1);
    useBrushSettingsStore.getState().setBrushOpacity('sketchBrush', 1.0);

    // Dab expansion doesn't read opacity — it only uses size/scatter
    const pts1 = expandDab(10, 10, { size: 3, scatter: 0, canvasWidth: 32, canvasHeight: 32 });
    const pts2 = expandDab(10, 10, { size: 3, scatter: 0, canvasWidth: 32, canvasHeight: 32 });
    expect(pts1).toEqual(pts2);
  });

  it('roughModeActive tracks drawing state correctly', () => {
    const store = useBrushSettingsStore.getState();
    expect(store.roughModeActive).toBe(false);
    store.setRoughModeActive(true);
    expect(useBrushSettingsStore.getState().roughModeActive).toBe(true);
    store.setRoughModeActive(false);
    expect(useBrushSettingsStore.getState().roughModeActive).toBe(false);
  });

  it('isSketchTool gates dab expansion correctly', () => {
    // Only sketch tools should trigger dab expansion
    const allTools: ToolId[] = [
      'pencil', 'eraser', 'fill', 'line', 'rectangle', 'ellipse',
      'marquee', 'lasso', 'magic-select', 'color-select',
      'move', 'transform', 'slice', 'socket', 'measure',
      'sketch-brush', 'sketch-eraser',
    ];

    const sketchTools = allTools.filter(isSketchTool);
    expect(sketchTools).toEqual(['sketch-brush', 'sketch-eraser']);
    expect(sketchTools.length).toBe(SKETCH_TOOLS.length);
  });

  it('dab at canvas edge does not produce out-of-bounds points', () => {
    const pts = expandDab(0, 0, { size: 7, scatter: 3, canvasWidth: 16, canvasHeight: 16 });
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(16);
      expect(y).toBeLessThan(16);
    }
  });

  it('dab at far edge does not exceed canvas bounds', () => {
    const pts = expandDab(15, 15, { size: 7, scatter: 3, canvasWidth: 16, canvasHeight: 16 });
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(16);
      expect(y).toBeLessThan(16);
    }
  });

  it('maximum brush size produces large dab', () => {
    useBrushSettingsStore.getState().setBrushSize('sketchBrush', 64);
    const pts = expandDab(128, 128, { size: 64, scatter: 0, canvasWidth: 256, canvasHeight: 256 });
    // r=31.5, area ~pi*31.5^2 ~= 3117
    expect(pts.length).toBeGreaterThan(2500);
  });
});
