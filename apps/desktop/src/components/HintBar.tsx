import { useEffect, useMemo } from 'react';
import { useSpriteEditorStore, useHintStore } from '@glyphstudio/state';
import { evaluateHintTriggers } from '@glyphstudio/state';
import type { HintEditorState } from '@glyphstudio/state';
import { loadPartLibrary } from '../lib/partLibraryStorage';

/**
 * HintBar — shows contextual hints from recipes and workflow triggers.
 *
 * Watches editor state and evaluates hint triggers reactively.
 * Hints are dismissible and non-repeating (tracked in useHintStore).
 * Renders nothing when no active hints.
 */
export function HintBar() {
  const activeHints = useHintStore((s) => s.activeHints);
  const dismissedIds = useHintStore((s) => s.dismissedIds);
  const setActiveHints = useHintStore((s) => s.setActiveHints);
  const dismissHint = useHintStore((s) => s.dismissHint);

  // Watch relevant editor state for trigger evaluation
  const doc = useSpriteEditorStore((s) => s.document);
  const selectionRect = useSpriteEditorStore((s) => s.selectionRect);
  const activeStampPartId = useSpriteEditorStore((s) => s.activeStampPartId);
  const compareVariantId = useSpriteEditorStore((s) => s.compareVariantId);
  const previewPaletteSetId = useSpriteEditorStore((s) => s.previewPaletteSetId);

  // Build editor state snapshot for trigger evaluation
  const editorState: HintEditorState = useMemo(() => ({
    hasSelection: selectionRect !== null,
    frameCount: doc?.frames.length ?? 0,
    paletteSetCount: (doc?.paletteSets ?? []).length,
    variantCount: (doc?.variants ?? []).length,
    partCount: loadPartLibrary().parts.length,
    isStampMode: activeStampPartId !== null,
    isCompareMode: compareVariantId !== null,
    isPreviewingPalette: previewPaletteSetId !== null,
    bundleOutputCount: Math.max(1, (doc?.variants ?? []).length + 1) * Math.max(1, (doc?.paletteSets ?? []).length + 1),
  }), [doc, selectionRect, activeStampPartId, compareVariantId, previewPaletteSetId]);

  // Evaluate triggers when state changes
  useEffect(() => {
    if (!doc) return;
    const triggered = evaluateHintTriggers(editorState, dismissedIds);
    if (triggered.length > 0) {
      // Merge with existing recipe hints (don't replace them)
      const existingIds = new Set(activeHints.map((h) => h.id));
      const newHints = triggered.filter((h) => !existingIds.has(h.id));
      if (newHints.length > 0) {
        setActiveHints([...activeHints, ...newHints.map((h) => ({ id: h.id, text: h.text }))]);
      }
    }
  }, [editorState, doc]); // intentionally not including activeHints to avoid infinite loop

  if (activeHints.length === 0) return null;

  return (
    <div className="hint-bar" data-testid="hint-bar">
      {activeHints.map((hint) => (
        <div key={hint.id} className="hint-item" data-testid={`hint-${hint.id}`}>
          <span className="hint-text">{hint.text}</span>
          <button
            className="hint-dismiss"
            onClick={() => dismissHint(hint.id)}
            title="Dismiss"
            data-testid={`hint-dismiss-${hint.id}`}
          >
            &#x2715;
          </button>
        </div>
      ))}
    </div>
  );
}
