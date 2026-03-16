import { useSpriteEditorStore } from '@glyphstudio/state';
import type { SpriteToolId, SpriteBrushShape } from '@glyphstudio/domain';

const TOOLS: { id: SpriteToolId; label: string; shortcut: string }[] = [
  { id: 'select', label: 'Select', shortcut: 'M' },
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
  const brushShape = useSpriteEditorStore((s) => s.tool.brushShape);
  const pixelPerfect = useSpriteEditorStore((s) => s.tool.pixelPerfect);
  const setBrushShape = useSpriteEditorStore((s) => s.setBrushShape);
  const setPixelPerfect = useSpriteEditorStore((s) => s.setPixelPerfect);
  const onionSkin = useSpriteEditorStore((s) => s.onionSkin);
  const setOnionSkin = useSpriteEditorStore((s) => s.setOnionSkin);

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
        <div className="sprite-brush-shape" data-testid="brush-shape-control">
          {(['square', 'circle'] as SpriteBrushShape[]).map((shape) => (
            <button
              key={shape}
              className={`sprite-shape-btn${brushShape === shape ? ' active' : ''}`}
              onClick={() => setBrushShape(shape)}
              title={`Brush shape: ${shape}`}
              data-testid={`brush-shape-${shape}`}
            >
              {shape === 'square' ? '\u25a0' : '\u25cf'}
            </button>
          ))}
        </div>
        <label className="sprite-pixel-perfect-label" data-testid="pixel-perfect-control">
          <input
            type="checkbox"
            checked={pixelPerfect}
            onChange={(e) => setPixelPerfect(e.target.checked)}
            data-testid="pixel-perfect-toggle"
          />
          Pixel Perfect
        </label>
      </div>
      <div className="sprite-tool-rail-onion" data-testid="onion-skin-controls">
        <label className="sprite-onion-toggle-label">
          <input
            type="checkbox"
            checked={onionSkin.enabled}
            onChange={(e) => setOnionSkin({ enabled: e.target.checked })}
            data-testid="onion-skin-toggle"
          />
          Onion Skin
        </label>
        {onionSkin.enabled && (
          <>
            <label className="sprite-onion-option">
              Before
              <input
                type="number"
                min={0}
                max={5}
                value={onionSkin.framesBefore}
                onChange={(e) => setOnionSkin({ framesBefore: Math.max(0, Number(e.target.value)) })}
                data-testid="onion-frames-before"
              />
            </label>
            <label className="sprite-onion-option">
              After
              <input
                type="number"
                min={0}
                max={5}
                value={onionSkin.framesAfter}
                onChange={(e) => setOnionSkin({ framesAfter: Math.max(0, Number(e.target.value)) })}
                data-testid="onion-frames-after"
              />
            </label>
            <label className="sprite-onion-option">
              Opacity
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.05}
                value={onionSkin.opacity}
                onChange={(e) => setOnionSkin({ opacity: Number(e.target.value) })}
                data-testid="onion-opacity"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
