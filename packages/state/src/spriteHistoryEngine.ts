/**
 * Sprite history engine — undo/redo stacks with bounded capacity.
 *
 * Follows the same contract as sceneHistoryEngine:
 * - past[] holds chronological entries (most recent last)
 * - future[] holds undone entries (next redo candidate last)
 * - isApplyingHistory guards against re-recording during undo/redo
 * - new edits clear the future stack
 * - maxEntries trims oldest entries
 */

import type { SpriteHistoryEntry, SpriteHistorySnapshot } from './spriteHistory.js';

const DEFAULT_MAX_ENTRIES = 50;

// ── State ──

export interface SpriteHistoryState {
  past: SpriteHistoryEntry[];
  future: SpriteHistoryEntry[];
  maxEntries: number;
  isApplyingHistory: boolean;
}

export function createEmptySpriteHistoryState(
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): SpriteHistoryState {
  return {
    past: [],
    future: [],
    maxEntries,
    isApplyingHistory: false,
  };
}

// ── Queries ──

export function canUndoSprite(history: SpriteHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoSprite(history: SpriteHistoryState): boolean {
  return history.future.length > 0;
}

export function getSpriteHistorySummary(history: SpriteHistoryState): {
  canUndo: boolean;
  canRedo: boolean;
  pastCount: number;
  futureCount: number;
  latestOperation: string | null;
} {
  const latest = history.past.length > 0 ? history.past[history.past.length - 1] : null;
  return {
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    pastCount: history.past.length,
    futureCount: history.future.length,
    latestOperation: latest?.label ?? null,
  };
}

// ── Record ──

export function recordSpriteHistoryEntry(
  history: SpriteHistoryState,
  entry: SpriteHistoryEntry,
): SpriteHistoryState {
  const newPast = [...history.past, entry];
  while (newPast.length > history.maxEntries) {
    newPast.shift();
  }
  return {
    ...history,
    past: newPast,
    future: [], // New edit invalidates redo stack
  };
}

// ── Undo ──

export interface SpriteHistoryUndoResult {
  history: SpriteHistoryState;
  snapshot: SpriteHistorySnapshot | undefined;
}

export function undoSpriteHistory(
  history: SpriteHistoryState,
): SpriteHistoryUndoResult {
  if (history.past.length === 0) {
    return { history, snapshot: undefined };
  }
  const newPast = [...history.past];
  const entry = newPast.pop()!;
  return {
    history: {
      ...history,
      past: newPast,
      future: [...history.future, entry],
      isApplyingHistory: true,
    },
    snapshot: entry.before,
  };
}

// ── Redo ──

export interface SpriteHistoryRedoResult {
  history: SpriteHistoryState;
  snapshot: SpriteHistorySnapshot | undefined;
}

export function redoSpriteHistory(
  history: SpriteHistoryState,
): SpriteHistoryRedoResult {
  if (history.future.length === 0) {
    return { history, snapshot: undefined };
  }
  const newFuture = [...history.future];
  const entry = newFuture.pop()!;
  return {
    history: {
      ...history,
      past: [...history.past, entry],
      future: newFuture,
      isApplyingHistory: true,
    },
    snapshot: entry.after,
  };
}

// ── Guard ──

export function finishApplyingSpriteHistory(
  history: SpriteHistoryState,
): SpriteHistoryState {
  return { ...history, isApplyingHistory: false };
}
