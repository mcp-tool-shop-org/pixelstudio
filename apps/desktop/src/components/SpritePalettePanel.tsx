import { useSpriteEditorStore } from '@glyphstudio/state';

export function SpritePalettePanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const setForegroundColor = useSpriteEditorStore((s) => s.setForegroundColor);
  const setBackgroundColor = useSpriteEditorStore((s) => s.setBackgroundColor);
  const swapColors = useSpriteEditorStore((s) => s.swapColors);

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
            onContextMenu={(e) => {
              e.preventDefault();
              setBackgroundColor(i);
            }}
            data-color-index={i}
          />
        ))}
      </div>
    </div>
  );
}
