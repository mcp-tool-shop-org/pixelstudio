import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ToolId } from '@glyphstudio/domain';
import { isSketchTool, TOOL_SHORTCUT_LABEL, SWAP_COLORS_BINDING } from '@glyphstudio/domain';
import { useToolStore, useBrushSettingsStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';
import type { CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { useProjectStore } from '@glyphstudio/state';
import { ColorPickerPopover } from './ColorPickerPopover';
import { QuickPaletteStrip } from './QuickPaletteStrip';

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
  const setPrimaryColor = useToolStore((s) => s.setPrimaryColor);
  const setSecondaryColor = useToolStore((s) => s.setSecondaryColor);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);

  const [pickerTarget, setPickerTarget] = useState<'primary' | 'secondary' | null>(null);
  const [replaceError, setReplaceError] = useState('');
  const [replacePreview, setReplacePreview] = useState(false);

  const handleReplaceColor = useCallback(async () => {
    setReplaceError('');
    setReplacePreview(false);
    const pc = useToolStore.getState().primaryColor;
    const sc = useToolStore.getState().secondaryColor;
    try {
      const f = await invoke<CanvasFrameData>('replace_color', {
        fromR: pc.r, fromG: pc.g, fromB: pc.b, fromA: pc.a,
        toR: sc.r, toG: sc.g, toB: sc.b, toA: sc.a,
      });
      setFrame(f);
      syncLayersFromFrame(f);
      markDirty();
      invoke('mark_dirty').catch(() => {});
      setReplacePreview(true);
    } catch (err) {
      setReplaceError(String(err));
    }
  }, [setFrame, markDirty]);

  const handleReplaceUndo = useCallback(async () => {
    try {
      const f = await invoke<CanvasFrameData>('undo');
      setFrame(f);
      syncLayersFromFrame(f);
    } catch (err) {
      setReplaceError(String(err));
    }
    setReplacePreview(false);
  }, [setFrame]);

  const handleReplaceKeep = useCallback(() => {
    setReplacePreview(false);
  }, []);

  const primaryHex = `rgb(${primaryColor.r},${primaryColor.g},${primaryColor.b})`;
  const secondaryHex = `rgb(${secondaryColor.r},${secondaryColor.g},${secondaryColor.b})`;

  const isSketch = isSketchTool(activeTool);

  const swapTitle = SWAP_COLORS_BINDING?.status === 'live'
    ? `Swap colors (${SWAP_COLORS_BINDING.label})`
    : 'Swap colors';

  return (
    <aside className="tool-rail">
      {TOOLS.map((tool) => <ToolButton key={tool.id} id={tool.id} label={tool.label} active={activeTool === tool.id} setTool={setTool} />)}
      <div className="tool-rail-divider" />
      {SKETCH_TOOLS.map((tool) => <ToolButton key={tool.id} id={tool.id} label={tool.label} active={activeTool === tool.id} setTool={setTool} sketch />)}
      {isSketch && <SketchSettings />}
      <div className="tool-rail-spacer" />
      <div className="tool-colors">
        <div
          className="color-swatch secondary"
          style={{ backgroundColor: secondaryHex }}
          onClick={() => setPickerTarget('secondary')}
          title="Secondary color — click to change"
          data-testid="swatch-secondary"
        />
        <div
          className="color-swatch primary"
          style={{ backgroundColor: primaryHex }}
          onClick={() => setPickerTarget('primary')}
          title="Primary color — click to change"
          data-testid="swatch-primary"
        />
        <button
          className="color-swap-btn"
          onClick={swapColors}
          title={swapTitle}
          data-testid="swap-colors-btn"
        >
          ⇄
        </button>
        {replacePreview ? (
          <div className="color-replace-preview" data-testid="replace-preview">
            <button
              className="color-replace-keep-btn"
              onClick={handleReplaceKeep}
              title="Keep the recolor"
              data-testid="replace-keep-btn"
            >
              Keep
            </button>
            <button
              className="color-replace-undo-btn"
              onClick={handleReplaceUndo}
              title="Undo the recolor"
              data-testid="replace-undo-btn"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            className="color-replace-btn"
            onClick={handleReplaceColor}
            title="Replace primary color with secondary on active layer"
            data-testid="replace-color-btn"
          >
            Repl
          </button>
        )}
        {replaceError && <span className="color-replace-error" title={replaceError}>!</span>}
        {pickerTarget && (
          <ColorPickerPopover
            color={pickerTarget === 'primary' ? primaryColor : secondaryColor}
            onChange={(c) => pickerTarget === 'primary' ? setPrimaryColor(c) : setSecondaryColor(c)}
            onClose={() => setPickerTarget(null)}
          />
        )}
      </div>
      <QuickPaletteStrip />
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
