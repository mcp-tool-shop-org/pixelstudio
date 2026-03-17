import { create } from 'zustand';
import type { ToolId } from '@glyphstudio/domain';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const RECENT_MAX = 12;
const PINNED_MAX = 8;

function colorKey(c: RgbaColor): string {
  return `${c.r},${c.g},${c.b}`;
}

interface ToolState {
  activeTool: ToolId;
  previousTool: ToolId | null;
  primaryColor: RgbaColor;
  secondaryColor: RgbaColor;
  primaryColorSlotId: string | null;
  secondaryColorSlotId: string | null;
  recentColors: RgbaColor[];
  pinnedColors: RgbaColor[];
  palettePopup: {
    open: boolean;
    screenX: number;
    screenY: number;
  };

  setTool: (tool: ToolId) => void;
  setPrimaryColor: (color: RgbaColor, slotId?: string | null) => void;
  setSecondaryColor: (color: RgbaColor, slotId?: string | null) => void;
  swapColors: () => void;
  pushRecentColor: (color: RgbaColor) => void;
  pinColor: (color: RgbaColor) => void;
  unpinColor: (index: number) => void;
  openPalettePopup: (x: number, y: number) => void;
  closePalettePopup: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'pencil',
  previousTool: null,
  primaryColor: { r: 255, g: 255, b: 255, a: 255 },
  secondaryColor: { r: 0, g: 0, b: 0, a: 0 },
  primaryColorSlotId: null,
  secondaryColorSlotId: null,
  recentColors: [],
  pinnedColors: [],
  palettePopup: { open: false, screenX: 0, screenY: 0 },

  setTool: (tool) => set((s) => ({ activeTool: tool, previousTool: s.activeTool })),
  setPrimaryColor: (color, slotId) =>
    set((s) => {
      const key = colorKey(color);
      const deduped = s.recentColors.filter((c) => colorKey(c) !== key);
      return {
        primaryColor: color,
        primaryColorSlotId: slotId ?? null,
        recentColors: [color, ...deduped].slice(0, RECENT_MAX),
      };
    }),
  setSecondaryColor: (color, slotId) =>
    set({ secondaryColor: color, secondaryColorSlotId: slotId ?? null }),
  swapColors: () =>
    set((s) => ({
      primaryColor: s.secondaryColor,
      secondaryColor: s.primaryColor,
      primaryColorSlotId: s.secondaryColorSlotId,
      secondaryColorSlotId: s.primaryColorSlotId,
    })),
  pushRecentColor: (color) =>
    set((s) => {
      const key = colorKey(color);
      const deduped = s.recentColors.filter((c) => colorKey(c) !== key);
      return { recentColors: [color, ...deduped].slice(0, RECENT_MAX) };
    }),
  pinColor: (color) =>
    set((s) => {
      const key = colorKey(color);
      if (s.pinnedColors.some((c) => colorKey(c) === key)) return {};
      return { pinnedColors: [...s.pinnedColors, color].slice(0, PINNED_MAX) };
    }),
  unpinColor: (index) =>
    set((s) => ({ pinnedColors: s.pinnedColors.filter((_, i) => i !== index) })),
  openPalettePopup: (x, y) => set({ palettePopup: { open: true, screenX: x, screenY: y } }),
  closePalettePopup: () => set({ palettePopup: { open: false, screenX: 0, screenY: 0 } }),
}));
