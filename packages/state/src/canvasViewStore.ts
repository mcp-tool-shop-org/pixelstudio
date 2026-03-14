import { create } from 'zustand';

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
  previewBackground: 'dark' | 'light' | 'checker';

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleOverlay: (key: keyof Pick<CanvasViewState, 'showPixelGrid' | 'showMajorGrid' | 'showTileGrid' | 'showSelectionBounds' | 'showSockets' | 'showPivot' | 'showPaletteIndices' | 'showOnionSkin'>) => void;
  setPreviewBackground: (bg: 'dark' | 'light' | 'checker') => void;
}

export const useCanvasViewStore = create<CanvasViewState>((set) => ({
  zoom: 1,
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
  previewBackground: 'checker',

  setZoom: (zoom) => set({ zoom }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  toggleOverlay: (key) => set((s) => ({ [key]: !s[key] })),
  setPreviewBackground: (bg) => set({ previewBackground: bg }),
}));
