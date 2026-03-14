import { create } from 'zustand';
import type { Anchor, AnchorKind, AnchorBounds } from '@pixelstudio/domain';

interface AnchorState {
  anchors: Anchor[];
  selectedAnchorId: string | null;
  overlayVisible: boolean;

  setAnchors: (anchors: Anchor[]) => void;
  addAnchor: (anchor: Anchor) => void;
  removeAnchor: (id: string) => void;
  updateAnchor: (id: string, updates: Partial<Pick<Anchor, 'name' | 'kind' | 'x' | 'y' | 'bounds' | 'parentName' | 'falloffWeight'>>) => void;
  selectAnchor: (id: string | null) => void;
  toggleOverlay: () => void;
  setOverlayVisible: (visible: boolean) => void;
  reset: () => void;
}

const initialState = {
  anchors: [] as Anchor[],
  selectedAnchorId: null as string | null,
  overlayVisible: true,
};

export const useAnchorStore = create<AnchorState>((set) => ({
  ...initialState,

  setAnchors: (anchors) => set({ anchors }),
  addAnchor: (anchor) => set((s) => ({ anchors: [...s.anchors, anchor] })),
  removeAnchor: (id) =>
    set((s) => ({
      anchors: s.anchors.filter((a) => a.id !== id),
      selectedAnchorId: s.selectedAnchorId === id ? null : s.selectedAnchorId,
    })),
  updateAnchor: (id, updates) =>
    set((s) => ({
      anchors: s.anchors.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  selectAnchor: (id) => set({ selectedAnchorId: id }),
  toggleOverlay: () => set((s) => ({ overlayVisible: !s.overlayVisible })),
  setOverlayVisible: (visible) => set({ overlayVisible: visible }),
  reset: () => set(initialState),
}));
