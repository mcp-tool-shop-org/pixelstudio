import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '@glyphstudio/state';

type OutputPreset = 'static_sprite' | 'horizontal_strip' | 'sprite_sheet' | 'portrait_crop';

interface ExportResult {
  files: Array<{ path: string; width: number; height: number }>;
  frame_count: number;
  was_suffixed: boolean;
  warnings: string[];
}

interface Preset {
  id: OutputPreset;
  label: string;
  description: string;
  defaultName: string;
}

const PRESETS: Preset[] = [
  {
    id: 'static_sprite',
    label: 'Static Sprite',
    description: 'Current frame — full canvas as a single PNG',
    defaultName: 'sprite',
  },
  {
    id: 'horizontal_strip',
    label: 'H. Strip',
    description: 'All frames laid out horizontally — classic animation strip',
    defaultName: 'strip',
  },
  {
    id: 'sprite_sheet',
    label: 'Sprite Sheet',
    description: 'All frames in an auto-sized grid — game-engine ready sheet',
    defaultName: 'sheet',
  },
  {
    id: 'portrait_crop',
    label: 'Portrait Crop',
    description: 'Current frame auto-cropped to non-transparent content bounds',
    defaultName: 'portrait',
  },
];

export function OutputPresetsPanel() {
  const projectName = useProjectStore((s) => s.projectName);
  const [busy, setBusy] = useState<OutputPreset | null>(null);
  const [lastResult, setLastResult] = useState<{ preset: OutputPreset; msg: string } | null>(null);

  const handlePreset = useCallback(async (preset: Preset) => {
    const safeName = projectName ? projectName.replace(/[^a-z0-9_-]/gi, '_') : preset.defaultName;
    const defaultPath = `${safeName}_${preset.defaultName}`;
    const filePath = await save({
      title: `Export — ${preset.label}`,
      defaultPath,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (!filePath) return;

    setBusy(preset.id);
    setLastResult(null);
    try {
      const result = await invoke<ExportResult>('export_preset', {
        preset: preset.id,
        filePath,
      });
      const dims = result.files[0] ? `${result.files[0].width}×${result.files[0].height}` : '';
      const suffix = result.was_suffixed ? ' (renamed to avoid collision)' : '';
      const warn = result.warnings.length > 0 ? ` ⚠ ${result.warnings[0]}` : '';
      setLastResult({ preset: preset.id, msg: `✓ ${dims}${suffix}${warn}` });
    } catch (err) {
      setLastResult({ preset: preset.id, msg: `Error: ${String(err)}` });
    } finally {
      setBusy(null);
    }
  }, [projectName]);

  return (
    <div className="output-presets-panel">
      <div className="output-presets-header">
        <span className="output-presets-title">Output Presets</span>
        <span className="output-presets-hint">One-click export — no config needed</span>
      </div>

      <div className="output-presets-list">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`output-preset-btn${busy === preset.id ? ' busy' : ''}`}
            onClick={() => handlePreset(preset)}
            disabled={!!busy}
            title={preset.description}
            data-testid={`preset-btn-${preset.id}`}
          >
            <span className="preset-label">{busy === preset.id ? 'Exporting…' : preset.label}</span>
            <span className="preset-desc">{preset.description}</span>
            {lastResult?.preset === preset.id && (
              <span className={`preset-result${lastResult.msg.startsWith('Error') ? ' error' : ''}`} data-testid={`preset-result-${preset.id}`}>
                {lastResult.msg}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
