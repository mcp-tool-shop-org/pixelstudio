import { create } from 'zustand';

interface AppShellState {
  appReady: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  backgroundJobTrayOpen: boolean;
  crashRecoveryAvailable: boolean;
  lastError: string | null;

  setAppReady: (ready: boolean) => void;
  toggleCommandPalette: () => void;
  toggleSettings: () => void;
  toggleJobTray: () => void;
  setError: (error: string | null) => void;
  setCrashRecoveryAvailable: (available: boolean) => void;
}

export const useAppShellStore = create<AppShellState>((set) => ({
  appReady: false,
  commandPaletteOpen: false,
  settingsOpen: false,
  backgroundJobTrayOpen: false,
  crashRecoveryAvailable: false,
  lastError: null,

  setAppReady: (ready) => set({ appReady: ready }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  toggleJobTray: () => set((s) => ({ backgroundJobTrayOpen: !s.backgroundJobTrayOpen })),
  setError: (error) => set({ lastError: error }),
  setCrashRecoveryAvailable: (available) => set({ crashRecoveryAvailable: available }),
}));
