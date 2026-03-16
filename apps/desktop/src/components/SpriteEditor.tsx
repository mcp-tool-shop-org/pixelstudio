import { useEffect } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import type { SpriteToolId } from '@glyphstudio/domain';
import { SpriteToolRail } from './SpriteToolRail';
import { SpritePalettePanel } from './SpritePalettePanel';
import { SpriteFrameStrip } from './SpriteFrameStrip';
import { SpriteCanvasArea } from './SpriteCanvasArea';
import { SpriteImportExportBar } from './SpriteImportExportBar';
import { SpritePreviewBar } from './SpritePreviewBar';

const TOOL_SHORTCUTS: Record<string, SpriteToolId> = {
  m: 'select',
  b: 'pencil',
  e: 'eraser',
  g: 'fill',
  i: 'eyedropper',
};

/**
 * Top-level sprite editor shell.
 *
 * Layout: tool rail (left) | canvas (center) | palette (right)
 * Frame strip at the bottom.
 */
export function SpriteEditor() {
  const doc = useSpriteEditorStore((s) => s.document);

  // Keyboard shortcuts — only active when a document is open
  useEffect(() => {
    if (!doc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();
      const store = useSpriteEditorStore.getState();

      // Tool shortcuts (no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOL_SHORTCUTS[key];
        if (tool) {
          e.preventDefault();
          store.setTool(tool);
          return;
        }

        // Frame navigation: , = prev, . = next
        if (key === ',' || key === 'comma') {
          e.preventDefault();
          if (store.activeFrameIndex > 0) {
            store.setActiveFrame(store.activeFrameIndex - 1);
          }
          return;
        }
        if (key === '.' || key === 'period') {
          e.preventDefault();
          const doc = store.document;
          if (doc && store.activeFrameIndex < doc.frames.length - 1) {
            store.setActiveFrame(store.activeFrameIndex + 1);
          }
          return;
        }

        // Add blank frame: N
        if (key === 'n') {
          e.preventDefault();
          store.addFrame();
          return;
        }

        // Swap colors: X
        if (key === 'x') {
          e.preventDefault();
          store.swapColors();
          return;
        }

        // Play/stop: Space
        if (key === ' ') {
          e.preventDefault();
          store.togglePlay();
          return;
        }

        // Zoom: +/= to zoom in, - to zoom out
        if (key === '=' || key === '+') {
          e.preventDefault();
          store.zoomIn();
          return;
        }
        if (key === '-') {
          e.preventDefault();
          store.zoomOut();
          return;
        }
      }

      // Grid toggle: # (Shift+3)
      if (key === '#' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        store.toggleGrid();
        return;
      }

      // Duplicate frame: Shift+D
      if (key === 'd' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        store.duplicateFrame();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc]);

  if (!doc) {
    return (
      <div className="sprite-editor sprite-editor--empty" data-testid="sprite-editor-empty">
        <div className="sprite-editor-empty-message">
          No sprite document open. Create or open a sprite to begin editing.
        </div>
      </div>
    );
  }

  return (
    <div className="sprite-editor" data-testid="sprite-editor">
      <div className="sprite-editor-top">
        <SpriteToolRail />
        <SpriteCanvasArea />
        <SpritePalettePanel />
      </div>
      <SpritePreviewBar />
      <SpriteFrameStrip />
      <SpriteImportExportBar />
    </div>
  );
}
