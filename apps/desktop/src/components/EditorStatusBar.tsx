import { useCanvasViewStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';

export function EditorStatusBar() {
  const zoom = useCanvasViewStore((s) => s.zoom);
  const cursorX = useCanvasViewStore((s) => s.cursorPixelX);
  const cursorY = useCanvasViewStore((s) => s.cursorPixelY);
  const canvasSize = useProjectStore((s) => s.canvasSize);
  const frame = useCanvasFrameStore((s) => s.frame);

  const zoomLabel = zoom >= 1 ? `${zoom}x` : `${Math.round(zoom * 100)}%`;
  const sizeLabel = `${canvasSize.width}×${canvasSize.height}`;
  const cursorLabel = cursorX !== null && cursorY !== null ? `${cursorX}, ${cursorY}` : '—';
  const undoLabel = frame ? `${frame.undoDepth}` : '0';
  const canRedo = frame?.canRedo ?? false;

  return (
    <div className="editor-status-bar" data-testid="editor-status-bar">
      <span className="status-item" title="Zoom level" data-testid="status-zoom">
        {zoomLabel}
      </span>
      <span className="status-sep" />
      <span className="status-item" title="Canvas dimensions" data-testid="status-canvas-size">
        {sizeLabel}
      </span>
      <span className="status-sep" />
      <span className="status-item" title="Cursor pixel position" data-testid="status-cursor">
        {cursorLabel}
      </span>
      <span className="status-sep" />
      <span
        className={`status-item${frame?.canUndo ? ' status-undo-active' : ''}`}
        title={`Undo steps available${canRedo ? ' · Redo available' : ''}`}
        data-testid="status-undo"
      >
        Undo: {undoLabel}{canRedo ? ' ↩' : ''}
      </span>
    </div>
  );
}
