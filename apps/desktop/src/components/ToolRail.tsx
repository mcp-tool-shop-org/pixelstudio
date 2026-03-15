import type { ToolId } from '@glyphstudio/domain';
import { useToolStore } from '@glyphstudio/state';

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

export function ToolRail() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setTool);
  const primaryColor = useToolStore((s) => s.primaryColor);
  const secondaryColor = useToolStore((s) => s.secondaryColor);
  const swapColors = useToolStore((s) => s.swapColors);

  const primaryHex = `rgb(${primaryColor.r},${primaryColor.g},${primaryColor.b})`;
  const secondaryHex = `rgb(${secondaryColor.r},${secondaryColor.g},${secondaryColor.b})`;

  return (
    <aside className="tool-rail">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => setTool(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
        >
          <span className="tool-icon">{tool.label[0]}</span>
        </button>
      ))}
      <div className="tool-rail-spacer" />
      <div className="tool-colors" onClick={swapColors} title="Click to swap colors (X)">
        <div className="color-swatch primary" style={{ backgroundColor: primaryHex }} />
        <div className="color-swatch secondary" style={{ backgroundColor: secondaryHex }} />
      </div>
    </aside>
  );
}
