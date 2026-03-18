import { useMemo, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { getContextualShortcuts } from '@glyphstudio/state';
import type { ShortcutEditorState } from '@glyphstudio/state';

/**
 * ShortcutStrip — contextual command discovery bar.
 *
 * Shows the most relevant shortcuts for the current editor state.
 * Collapsible, remembers collapsed state. Not a full reference —
 * just the strongest moves for what the user is doing now.
 */
export function ShortcutStrip() {
  const doc = useSpriteEditorStore((s) => s.document);
  const selectionRect = useSpriteEditorStore((s) => s.selectionRect);
  const activeStampPartId = useSpriteEditorStore((s) => s.activeStampPartId);
  const compareVariantId = useSpriteEditorStore((s) => s.compareVariantId);
  const previewPaletteSetId = useSpriteEditorStore((s) => s.previewPaletteSetId);

  const [collapsed, setCollapsed] = useState(false);

  const editorState: ShortcutEditorState = useMemo(() => ({
    hasSelection: selectionRect !== null,
    isStampMode: activeStampPartId !== null,
    isCompareMode: compareVariantId !== null,
    isAnimation: (doc?.frames.length ?? 0) > 1,
    isLibraryFocused: false, // set by Library panel focus, not tracked here for v1
    hasVariants: (doc?.variants ?? []).length > 0,
    isPreviewingPalette: previewPaletteSetId !== null,
  }), [doc, selectionRect, activeStampPartId, compareVariantId, previewPaletteSetId]);

  const { context, shortcuts } = useMemo(
    () => getContextualShortcuts(editorState),
    [editorState],
  );

  if (!doc) return null;

  return (
    <div className={`shortcut-strip${collapsed ? ' collapsed' : ''}`} data-testid="shortcut-strip">
      <button
        className="shortcut-strip-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Show shortcuts' : 'Hide shortcuts'}
        data-testid="shortcut-strip-toggle"
      >
        {collapsed ? '\u25B6' : '\u25BC'}
      </button>
      {!collapsed && (
        <div className="shortcut-strip-items">
          {shortcuts.map((s, i) => (
            <span key={i} className="shortcut-chip" data-testid={`shortcut-${i}`}>
              <kbd className="shortcut-keys">{s.keys}</kbd>
              <span className="shortcut-action">{s.action}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
