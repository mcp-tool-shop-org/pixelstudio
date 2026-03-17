import type { ToolId } from '@glyphstudio/domain';
import { isSketchTool } from '@glyphstudio/domain';
import { useToolStore, useBrushSettingsStore } from '@glyphstudio/state';

const TOOLS: { id: ToolId; label: string; shortcut: string }[] = [
  { id: 'pencil', label: 'Pencil', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'fill', label: 'Fill', shortcut: 'G' },
  { id: 'line', label: 'Line', shortcut: 'L' },
  { id: 'rectangle', label: 'Rect', shortcut: 'U' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { id: 'marquee', label: 'Marquee', shortcut: 'M' },
  { id: 'lasso', label: 'Lasso', shortcut: 'Q' },
  { id: 'magic-select', label: 'Magic', shortcut: 'W' },
  { id: 'color-select', label: 'By Color', shortcut: 'Y' },
  { id: 'move', label: 'Move', shortcut: 'V' },
  { id: 'transform', label: 'Transform', shortcut: 'T' },
  { id: 'slice', label: 'Slice', shortcut: 'K' },
  { id: 'socket', label: 'Socket', shortcut: 'S' },
  { id: 'measure', label: 'Measure', shortcut: 'I' },
];

const SKETCH_TOOLS: { id: ToolId; label: string; shortcut: string }[] = [
  { id: 'sketch-brush', label: 'Sketch', shortcut: 'N' },
  { id: 'sketch-eraser', label: 'S.Erase', shortcut: 'Shift+N' },
];

export function ToolRail() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setTool);
  const primaryColor = useToolStore((s) => s.primaryColor);
  const secondaryColor = useToolStore((s) => s.secondaryColor);
  const swapColors = useToolStore((s) => s.swapColors);

  const primaryHex = `rgb(${primaryColor.r},${primaryColor.g},${primaryColor.b})`;
  const secondaryHex = `rgb(${secondaryColor.r},${secondaryColor.g},${secondaryColor.b})`;

  const isSketch = isSketchTool(activeTool);

  return (
    <aside className="tool-rail">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => setTool(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
        >
          <span className="tool-label">{tool.label}</span>
          <span className="tool-shortcut">{tool.shortcut}</span>
        </button>
      ))}
      <div className="tool-rail-divider" />
      {SKETCH_TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`tool-btn sketch-tool ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => setTool(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
        >
          <span className="tool-label">{tool.label}</span>
          <span className="tool-shortcut">{tool.shortcut}</span>
        </button>
      ))}
      {isSketch && <SketchSettings />}
      <div className="tool-rail-spacer" />
      <div className="tool-colors" onClick={swapColors} title="Click to swap colors (X)">
        <div className="color-swatch primary" style={{ backgroundColor: primaryHex }} />
        <div className="color-swatch secondary" style={{ backgroundColor: secondaryHex }} />
      </div>
    </aside>
  );
}

/** Compact brush settings shown when a sketch tool is active */
function SketchSettings() {
  const activeTool = useToolStore((s) => s.activeTool);
  const toolKey = activeTool === 'sketch-eraser' ? 'sketchEraser' as const : 'sketchBrush' as const;

  const size = useBrushSettingsStore((s) => s[toolKey].size);
  const opacity = useBrushSettingsStore((s) => s[toolKey].opacity);
  const setBrushSize = useBrushSettingsStore((s) => s.setBrushSize);
  const setBrushOpacity = useBrushSettingsStore((s) => s.setBrushOpacity);
  const resetToDefaults = useBrushSettingsStore((s) => s.resetToDefaults);

  return (
    <div className="sketch-settings">
      <label className="sketch-setting-row" title="Brush size (px)">
        <span className="sketch-setting-label">Sz</span>
        <input
          type="range"
          min={1}
          max={32}
          value={size}
          onChange={(e) => setBrushSize(toolKey, Number(e.target.value))}
          className="sketch-slider"
        />
        <span className="sketch-setting-value">{size}</span>
      </label>
      <label className="sketch-setting-row" title="Brush opacity">
        <span className="sketch-setting-label">Op</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => setBrushOpacity(toolKey, Number(e.target.value) / 100)}
          className="sketch-slider"
        />
        <span className="sketch-setting-value">{Math.round(opacity * 100)}%</span>
      </label>
      <button
        className="sketch-reset-btn"
        onClick={() => resetToDefaults(toolKey)}
        title="Reset to defaults"
      >
        Reset
      </button>
    </div>
  );
}
