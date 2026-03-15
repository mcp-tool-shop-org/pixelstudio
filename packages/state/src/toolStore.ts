import { create } from 'zustand';
import type { ToolId } from '@glyphstudio/domain';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ToolState {
  activeTool: ToolId;
  previousTool: ToolId | null;
  primaryColor: RgbaColor;
  secondaryColor: RgbaColor;
  primaryColorSlotId: string | null;
  secondaryColorSlotId: string | null;
  palettePopup: {
    open: boolean;
    screenX: number;
    screenY: number;
  };

  setTool: (tool: ToolId) => void;
  setPrimaryColor: (color: RgbaColor, slotId?: string | null) => void;
  setSecondaryColor: (color: RgbaColor, slotId?: string | null) => void;
  swapColors: () => void;
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
  palettePopup: { open: false, screenX: 0, screenY: 0 },

  setTool: (tool) => set((s) => ({ activeTool: tool, previousTool: s.activeTool })),
  setPrimaryColor: (color, slotId) =>
    set({ primaryColor: color, primaryColorSlotId: slotId ?? null }),
  setSecondaryColor: (color, slotId) =>
    set({ secondaryColor: color, secondaryColorSlotId: slotId ?? null }),
  swapColors: () =>
    set((s) => ({
      primaryColor: s.secondaryColor,
      secondaryColor: s.primaryColor,
      primaryColorSlotId: s.secondaryColorSlotId,
      secondaryColorSlotId: s.primaryColorSlotId,
    })),
  openPalettePopup: (x, y) => set({ palettePopup: { open: true, screenX: x, screenY: y } }),
  closePalettePopup: () => set({ palettePopup: { open: false, screenX: 0, screenY: 0 } }),
}));
