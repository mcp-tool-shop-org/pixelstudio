import { describe, it, expect } from 'vitest';
import { getContextualShortcuts } from './contextualShortcuts';
import type { ShortcutEditorState } from './contextualShortcuts';

const DEFAULT_STATE: ShortcutEditorState = {
  hasSelection: false,
  isStampMode: false,
  isCompareMode: false,
  isAnimation: false,
  isLibraryFocused: false,
  hasVariants: false,
  isPreviewingPalette: false,
};

describe('contextualShortcuts', () => {
  it('returns default shortcuts for empty state', () => {
    const result = getContextualShortcuts(DEFAULT_STATE);
    expect(result.context).toBe('default');
    expect(result.shortcuts.length).toBeGreaterThan(0);
  });

  it('returns selection shortcuts when selection active', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, hasSelection: true });
    expect(result.context).toBe('selection-active');
    expect(result.shortcuts.some((s) => s.keys === 'Ctrl+C')).toBe(true);
  });

  it('returns stamp shortcuts in stamp mode', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, isStampMode: true });
    expect(result.context).toBe('stamp-mode');
  });

  it('returns compare shortcuts in compare mode', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, isCompareMode: true });
    expect(result.context).toBe('compare-mode');
  });

  it('returns animation shortcuts for multi-frame', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, isAnimation: true });
    expect(result.context).toBe('animation');
    expect(result.shortcuts.some((s) => s.action === 'Duplicate frame')).toBe(true);
  });

  it('returns library shortcuts when library focused', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, isLibraryFocused: true });
    expect(result.context).toBe('library-focused');
    expect(result.shortcuts.some((s) => s.keys === 'Ctrl+F')).toBe(true);
  });

  it('returns variant shortcuts when variants exist', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, hasVariants: true });
    expect(result.context).toBe('variant-workflow');
  });

  it('returns palette preview shortcuts during preview', () => {
    const result = getContextualShortcuts({ ...DEFAULT_STATE, isPreviewingPalette: true });
    expect(result.context).toBe('palette-preview');
  });

  it('stamp mode has higher priority than selection', () => {
    const result = getContextualShortcuts({
      ...DEFAULT_STATE,
      hasSelection: true,
      isStampMode: true,
    });
    expect(result.context).toBe('stamp-mode');
  });

  it('palette preview has higher priority than selection', () => {
    const result = getContextualShortcuts({
      ...DEFAULT_STATE,
      hasSelection: true,
      isPreviewingPalette: true,
    });
    expect(result.context).toBe('palette-preview');
  });
});
