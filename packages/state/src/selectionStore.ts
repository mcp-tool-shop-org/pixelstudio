import { create } from 'zustand';
import type { Rect } from '@pixelstudio/domain';

export interface TransformPreviewData {
  sourceX: number;
  sourceY: number;
  payloadWidth: number;
  payloadHeight: number;
  offsetX: number;
  offsetY: number;
  payloadData: number[];
}

interface SelectionState {
  hasSelection: boolean;
  selectionBounds: Rect | null;
  selectionMode: 'replace' | 'add' | 'subtract' | 'intersect';
  isFloating: boolean;
  isTransforming: boolean;
  transformPreview: TransformPreviewData | null;

  setSelection: (bounds: Rect | null) => void;
  clearSelection: () => void;
  setSelectionMode: (mode: SelectionState['selectionMode']) => void;
  setTransform: (preview: TransformPreviewData) => void;
  clearTransform: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  hasSelection: false,
  selectionBounds: null,
  selectionMode: 'replace',
  isFloating: false,
  isTransforming: false,
  transformPreview: null,

  setSelection: (bounds) => set({ hasSelection: bounds !== null, selectionBounds: bounds }),
  clearSelection: () => set({ hasSelection: false, selectionBounds: null, isFloating: false, isTransforming: false, transformPreview: null }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
  setTransform: (preview) => set({ isTransforming: true, transformPreview: preview }),
  clearTransform: () => set({ isTransforming: false, transformPreview: null }),
}));
