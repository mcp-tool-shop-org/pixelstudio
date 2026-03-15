import { create } from 'zustand';
import type { WorkspaceMode } from '@glyphstudio/domain';

interface WorkspaceState {
  activeMode: WorkspaceMode;
  previousMode: WorkspaceMode | null;
  bottomDockOpen: boolean;
  leftRailCollapsed: boolean;

  setMode: (mode: WorkspaceMode) => void;
  toggleBottomDock: () => void;
  toggleLeftRail: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeMode: 'project-home',
  previousMode: null,
  bottomDockOpen: true,
  leftRailCollapsed: false,

  setMode: (mode) => set((s) => ({ activeMode: mode, previousMode: s.activeMode })),
  toggleBottomDock: () => set((s) => ({ bottomDockOpen: !s.bottomDockOpen })),
  toggleLeftRail: () => set((s) => ({ leftRailCollapsed: !s.leftRailCollapsed })),
}));
