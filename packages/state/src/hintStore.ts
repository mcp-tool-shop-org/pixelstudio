/**
 * Hint store — tracks which contextual hints have been dismissed.
 *
 * Persists via localStorage so hints don't repeat across sessions.
 */

import { create } from 'zustand';

const STORAGE_KEY = 'glyphstudio_dismissed_hints';

function loadDismissed(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

interface HintState {
  /** Hint IDs that have been dismissed. */
  dismissedIds: Set<string>;
  /** Active hints for the current recipe (set on project start). */
  activeHints: { id: string; text: string }[];

  /** Set active hints (from recipe launch). */
  setActiveHints: (hints: { id: string; text: string }[]) => void;
  /** Dismiss a hint (permanently). */
  dismissHint: (id: string) => void;
  /** Check if a hint has been dismissed. */
  isDismissed: (id: string) => boolean;
  /** Clear active hints. */
  clearActiveHints: () => void;
}

export const useHintStore = create<HintState>((set, get) => ({
  dismissedIds: loadDismissed(),
  activeHints: [],

  setActiveHints: (hints) => {
    const dismissed = get().dismissedIds;
    const visible = hints.filter((h) => !dismissed.has(h.id));
    set({ activeHints: visible });
  },

  dismissHint: (id) => {
    set((s) => {
      const next = new Set(s.dismissedIds);
      next.add(id);
      saveDismissed(next);
      return {
        dismissedIds: next,
        activeHints: s.activeHints.filter((h) => h.id !== id),
      };
    });
  },

  isDismissed: (id) => get().dismissedIds.has(id),

  clearActiveHints: () => set({ activeHints: [] }),
}));
