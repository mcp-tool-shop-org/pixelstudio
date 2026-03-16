import { useSpriteEditorStore } from '@glyphstudio/state';
import type { SpriteToolId } from '@glyphstudio/domain';

const TOOLS: { id: SpriteToolId; label: string; shortcut: string }[] = [
  { id: 'pencil', label: 'Pencil', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'fill', label: 'Fill', shortcut: 'G' },
  { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I' },
];

export function SpriteToolRail() {
  const activeTool = useSpriteEditorStore((s) => s.tool.activeTool);
  const brushSize = useSpriteEditorStore((s) => s.tool.brushSize);
  const setTool = useSpriteEditorStore((s) => s.setTool);
  const setBrushSize = useSpriteEditorStore((s) => s.setBrushSize);

  return (
    <div className="sprite-tool-rail" data-testid="sprite-tool-rail">
      <div className="sprite-tool-rail-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`sprite-tool-btn${activeTool === t.id ? ' active' : ''}`}
            data-tool={t.id}
            title={`${t.label} (${t.shortcut})`}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="sprite-tool-rail-options">
        <label className="sprite-brush-size-label">
          Size
          <input
            type="number"
            className="sprite-brush-size-input"
            min={1}
            max={32}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            data-testid="brush-size-input"
          />
        </label>
      </div>
    </div>
  );
}
