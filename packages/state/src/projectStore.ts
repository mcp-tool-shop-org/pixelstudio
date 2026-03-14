import { create } from 'zustand';
import type { ColorMode } from '@pixelstudio/domain';

interface ProjectState {
  projectId: string | null;
  name: string;
  filePath: string | null;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  colorMode: ColorMode;
  canvasSize: { width: number; height: number };
  activePaletteContractId: string | null;

  setProject: (id: string, name: string, filePath: string, colorMode: ColorMode, width: number, height: number) => void;
  markDirty: () => void;
  markSaved: () => void;
  setColorMode: (mode: ColorMode) => void;
  setPaletteContract: (contractId: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null,
  name: 'Untitled',
  filePath: null,
  isDirty: false,
  saveStatus: 'idle',
  colorMode: 'rgb',
  canvasSize: { width: 64, height: 64 },
  activePaletteContractId: null,

  setProject: (id, name, filePath, colorMode, width, height) =>
    set({ projectId: id, name, filePath, colorMode, canvasSize: { width, height }, isDirty: false, saveStatus: 'idle' }),
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false, saveStatus: 'saved' }),
  setColorMode: (mode) => set({ colorMode: mode, isDirty: true }),
  setPaletteContract: (contractId) => set({ activePaletteContractId: contractId }),
}));
