import { describe, it, expect } from 'vitest';
import { generateSuggestions, type Suggestion } from './aiSuggestions';
import type { CanvasContext } from './aiSettings';

function makeContext(overrides: Partial<CanvasContext> = {}): CanvasContext {
  return {
    document: { width: 32, height: 32, activeFrameName: 'Frame 1', activeLayerName: 'Layer 1', packageName: 'test' },
    layers: [
      { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1.0, zIndex: 0 },
    ],
    selection: null,
    animation: { frameCount: 1, activeFrameIndex: 0, frames: [{ id: 'frame-1', name: 'Frame 1', durationMs: null }] },
    history: { canUndo: true, canRedo: false, undoDepth: 3, redoDepth: 0, recentTools: ['brush'] },
    snapshotBase64: null,
    ...overrides,
  };
}

describe('generateSuggestions', () => {
  it('returns empty for brand new canvas', () => {
    const ctx = makeContext({
      history: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0, recentTools: [] },
    });
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map((s) => s.id);
    expect(ids).toContain('fill-bg');
    expect(ids).toContain('add-frame');
  });

  it('suggests add-frame for single-frame sprite', () => {
    const ctx = makeContext();
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.some((s) => s.id === 'add-frame')).toBe(true);
  });

  it('suggests compare-frames for multi-frame sprite', () => {
    const ctx = makeContext({
      animation: {
        frameCount: 3,
        activeFrameIndex: 0,
        frames: [
          { id: 'f1', name: 'Frame 1', durationMs: null },
          { id: 'f2', name: 'Frame 2', durationMs: null },
          { id: 'f3', name: 'Frame 3', durationMs: null },
        ],
      },
    });
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.some((s) => s.id === 'compare-frames')).toBe(true);
  });

  it('suggests analyze-colors when there is content', () => {
    const ctx = makeContext();
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.some((s) => s.id === 'analyze-colors')).toBe(true);
  });

  it('suggests mirror-sprite when content exists and no selection', () => {
    const ctx = makeContext({
      history: { canUndo: true, canRedo: false, undoDepth: 5, redoDepth: 0, recentTools: ['brush'] },
    });
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.some((s) => s.id === 'mirror-sprite')).toBe(true);
  });

  it('does not suggest mirror-sprite when selection is active', () => {
    const ctx = makeContext({
      selection: { x: 0, y: 0, width: 16, height: 16 },
      history: { canUndo: true, canRedo: false, undoDepth: 5, redoDepth: 0, recentTools: ['brush'] },
    });
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.some((s) => s.id === 'mirror-sprite')).toBe(false);
  });

  it('respects maxSuggestions limit', () => {
    const ctx = makeContext({
      history: { canUndo: true, canRedo: false, undoDepth: 10, redoDepth: 0, recentTools: ['brush'] },
    });
    const suggestions = generateSuggestions(ctx, 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('all suggestions have required fields', () => {
    const ctx = makeContext({
      history: { canUndo: true, canRedo: false, undoDepth: 10, redoDepth: 0, recentTools: ['brush'] },
    });
    const suggestions = generateSuggestions(ctx, 10);
    for (const s of suggestions) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.prompt).toBeTruthy();
      expect(typeof s.priority).toBe('number');
    }
  });

  it('returns suggestions sorted by priority', () => {
    const ctx = makeContext({
      history: { canUndo: true, canRedo: false, undoDepth: 10, redoDepth: 0, recentTools: ['brush'] },
    });
    const suggestions = generateSuggestions(ctx, 10);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i - 1].priority);
    }
  });
});
