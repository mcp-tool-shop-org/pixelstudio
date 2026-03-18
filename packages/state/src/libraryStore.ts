/**
 * Library store — session-scoped state for pinning, recency, and view modes.
 *
 * No persistence — resets on app restart. This is working-memory
 * prioritization, not permanent organization.
 */

import { create } from 'zustand';

/** Library view mode. */
export type LibraryViewMode = 'all' | 'recent' | 'pinned';

const MAX_RECENT = 12;

interface LibraryState {
  /** Recently accessed item IDs, most recent first. */
  recentIds: string[];
  /** User-pinned item IDs. */
  pinnedIds: string[];
  /** Active view mode. */
  viewMode: LibraryViewMode;

  /** Push an item to the front of the recent list. */
  pushRecent: (id: string) => void;
  /** Toggle an item's pinned state. */
  togglePin: (id: string) => void;
  /** Set the active view mode. */
  setViewMode: (mode: LibraryViewMode) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  recentIds: [],
  pinnedIds: [],
  viewMode: 'all',

  pushRecent: (id) =>
    set((s) => ({
      recentIds: [id, ...s.recentIds.filter((r) => r !== id)].slice(0, MAX_RECENT),
    })),

  togglePin: (id) =>
    set((s) => ({
      pinnedIds: s.pinnedIds.includes(id)
        ? s.pinnedIds.filter((p) => p !== id)
        : [...s.pinnedIds, id],
    })),

  setViewMode: (viewMode) => set({ viewMode }),
}));
