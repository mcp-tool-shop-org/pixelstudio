import type { ToolId } from '@glyphstudio/domain';
import { isSketchTool, TOOL_SHORTCUT_LABEL, SWAP_COLORS_BINDING } from '@glyphstudio/domain';
import { useToolStore, useBrushSettingsStore } from '@glyphstudio/state';

/** Tool definitions for UI layout. Shortcut display is derived from the manifest. */
const TOOLS: { id: ToolId; label: string }[] = [
  { id: 'pencil', label: 'Pencil' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'fill', label: 'Fill' },
  { id: 'line', label: 'Line' },
  { id: 'rectangle', label: 'Rect' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'marquee', label: 'Marquee' },
  { id: 'lasso', label: 'Lasso' },
  { id: 'magic-select', label: 'Magic' },
  { id: 'color-select', label: 'By Color' },
  { id: 'move', label: 'Move' },
  { id: 'transform', label: 'Transform' },
  { id: 'slice', label: 'Slice' },
  { id: 'socket', label: 'Socket' },
  { id: 'measure', label: 'Measure' },
];

const SKETCH_TOOLS: { id: ToolId; label: string }[] = [
  { id: 'sketch-brush', label: 'Sketch' },
  { id: 'sketch-eraser', label: 'S.Erase' },
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

  const swapTitle = SWAP_COLORS_BINDING?.status === 'live'
    ? `Click to swap colors (${SWAP_COLORS_BINDING.label})`
    : 'Click to swap colors';

  return (
    <aside className="tool-rail">
      {TOOLS.map((tool) => <ToolButton key={tool.id} id={tool.id} label={tool.label} active={activeTool === tool.id} setTool={setTool} />)}
      <div className="tool-rail-divider" />
      {SKETCH_TOOLS.map((tool) => <ToolButton key={tool.id} id={tool.id} label={tool.label} active={activeTool === tool.id} setTool={setTool} sketch />)}
      {isSketch && <SketchSettings />}
      <div className="tool-rail-spacer" />
      <div className="tool-colors" onClick={swapColors} title={swapTitle}>
        <div className="color-swatch primary" style={{ backgroundColor: primaryHex }} />
        <div className="color-swatch secondary" style={{ backgroundColor: secondaryHex }} />
      </div>
    </aside>
  );
}

/** Single tool button — shortcut badge derived from manifest */
function ToolButton({ id, label, active, setTool, sketch }: {
  id: ToolId; label: string; active: boolean; setTool: (t: ToolId) => void; sketch?: boolean;
}) {
  const shortcutLabel = TOOL_SHORTCUT_LABEL.get(id);
  const title = shortcutLabel ? `${label} (${shortcutLabel})` : label;
  return (
    <button
      className={`tool-btn${sketch ? ' sketch-tool' : ''} ${active ? 'active' : ''}`}
      onClick={() => setTool(id)}
      title={title}
    >
      <span className="tool-label">{label}</span>
      {shortcutLabel && <span className="tool-shortcut">{shortcutLabel}</span>}
    </button>
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
