/**
 * Workflow hints — state-triggered contextual hints for power discovery.
 *
 * Each hint fires once based on editor state conditions. Dismissed hints
 * never re-appear (tracked in useHintStore). Hints point to one strong
 * action, not a list.
 */

/** A state-triggered workflow hint. */
export interface WorkflowHint {
  id: string;
  /** Short, actionable text pointing to one strong move. */
  text: string;
  /** When this hint should trigger. */
  trigger: WorkflowHintTrigger;
}

/** What editor state triggers a hint. */
export type WorkflowHintTrigger =
  | { kind: 'has-selection' }
  | { kind: 'has-multiple-frames' }
  | { kind: 'has-palette-sets' }
  | { kind: 'has-variants' }
  | { kind: 'has-parts' }
  | { kind: 'stamp-mode-active' }
  | { kind: 'compare-mode-active' }
  | { kind: 'preview-palette-active' }
  | { kind: 'multiple-bundle-outputs' };

/** Editor state snapshot for trigger evaluation. */
export interface HintEditorState {
  hasSelection: boolean;
  frameCount: number;
  paletteSetCount: number;
  variantCount: number;
  partCount: number;
  isStampMode: boolean;
  isCompareMode: boolean;
  isPreviewingPalette: boolean;
  bundleOutputCount: number;
}

// ── Built-in workflow hints ──

export const WORKFLOW_HINTS: WorkflowHint[] = [
  {
    id: 'wh-selection-save',
    text: 'Save this selection as a reusable part via Library \u2192 Save Selection',
    trigger: { kind: 'has-selection' },
  },
  {
    id: 'wh-frames-onion',
    text: 'Enable onion skin to see adjacent frames while drawing',
    trigger: { kind: 'has-multiple-frames' },
  },
  {
    id: 'wh-palette-preview',
    text: 'Click Apply to commit, or Cancel to discard this palette preview',
    trigger: { kind: 'preview-palette-active' },
  },
  {
    id: 'wh-variant-compare',
    text: 'Click the \u2194 button on a variant tab to compare as ghost overlay',
    trigger: { kind: 'has-variants' },
  },
  {
    id: 'wh-stamp-place',
    text: 'Click on the canvas to stamp this part. Click the part again to exit stamp mode',
    trigger: { kind: 'stamp-mode-active' },
  },
  {
    id: 'wh-compare-toggle',
    text: 'Compare mode shows a ghost overlay of another variant at the same frame',
    trigger: { kind: 'compare-mode-active' },
  },
  {
    id: 'wh-bundle-scope',
    text: 'Open Bundle panel in export mode to export all variants and palette combinations at once',
    trigger: { kind: 'multiple-bundle-outputs' },
  },
  {
    id: 'wh-parts-library',
    text: 'Use Ctrl+F in Library panel for fast part and palette search',
    trigger: { kind: 'has-parts' },
  },
];

/**
 * Evaluate which hints should be active based on current editor state.
 *
 * Returns hint IDs that should fire. Caller is responsible for filtering
 * out already-dismissed hints (via useHintStore).
 */
export function evaluateHintTriggers(
  state: HintEditorState,
  dismissedIds: Set<string>,
): WorkflowHint[] {
  const triggered: WorkflowHint[] = [];

  for (const hint of WORKFLOW_HINTS) {
    if (dismissedIds.has(hint.id)) continue;

    let shouldFire = false;
    switch (hint.trigger.kind) {
      case 'has-selection':
        shouldFire = state.hasSelection;
        break;
      case 'has-multiple-frames':
        shouldFire = state.frameCount > 1;
        break;
      case 'has-palette-sets':
        shouldFire = state.paletteSetCount > 0;
        break;
      case 'has-variants':
        shouldFire = state.variantCount > 0;
        break;
      case 'has-parts':
        shouldFire = state.partCount > 0;
        break;
      case 'stamp-mode-active':
        shouldFire = state.isStampMode;
        break;
      case 'compare-mode-active':
        shouldFire = state.isCompareMode;
        break;
      case 'preview-palette-active':
        shouldFire = state.isPreviewingPalette;
        break;
      case 'multiple-bundle-outputs':
        shouldFire = state.bundleOutputCount > 1;
        break;
    }

    if (shouldFire) {
      triggered.push(hint);
    }
  }

  return triggered;
}
