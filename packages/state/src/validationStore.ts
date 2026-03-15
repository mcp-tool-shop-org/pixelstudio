import { create } from 'zustand';
import type { ValidationReport } from '@glyphstudio/api-contract';

interface ValidationState {
  currentReport: ValidationReport | null;
  activeIssueId: string | null;
  running: boolean;

  setReport: (report: ValidationReport) => void;
  setActiveIssue: (id: string | null) => void;
  setRunning: (running: boolean) => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  currentReport: null,
  activeIssueId: null,
  running: false,

  setReport: (report) => set({ currentReport: report, running: false }),
  setActiveIssue: (id) => set({ activeIssueId: id }),
  setRunning: (running) => set({ running }),
}));
