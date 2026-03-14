import { create } from 'zustand';
import type { AIJobType } from '@pixelstudio/api-contract';

interface AIJob {
  id: string;
  type: AIJobType;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: number | null;
  resultCandidateIds: string[];
  error: string | null;
}

interface AIState {
  jobsById: Record<string, AIJob>;
  jobOrder: string[];
  selectedCandidateId: string | null;
  resultsTrayOpen: boolean;

  addJob: (job: AIJob) => void;
  updateJob: (id: string, updates: Partial<AIJob>) => void;
  selectCandidate: (id: string | null) => void;
  toggleResultsTray: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  jobsById: {},
  jobOrder: [],
  selectedCandidateId: null,
  resultsTrayOpen: false,

  addJob: (job) =>
    set((s) => ({
      jobsById: { ...s.jobsById, [job.id]: job },
      jobOrder: [...s.jobOrder, job.id],
    })),
  updateJob: (id, updates) =>
    set((s) => ({
      jobsById: { ...s.jobsById, [id]: { ...s.jobsById[id], ...updates } },
    })),
  selectCandidate: (id) => set({ selectedCandidateId: id }),
  toggleResultsTray: () => set((s) => ({ resultsTrayOpen: !s.resultsTrayOpen })),
}));
