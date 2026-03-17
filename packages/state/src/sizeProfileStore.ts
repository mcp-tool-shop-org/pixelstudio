import { create } from 'zustand';
import type { SizeProfile, SizeProfileId } from '@glyphstudio/domain';
import { BUILT_IN_SIZE_PROFILES, createSizeProfile } from '@glyphstudio/domain';

interface SizeProfileState {
  /** All available size profiles (built-in + custom). */
  profiles: SizeProfile[];
  /** IDs of profiles currently selected for comparison. */
  activeProfileIds: SizeProfileId[];

  /** Add a custom size profile. Returns the new profile ID. */
  addProfile: (name: string, width: number, height: number, notes?: string) => SizeProfileId;
  /** Remove a profile by ID (built-in profiles cannot be removed). */
  removeProfile: (id: SizeProfileId) => void;

  /** Select a profile for comparison. */
  activateProfile: (id: SizeProfileId) => void;
  /** Deselect a profile from comparison. */
  deactivateProfile: (id: SizeProfileId) => void;
  /** Toggle a profile's active state. */
  toggleProfile: (id: SizeProfileId) => void;
  /** Set all active profiles at once. */
  setActiveProfiles: (ids: SizeProfileId[]) => void;
  /** Activate all profiles. */
  activateAll: () => void;
  /** Deactivate all profiles. */
  deactivateAll: () => void;

  /** Reset to built-in profiles only. */
  resetToBuiltIn: () => void;
}

const builtInIds = new Set(BUILT_IN_SIZE_PROFILES.map((p) => p.id));

export const useSizeProfileStore = create<SizeProfileState>((set, get) => ({
  profiles: [...BUILT_IN_SIZE_PROFILES],
  activeProfileIds: [],

  addProfile: (name, width, height, notes) => {
    const profile = createSizeProfile(name, width, height, notes);
    set((s) => ({ profiles: [...s.profiles, profile] }));
    return profile.id;
  },

  removeProfile: (id) => {
    if (builtInIds.has(id)) return; // protect built-ins
    set((s) => ({
      profiles: s.profiles.filter((p) => p.id !== id),
      activeProfileIds: s.activeProfileIds.filter((aid) => aid !== id),
    }));
  },

  activateProfile: (id) => {
    const { activeProfileIds, profiles } = get();
    if (!profiles.find((p) => p.id === id)) return;
    if (activeProfileIds.includes(id)) return;
    set({ activeProfileIds: [...activeProfileIds, id] });
  },

  deactivateProfile: (id) => {
    set((s) => ({ activeProfileIds: s.activeProfileIds.filter((aid) => aid !== id) }));
  },

  toggleProfile: (id) => {
    const { activeProfileIds } = get();
    if (activeProfileIds.includes(id)) {
      set({ activeProfileIds: activeProfileIds.filter((aid) => aid !== id) });
    } else {
      const { profiles } = get();
      if (profiles.find((p) => p.id === id)) {
        set({ activeProfileIds: [...activeProfileIds, id] });
      }
    }
  },

  setActiveProfiles: (ids) => {
    const validIds = ids.filter((id) => get().profiles.find((p) => p.id === id));
    set({ activeProfileIds: validIds });
  },

  activateAll: () => {
    set((s) => ({ activeProfileIds: s.profiles.map((p) => p.id) }));
  },

  deactivateAll: () => {
    set({ activeProfileIds: [] });
  },

  resetToBuiltIn: () => {
    set({ profiles: [...BUILT_IN_SIZE_PROFILES], activeProfileIds: [] });
  },
}));
