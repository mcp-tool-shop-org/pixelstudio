import { useSpriteEditorStore } from '@glyphstudio/state';
import { SpriteToolRail } from './SpriteToolRail';
import { SpritePalettePanel } from './SpritePalettePanel';
import { SpriteFrameStrip } from './SpriteFrameStrip';
import { SpriteCanvasArea } from './SpriteCanvasArea';
import { SpriteImportExportBar } from './SpriteImportExportBar';

/**
 * Top-level sprite editor shell.
 *
 * Layout: tool rail (left) | canvas (center) | palette (right)
 * Frame strip at the bottom.
 */
export function SpriteEditor() {
  const doc = useSpriteEditorStore((s) => s.document);

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
      <SpriteFrameStrip />
      <SpriteImportExportBar />
    </div>
  );
}
