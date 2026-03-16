import { create } from 'zustand';
import { produce } from 'immer';

/** Brush settings for sketch drawing tools */
export interface BrushSettings {
  /** Brush diameter in pixels (1–64) */
  size: number;
  /** Drawing opacity 0–1 */
  opacity: number;
  /** Pixel scatter radius for rough feel (0 = no scatter) */
  scatter: number;
  /** Spacing between dabs as fraction of size (0.1–1.0) */
  spacing: number;
}

/** Defaults for sketch-brush (rough, fast, loose) */
export const SKETCH_BRUSH_DEFAULTS: Readonly<BrushSettings> = {
  size: 3,
  opacity: 0.6,
  scatter: 1,
  spacing: 0.25,
};

/** Defaults for sketch-eraser (matches brush size, full opacity) */
export const SKETCH_ERASER_DEFAULTS: Readonly<BrushSettings> = {
  size: 5,
  opacity: 1,
  scatter: 0,
  spacing: 0.25,
};

/** Defaults applied when user is on a sketch layer */
export const SKETCH_LAYER_DEFAULTS: Partial<BrushSettings> = {
  opacity: 0.5,
};

interface BrushSettingsState {
  /** Settings for sketch-brush tool */
  sketchBrush: BrushSettings;
  /** Settings for sketch-eraser tool */
  sketchEraser: BrushSettings;
  /** Whether rough mode visual indicator is active */
  roughModeActive: boolean;

  setBrushSize: (tool: 'sketchBrush' | 'sketchEraser', size: number) => void;
  setBrushOpacity: (tool: 'sketchBrush' | 'sketchEraser', opacity: number) => void;
  setBrushScatter: (tool: 'sketchBrush' | 'sketchEraser', scatter: number) => void;
  setBrushSpacing: (tool: 'sketchBrush' | 'sketchEraser', spacing: number) => void;
  setRoughModeActive: (active: boolean) => void;
  resetToDefaults: (tool: 'sketchBrush' | 'sketchEraser') => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const useBrushSettingsStore = create<BrushSettingsState>((set) => ({
  sketchBrush: { ...SKETCH_BRUSH_DEFAULTS },
  sketchEraser: { ...SKETCH_ERASER_DEFAULTS },
  roughModeActive: false,

  setBrushSize: (tool, size) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].size = clamp(Math.round(size), 1, 64);
      }),
    ),

  setBrushOpacity: (tool, opacity) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].opacity = clamp(opacity, 0, 1);
      }),
    ),

  setBrushScatter: (tool, scatter) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].scatter = clamp(Math.round(scatter), 0, 16);
      }),
    ),

  setBrushSpacing: (tool, spacing) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].spacing = clamp(spacing, 0.1, 1.0);
      }),
    ),

  setRoughModeActive: (active) => set({ roughModeActive: active }),

  resetToDefaults: (tool) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool] =
          tool === 'sketchBrush'
            ? { ...SKETCH_BRUSH_DEFAULTS }
            : { ...SKETCH_ERASER_DEFAULTS };
      }),
    ),
}));
