import { create } from 'zustand';

export interface SliceRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SliceState {
  sliceRegions: SliceRegion[];
  selectedSliceId: string | null;
  hoveredSliceId: string | null;

  setSliceRegions: (regions: SliceRegion[]) => void;
  setSelectedSliceId: (id: string | null) => void;
  setHoveredSliceId: (id: string | null) => void;
}

export const useSliceStore = create<SliceState>((set) => ({
  sliceRegions: [],
  selectedSliceId: null,
  hoveredSliceId: null,

  setSliceRegions: (regions) => set({ sliceRegions: regions }),
  setSelectedSliceId: (id) => set({ selectedSliceId: id }),
  setHoveredSliceId: (id) => set({ hoveredSliceId: id }),
}));
