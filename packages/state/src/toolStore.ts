import { create } from 'zustand';
import type { ToolId } from '@pixelstudio/domain';

interface ToolState {
  activeTool: ToolId;
  previousTool: ToolId | null;
  primaryColorSlotId: string | null;
  secondaryColorSlotId: string | null;
  palettePopup: {
    open: boolean;
    screenX: number;
    screenY: number;
  };

  setTool: (tool: ToolId) => void;
  setPrimaryColor: (slotId: string | null) => void;
  setSecondaryColor: (slotId: string | null) => void;
  openPalettePopup: (x: number, y: number) => void;
  closePalettePopup: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'pencil',
  previousTool: null,
  primaryColorSlotId: null,
  secondaryColorSlotId: null,
  palettePopup: { open: false, screenX: 0, screenY: 0 },

  setTool: (tool) => set((s) => ({ activeTool: tool, previousTool: s.activeTool })),
  setPrimaryColor: (slotId) => set({ primaryColorSlotId: slotId }),
  setSecondaryColor: (slotId) => set({ secondaryColorSlotId: slotId }),
  openPalettePopup: (x, y) => set({ palettePopup: { open: true, screenX: x, screenY: y } }),
  closePalettePopup: () => set({ palettePopup: { open: false, screenX: 0, screenY: 0 } }),
}));
