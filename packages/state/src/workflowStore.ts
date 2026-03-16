import { create } from 'zustand';
import type {
  WorkflowDef,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStepResult,
  WorkflowStepStatus,
} from '@glyphstudio/domain';

interface WorkflowState {
  /** Registered workflow definitions. */
  workflows: WorkflowDef[];
  /** The currently active run, if any. */
  activeRun: WorkflowRun | null;

  registerWorkflows: (defs: WorkflowDef[]) => void;
  startRun: (workflowId: string) => void;
  advanceStep: (result: WorkflowStepResult) => void;
  completeRun: () => void;
  failRun: (error: string) => void;
  cancelRun: () => void;
  clearRun: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  activeRun: null,

  registerWorkflows: (defs) => set({ workflows: defs }),

  startRun: (workflowId) => {
    const def = get().workflows.find((w) => w.id === workflowId);
    if (!def) return;
    set({
      activeRun: {
        workflowId,
        status: 'running',
        currentStepIndex: 0,
        stepResults: [],
        startedAt: new Date().toISOString(),
      },
    });
  },

  advanceStep: (result) => {
    const run = get().activeRun;
    if (!run || run.status !== 'running') return;
    const results = [...run.stepResults, result];
    const def = get().workflows.find((w) => w.id === run.workflowId);
    const totalSteps = def?.steps.length ?? 0;
    const nextIndex = run.currentStepIndex + 1;
    const done = nextIndex >= totalSteps;
    set({
      activeRun: {
        ...run,
        stepResults: results,
        currentStepIndex: done ? run.currentStepIndex : nextIndex,
        status: done ? 'completed' : 'running',
        completedAt: done ? new Date().toISOString() : undefined,
      },
    });
  },

  completeRun: () => {
    const run = get().activeRun;
    if (!run) return;
    set({
      activeRun: {
        ...run,
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    });
  },

  failRun: (error) => {
    const run = get().activeRun;
    if (!run) return;
    const results = [...run.stepResults, {
      stepId: `error`,
      status: 'failed' as WorkflowStepStatus,
      error,
    }];
    set({
      activeRun: {
        ...run,
        status: 'failed',
        stepResults: results,
        completedAt: new Date().toISOString(),
      },
    });
  },

  cancelRun: () => {
    const run = get().activeRun;
    if (!run) return;
    set({
      activeRun: {
        ...run,
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      },
    });
  },

  clearRun: () => set({ activeRun: null }),
}));
