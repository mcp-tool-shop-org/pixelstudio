import { create } from 'zustand';
import type { SandboxPlaybackSettings, SandboxSessionInfo, SandboxMetricsSummary, AnchorPathInfo } from '@pixelstudio/domain';

interface SandboxState {
  session: SandboxSessionInfo | null;
  playback: SandboxPlaybackSettings;
  currentFrame: number;
  playing: boolean;
  lastError: string | null;

  // Analysis state
  metrics: SandboxMetricsSummary | null;
  analysisLoading: boolean;
  analysisError: string | null;
  analyzedSessionId: string | null;

  // Anchor path visualization state
  anchorPaths: AnchorPathInfo[];
  selectedAnchorNames: string[];
  pathsLoading: boolean;
  pathsError: string | null;
  pathsSessionId: string | null;
  showContactHints: boolean;

  // Action state
  applying: boolean;
  duplicating: boolean;
  actionSuccess: string | null;
  actionError: string | null;

  setSession: (session: SandboxSessionInfo | null) => void;
  setFps: (fps: number) => void;
  setLooping: (looping: boolean) => void;
  setCurrentFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setError: (error: string | null) => void;
  setMetrics: (metrics: SandboxMetricsSummary) => void;
  setAnalysisLoading: (loading: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  clearAnalysis: () => void;
  setAnchorPaths: (paths: AnchorPathInfo[], sessionId: string) => void;
  setSelectedAnchorNames: (names: string[]) => void;
  toggleAnchorName: (name: string) => void;
  setPathsLoading: (loading: boolean) => void;
  setPathsError: (error: string | null) => void;
  setShowContactHints: (show: boolean) => void;
  clearPaths: () => void;
  setApplying: (applying: boolean) => void;
  setDuplicating: (duplicating: boolean) => void;
  setActionSuccess: (msg: string | null) => void;
  setActionError: (msg: string | null) => void;
  clearActionFeedback: () => void;
  reset: () => void;
}

const initialPlayback: SandboxPlaybackSettings = { fps: 8, looping: true };

export const useSandboxStore = create<SandboxState>((set) => ({
  session: null,
  playback: initialPlayback,
  currentFrame: 0,
  playing: false,
  lastError: null,
  metrics: null,
  analysisLoading: false,
  analysisError: null,
  analyzedSessionId: null,
  anchorPaths: [],
  selectedAnchorNames: [],
  pathsLoading: false,
  pathsError: null,
  pathsSessionId: null,
  showContactHints: true,
  applying: false,
  duplicating: false,
  actionSuccess: null,
  actionError: null,

  setSession: (session) => set({
    session,
    currentFrame: 0,
    playing: false,
    lastError: null,
    metrics: null,
    analysisError: null,
    analyzedSessionId: null,
    anchorPaths: [],
    selectedAnchorNames: [],
    pathsError: null,
    pathsSessionId: null,
  }),
  setFps: (fps) => set((s) => ({ playback: { ...s.playback, fps } })),
  setLooping: (looping) => set((s) => ({ playback: { ...s.playback, looping } })),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setPlaying: (playing) => set({ playing }),
  setError: (error) => set({ lastError: error, playing: false }),
  setMetrics: (metrics) => set({ metrics, analysisLoading: false, analysisError: null, analyzedSessionId: metrics.sessionId }),
  setAnalysisLoading: (loading) => set({ analysisLoading: loading }),
  setAnalysisError: (error) => set({ analysisError: error, analysisLoading: false }),
  clearAnalysis: () => set({ metrics: null, analysisError: null, analyzedSessionId: null }),
  setAnchorPaths: (paths, sessionId) => set({ anchorPaths: paths, pathsLoading: false, pathsError: null, pathsSessionId: sessionId }),
  setSelectedAnchorNames: (names) => set({ selectedAnchorNames: names }),
  toggleAnchorName: (name) => set((s) => ({
    selectedAnchorNames: s.selectedAnchorNames.includes(name)
      ? s.selectedAnchorNames.filter((n) => n !== name)
      : [...s.selectedAnchorNames, name],
  })),
  setPathsLoading: (loading) => set({ pathsLoading: loading }),
  setPathsError: (error) => set({ pathsError: error, pathsLoading: false }),
  setShowContactHints: (show) => set({ showContactHints: show }),
  clearPaths: () => set({ anchorPaths: [], selectedAnchorNames: [], pathsError: null, pathsSessionId: null }),
  setApplying: (applying) => set({ applying }),
  setDuplicating: (duplicating) => set({ duplicating }),
  setActionSuccess: (msg) => set({ actionSuccess: msg, actionError: null }),
  setActionError: (msg) => set({ actionError: msg, actionSuccess: null, applying: false, duplicating: false }),
  clearActionFeedback: () => set({ actionSuccess: null, actionError: null }),
  reset: () => set({
    session: null,
    playback: initialPlayback,
    currentFrame: 0,
    playing: false,
    lastError: null,
    metrics: null,
    analysisLoading: false,
    analysisError: null,
    analyzedSessionId: null,
    anchorPaths: [],
    selectedAnchorNames: [],
    pathsLoading: false,
    pathsError: null,
    pathsSessionId: null,
    showContactHints: true,
    applying: false,
    duplicating: false,
    actionSuccess: null,
    actionError: null,
  }),
}));
