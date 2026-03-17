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

/** Named brush preset — one-click config for common mark-making modes */
export interface BrushPreset {
  id: string;
  label: string;
  title: string;
  settings: BrushSettings;
}

/** Built-in presets. Order = display order in rail. */
export const BRUSH_PRESETS: readonly BrushPreset[] = [
  {
    id: 'pixel-hard',
    label: 'Hard',
    title: 'Pixel-hard — 1px crisp outlines and clean fills',
    settings: { size: 1, opacity: 1.0, scatter: 0, spacing: 0.1 },
  },
  {
    id: 'cluster',
    label: 'Blob',
    title: 'Cluster blob — fast silhouette blocking with a wide soft dab',
    settings: { size: 5, opacity: 0.9, scatter: 2, spacing: 0.3 },
  },
  {
    id: 'dither',
    label: 'Dith',
    title: 'Dither scatter — texture and shading via scattered semi-transparent dabs',
    settings: { size: 2, opacity: 0.55, scatter: 3, spacing: 0.5 },
  },
  {
    id: 'sketch',
    label: 'Soft',
    title: 'Sketch — loose rough strokes for ideation and cleanup',
    settings: { size: 3, opacity: 0.6, scatter: 1, spacing: 0.25 },
  },
];

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
  /** ID of the active preset, or null when manually customised */
  activePresetId: string | null;

  setBrushSize: (tool: 'sketchBrush' | 'sketchEraser', size: number) => void;
  setBrushOpacity: (tool: 'sketchBrush' | 'sketchEraser', opacity: number) => void;
  setBrushScatter: (tool: 'sketchBrush' | 'sketchEraser', scatter: number) => void;
  setBrushSpacing: (tool: 'sketchBrush' | 'sketchEraser', spacing: number) => void;
  setRoughModeActive: (active: boolean) => void;
  resetToDefaults: (tool: 'sketchBrush' | 'sketchEraser') => void;
  /** Apply a named preset to sketchBrush and record which preset is active */
  applyPreset: (id: string) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const useBrushSettingsStore = create<BrushSettingsState>((set) => ({
  sketchBrush: { ...SKETCH_BRUSH_DEFAULTS },
  sketchEraser: { ...SKETCH_ERASER_DEFAULTS },
  roughModeActive: false,
  activePresetId: null,

  setBrushSize: (tool, size) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].size = clamp(Math.round(size), 1, 64);
        if (tool === 'sketchBrush') s.activePresetId = null;
      }),
    ),

  setBrushOpacity: (tool, opacity) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].opacity = clamp(opacity, 0, 1);
        if (tool === 'sketchBrush') s.activePresetId = null;
      }),
    ),

  setBrushScatter: (tool, scatter) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].scatter = clamp(Math.round(scatter), 0, 16);
        if (tool === 'sketchBrush') s.activePresetId = null;
      }),
    ),

  setBrushSpacing: (tool, spacing) =>
    set(
      produce((s: BrushSettingsState) => {
        s[tool].spacing = clamp(spacing, 0.1, 1.0);
        if (tool === 'sketchBrush') s.activePresetId = null;
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
        if (tool === 'sketchBrush') s.activePresetId = null;
      }),
    ),

  applyPreset: (id) =>
    set(
      produce((s: BrushSettingsState) => {
        const preset = BRUSH_PRESETS.find((p) => p.id === id);
        if (!preset) return;
        s.sketchBrush = { ...preset.settings };
        s.activePresetId = id;
      }),
    ),
}));
