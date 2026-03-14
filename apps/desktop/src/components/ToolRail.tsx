import type { ToolId } from '@pixelstudio/domain';
import { useState } from 'react';

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
  const [activeTool, setActiveTool] = useState<ToolId>('pencil');

  return (
    <aside className="tool-rail">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => setActiveTool(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
        >
          <span className="tool-icon">{tool.label[0]}</span>
        </button>
      ))}
      <div className="tool-rail-spacer" />
      <div className="tool-colors">
        <div className="color-swatch primary" />
        <div className="color-swatch secondary" />
      </div>
    </aside>
  );
}
