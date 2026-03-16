import { create } from 'zustand';

const ZOOM_STEPS = [1, 2, 4, 8, 16, 32] as const;
const MIN_ZOOM = ZOOM_STEPS[0];
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

type OverlayKey =
  | 'showPixelGrid'
  | 'showMajorGrid'
  | 'showTileGrid'
  | 'showSelectionBounds'
  | 'showSockets'
  | 'showPivot'
  | 'showPaletteIndices'
  | 'showOnionSkin'
  | 'showSilhouette';

/** RGBA silhouette color — each channel 0–255. */
export type SilhouetteColor = [number, number, number, number];

interface CanvasViewState {
  zoom: number;
  panX: number;
  panY: number;
  showPixelGrid: boolean;
  showMajorGrid: boolean;
  showTileGrid: boolean;
  showSelectionBounds: boolean;
  showSockets: boolean;
  showPivot: boolean;
  showPaletteIndices: boolean;
  showOnionSkin: boolean;
  showSilhouette: boolean;
  silhouetteColor: SilhouetteColor;
  previewBackground: 'dark' | 'light' | 'checker';

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: (canvasW: number, canvasH: number, viewportW: number, viewportH: number) => void;
  setPan: (x: number, y: number) => void;
  panBy: (dx: number, dy: number) => void;
  toggleOverlay: (key: OverlayKey) => void;
  setSilhouetteColor: (color: SilhouetteColor) => void;
  setPreviewBackground: (bg: 'dark' | 'light' | 'checker') => void;
}

function nextZoomStep(current: number): number {
  for (const step of ZOOM_STEPS) {
    if (step > current) return step;
  }
  return MAX_ZOOM;
}

function prevZoomStep(current: number): number {
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < current) return ZOOM_STEPS[i];
  }
  return MIN_ZOOM;
}

export const useCanvasViewStore = create<CanvasViewState>((set) => ({
  zoom: 8,
  panX: 0,
  panY: 0,
  showPixelGrid: true,
  showMajorGrid: false,
  showTileGrid: false,
  showSelectionBounds: true,
  showSockets: true,
  showPivot: true,
  showPaletteIndices: false,
  showOnionSkin: false,
  showSilhouette: false,
  silhouetteColor: [30, 30, 40, 255] as SilhouetteColor,
  previewBackground: 'checker',

  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: nextZoomStep(s.zoom) })),
  zoomOut: () => set((s) => ({ zoom: prevZoomStep(s.zoom) })),
  zoomToFit: (canvasW, canvasH, viewportW, viewportH) => {
    const scaleX = viewportW / canvasW;
    const scaleY = viewportH / canvasH;
    const fitScale = Math.min(scaleX, scaleY);
    // Snap to nearest zoom step that fits
    let best: number = ZOOM_STEPS[0];
    for (const step of ZOOM_STEPS) {
      if (step <= fitScale) best = step;
    }
    set({ zoom: best, panX: 0, panY: 0 });
  },
  setPan: (x, y) => set({ panX: x, panY: y }),
  panBy: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),
  toggleOverlay: (key) => set((s) => ({ [key]: !s[key] })),
  setSilhouetteColor: (color) => set({ silhouetteColor: color }),
  setPreviewBackground: (bg) => set({ previewBackground: bg }),
}));

export { ZOOM_STEPS };
