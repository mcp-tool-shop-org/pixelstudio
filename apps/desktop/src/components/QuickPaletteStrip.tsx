/**
 * QuickPaletteStrip — compact swatch grid on the ToolRail showing
 * pinned colors (top) and recent color history (bottom).
 *
 * Click → set primary. Shift+click → set secondary.
 * Pin button adds current primary to pinned. × removes a pin.
 */
import { useToolStore } from '@glyphstudio/state';
import type { RgbaColor } from '@glyphstudio/state';

function toRgb(c: RgbaColor): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

interface SwatchProps {
  color: RgbaColor;
  title?: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onRemove?: () => void;
  testId?: string;
}

function Swatch({ color, title, onPrimary, onSecondary, onRemove, testId }: SwatchProps) {
  return (
    <div
      className="qps-swatch-wrap"
      title={title}
      data-testid={testId}
    >
      <button
        className="qps-swatch"
        style={{ backgroundColor: toRgb(color) }}
        onClick={(e) => { e.shiftKey ? onSecondary() : onPrimary(); }}
        aria-label={title}
      />
      {onRemove && (
        <button
          className="qps-swatch-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Unpin"
          data-testid={testId ? `${testId}-remove` : undefined}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function QuickPaletteStrip() {
  const primaryColor = useToolStore((s) => s.primaryColor);
  const setPrimaryColor = useToolStore((s) => s.setPrimaryColor);
  const setSecondaryColor = useToolStore((s) => s.setSecondaryColor);
  const recentColors = useToolStore((s) => s.recentColors);
  const pinnedColors = useToolStore((s) => s.pinnedColors);
  const pinColor = useToolStore((s) => s.pinColor);
  const unpinColor = useToolStore((s) => s.unpinColor);

  const hasPinned = pinnedColors.length > 0;
  const hasRecent = recentColors.length > 0;

  if (!hasPinned && !hasRecent) {
    return (
      <div className="quick-palette-strip" data-testid="quick-palette-strip">
        <button
          className="qps-pin-btn"
          onClick={() => pinColor(primaryColor)}
          title="Pin current primary color"
          data-testid="qps-pin-btn"
        >
          + Pin
        </button>
      </div>
    );
  }

  return (
    <div className="quick-palette-strip" data-testid="quick-palette-strip">
      <button
        className="qps-pin-btn"
        onClick={() => pinColor(primaryColor)}
        title="Pin current primary color"
        data-testid="qps-pin-btn"
      >
        + Pin
      </button>

      {hasPinned && (
        <div className="qps-section" data-testid="qps-pinned">
          <span className="qps-section-label">Pinned</span>
          <div className="qps-swatch-grid">
            {pinnedColors.map((c, i) => (
              <Swatch
                key={i}
                color={c}
                title={`Pinned: rgb(${c.r},${c.g},${c.b})\nClick: set primary | Shift+click: set secondary`}
                onPrimary={() => setPrimaryColor(c)}
                onSecondary={() => setSecondaryColor(c)}
                onRemove={() => unpinColor(i)}
                testId={`qps-pinned-${i}`}
              />
            ))}
          </div>
        </div>
      )}

      {hasRecent && (
        <div className="qps-section" data-testid="qps-recent">
          <span className="qps-section-label">Recent</span>
          <div className="qps-swatch-grid">
            {recentColors.map((c, i) => (
              <Swatch
                key={i}
                color={c}
                title={`rgb(${c.r},${c.g},${c.b})\nClick: set primary | Shift+click: set secondary`}
                onPrimary={() => setPrimaryColor(c)}
                onSecondary={() => setSecondaryColor(c)}
                testId={`qps-recent-${i}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
