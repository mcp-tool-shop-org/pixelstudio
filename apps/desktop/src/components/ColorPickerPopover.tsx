import { useEffect, useRef } from 'react';
import type { RgbaColor } from '@glyphstudio/state';

interface ColorPickerPopoverProps {
  color: RgbaColor;
  onChange: (color: RgbaColor) => void;
  onClose: () => void;
}

/** Convert RgbaColor {r,g,b,a} to a 6-digit hex string (ignores alpha). */
function toHex(c: RgbaColor): string {
  return [c.r, c.g, c.b]
    .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('');
}

/** Parse a 3 or 6 char hex string (without #) to r,g,b. Returns null on failure. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

export function ColorPickerPopover({ color, onChange, onClose }: ColorPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const setChannel = (channel: 'r' | 'g' | 'b', value: number) => {
    onChange({ ...color, [channel]: Math.max(0, Math.min(255, value)) });
  };

  const handleHexChange = (raw: string) => {
    const parsed = parseHex(raw);
    if (parsed) onChange({ ...color, ...parsed });
  };

  const previewStyle = { backgroundColor: `rgb(${color.r},${color.g},${color.b})` };

  return (
    <div className="color-picker-popover" ref={ref} data-testid="color-picker-popover">
      <div className="cpp-preview" style={previewStyle} />
      <div className="cpp-row">
        <label className="cpp-label">Hex</label>
        <input
          className="cpp-hex-input"
          defaultValue={toHex(color)}
          key={toHex(color)}
          onBlur={(e) => handleHexChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleHexChange((e.target as HTMLInputElement).value); }}
          maxLength={6}
          data-testid="cpp-hex"
        />
      </div>
      {(['r', 'g', 'b'] as const).map((ch) => (
        <div className="cpp-row" key={ch}>
          <label className="cpp-label">{ch.toUpperCase()}</label>
          <input
            type="range"
            className="cpp-slider"
            min={0}
            max={255}
            value={color[ch]}
            onChange={(e) => setChannel(ch, Number(e.target.value))}
            data-testid={`cpp-slider-${ch}`}
          />
          <span className="cpp-value">{color[ch]}</span>
        </div>
      ))}
    </div>
  );
}
