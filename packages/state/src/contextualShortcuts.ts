/**
 * Contextual shortcuts — state-aware command discovery.
 *
 * Shows the most relevant shortcuts for the current editor state.
 * Not a full keyboard reference — just the strongest moves for
 * what the user is doing right now.
 */

/** A contextual shortcut to display. */
export interface ContextualShortcut {
  /** Keyboard shortcut label (e.g., "Ctrl+D", "Alt+1"). */
  keys: string;
  /** What the shortcut does. */
  action: string;
}

/** Editor context for selecting relevant shortcuts. */
export type ShortcutContext =
  | 'default'
  | 'selection-active'
  | 'stamp-mode'
  | 'compare-mode'
  | 'animation'
  | 'library-focused'
  | 'variant-workflow'
  | 'palette-preview';

/** Map of context → relevant shortcuts. */
const SHORTCUT_MAP: Record<ShortcutContext, ContextualShortcut[]> = {
  default: [
    { keys: 'B', action: 'Pencil' },
    { keys: 'E', action: 'Eraser' },
    { keys: 'G', action: 'Fill' },
    { keys: 'M', action: 'Marquee select' },
    { keys: 'X', action: 'Swap FG/BG' },
    { keys: 'Ctrl+Z', action: 'Undo' },
  ],
  'selection-active': [
    { keys: 'Ctrl+C', action: 'Copy selection' },
    { keys: 'Ctrl+X', action: 'Cut selection' },
    { keys: 'Ctrl+V', action: 'Paste' },
    { keys: 'Del', action: 'Clear selection' },
    { keys: 'Escape', action: 'Deselect' },
  ],
  'stamp-mode': [
    { keys: 'Click', action: 'Place stamp' },
    { keys: 'Escape', action: 'Exit stamp mode' },
  ],
  'compare-mode': [
    { keys: 'Click \u2194', action: 'Toggle comparison' },
  ],
  animation: [
    { keys: 'Ctrl+D', action: 'Duplicate frame' },
    { keys: 'Space', action: 'Play/Stop' },
    { keys: '\u2190 \u2192', action: 'Step frames' },
  ],
  'library-focused': [
    { keys: 'Ctrl+F', action: 'Focus search' },
    { keys: '\u2191 \u2193', action: 'Navigate items' },
    { keys: 'Enter', action: 'Activate item' },
  ],
  'variant-workflow': [
    { keys: '+ Variant', action: 'Fork current sequence' },
    { keys: '\u2194', action: 'Compare with ghost overlay' },
  ],
  'palette-preview': [
    { keys: 'Apply', action: 'Commit palette remap' },
    { keys: 'Cancel', action: 'Discard preview' },
  ],
};

/** Editor state for determining active contexts. */
export interface ShortcutEditorState {
  hasSelection: boolean;
  isStampMode: boolean;
  isCompareMode: boolean;
  isAnimation: boolean;
  isLibraryFocused: boolean;
  hasVariants: boolean;
  isPreviewingPalette: boolean;
}

/**
 * Get the relevant shortcuts for the current editor state.
 *
 * Returns the most specific context's shortcuts. If multiple
 * specific contexts apply, returns the highest-priority one.
 */
export function getContextualShortcuts(state: ShortcutEditorState): {
  context: ShortcutContext;
  shortcuts: ContextualShortcut[];
} {
  // Priority order: most specific state wins
  if (state.isStampMode) {
    return { context: 'stamp-mode', shortcuts: SHORTCUT_MAP['stamp-mode'] };
  }
  if (state.isPreviewingPalette) {
    return { context: 'palette-preview', shortcuts: SHORTCUT_MAP['palette-preview'] };
  }
  if (state.isCompareMode) {
    return { context: 'compare-mode', shortcuts: SHORTCUT_MAP['compare-mode'] };
  }
  if (state.hasSelection) {
    return { context: 'selection-active', shortcuts: SHORTCUT_MAP['selection-active'] };
  }
  if (state.isLibraryFocused) {
    return { context: 'library-focused', shortcuts: SHORTCUT_MAP['library-focused'] };
  }
  if (state.isAnimation) {
    return { context: 'animation', shortcuts: SHORTCUT_MAP.animation };
  }
  if (state.hasVariants) {
    return { context: 'variant-workflow', shortcuts: SHORTCUT_MAP['variant-workflow'] };
  }
  return { context: 'default', shortcuts: SHORTCUT_MAP.default };
}
