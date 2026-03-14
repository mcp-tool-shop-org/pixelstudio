import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { MotionPresetSummary, PresetApplyResult, PresetCompatibility, BatchApplyResult, PresetApplyOverrides, PresetPreviewResult } from '@pixelstudio/domain';
import { useAnchorStore } from '@pixelstudio/state';
import { useTimelineStore } from '@pixelstudio/state';

type ApplyScope = 'current' | 'span' | 'all';

const KIND_LABELS: Record<string, string> = {
  locomotion: 'Locomotion',
  secondary_motion: 'Secondary',
};

export function PresetPanel() {
  const [presets, setPresets] = useState<MotionPresetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [compat, setCompat] = useState<Record<string, PresetCompatibility>>({});

  // Filter/search
  const [kindFilter, setKindFilter] = useState<'all' | 'locomotion' | 'secondary_motion'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Batch apply state
  const [applyScope, setApplyScope] = useState<ApplyScope>('current');
  const [spanStart, setSpanStart] = useState(0);
  const [spanEnd, setSpanEnd] = useState(0);
  const [batchResult, setBatchResult] = useState<BatchApplyResult | null>(null);

  // Override controls
  const [showOverrides, setShowOverrides] = useState(false);
  const [ovStrength, setOvStrength] = useState<number | null>(null);
  const [ovDirection, setOvDirection] = useState<string | null>(null);
  const [ovPhaseOffset, setOvPhaseOffset] = useState<number | null>(null);

  // Preview state
  const [preview, setPreview] = useState<PresetPreviewResult | null>(null);
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null);

  const frames = useTimelineStore((s) => s.frames);

  const refreshPresets = useCallback(() => {
    invoke<MotionPresetSummary[]>('list_motion_presets')
      .then(setPresets)
      .catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  // Sync span bounds to frame count
  useEffect(() => {
    if (frames.length > 0) {
      setSpanEnd(Math.min(spanEnd, frames.length - 1));
    }
  }, [frames.length]);

  // Fetch compatibility for each preset when panel is expanded
  useEffect(() => {
    if (!expanded || presets.length === 0) return;
    const checks = presets.map((p) =>
      invoke<PresetCompatibility>('check_motion_preset_compatibility', { presetId: p.id })
        .then((c) => [p.id, c] as const)
        .catch(() => null)
    );
    Promise.all(checks).then((results) => {
      const map: Record<string, PresetCompatibility> = {};
      for (const r of results) {
        if (r) map[r[0]] = r[1];
      }
      setCompat(map);
    });
  }, [expanded, presets]);

  const refreshAnchors = useCallback(async () => {
    const anchors = await invoke<any[]>('list_anchors');
    useAnchorStore.getState().setAnchors(anchors.map((r: any) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      x: r.x,
      y: r.y,
      bounds: r.bounds,
      parentName: r.parentName ?? null,
      falloffWeight: r.falloffWeight ?? 1.0,
    })));
  }, []);

  const buildOverrides = useCallback((): PresetApplyOverrides | undefined => {
    if (!showOverrides) return undefined;
    const ov: PresetApplyOverrides = {};
    if (ovStrength !== null) ov.strength = ovStrength;
    if (ovDirection !== null) ov.direction = ovDirection;
    if (ovPhaseOffset !== null) ov.phaseOffset = ovPhaseOffset;
    return Object.keys(ov).length > 0 ? ov : undefined;
  }, [showOverrides, ovStrength, ovDirection, ovPhaseOffset]);

  const handlePreview = useCallback(async (presetId: string) => {
    setError(null);
    setPreview(null);
    setPreviewPresetId(presetId);
    const overrides = buildOverrides() ?? null;
    try {
      const result = await invoke<PresetPreviewResult>('preview_motion_preset_apply', {
        presetId,
        scope: applyScope,
        startIndex: applyScope === 'span' ? spanStart : null,
        endIndex: applyScope === 'span' ? spanEnd : null,
        overrides,
      });
      setPreview(result);
    } catch (err) {
      setError(String(err));
      setPreviewPresetId(null);
    }
  }, [applyScope, spanStart, spanEnd, buildOverrides]);

  const handleApply = useCallback(async (presetId: string, presetName: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setBatchResult(null);
    setPreview(null);
    setPreviewPresetId(null);
    const overrides = buildOverrides() ?? null;

    try {
      if (applyScope === 'current') {
        const result = await invoke<PresetApplyResult>('apply_motion_preset', { presetId, overrides });
        await refreshAnchors();
        const parts: string[] = [];
        if (result.createdAnchors.length > 0) parts.push(`${result.createdAnchors.length} created`);
        if (result.updatedAnchors.length > 0) parts.push(`${result.updatedAnchors.length} updated`);
        if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
        setMessage(`Applied "${presetName}": ${parts.join(', ')}`);
        if (result.warnings.length > 0) {
          setError(result.warnings.join('; '));
        }
      } else if (applyScope === 'span') {
        const result = await invoke<BatchApplyResult>('apply_motion_preset_to_span', {
          presetId, startIndex: spanStart, endIndex: spanEnd, overrides,
        });
        await refreshAnchors();
        setBatchResult(result);
        setMessage(`Applied "${presetName}" to span: ${result.summary.join(', ')}`);
      } else {
        const result = await invoke<BatchApplyResult>('apply_motion_preset_to_all_frames', { presetId, overrides });
        await refreshAnchors();
        setBatchResult(result);
        setMessage(`Applied "${presetName}" to all frames: ${result.summary.join(', ')}`);
      }
      setTimeout(() => { setMessage(null); setError(null); setBatchResult(null); }, 6000);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [applyScope, spanStart, spanEnd, refreshAnchors, buildOverrides]);

  const handleDelete = useCallback(async (presetId: string) => {
    try {
      await invoke('delete_motion_preset', { presetId });
      refreshPresets();
    } catch (err) {
      setError(String(err));
    }
  }, [refreshPresets]);

  const handleRename = useCallback(async (presetId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await invoke('rename_motion_preset', { presetId, newName });
      refreshPresets();
    } catch (err) {
      setError(String(err));
    }
  }, [refreshPresets]);

  const maxIndex = Math.max(0, frames.length - 1);

  // Filter and sort presets
  const filteredPresets = presets
    .filter((p) => kindFilter === 'all' || p.kind === kindFilter)
    .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Compatible first
      const ca = compat[a.id]?.tier === 'compatible' ? 0 : compat[a.id]?.tier === 'partial' ? 1 : 2;
      const cb = compat[b.id]?.tier === 'compatible' ? 0 : compat[b.id]?.tier === 'partial' ? 1 : 2;
      if (ca !== cb) return ca - cb;
      // Then by name
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="preset-panel">
      <div className="preset-header" onClick={() => setExpanded(!expanded)}>
        <span className="preset-title">Presets</span>
        <span className="preset-count">{presets.length}</span>
        <span className="preset-toggle">{expanded ? '\u25BC' : '\u25B6'}</span>
      </div>

      {expanded && (
        <div className="preset-body">
          {/* Batch scope selector */}
          {frames.length > 1 && (
            <div className="preset-scope-bar">
              <button
                className={`preset-scope-btn ${applyScope === 'current' ? 'active' : ''}`}
                onClick={() => setApplyScope('current')}
              >
                Current
              </button>
              <button
                className={`preset-scope-btn ${applyScope === 'span' ? 'active' : ''}`}
                onClick={() => setApplyScope('span')}
              >
                Span
              </button>
              <button
                className={`preset-scope-btn ${applyScope === 'all' ? 'active' : ''}`}
                onClick={() => setApplyScope('all')}
              >
                All Frames
              </button>
            </div>
          )}

          {applyScope === 'span' && frames.length > 1 && (
            <div className="preset-span-row">
              <label className="preset-span-label">
                From:
                <input
                  type="number"
                  min={0}
                  max={maxIndex}
                  value={spanStart}
                  onChange={(e) => setSpanStart(Math.min(Number(e.target.value), spanEnd))}
                  className="preset-span-input"
                />
              </label>
              <label className="preset-span-label">
                To:
                <input
                  type="number"
                  min={0}
                  max={maxIndex}
                  value={spanEnd}
                  onChange={(e) => setSpanEnd(Math.max(Number(e.target.value), spanStart))}
                  className="preset-span-input"
                />
              </label>
              <span className="preset-span-count">{spanEnd - spanStart + 1} frame{spanEnd - spanStart !== 0 ? 's' : ''}</span>
            </div>
          )}

          {/* Override controls */}
          <div className="preset-overrides-toggle">
            <button
              className={`preset-scope-btn ${showOverrides ? 'active' : ''}`}
              onClick={() => setShowOverrides(!showOverrides)}
            >
              {showOverrides ? 'Hide Overrides' : 'Overrides'}
            </button>
            {showOverrides && (
              <button
                className="preset-override-reset"
                onClick={() => { setOvStrength(null); setOvDirection(null); setOvPhaseOffset(null); }}
              >
                Reset
              </button>
            )}
          </div>
          {showOverrides && (
            <div className="preset-overrides-body">
              <div className="preset-override-row">
                <label className="preset-override-label">Strength</label>
                <input
                  type="range"
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  value={ovStrength ?? 1.0}
                  onChange={(e) => setOvStrength(Number(e.target.value))}
                  className="preset-override-slider"
                />
                <span className="preset-override-value">
                  {ovStrength !== null ? ovStrength.toFixed(1) : 'preset'}
                </span>
              </div>
              <div className="preset-override-row">
                <label className="preset-override-label">Direction</label>
                <select
                  className="preset-override-select"
                  value={ovDirection ?? ''}
                  onChange={(e) => setOvDirection(e.target.value || null)}
                >
                  <option value="">preset default</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                </select>
              </div>
              <div className="preset-override-row">
                <label className="preset-override-label">Phase</label>
                <input
                  type="range"
                  min={0}
                  max={6.28}
                  step={0.1}
                  value={ovPhaseOffset ?? 0}
                  onChange={(e) => setOvPhaseOffset(Number(e.target.value))}
                  className="preset-override-slider"
                />
                <span className="preset-override-value">
                  {ovPhaseOffset !== null ? ovPhaseOffset.toFixed(1) : 'preset'}
                </span>
              </div>
            </div>
          )}

          {/* Filter/search */}
          {presets.length > 0 && (
            <div className="preset-filter-bar">
              <select
                className="preset-kind-filter"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="locomotion">Locomotion</option>
                <option value="secondary_motion">Secondary</option>
              </select>
              <input
                type="text"
                className="preset-search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {presets.length === 0 && (
            <div className="preset-empty">No saved presets. Save a setup from the Motion or Anchor panel.</div>
          )}
          {presets.length > 0 && filteredPresets.length === 0 && (
            <div className="preset-empty">No presets match filters.</div>
          )}

          <div className="preset-list">
            {filteredPresets.map((p) => (
              <div key={p.id} className="preset-item">
                <div className="preset-item-header">
                  <span className="preset-item-name">{p.name}</span>
                  <span className="preset-kind-badge">{KIND_LABELS[p.kind] ?? p.kind}</span>
                </div>
                <div className="preset-item-meta">
                  {p.anchorCount} anchor{p.anchorCount !== 1 ? 's' : ''}
                  {p.hasHierarchy && ' \u00B7 hierarchy'}
                  {p.templateId && ` \u00B7 ${p.templateId}`}
                  {compat[p.id] && (
                    <span className={`preset-compat-badge compat-${compat[p.id].tier}`}>
                      {compat[p.id].tier === 'compatible' ? 'Match' : compat[p.id].tier === 'partial' ? 'Partial' : 'No match'}
                    </span>
                  )}
                </div>
                {compat[p.id] && compat[p.id].notes.length > 0 && (
                  <div className="preset-compat-notes">
                    {compat[p.id].notes.map((n, i) => <span key={i} className="preset-compat-note">{n}</span>)}
                  </div>
                )}
                {p.description && (
                  <div className="preset-item-desc">{p.description}</div>
                )}
                <div className="preset-item-actions">
                  {applyScope !== 'current' && (
                    <button
                      className="preset-preview-btn"
                      onClick={() => handlePreview(p.id)}
                      disabled={loading}
                    >
                      Preview
                    </button>
                  )}
                  <button
                    className="preset-apply-btn"
                    onClick={() => handleApply(p.id, p.name)}
                    disabled={loading}
                  >
                    {applyScope === 'current' ? 'Apply' : applyScope === 'span' ? 'Apply to Span' : 'Apply to All'}
                  </button>
                  <button
                    className="preset-rename-btn"
                    onClick={() => {
                      const name = prompt('Rename preset:', p.name);
                      if (name) handleRename(p.id, name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="preset-delete-btn"
                    onClick={() => handleDelete(p.id)}
                  >
                    {'\u00D7'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {preview && (
            <div className="preset-preview-panel">
              <div className="preset-preview-header">
                <span className="preset-preview-title">Preview: {preview.presetName}</span>
                <span className="preset-preview-scope">{preview.scopeFrames} frame{preview.scopeFrames !== 1 ? 's' : ''}</span>
                <button className="preset-preview-close" onClick={() => { setPreview(null); setPreviewPresetId(null); }}>{'\u00D7'}</button>
              </div>
              <div className="preset-preview-diffs">
                {preview.anchorDiffs.map((d, i) => (
                  <div key={i} className={`preset-diff-item diff-${d.action}`}>
                    <span className="preset-diff-action">{d.action}</span>
                    <span className="preset-diff-name">{d.name}</span>
                    {d.changes.length > 0 && (
                      <span className="preset-diff-changes">{d.changes.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
              {preview.warnings.length > 0 && (
                <div className="preset-preview-warnings">
                  {preview.warnings.map((w, i) => <span key={i} className="preset-preview-warning">{w}</span>)}
                </div>
              )}
              {previewPresetId && (
                <button
                  className="preset-apply-btn preset-confirm-apply"
                  onClick={() => {
                    const p = presets.find((pr) => pr.id === previewPresetId);
                    if (p) handleApply(p.id, p.name);
                  }}
                  disabled={loading}
                >
                  Apply Now
                </button>
              )}
            </div>
          )}

          {batchResult && (
            <div className="preset-batch-summary">
              {batchResult.summary.map((s, i) => <span key={i} className="preset-batch-line">{s}</span>)}
            </div>
          )}

          {message && <div className="preset-success">{message}</div>}
          {error && <div className="preset-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
