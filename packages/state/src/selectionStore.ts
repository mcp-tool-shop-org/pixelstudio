import { create } from 'zustand';
import type { Rect } from '@pixelstudio/domain';

interface SelectionState {
  hasSelection: boolean;
  selectionBounds: Rect | null;
  selectionMode: 'replace' | 'add' | 'subtract' | 'intersect';
  isFloating: boolean;

  setSelection: (bounds: Rect | null) => void;
  clearSelection: () => void;
  setSelectionMode: (mode: SelectionState['selectionMode']) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  hasSelection: false,
  selectionBounds: null,
  selectionMode: 'replace',
  isFloating: false,

  setSelection: (bounds) => set({ hasSelection: bounds !== null, selectionBounds: bounds }),
  clearSelection: () => set({ hasSelection: false, selectionBounds: null, isFloating: false }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
}));
