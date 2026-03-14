import { create } from 'zustand';
import type { Point } from '@pixelstudio/domain';

interface LocomotionAnalysis {
  id: string;
  weightClass: 'light' | 'standard' | 'heavy' | 'unknown';
  cadence: number | null;
  strideSymmetryScore: number | null;
  centerOfMassPath: Point[];
  silhouetteStabilityScore: number | null;
  notes: string[];
}

type PreviewMode = 'gameplay' | 'edit' | 'side-by-side' | 'ghost-compare' | 'contact-only' | 'silhouette-only';

interface LocomotionState {
  activeAnalysisId: string | null;
  analysesById: Record<string, LocomotionAnalysis>;
  previewMode: PreviewMode;
  showFootfalls: boolean;
  showRootMotion: boolean;
  showCenterOfMass: boolean;
  showCollisionWarnings: boolean;

  setAnalysis: (analysis: LocomotionAnalysis) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  toggleOverlay: (key: 'showFootfalls' | 'showRootMotion' | 'showCenterOfMass' | 'showCollisionWarnings') => void;
}

export const useLocomotionStore = create<LocomotionState>((set) => ({
  activeAnalysisId: null,
  analysesById: {},
  previewMode: 'gameplay',
  showFootfalls: true,
  showRootMotion: true,
  showCenterOfMass: true,
  showCollisionWarnings: true,

  setAnalysis: (analysis) =>
    set((s) => ({
      activeAnalysisId: analysis.id,
      analysesById: { ...s.analysesById, [analysis.id]: analysis },
    })),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  toggleOverlay: (key) => set((s) => ({ [key]: !s[key] })),
}));
