import { create } from 'zustand';

/**
 * Supported game-facing sprite resolutions for concept→sprite translation.
 * These are reinterpretation targets, not downscale targets.
 */
export const TRANSLATION_RESOLUTIONS = [32, 48, 64] as const;
export type TranslationResolution = (typeof TRANSLATION_RESOLUTIONS)[number];

/** A concept→sprite translation session. */
export interface TranslationSession {
  id: string;
  /** Display name for this translation (e.g. "Ranger → 48×48") */
  name: string;
  /** Absolute path to the source concept PNG (500×500 from Stage 39.5) */
  conceptPath: string;
  /** Source concept dimensions */
  conceptWidth: number;
  conceptHeight: number;
  /** Target sprite resolution */
  targetWidth: TranslationResolution;
  targetHeight: TranslationResolution;
  /** What survived translation (populated during/after) */
  survivedCues: string[];
  /** What was dropped (populated during/after) */
  droppedCues: string[];
  /** What needed exaggeration (populated during/after) */
  exaggeratedCues: string[];
  /** Free-form notes about translation decisions */
  notes: string;
  /** Timestamp */
  createdAt: string;
  /** Whether the translation is complete */
  complete: boolean;
}

interface TranslationState {
  sessions: TranslationSession[];
  activeSessionId: string | null;

  createSession: (
    name: string,
    conceptPath: string,
    conceptWidth: number,
    conceptHeight: number,
    targetWidth: TranslationResolution,
    targetHeight: TranslationResolution,
  ) => string;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;

  addSurvivedCue: (id: string, cue: string) => void;
  addDroppedCue: (id: string, cue: string) => void;
  addExaggeratedCue: (id: string, cue: string) => void;
  setNotes: (id: string, notes: string) => void;
  markComplete: (id: string) => void;
}

let sessionCounter = 0;

function generateSessionId(): string {
  return `trans-${Date.now()}-${++sessionCounter}`;
}

function updateSession(
  sessions: TranslationSession[],
  id: string,
  patch: Partial<TranslationSession>,
): TranslationSession[] {
  return sessions.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export const useTranslationStore = create<TranslationState>((set) => ({
  sessions: [],
  activeSessionId: null,

  createSession: (name, conceptPath, conceptWidth, conceptHeight, targetWidth, targetHeight) => {
    const id = generateSessionId();
    const session: TranslationSession = {
      id,
      name,
      conceptPath,
      conceptWidth,
      conceptHeight,
      targetWidth,
      targetHeight,
      survivedCues: [],
      droppedCues: [],
      exaggeratedCues: [],
      notes: '',
      createdAt: new Date().toISOString(),
      complete: false,
    };
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: id,
    }));
    return id;
  },

  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    })),

  setActiveSession: (id) => set({ activeSessionId: id }),

  addSurvivedCue: (id, cue) =>
    set((s) => {
      const sess = s.sessions.find((x) => x.id === id);
      if (!sess || sess.survivedCues.includes(cue)) return s;
      return { sessions: updateSession(s.sessions, id, { survivedCues: [...sess.survivedCues, cue] }) };
    }),

  addDroppedCue: (id, cue) =>
    set((s) => {
      const sess = s.sessions.find((x) => x.id === id);
      if (!sess || sess.droppedCues.includes(cue)) return s;
      return { sessions: updateSession(s.sessions, id, { droppedCues: [...sess.droppedCues, cue] }) };
    }),

  addExaggeratedCue: (id, cue) =>
    set((s) => {
      const sess = s.sessions.find((x) => x.id === id);
      if (!sess || sess.exaggeratedCues.includes(cue)) return s;
      return { sessions: updateSession(s.sessions, id, { exaggeratedCues: [...sess.exaggeratedCues, cue] }) };
    }),

  setNotes: (id, notes) =>
    set((s) => ({ sessions: updateSession(s.sessions, id, { notes }) })),

  markComplete: (id) =>
    set((s) => ({ sessions: updateSession(s.sessions, id, { complete: true }) })),
}));
