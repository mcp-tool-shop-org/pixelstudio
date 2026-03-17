import { useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SpriteTemplate, AnimationPreset, RGBA, TemplateArchetype } from '@glyphstudio/domain';
import {
  SPRITE_TEMPLATE_LIBRARY,
  listTemplatesByArchetype,
  searchTemplates,
} from '../lib/spriteTemplateLibrary';
import { resolveTemplate } from '../lib/spriteTemplateRenderer';
import {
  listCompatiblePresets,
} from '../lib/animationPresetLibrary';
import { generateAnimationSequence } from '../lib/animationSequenceGenerator';

type FilterArchetype = TemplateArchetype | 'all';
type PanelMode = 'template' | 'animation';

function rgbaToHex([r, g, b]: RGBA): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function TemplateBrowserPanel() {
  const [mode, setMode] = useState<PanelMode>('template');
  const [filter, setFilter] = useState<FilterArchetype>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Record<string, RGBA>>({});
  const [scale, setScale] = useState(1.0);
  const [status, setStatus] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // Animation state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(1.0);
  const [animProgress, setAnimProgress] = useState<string | null>(null);
  const [animResult, setAnimResult] = useState<{
    frameCount: number; totalPixels: number; frameIds: string[];
  } | null>(null);

  // Filter templates
  const templates: SpriteTemplate[] = query.trim()
    ? searchTemplates(query)
    : filter === 'all'
      ? [...SPRITE_TEMPLATE_LIBRARY]
      : listTemplatesByArchetype(filter);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  // Compatible animation presets for the selected template
  const compatiblePresets: AnimationPreset[] = useMemo(
    () => (selected ? listCompatiblePresets(selected.archetype) : []),
    [selected],
  );

  const selectedPreset = compatiblePresets.find((p) => p.id === selectedPresetId) ?? null;

  const handleColorChange = useCallback((slotName: string, hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    setColorOverrides((prev) => ({ ...prev, [slotName]: [r, g, b, 255] }));
  }, []);

  const handleInstantiate = useCallback(async () => {
    if (!selected) return;
    setRendering(true);
    setStatus(null);

    const params = {
      templateId: selected.id,
      colors: colorOverrides,
      scale,
    };

    const { regions, connections } = resolveTemplate(selected, params);

    try {
      const result = await invoke<{
        regionCount: number;
        connectionCount: number;
        pixelCount: number;
      }>('render_template', {
        input: { regions, connections, layerId: null },
      });

      setStatus(`Rendered ${result.regionCount} regions, ${result.pixelCount} pixels`);
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRendering(false);
    }
  }, [selected, colorOverrides, scale]);

  const handleGenerateAnimation = useCallback(async () => {
    if (!selected || !selectedPresetId) return;
    setRendering(true);
    setStatus(null);
    setAnimResult(null);
    setAnimProgress('Starting...');

    try {
      const result = await generateAnimationSequence(
        {
          templateId: selected.id,
          presetId: selectedPresetId,
          colors: colorOverrides,
          scale,
          intensity,
        },
        (frame, total) => {
          setAnimProgress(`Frame ${frame + 1}/${total}`);
        },
      );

      setAnimResult({
        frameCount: result.frameCount,
        totalPixels: result.totalPixels,
        frameIds: result.frameIds,
      });
      setStatus(`Generated ${result.frameCount} frames, ${result.totalPixels} total pixels`);
      setAnimProgress(null);
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setAnimProgress(null);
    } finally {
      setRendering(false);
    }
  }, [selected, selectedPresetId, colorOverrides, scale, intensity]);

  const handleResetColors = useCallback(() => {
    setColorOverrides({});
  }, []);

  return (
    <div className="template-browser-panel">
      {/* Mode toggle */}
      <div className="template-mode-toggle">
        <button
          className={`template-mode-btn ${mode === 'template' ? 'active' : ''}`}
          onClick={() => setMode('template')}
        >
          Static
        </button>
        <button
          className={`template-mode-btn ${mode === 'animation' ? 'active' : ''}`}
          onClick={() => setMode('animation')}
        >
          Animate
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="template-filter-bar">
        <input
          type="text"
          className="template-search"
          placeholder="Search templates..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
        />
        <select
          className="template-archetype-filter"
          value={filter}
          onChange={(e) => { setFilter(e.target.value as FilterArchetype); setSelectedId(null); }}
          disabled={query.trim().length > 0}
        >
          <option value="all">All</option>
          <option value="humanoid">Humanoid</option>
          <option value="quadruped">Quadruped</option>
          <option value="flying">Flying</option>
          <option value="item">Item</option>
          <option value="vehicle">Vehicle</option>
          <option value="structure">Structure</option>
        </select>
      </div>

      {/* Template grid */}
      <div className="template-grid">
        {templates.map((t) => (
          <button
            key={t.id}
            className={`template-card ${selectedId === t.id ? 'selected' : ''}`}
            onClick={() => { setSelectedId(t.id); setColorOverrides({}); setSelectedPresetId(null); setAnimResult(null); }}
          >
            <div className="template-card-header">
              <span className="template-card-name">{t.name}</span>
              <span className="template-card-size">{t.suggestedWidth}x{t.suggestedHeight}</span>
            </div>
            <div className="template-card-colors">
              {t.colorSlots.map((s) => (
                <span
                  key={s.name}
                  className="template-color-dot"
                  style={{ backgroundColor: rgbaToHex(s.defaultColor) }}
                  title={s.name}
                />
              ))}
            </div>
            <div className="template-card-tags">
              {t.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="template-tag">{tag}</span>
              ))}
            </div>
          </button>
        ))}
        {templates.length === 0 && (
          <div className="template-empty">No templates match your search.</div>
        )}
      </div>

      {/* Detail / customization panel */}
      {selected && (
        <div className="template-detail">
          <h4 className="template-detail-name">{selected.name}</h4>
          <p className="template-detail-desc">{selected.description}</p>

          <div className="template-color-slots">
            <div className="template-section-header">
              <span>Color Slots</span>
              <button className="template-reset-btn" onClick={handleResetColors}>Reset</button>
            </div>
            {selected.colorSlots.map((slot) => {
              const current = colorOverrides[slot.name] ?? slot.defaultColor;
              return (
                <label key={slot.name} className="template-color-row">
                  <input
                    type="color"
                    value={rgbaToHex(current)}
                    onChange={(e) => handleColorChange(slot.name, e.target.value)}
                  />
                  <span className="template-color-label">{slot.name}</span>
                  <span className="template-color-desc">{slot.description}</span>
                </label>
              );
            })}
          </div>

          <div className="template-scale-row">
            <label>
              Scale:
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
              />
              <span>{scale}x</span>
            </label>
          </div>

          {/* Static mode: instantiate single frame */}
          {mode === 'template' && (
            <button
              className="template-instantiate-btn"
              onClick={handleInstantiate}
              disabled={rendering}
            >
              {rendering ? 'Rendering...' : 'Instantiate on Canvas'}
            </button>
          )}

          {/* Animation mode: preset selector + generate */}
          {mode === 'animation' && (
            <div className="template-animation-section">
              <div className="template-section-header">
                <span>Animation Preset</span>
              </div>

              {compatiblePresets.length === 0 ? (
                <div className="template-empty">No animations for {selected.archetype} templates.</div>
              ) : (
                <>
                  <div className="template-preset-grid">
                    {compatiblePresets.map((p) => (
                      <button
                        key={p.id}
                        className={`template-preset-card ${selectedPresetId === p.id ? 'selected' : ''}`}
                        onClick={() => { setSelectedPresetId(p.id); setAnimResult(null); }}
                      >
                        <span className="template-preset-name">{p.name}</span>
                        <span className="template-preset-meta">
                          {p.frameCount}f · {p.defaultFps}fps · {p.looping ? 'loop' : 'once'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedPreset && (
                    <>
                      <p className="template-preset-desc">{selectedPreset.description}</p>

                      <div className="template-scale-row">
                        <label>
                          Intensity:
                          <input
                            type="range"
                            min="0.1"
                            max="3"
                            step="0.1"
                            value={intensity}
                            onChange={(e) => setIntensity(parseFloat(e.target.value))}
                          />
                          <span>{intensity.toFixed(1)}x</span>
                        </label>
                      </div>

                      <button
                        className="template-instantiate-btn"
                        onClick={handleGenerateAnimation}
                        disabled={rendering}
                      >
                        {rendering
                          ? animProgress ?? 'Generating...'
                          : `Generate ${selectedPreset.frameCount}-Frame Animation`
                        }
                      </button>

                      {animResult && (
                        <div className="template-anim-result">
                          <div className="template-anim-result-header">Animation Generated</div>
                          <div className="template-anim-result-stats">
                            {animResult.frameCount} frames · {animResult.totalPixels} pixels
                          </div>
                          <div className="template-anim-frame-ids">
                            {animResult.frameIds.map((id, i) => (
                              <span key={id} className="template-anim-frame-chip">
                                F{i + 1}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {status && <div className="template-status">{status}</div>}
        </div>
      )}
    </div>
  );
}
