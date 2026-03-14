import { create } from 'zustand';
import type {
  MotionIntent,
  MotionDirection,
  MotionTargetMode,
  MotionFrameCount,
  MotionSessionStatus,
  MotionProposal,
  MotionPanelMode,
} from '@pixelstudio/domain';

interface MotionState {
  panelMode: MotionPanelMode;
  sessionId: string | null;
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
  sourceFrameId: string | null;
  proposals: MotionProposal[];
  selectedProposalId: string | null;
  status: MotionSessionStatus;
  lastError: string | null;

  setPanelMode: (mode: MotionPanelMode) => void;
  setSession: (session: {
    sessionId: string;
    intent: MotionIntent;
    direction: MotionDirection | null;
    targetMode: MotionTargetMode;
    outputFrameCount: MotionFrameCount;
    sourceFrameId: string;
    proposals: MotionProposal[];
    selectedProposalId: string | null;
    status: MotionSessionStatus;
  }) => void;
  setIntent: (intent: MotionIntent) => void;
  setDirection: (direction: MotionDirection | null) => void;
  setTargetMode: (mode: MotionTargetMode) => void;
  setOutputFrameCount: (count: MotionFrameCount) => void;
  setProposals: (proposals: MotionProposal[]) => void;
  setSelectedProposalId: (id: string | null) => void;
  setStatus: (status: MotionSessionStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  panelMode: 'locomotion' as MotionPanelMode,
  sessionId: null as string | null,
  intent: 'idle_bob' as MotionIntent,
  direction: null as MotionDirection | null,
  targetMode: 'whole_frame' as MotionTargetMode,
  outputFrameCount: 2 as MotionFrameCount,
  sourceFrameId: null as string | null,
  proposals: [] as MotionProposal[],
  selectedProposalId: null as string | null,
  status: 'idle' as MotionSessionStatus,
  lastError: null as string | null,
};

export const useMotionStore = create<MotionState>((set) => ({
  ...initialState,

  setPanelMode: (mode) => set({ panelMode: mode }),
  setSession: (session) =>
    set({
      sessionId: session.sessionId,
      intent: session.intent,
      direction: session.direction,
      targetMode: session.targetMode,
      outputFrameCount: session.outputFrameCount,
      sourceFrameId: session.sourceFrameId,
      proposals: session.proposals,
      selectedProposalId: session.selectedProposalId,
      status: session.status,
      lastError: null,
    }),
  setIntent: (intent) => set({ intent }),
  setDirection: (direction) => set({ direction }),
  setTargetMode: (mode) => set({ targetMode: mode }),
  setOutputFrameCount: (count) => set({ outputFrameCount: count }),
  setProposals: (proposals) => set({ proposals }),
  setSelectedProposalId: (id) => set({ selectedProposalId: id }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ lastError: error, status: 'error' }),
  reset: () => set(initialState),
}));
