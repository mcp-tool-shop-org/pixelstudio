import { create } from 'zustand';

interface ExportState {
  activePresetId: string | null;
  exportRunning: boolean;
  exportReadiness: 'unknown' | 'ready' | 'warning' | 'blocked';

  setPreset: (id: string | null) => void;
  setRunning: (running: boolean) => void;
  setReadiness: (readiness: ExportState['exportReadiness']) => void;
}

export const useExportStore = create<ExportState>((set) => ({
  activePresetId: null,
  exportRunning: false,
  exportReadiness: 'unknown',

  setPreset: (id) => set({ activePresetId: id }),
  setRunning: (running) => set({ exportRunning: running }),
  setReadiness: (readiness) => set({ exportReadiness: readiness }),
}));
