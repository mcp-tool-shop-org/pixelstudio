import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ToolId } from '@glyphstudio/domain';
import { isSketchTool, TOOL_SHORTCUT_LABEL, SWAP_COLORS_BINDING } from '@glyphstudio/domain';
import { useToolStore, useBrushSettingsStore, useSelectionStore, BRUSH_PRESETS } from '@glyphstudio/state';
import type { MirrorMode, DitherPattern } from '@glyphstudio/state';
import { getDitherCellActive } from '../lib/canvasPixelMath';
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
  const mirrorMode = useToolStore((s) => s.mirrorMode);
  const toggleMirrorH = useToolStore((s) => s.toggleMirrorH);
  const toggleMirrorV = useToolStore((s) => s.toggleMirrorV);
  const hasSelection = useSelectionStore((s) => s.hasSelection);
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
    const sel = useSelectionStore.getState().selectionBounds;
    const args: Record<string, unknown> = {
      fromR: pc.r, fromG: pc.g, fromB: pc.b, fromA: pc.a,
      toR: sc.r, toG: sc.g, toB: sc.b, toA: sc.a,
    };
    if (sel) {
      args.selX = sel.x;
      args.selY = sel.y;
      args.selW = sel.width;
      args.selH = sel.height;
    }
    try {
      const f = await invoke<CanvasFrameData>('replace_color', args);
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
      <div className="tool-rail-divider" />
      <MirrorToggles mirrorMode={mirrorMode} onToggleH={toggleMirrorH} onToggleV={toggleMirrorV} />
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
            title={hasSelection ? 'Replace primary→secondary in selection' : 'Replace primary→secondary on active layer'}
            data-testid="replace-color-btn"
          >
            {hasSelection ? 'Repl Sel' : 'Repl'}
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

/** Pattern + density controls shown inside SketchSettings when Dith preset is active */
function DitherControls() {
  const ditherPattern = useBrushSettingsStore((s) => s.ditherPattern);
  const ditherDensity = useBrushSettingsStore((s) => s.ditherDensity);
  const setDitherPattern = useBrushSettingsStore((s) => s.setDitherPattern);
  const setDitherDensity = useBrushSettingsStore((s) => s.setDitherDensity);

  return (
    <div className="dither-controls" data-testid="dither-controls">
      <div className="dither-patterns">
        {DITHER_PATTERN_ORDER.map((p) => (
          <button
            key={p}
            className={`dither-pattern-btn${ditherPattern === p ? ' active' : ''}`}
            onClick={() => setDitherPattern(p)}
            title={DITHER_PATTERN_TITLES[p]}
            data-testid={`dither-pattern-${p}`}
          >
            {DITHER_PATTERN_LABELS[p]}
          </button>
        ))}
      </div>
      <label className="sketch-setting-row" title="Dither density — fraction of pattern pixels that fire">
        <span className="sketch-setting-label">Dn</span>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(ditherDensity * 100)}
          onChange={(e) => setDitherDensity(Number(e.target.value) / 100)}
          className="sketch-slider"
        />
        <span className="sketch-setting-value">{Math.round(ditherDensity * 100)}%</span>
      </label>
      <DitherPreview pattern={ditherPattern} density={ditherDensity} />
    </div>
  );
}

/** 8×8 pixel swatch showing the active dither pattern at the current density */
function DitherPreview({ pattern, density }: { pattern: DitherPattern; density: number }) {
  const SIZE = 8;
  const cells: boolean[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      cells.push(getDitherCellActive(x, y, pattern, density));
    }
  }
  return (
    <div
      className="dither-preview"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 6px)`, gap: '1px' }}
      title="Live pattern preview (8×8)"
      data-testid="dither-preview"
    >
      {cells.map((on, i) => (
        <div key={i} className={`dither-cell${on ? ' on' : ''}`} style={{ width: 6, height: 6 }} />
      ))}
    </div>
  );
}

/** Mirror drawing toggle buttons — H, V, or both */
function MirrorToggles({ mirrorMode, onToggleH, onToggleV }: {
  mirrorMode: MirrorMode;
  onToggleH: () => void;
  onToggleV: () => void;
}) {
  const hActive = mirrorMode === 'h' || mirrorMode === 'both';
  const vActive = mirrorMode === 'v' || mirrorMode === 'both';
  return (
    <div className="mirror-toggles">
      <button
        className={`mirror-btn${hActive ? ' active' : ''}`}
        onClick={onToggleH}
        title={hActive ? 'Horizontal mirror ON — click to toggle off' : 'Enable horizontal mirror'}
        data-testid="mirror-h-btn"
      >
        ⟺H
      </button>
      <button
        className={`mirror-btn${vActive ? ' active' : ''}`}
        onClick={onToggleV}
        title={vActive ? 'Vertical mirror ON — click to toggle off' : 'Enable vertical mirror'}
        data-testid="mirror-v-btn"
      >
        ⇕V
      </button>
    </div>
  );
}

const DITHER_PATTERN_LABELS: Record<DitherPattern, string> = {
  'checker':      '⊞',
  'diagonal':     '╱',
  'cross':        '✚',
  'sparse-noise': '∷',
};

const DITHER_PATTERN_TITLES: Record<DitherPattern, string> = {
  'checker':      'Checker — alternating pixel grid (~50% coverage)',
  'diagonal':     'Diagonal — slanted stripe pattern (~25% coverage)',
  'cross':        'Cross — grid crosshatch pattern',
  'sparse-noise': 'Sparse noise — random scatter, density controls coverage',
};

const DITHER_PATTERN_ORDER: DitherPattern[] = ['checker', 'diagonal', 'cross', 'sparse-noise'];

/** Compact brush settings shown when a sketch tool is active */
function SketchSettings() {
  const activeTool = useToolStore((s) => s.activeTool);
  const toolKey = activeTool === 'sketch-eraser' ? 'sketchEraser' as const : 'sketchBrush' as const;
  const isBrush = toolKey === 'sketchBrush';

  const size = useBrushSettingsStore((s) => s[toolKey].size);
  const opacity = useBrushSettingsStore((s) => s[toolKey].opacity);
  const activePresetId = useBrushSettingsStore((s) => s.activePresetId);
  const setBrushSize = useBrushSettingsStore((s) => s.setBrushSize);
  const setBrushOpacity = useBrushSettingsStore((s) => s.setBrushOpacity);
  const resetToDefaults = useBrushSettingsStore((s) => s.resetToDefaults);
  const applyPreset = useBrushSettingsStore((s) => s.applyPreset);

  return (
    <div className="sketch-settings">
      {isBrush && (
        <div className="brush-presets" data-testid="brush-presets">
          {BRUSH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`brush-preset-btn${activePresetId === preset.id ? ' active' : ''}`}
              onClick={() => applyPreset(preset.id)}
              title={preset.title}
              data-testid={`brush-preset-${preset.id}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      {isBrush && activePresetId === 'dither' && <DitherControls />}
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
