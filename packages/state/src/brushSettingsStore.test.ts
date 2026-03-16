import { describe, it, expect, beforeEach } from 'vitest';
import {
  useBrushSettingsStore,
  SKETCH_BRUSH_DEFAULTS,
  SKETCH_ERASER_DEFAULTS,
} from './brushSettingsStore';

beforeEach(() => {
  useBrushSettingsStore.setState({
    sketchBrush: { ...SKETCH_BRUSH_DEFAULTS },
    sketchEraser: { ...SKETCH_ERASER_DEFAULTS },
    roughModeActive: false,
  });
});

describe('brushSettingsStore', () => {
  // --- Defaults ---
  it('initializes sketch-brush with correct defaults', () => {
    const s = useBrushSettingsStore.getState();
    expect(s.sketchBrush).toEqual(SKETCH_BRUSH_DEFAULTS);
    expect(s.sketchBrush.size).toBe(3);
    expect(s.sketchBrush.opacity).toBe(0.6);
    expect(s.sketchBrush.scatter).toBe(1);
    expect(s.sketchBrush.spacing).toBe(0.25);
  });

  it('initializes sketch-eraser with correct defaults', () => {
    const s = useBrushSettingsStore.getState();
    expect(s.sketchEraser).toEqual(SKETCH_ERASER_DEFAULTS);
    expect(s.sketchEraser.size).toBe(5);
    expect(s.sketchEraser.opacity).toBe(1);
    expect(s.sketchEraser.scatter).toBe(0);
  });

  it('roughModeActive starts false', () => {
    expect(useBrushSettingsStore.getState().roughModeActive).toBe(false);
  });

  // --- Size ---
  it('setBrushSize updates size', () => {
    useBrushSettingsStore.getState().setBrushSize('sketchBrush', 8);
    expect(useBrushSettingsStore.getState().sketchBrush.size).toBe(8);
  });

  it('setBrushSize clamps to [1, 64]', () => {
    const { setBrushSize } = useBrushSettingsStore.getState();
    setBrushSize('sketchBrush', 0);
    expect(useBrushSettingsStore.getState().sketchBrush.size).toBe(1);
    setBrushSize('sketchBrush', 100);
    expect(useBrushSettingsStore.getState().sketchBrush.size).toBe(64);
  });

  it('setBrushSize rounds to integer', () => {
    useBrushSettingsStore.getState().setBrushSize('sketchBrush', 3.7);
    expect(useBrushSettingsStore.getState().sketchBrush.size).toBe(4);
  });

  // --- Opacity ---
  it('setBrushOpacity updates opacity', () => {
    useBrushSettingsStore.getState().setBrushOpacity('sketchBrush', 0.3);
    expect(useBrushSettingsStore.getState().sketchBrush.opacity).toBe(0.3);
  });

  it('setBrushOpacity clamps to [0, 1]', () => {
    const { setBrushOpacity } = useBrushSettingsStore.getState();
    setBrushOpacity('sketchBrush', -0.5);
    expect(useBrushSettingsStore.getState().sketchBrush.opacity).toBe(0);
    setBrushOpacity('sketchBrush', 2.0);
    expect(useBrushSettingsStore.getState().sketchBrush.opacity).toBe(1);
  });

  // --- Scatter ---
  it('setBrushScatter updates scatter', () => {
    useBrushSettingsStore.getState().setBrushScatter('sketchBrush', 4);
    expect(useBrushSettingsStore.getState().sketchBrush.scatter).toBe(4);
  });

  it('setBrushScatter clamps to [0, 16]', () => {
    const { setBrushScatter } = useBrushSettingsStore.getState();
    setBrushScatter('sketchEraser', -2);
    expect(useBrushSettingsStore.getState().sketchEraser.scatter).toBe(0);
    setBrushScatter('sketchEraser', 30);
    expect(useBrushSettingsStore.getState().sketchEraser.scatter).toBe(16);
  });

  // --- Spacing ---
  it('setBrushSpacing updates spacing', () => {
    useBrushSettingsStore.getState().setBrushSpacing('sketchBrush', 0.5);
    expect(useBrushSettingsStore.getState().sketchBrush.spacing).toBe(0.5);
  });

  it('setBrushSpacing clamps to [0.1, 1.0]', () => {
    const { setBrushSpacing } = useBrushSettingsStore.getState();
    setBrushSpacing('sketchBrush', 0.01);
    expect(useBrushSettingsStore.getState().sketchBrush.spacing).toBe(0.1);
    setBrushSpacing('sketchBrush', 5.0);
    expect(useBrushSettingsStore.getState().sketchBrush.spacing).toBe(1.0);
  });

  // --- Rough mode toggle ---
  it('setRoughModeActive toggles rough mode', () => {
    useBrushSettingsStore.getState().setRoughModeActive(true);
    expect(useBrushSettingsStore.getState().roughModeActive).toBe(true);
    useBrushSettingsStore.getState().setRoughModeActive(false);
    expect(useBrushSettingsStore.getState().roughModeActive).toBe(false);
  });

  // --- Reset ---
  it('resetToDefaults restores sketch-brush defaults', () => {
    const s = useBrushSettingsStore.getState();
    s.setBrushSize('sketchBrush', 20);
    s.setBrushOpacity('sketchBrush', 0.1);
    s.setBrushScatter('sketchBrush', 10);
    s.resetToDefaults('sketchBrush');
    expect(useBrushSettingsStore.getState().sketchBrush).toEqual(SKETCH_BRUSH_DEFAULTS);
  });

  it('resetToDefaults restores sketch-eraser defaults', () => {
    const s = useBrushSettingsStore.getState();
    s.setBrushSize('sketchEraser', 20);
    s.setBrushOpacity('sketchEraser', 0.5);
    s.resetToDefaults('sketchEraser');
    expect(useBrushSettingsStore.getState().sketchEraser).toEqual(SKETCH_ERASER_DEFAULTS);
  });

  // --- Cross-tool independence ---
  it('changing brush does not affect eraser', () => {
    useBrushSettingsStore.getState().setBrushSize('sketchBrush', 16);
    expect(useBrushSettingsStore.getState().sketchEraser.size).toBe(SKETCH_ERASER_DEFAULTS.size);
  });

  it('changing eraser does not affect brush', () => {
    useBrushSettingsStore.getState().setBrushOpacity('sketchEraser', 0.3);
    expect(useBrushSettingsStore.getState().sketchBrush.opacity).toBe(SKETCH_BRUSH_DEFAULTS.opacity);
  });
});
