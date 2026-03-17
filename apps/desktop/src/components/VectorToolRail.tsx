import { useState, useCallback } from 'react';
import type { VectorToolId } from './VectorCanvas';
import type { Rgba } from '@glyphstudio/domain';

// ── Tool definitions ──

const VECTOR_TOOLS: { id: VectorToolId; label: string; key: string; title: string }[] = [
  { id: 'v-select', label: 'V', key: 'V', title: 'Select / Move (V)' },
  { id: 'v-rect', label: 'R', key: 'R', title: 'Rectangle (R)' },
  { id: 'v-ellipse', label: 'E', key: 'E', title: 'Ellipse (E)' },
  { id: 'v-line', label: 'L', key: 'L', title: 'Line (L)' },
  { id: 'v-polygon', label: 'P', key: 'P', title: 'Polygon (P) — click to add points, double-click to close' },
];

function rgbaToHex(c: Rgba): string {
  return '#' + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgba(hex: string, alpha: number): Rgba {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

// ── Component ──

interface VectorToolRailProps {
  activeTool: VectorToolId;
  onToolChange: (tool: VectorToolId) => void;
  fillColor: Rgba | null;
  onFillChange: (color: Rgba | null) => void;
  strokeColor: Rgba | null;
  onStrokeChange: (color: Rgba | null) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
}

export function VectorToolRail({
  activeTool, onToolChange,
  fillColor, onFillChange,
  strokeColor, onStrokeChange,
  strokeWidth, onStrokeWidthChange,
}: VectorToolRailProps) {
  const [fillEnabled, setFillEnabled] = useState(fillColor !== null);
  const [strokeEnabled, setStrokeEnabled] = useState(strokeColor !== null);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tool = VECTOR_TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
    if (tool) onToolChange(tool.id);
  }, [onToolChange]);

  return (
    <aside className="tool-rail vector-tool-rail" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="tool-rail-section">
        {VECTOR_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''} vector-tool`}
            title={tool.title}
            onClick={() => onToolChange(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div className="tool-rail-divider" />

      {/* Fill controls */}
      <div className="vector-color-section">
        <label className="vector-color-label">
          <input
            type="checkbox"
            checked={fillEnabled}
            onChange={(e) => {
              setFillEnabled(e.target.checked);
              onFillChange(e.target.checked ? (fillColor ?? [100, 100, 100, 255]) : null);
            }}
          />
          Fill
        </label>
        {fillEnabled && fillColor && (
          <input
            type="color"
            className="vector-color-input"
            value={rgbaToHex(fillColor)}
            onChange={(e) => onFillChange(hexToRgba(e.target.value, fillColor[3]))}
            title="Fill color"
          />
        )}
      </div>

      {/* Stroke controls */}
      <div className="vector-color-section">
        <label className="vector-color-label">
          <input
            type="checkbox"
            checked={strokeEnabled}
            onChange={(e) => {
              setStrokeEnabled(e.target.checked);
              onStrokeChange(e.target.checked ? (strokeColor ?? [255, 255, 255, 255]) : null);
            }}
          />
          Stroke
        </label>
        {strokeEnabled && strokeColor && (
          <>
            <input
              type="color"
              className="vector-color-input"
              value={rgbaToHex(strokeColor)}
              onChange={(e) => onStrokeChange(hexToRgba(e.target.value, strokeColor[3]))}
              title="Stroke color"
            />
            <input
              type="range"
              className="vector-stroke-slider"
              min={1}
              max={20}
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(parseInt(e.target.value, 10))}
              title={`Stroke width: ${strokeWidth}`}
            />
          </>
        )}
      </div>
    </aside>
  );
}
