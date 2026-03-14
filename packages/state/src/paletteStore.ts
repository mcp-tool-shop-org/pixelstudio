import { create } from 'zustand';
import type { PaletteDefinition } from '@pixelstudio/domain';

interface PaletteState {
  activePaletteId: string | null;
  paletteById: Record<string, PaletteDefinition>;
  activeContractId: string | null;
  recentSlotIds: string[];

  setActivePalette: (id: string | null) => void;
  addPalette: (palette: PaletteDefinition) => void;
  setContract: (id: string | null) => void;
  pushRecentSlot: (slotId: string) => void;
}

export const usePaletteStore = create<PaletteState>((set) => ({
  activePaletteId: null,
  paletteById: {},
  activeContractId: null,
  recentSlotIds: [],

  setActivePalette: (id) => set({ activePaletteId: id }),
  addPalette: (palette) =>
    set((s) => ({ paletteById: { ...s.paletteById, [palette.id]: palette } })),
  setContract: (id) => set({ activeContractId: id }),
  pushRecentSlot: (slotId) =>
    set((s) => ({
      recentSlotIds: [slotId, ...s.recentSlotIds.filter((id) => id !== slotId)].slice(0, 16),
    })),
}));
