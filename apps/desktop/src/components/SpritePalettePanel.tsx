import { useRef } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';

/** Convert a #RRGGBB hex string to [R,G,B,255]. */
function hexToRgba(hex: string): [number, number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
}

/** Format RGBA as a display string. */
function rgbaLabel(rgba: [number, number, number, number]): string {
  return `${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]}`;
}

export function SpritePalettePanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const setForegroundColor = useSpriteEditorStore((s) => s.setForegroundColor);
  const setBackgroundColor = useSpriteEditorStore((s) => s.setBackgroundColor);
  const setForegroundColorByRgba = useSpriteEditorStore((s) => s.setForegroundColorByRgba);
  const swapColors = useSpriteEditorStore((s) => s.swapColors);
  const setTool = useSpriteEditorStore((s) => s.setTool);
  const colorInputRef = useRef<HTMLInputElement>(null);

  if (!doc) return null;

  const { palette } = doc;
  const fgColor = palette.colors[palette.foregroundIndex];
  const bgColor = palette.colors[palette.backgroundIndex];

  return (
    <div className="sprite-palette-panel" data-testid="sprite-palette-panel">
      <div className="sprite-palette-active-colors">
        <div
          className="sprite-palette-fg"
          data-testid="palette-foreground"
          style={{
            backgroundColor: fgColor
              ? `rgba(${fgColor.rgba[0]},${fgColor.rgba[1]},${fgColor.rgba[2]},${fgColor.rgba[3] / 255})`
              : 'transparent',
          }}
          title={`Foreground: ${fgColor?.name ?? 'unknown'}`}
        />
        <button
          className="sprite-palette-swap"
          onClick={swapColors}
          title="Swap colors (X)"
          data-testid="palette-swap"
        >
          Swap
        </button>
        <div
          className="sprite-palette-bg"
          data-testid="palette-background"
          style={{
            backgroundColor: bgColor
              ? `rgba(${bgColor.rgba[0]},${bgColor.rgba[1]},${bgColor.rgba[2]},${bgColor.rgba[3] / 255})`
              : 'transparent',
          }}
          title={`Background: ${bgColor?.name ?? 'unknown'}`}
        />
      </div>
      <div className="sprite-palette-grid" data-testid="palette-grid">
        {palette.colors.map((color, i) => (
          <button
            key={i}
            className={`sprite-palette-swatch${
              i === palette.foregroundIndex ? ' fg-selected' : ''
            }${i === palette.backgroundIndex ? ' bg-selected' : ''}`}
            style={{
              backgroundColor: `rgba(${color.rgba[0]},${color.rgba[1]},${color.rgba[2]},${color.rgba[3] / 255})`,
            }}
            title={color.name ?? `Color ${i}`}
            onClick={() => setForegroundColor(i)}
            onDoubleClick={() => {
              setForegroundColor(i);
              setTool('pencil');
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setBackgroundColor(i);
            }}
            data-color-index={i}
            data-testid={`palette-swatch-${i}`}
          />
        ))}
      </div>
      {fgColor && (
        <div className="sprite-palette-info" data-testid="palette-color-info">
          <span data-testid="palette-rgba-label">{rgbaLabel(fgColor.rgba)}</span>
        </div>
      )}
      <div className="sprite-palette-add-color">
        <input
          ref={colorInputRef}
          type="color"
          defaultValue="#000000"
          data-testid="palette-color-picker"
          title="Pick a custom color"
          onChange={(e) => {
            const rgba = hexToRgba(e.target.value);
            if (rgba) setForegroundColorByRgba(rgba);
          }}
        />
      </div>
    </div>
  );
}
