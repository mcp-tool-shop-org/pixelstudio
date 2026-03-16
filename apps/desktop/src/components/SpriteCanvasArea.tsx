import { useSpriteEditorStore } from '@glyphstudio/state';

/**
 * Sprite canvas area — placeholder shell.
 *
 * Stage 27.2 will add the actual pixel canvas with HTML5 Canvas rendering
 * and paint tool interaction. For now, this shows the document dimensions
 * and zoom level.
 */
export function SpriteCanvasArea() {
  const doc = useSpriteEditorStore((s) => s.document);
  const zoom = useSpriteEditorStore((s) => s.zoom);
  const activeFrameIndex = useSpriteEditorStore((s) => s.activeFrameIndex);

  if (!doc) return null;

  const activeFrame = doc.frames[activeFrameIndex];

  return (
    <div className="sprite-canvas-area" data-testid="sprite-canvas-area">
      <div className="sprite-canvas-placeholder">
        <div className="sprite-canvas-info">
          <span data-testid="canvas-dimensions">
            {doc.width} x {doc.height}
          </span>
          <span data-testid="canvas-zoom">{zoom}x</span>
          <span data-testid="canvas-frame">
            Frame {activeFrameIndex + 1}/{doc.frames.length}
          </span>
          {activeFrame && (
            <span data-testid="canvas-frame-duration">{activeFrame.durationMs}ms</span>
          )}
        </div>
      </div>
    </div>
  );
}
