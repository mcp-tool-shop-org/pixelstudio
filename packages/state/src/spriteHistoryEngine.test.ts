/**
 * Tests for sprite history engine — undo/redo stacks, recording, guards.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { SpriteHistoryState } from './spriteHistoryEngine';
import {
  createEmptySpriteHistoryState,
  canUndoSprite,
  canRedoSprite,
  getSpriteHistorySummary,
  recordSpriteHistoryEntry,
  undoSpriteHistory,
  redoSpriteHistory,
  finishApplyingSpriteHistory,
} from './spriteHistoryEngine';
import {
  captureSpriteSnapshot,
  createSpriteHistoryEntry,
  describeSpriteHistoryOperation,
} from './spriteHistory';
import { createSpriteDocument, createBlankPixelBuffer } from '@glyphstudio/domain';

function makeDoc(name = 'Test', w = 4, h = 4) {
  const doc = createSpriteDocument(name, w, h);
  const layerId = doc.frames[0].layers[0].id;
  const buf = createBlankPixelBuffer(w, h);
  return { doc, layerId, buffers: { [layerId]: buf } };
}

function makeEntry(kind: 'draw' | 'fill' = 'draw') {
  const { doc, buffers, layerId } = makeDoc();
  const before = captureSpriteSnapshot(doc, buffers, 0, layerId);
  // Modify a pixel so before != after
  const afterBuffers = { ...buffers };
  const afterBuf = createBlankPixelBuffer(4, 4);
  afterBuf.data[0] = 255; // Set red channel of pixel (0,0)
  afterBuffers[layerId] = afterBuf;
  const after = captureSpriteSnapshot(doc, afterBuffers, 0, layerId);
  return createSpriteHistoryEntry(kind, before, after)!;
}

describe('createEmptySpriteHistoryState', () => {
  it('creates empty state with defaults', () => {
    const state = createEmptySpriteHistoryState();
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    expect(state.maxEntries).toBe(50);
    expect(state.isApplyingHistory).toBe(false);
  });

  it('accepts custom maxEntries', () => {
    const state = createEmptySpriteHistoryState(10);
    expect(state.maxEntries).toBe(10);
  });
});

describe('canUndoSprite / canRedoSprite', () => {
  it('cannot undo/redo on empty state', () => {
    const state = createEmptySpriteHistoryState();
    expect(canUndoSprite(state)).toBe(false);
    expect(canRedoSprite(state)).toBe(false);
  });

  it('can undo after recording', () => {
    let state = createEmptySpriteHistoryState();
    state = recordSpriteHistoryEntry(state, makeEntry());
    expect(canUndoSprite(state)).toBe(true);
    expect(canRedoSprite(state)).toBe(false);
  });
});

describe('recordSpriteHistoryEntry', () => {
  it('appends to past and clears future', () => {
    let state = createEmptySpriteHistoryState();
    state = recordSpriteHistoryEntry(state, makeEntry());
    expect(state.past).toHaveLength(1);
    expect(state.future).toHaveLength(0);
  });

  it('trims oldest when over capacity', () => {
    let state = createEmptySpriteHistoryState(3);
    state = recordSpriteHistoryEntry(state, makeEntry());
    state = recordSpriteHistoryEntry(state, makeEntry());
    state = recordSpriteHistoryEntry(state, makeEntry());
    state = recordSpriteHistoryEntry(state, makeEntry());
    expect(state.past).toHaveLength(3);
  });

  it('clears future on new edit', () => {
    let state = createEmptySpriteHistoryState();
    state = recordSpriteHistoryEntry(state, makeEntry());
    state = recordSpriteHistoryEntry(state, makeEntry());
    const { history } = undoSpriteHistory(state);
    expect(canRedoSprite(history)).toBe(true);
    // New edit should clear future
    const afterNewEdit = recordSpriteHistoryEntry(history, makeEntry());
    expect(canRedoSprite(afterNewEdit)).toBe(false);
  });
});

describe('undoSpriteHistory', () => {
  it('returns undefined snapshot when nothing to undo', () => {
    const state = createEmptySpriteHistoryState();
    const result = undoSpriteHistory(state);
    expect(result.snapshot).toBeUndefined();
  });

  it('pops last entry and returns before snapshot', () => {
    let state = createEmptySpriteHistoryState();
    const entry = makeEntry();
    state = recordSpriteHistoryEntry(state, entry);
    const result = undoSpriteHistory(state);
    expect(result.snapshot).toBeDefined();
    expect(result.history.past).toHaveLength(0);
    expect(result.history.future).toHaveLength(1);
    expect(result.history.isApplyingHistory).toBe(true);
  });
});

describe('redoSpriteHistory', () => {
  it('returns undefined snapshot when nothing to redo', () => {
    const state = createEmptySpriteHistoryState();
    const result = redoSpriteHistory(state);
    expect(result.snapshot).toBeUndefined();
  });

  it('pops future and returns after snapshot', () => {
    let state = createEmptySpriteHistoryState();
    state = recordSpriteHistoryEntry(state, makeEntry());
    const { history: undone } = undoSpriteHistory(state);
    const result = redoSpriteHistory(undone);
    expect(result.snapshot).toBeDefined();
    expect(result.history.past).toHaveLength(1);
    expect(result.history.future).toHaveLength(0);
    expect(result.history.isApplyingHistory).toBe(true);
  });
});

describe('finishApplyingSpriteHistory', () => {
  it('clears isApplyingHistory flag', () => {
    let state = createEmptySpriteHistoryState();
    state = recordSpriteHistoryEntry(state, makeEntry());
    const { history } = undoSpriteHistory(state);
    expect(history.isApplyingHistory).toBe(true);
    const finished = finishApplyingSpriteHistory(history);
    expect(finished.isApplyingHistory).toBe(false);
  });
});

describe('getSpriteHistorySummary', () => {
  it('returns summary with counts', () => {
    let state = createEmptySpriteHistoryState();
    state = recordSpriteHistoryEntry(state, makeEntry());
    state = recordSpriteHistoryEntry(state, makeEntry('fill'));
    const summary = getSpriteHistorySummary(state);
    expect(summary.canUndo).toBe(true);
    expect(summary.canRedo).toBe(false);
    expect(summary.pastCount).toBe(2);
    expect(summary.futureCount).toBe(0);
    expect(summary.latestOperation).toBe('Fill');
  });
});

describe('createSpriteHistoryEntry', () => {
  it('returns null for identical snapshots (no-op)', () => {
    const { doc, buffers, layerId } = makeDoc();
    const snap = captureSpriteSnapshot(doc, buffers, 0, layerId);
    const snap2 = captureSpriteSnapshot(doc, buffers, 0, layerId);
    const entry = createSpriteHistoryEntry('draw', snap, snap2);
    expect(entry).toBeNull();
  });

  it('creates entry for different snapshots', () => {
    const entry = makeEntry();
    expect(entry).not.toBeNull();
    expect(entry.kind).toBe('draw');
    expect(entry.label).toBe('Draw');
    expect(entry.timestamp).toBeDefined();
  });
});

describe('describeSpriteHistoryOperation', () => {
  it('returns human labels', () => {
    expect(describeSpriteHistoryOperation('draw')).toBe('Draw');
    expect(describeSpriteHistoryOperation('add-frame')).toBe('Add frame');
    expect(describeSpriteHistoryOperation('cut-selection')).toBe('Cut selection');
    expect(describeSpriteHistoryOperation('import-sheet')).toBe('Import sheet');
  });
});

describe('captureSpriteSnapshot', () => {
  it('deep-clones pixel buffers', () => {
    const { doc, buffers, layerId } = makeDoc();
    const snap = captureSpriteSnapshot(doc, buffers, 0, layerId);
    // Modify original — snapshot should be unaffected
    buffers[layerId].data[0] = 99;
    expect(snap.pixelBuffers[layerId].data[0]).toBe(0);
  });

  it('deep-clones document', () => {
    const { doc, buffers, layerId } = makeDoc();
    const snap = captureSpriteSnapshot(doc, buffers, 0, layerId);
    doc.name = 'Modified';
    expect(snap.document.name).toBe('Test');
  });
});
