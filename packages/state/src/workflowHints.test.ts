import { describe, it, expect } from 'vitest';
import { WORKFLOW_HINTS, evaluateHintTriggers } from './workflowHints';
import type { HintEditorState } from './workflowHints';

const EMPTY_STATE: HintEditorState = {
  hasSelection: false,
  frameCount: 1,
  paletteSetCount: 0,
  variantCount: 0,
  partCount: 0,
  isStampMode: false,
  isCompareMode: false,
  isPreviewingPalette: false,
  bundleOutputCount: 0,
};

describe('workflowHints', () => {
  it('has built-in hints', () => {
    expect(WORKFLOW_HINTS.length).toBeGreaterThan(0);
  });

  it('returns no hints for empty/default state', () => {
    const result = evaluateHintTriggers(EMPTY_STATE, new Set());
    expect(result).toHaveLength(0);
  });

  it('triggers selection hint when selection exists', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, hasSelection: true }, new Set());
    expect(result.some((h) => h.id === 'wh-selection-save')).toBe(true);
  });

  it('triggers frame hint for multi-frame documents', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, frameCount: 4 }, new Set());
    expect(result.some((h) => h.id === 'wh-frames-onion')).toBe(true);
  });

  it('triggers variant hint when variants exist', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, variantCount: 2 }, new Set());
    expect(result.some((h) => h.id === 'wh-variant-compare')).toBe(true);
  });

  it('triggers stamp hint in stamp mode', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, isStampMode: true }, new Set());
    expect(result.some((h) => h.id === 'wh-stamp-place')).toBe(true);
  });

  it('triggers compare hint in compare mode', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, isCompareMode: true }, new Set());
    expect(result.some((h) => h.id === 'wh-compare-toggle')).toBe(true);
  });

  it('triggers palette preview hint', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, isPreviewingPalette: true }, new Set());
    expect(result.some((h) => h.id === 'wh-palette-preview')).toBe(true);
  });

  it('triggers bundle hint for multiple outputs', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, bundleOutputCount: 4 }, new Set());
    expect(result.some((h) => h.id === 'wh-bundle-scope')).toBe(true);
  });

  it('triggers parts hint when parts exist', () => {
    const result = evaluateHintTriggers({ ...EMPTY_STATE, partCount: 3 }, new Set());
    expect(result.some((h) => h.id === 'wh-parts-library')).toBe(true);
  });

  it('excludes dismissed hints', () => {
    const dismissed = new Set(['wh-selection-save']);
    const result = evaluateHintTriggers({ ...EMPTY_STATE, hasSelection: true }, dismissed);
    expect(result.some((h) => h.id === 'wh-selection-save')).toBe(false);
  });

  it('triggers multiple hints simultaneously', () => {
    const result = evaluateHintTriggers({
      ...EMPTY_STATE,
      hasSelection: true,
      frameCount: 3,
      variantCount: 1,
    }, new Set());
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});
