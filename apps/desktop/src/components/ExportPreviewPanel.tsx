import { useCallback, useRef, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type {
  ExportScope,
  ExportLayout,
  ExportPreviewResult,
  ExportResult,
  ClipInfo,
  ManifestFormat,
  ExportBundleFormat,
  ExportBundleResult,
  BundlePreviewResult,
  PackageMetadata,
} from '@glyphstudio/domain';
import { useTimelineStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { loadExportSettings, saveExportSettings } from '../lib/exportSettings';
import { loadPackagingSettings, savePackagingSettings } from '../lib/packagingSettings';

type ScopeChoice = 'current_frame' | 'selected_span' | 'current_clip' | 'all_clips';
type LayoutChoice = 'horizontal_strip' | 'vertical_strip' | 'grid';
type PreviewState = 'empty' | 'loading' | 'ready' | 'stale' | 'error';
type ExportAction = 'sequence' | 'sheet' | 'all_clips_sheet';

interface LastExportConfig {
  action: ExportAction;
  clipId: string | null;
  filePath: string | null;
  dirPath: string | null;
  layout: LayoutChoice;
  emitManifest: boolean;
  manifestFormat: ManifestFormat;
  timestamp: number;
}

function initSettings() {
  const s = loadExportSettings();
  return s;
}

export function ExportPreviewPanel() {
  const [saved] = useState(initSettings);
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>(saved.scopeChoice as ScopeChoice);
  const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>(saved.layoutChoice as LayoutChoice);
  const [preview, setPreview] = useState<ExportPreviewResult | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>('empty');
  const [errorMsg, setErrorMsg] = useState('');
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(saved.selectedClipId);
  const [spanStart, setSpanStart] = useState(saved.spanStart);
  const [spanEnd, setSpanEnd] = useState(saved.spanEnd);
  const [emitManifest, setEmitManifest] = useState(saved.emitManifest);
  const [manifestFormat, setManifestFormat] = useState<ManifestFormat>(saved.manifestFormat);
  const [lastOutputDir, setLastOutputDir] = useState<string | null>(saved.lastOutputDir);
  const [lastOutputFile, setLastOutputFile] = useState<string | null>(saved.lastOutputFile);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [lastExportConfig, setLastExportConfig] = useState<LastExportConfig | null>(null);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const frames = useTimelineStore((s) => s.frames);
  const activeFrameIndex = useTimelineStore((s) => s.activeFrameIndex);
  const projectName = useProjectStore((s) => s.name);
  const markDirty = useProjectStore((s) => s.markDirty);

  // Persist settings on change
  useEffect(() => {
    saveExportSettings({
      scopeChoice, layoutChoice, selectedClipId, spanStart, spanEnd,
      emitManifest, manifestFormat, lastOutputDir, lastOutputFile,
    });
  }, [scopeChoice, layoutChoice, selectedClipId, spanStart, spanEnd, emitManifest, manifestFormat, lastOutputDir, lastOutputFile]);

  // Load clips when panel opens; validate persisted clip selection
  useEffect(() => {
    invoke<ClipInfo[]>('list_clips')
      .then((result) => {
        setClips(result);
        if (result.length > 0) {
          // If persisted clip no longer exists, fall back to first
          const persisted = selectedClipId;
          if (!persisted || !result.some((c) => c.id === persisted)) {
            setSelectedClipId(result[0].id);
          }
        } else {
          setSelectedClipId(null);
        }
      })
      .catch(() => {});
  }, [frames.length]);

  // Clamp persisted span to current frame count
  useEffect(() => {
    if (frames.length > 0) {
      if (spanStart > frames.length) setSpanStart(1);
      if (spanEnd > frames.length) setSpanEnd(frames.length);
    }
  }, [frames.length]);

  // Mark stale when scope inputs change
  useEffect(() => {
    if (previewState === 'ready') setPreviewState('stale');
    setExportResult(null);
  }, [scopeChoice, layoutChoice, selectedClipId, spanStart, spanEnd, activeFrameIndex]);

  const buildScope = useCallback((): ExportScope => {
    switch (scopeChoice) {
      case 'current_frame':
        return { type: 'current_frame' };
      case 'selected_span':
        return { type: 'selected_span', start: spanStart - 1, end: spanEnd - 1 };
      case 'current_clip':
        return { type: 'current_clip', clipId: selectedClipId ?? '' };
      case 'all_clips':
        return { type: 'all_clips' };
    }
  }, [scopeChoice, spanStart, spanEnd, selectedClipId]);

  const buildLayout = useCallback((): ExportLayout => {
    switch (layoutChoice) {
      case 'horizontal_strip':
        return { type: 'horizontal_strip' };
      case 'vertical_strip':
        return { type: 'vertical_strip' };
      case 'grid':
        return { type: 'grid', columns: null };
    }
  }, [layoutChoice]);

  const handlePreview = useCallback(async () => {
    setPreviewState('loading');
    setErrorMsg('');
    setExportResult(null);
    try {
      const result = await invoke<ExportPreviewResult>('preview_sprite_sheet_layout', {
        scope: buildScope(),
        layout: buildLayout(),
      });
      setPreview(result);
      setPreviewState('ready');
    } catch (err) {
      setErrorMsg(String(err));
      setPreviewState('error');
    }
  }, [buildScope, buildLayout]);

  // --- Export handlers ---

  const handleExportSequence = useCallback(async () => {
    if (!selectedClipId || previewState !== 'ready') return;
    setExporting(true);
    try {
      const clipName = clips.find((c) => c.id === selectedClipId)?.name ?? 'clip';
      const defaultName = `${projectName || 'sprite'}_${clipName}_sequence`;
      const defaultPath = lastOutputDir ? `${lastOutputDir}/${defaultName}` : defaultName;
      const dirPath = await save({
        title: 'Export Clip Sequence — Choose folder',
        defaultPath,
      });
      if (!dirPath) { setExporting(false); return; }

      const cmd = emitManifest ? 'export_clip_sequence_with_manifest' : 'export_clip_sequence';
      const result = await invoke<ExportResult>(cmd, {
        clipId: selectedClipId,
        dirPath,
        ...(emitManifest ? { manifestFormat } : {}),
      });
      setExportResult(result);
      setLastOutputDir(dirPath.replace(/[\\/][^\\/]*$/, ''));
      setLastExportConfig({
        action: 'sequence', clipId: selectedClipId, filePath: null, dirPath,
        layout: layoutChoice, emitManifest, manifestFormat, timestamp: Date.now(),
      });
    } catch (err) {
      setErrorMsg(String(err));
    }
    setExporting(false);
  }, [selectedClipId, previewState, clips, projectName, emitManifest, manifestFormat, lastOutputDir, layoutChoice]);

  const handleExportSheet = useCallback(async () => {
    if (!selectedClipId || previewState !== 'ready') return;
    setExporting(true);
    try {
      const clipName = clips.find((c) => c.id === selectedClipId)?.name ?? 'clip';
      const defaultName = `${clipName}_sheet.png`;
      const defaultPath = lastOutputDir ? `${lastOutputDir}/${defaultName}` : defaultName;
      const filePath = await save({
        title: 'Export Clip Sheet',
        defaultPath,
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });
      if (!filePath) { setExporting(false); return; }

      const result = await invoke<ExportResult>('export_clip_sheet', {
        clipId: selectedClipId,
        filePath,
        layout: buildLayout(),
        emitManifest,
        manifestFormat: emitManifest ? manifestFormat : undefined,
      });
      setExportResult(result);
      const dir = filePath.replace(/[\\/][^\\/]*$/, '');
      setLastOutputDir(dir);
      setLastOutputFile(filePath);
      setLastExportConfig({
        action: 'sheet', clipId: selectedClipId, filePath, dirPath: null,
        layout: layoutChoice, emitManifest, manifestFormat, timestamp: Date.now(),
      });
    } catch (err) {
      setErrorMsg(String(err));
    }
    setExporting(false);
  }, [selectedClipId, previewState, clips, buildLayout, emitManifest, manifestFormat, lastOutputDir, layoutChoice]);

  const handleExportAllClipsSheet = useCallback(async () => {
    if (previewState !== 'ready') return;
    setExporting(true);
    try {
      const defaultName = 'all_clips_sheet.png';
      const defaultPath = lastOutputDir ? `${lastOutputDir}/${defaultName}` : defaultName;
      const filePath = await save({
        title: 'Export All Clips Sheet',
        defaultPath,
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });
      if (!filePath) { setExporting(false); return; }

      const result = await invoke<ExportResult>('export_all_clips_sheet', {
        filePath,
        layout: buildLayout(),
        emitManifest,
        manifestFormat: emitManifest ? manifestFormat : undefined,
      });
      setExportResult(result);
      const dir = filePath.replace(/[\\/][^\\/]*$/, '');
      setLastOutputDir(dir);
      setLastOutputFile(filePath);
      setLastExportConfig({
        action: 'all_clips_sheet', clipId: null, filePath, dirPath: null,
        layout: layoutChoice, emitManifest, manifestFormat, timestamp: Date.now(),
      });
    } catch (err) {
      setErrorMsg(String(err));
    }
    setExporting(false);
  }, [previewState, buildLayout, emitManifest, manifestFormat, lastOutputDir, layoutChoice]);

  // Export Again — re-run last export to the same path without dialog
  const handleExportAgain = useCallback(async () => {
    if (!lastExportConfig || previewState !== 'ready' || exporting) return;
    const cfg = lastExportConfig;
    setExporting(true);
    setErrorMsg('');
    try {
      let result: ExportResult;
      if (cfg.action === 'sequence' && cfg.clipId && cfg.dirPath) {
        // Validate clip still exists
        if (!clips.some((c) => c.id === cfg.clipId)) {
          setErrorMsg('Previously exported clip no longer exists');
          setExporting(false);
          return;
        }
        const cmd = cfg.emitManifest ? 'export_clip_sequence_with_manifest' : 'export_clip_sequence';
        result = await invoke<ExportResult>(cmd, {
          clipId: cfg.clipId,
          dirPath: cfg.dirPath,
          ...(cfg.emitManifest ? { manifestFormat: cfg.manifestFormat } : {}),
        });
      } else if (cfg.action === 'sheet' && cfg.clipId && cfg.filePath) {
        if (!clips.some((c) => c.id === cfg.clipId)) {
          setErrorMsg('Previously exported clip no longer exists');
          setExporting(false);
          return;
        }
        result = await invoke<ExportResult>('export_clip_sheet', {
          clipId: cfg.clipId,
          filePath: cfg.filePath,
          layout: buildLayout(),
          emitManifest: cfg.emitManifest,
          manifestFormat: cfg.emitManifest ? cfg.manifestFormat : undefined,
        });
      } else if (cfg.action === 'all_clips_sheet' && cfg.filePath) {
        result = await invoke<ExportResult>('export_all_clips_sheet', {
          filePath: cfg.filePath,
          layout: buildLayout(),
          emitManifest: cfg.emitManifest,
          manifestFormat: cfg.emitManifest ? cfg.manifestFormat : undefined,
        });
      } else {
        setErrorMsg('Invalid last export config');
        setExporting(false);
        return;
      }
      setExportResult(result);
      setLastExportConfig({ ...cfg, timestamp: Date.now() });
    } catch (err) {
      setErrorMsg(String(err));
    }
    setExporting(false);
  }, [lastExportConfig, previewState, exporting, clips, buildLayout]);

  // Export Again is allowed when preview is fresh and last config exists with a valid target
  const canExportAgain = previewState === 'ready' && !exporting && !!lastExportConfig && !!(lastExportConfig.filePath || lastExportConfig.dirPath);

  // --- Package metadata ---
  const [pkgMeta, setPkgMeta] = useState<PackageMetadata>({
    packageName: '', version: '0.1.0', author: '', description: '', tags: [],
  });
  const [pkgLoaded, setPkgLoaded] = useState(false);

  // Load package metadata from backend on mount
  useEffect(() => {
    invoke<PackageMetadata>('get_asset_package_metadata')
      .then((meta) => {
        setPkgMeta({
          ...meta,
          packageName: meta.packageName || projectName || '',
        });
        setPkgLoaded(true);
      })
      .catch(() => {
        setPkgMeta((prev) => ({ ...prev, packageName: projectName || '' }));
        setPkgLoaded(true);
      });
  }, []);

  const savePkgMeta = useCallback((updated: PackageMetadata) => {
    setPkgMeta(updated);
    invoke('set_asset_package_metadata', {
      packageName: updated.packageName,
      version: updated.version,
      author: updated.author,
      description: updated.description,
      tags: updated.tags,
    }).then(() => {
      markDirty();
      invoke('mark_dirty').catch(() => {});
    }).catch(() => {});
  }, [markDirty]);

  // --- Bundle packaging ---
  const [savedPkg] = useState(() => loadPackagingSettings());
  const [bundleFormat, setBundleFormat] = useState<ExportBundleFormat>(savedPkg.bundleFormat);
  const [bundleIncludePreview, setBundleIncludePreview] = useState(savedPkg.bundleIncludePreview);
  const [bundlePreview, setBundlePreview] = useState<BundlePreviewResult | null>(null);
  const [bundleResult, setBundleResult] = useState<ExportBundleResult | null>(null);
  const [bundling, setBundling] = useState(false);
  const [lastBundleOutputDir, setLastBundleOutputDir] = useState<string | null>(null);
  const [bundlePreviewStale, setBundlePreviewStale] = useState(false);

  // Persist bundle packaging settings on change
  useEffect(() => {
    savePackagingSettings({
      bundleFormat,
      bundleIncludePreview,
      lastPackagingMode: 'single',
    });
  }, [bundleFormat, bundleIncludePreview]);

  // Mark bundle preview stale when settings change
  useEffect(() => {
    if (bundlePreview) setBundlePreviewStale(true);
  }, [bundleFormat, bundleIncludePreview, emitManifest, manifestFormat, scopeChoice, selectedClipId, layoutChoice]);

  const resolveBundleAction = useCallback((): 'sequence' | 'sheet' | 'all_clips_sheet' => {
    if (scopeChoice === 'all_clips') return 'all_clips_sheet';
    return 'sheet';
  }, [scopeChoice]);

  const handleBundlePreview = useCallback(async () => {
    if (previewState !== 'ready') return;
    try {
      const result = await invoke<BundlePreviewResult>('preview_asset_bundle', {
        bundleName: projectName || 'sprite',
        exportAction: resolveBundleAction(),
        clipId: selectedClipId,
        layout: buildLayout(),
        manifestFormat: emitManifest ? manifestFormat : undefined,
        contents: { images: true, manifest: emitManifest, preview: bundleIncludePreview },
      });
      setBundlePreview(result);
      setBundleResult(null);
      setBundlePreviewStale(false);
    } catch (err) {
      setErrorMsg(String(err));
    }
  }, [previewState, projectName, resolveBundleAction, selectedClipId, buildLayout, emitManifest, manifestFormat, bundleIncludePreview]);

  const handleExportBundle = useCallback(async () => {
    if (previewState !== 'ready' || bundling) return;
    setBundling(true);
    setErrorMsg('');
    try {
      const defaultName = `${projectName || 'sprite'}_bundle`;
      const defaultPath = lastOutputDir ? `${lastOutputDir}/${defaultName}` : defaultName;
      const dirPath = await save({
        title: `Export Bundle — Choose output directory`,
        defaultPath,
      });
      if (!dirPath) { setBundling(false); return; }

      const outputDir = dirPath.replace(/[\\/][^\\/]*$/, '');
      const result = await invoke<ExportBundleResult>('export_asset_bundle', {
        outputPath: outputDir,
        bundleName: projectName || 'sprite',
        format: bundleFormat,
        exportAction: resolveBundleAction(),
        clipId: selectedClipId,
        layout: buildLayout(),
        manifestFormat: emitManifest ? manifestFormat : undefined,
        contents: { images: true, manifest: emitManifest, preview: bundleIncludePreview },
      });
      setBundleResult(result);
      setLastOutputDir(outputDir);
      setLastBundleOutputDir(outputDir);
      savePackagingSettings({ lastPackageOutputDir: outputDir, lastPackagingMode: 'single' });
    } catch (err) {
      setErrorMsg(String(err));
    }
    setBundling(false);
  }, [previewState, bundling, projectName, lastOutputDir, bundleFormat, resolveBundleAction, selectedClipId, buildLayout, emitManifest, manifestFormat, bundleIncludePreview]);

  // Package Again — re-run last bundle export to the same output dir
  const handlePackageAgain = useCallback(async () => {
    if (!lastBundleOutputDir || previewState !== 'ready' || bundling || bundlePreviewStale) return;
    setBundling(true);
    setErrorMsg('');
    try {
      const result = await invoke<ExportBundleResult>('export_asset_bundle', {
        outputPath: lastBundleOutputDir,
        bundleName: projectName || 'sprite',
        format: bundleFormat,
        exportAction: resolveBundleAction(),
        clipId: selectedClipId,
        layout: buildLayout(),
        manifestFormat: emitManifest ? manifestFormat : undefined,
        contents: { images: true, manifest: emitManifest, preview: bundleIncludePreview },
      });
      setBundleResult(result);
    } catch (err) {
      setErrorMsg(String(err));
    }
    setBundling(false);
  }, [lastBundleOutputDir, previewState, bundling, bundlePreviewStale, projectName, bundleFormat, resolveBundleAction, selectedClipId, buildLayout, emitManifest, manifestFormat, bundleIncludePreview]);

  const canPackageAgain = previewState === 'ready' && !bundling && !!lastBundleOutputDir && !bundlePreviewStale;

  // Draw preview canvas
  useEffect(() => {
    if (!preview || previewState !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxDisplayW = 320;
    const maxDisplayH = 200;
    const { outputWidth, outputHeight, placements, clipGroups } = preview;
    if (outputWidth === 0 || outputHeight === 0) return;

    const scale = Math.min(maxDisplayW / outputWidth, maxDisplayH / outputHeight, 1);
    const displayW = Math.ceil(outputWidth * scale);
    const displayH = Math.ceil(outputHeight * scale);

    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, displayW, displayH);

    const groupColors = ['#2a3a5c', '#3a2a4c', '#2a4a3c', '#4a3a2c', '#2c2a4a'];
    if (clipGroups.length > 0) {
      clipGroups.forEach((group, gi) => {
        const tint = groupColors[gi % groupColors.length];
        for (let i = 0; i < group.frameCount; i++) {
          const p = placements[group.placementOffset + i];
          if (!p) continue;
          ctx.fillStyle = tint;
          ctx.fillRect(p.x * scale, p.y * scale, p.width * scale, p.height * scale);
        }
      });
    }

    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 1;
    placements.forEach((p) => {
      const rx = Math.floor(p.x * scale) + 0.5;
      const ry = Math.floor(p.y * scale) + 0.5;
      const rw = Math.floor(p.width * scale);
      const rh = Math.floor(p.height * scale);
      ctx.strokeRect(rx, ry, rw, rh);
      if (rw > 14 && rh > 12) {
        ctx.fillStyle = '#8ab4f8';
        ctx.font = `${Math.max(8, Math.min(11, rh * 0.4))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.frameIndex + 1), rx + rw / 2, ry + rh / 2);
      }
    });

    if (clipGroups.length > 1) {
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      clipGroups.forEach((group) => {
        if (group.frameCount === 0) return;
        const firstP = placements[group.placementOffset];
        if (!firstP) return;
        ctx.fillStyle = '#ccc';
        ctx.fillText(group.clipName, firstP.x * scale + 2, firstP.y * scale + 1);
      });
    }
  }, [preview, previewState]);

  const scopeBlocked =
    (scopeChoice === 'current_clip' && clips.length === 0) ||
    (scopeChoice === 'all_clips' && clips.length === 0);

  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const selectedClipInvalid = selectedClip?.validity === 'invalid';

  const canExport = previewState === 'ready' && !exporting;
  const canExportClip = canExport && (scopeChoice === 'current_clip') && !!selectedClipId && !selectedClipInvalid;
  const canExportAllClips = canExport && scopeChoice === 'all_clips' && clips.length > 0;

  return (
    <div className="export-preview-panel">
      <div className="export-preview-header">
        <span className="export-preview-title">Export Preview</span>
      </div>

      <div className="export-preview-controls">
        <div className="export-preview-row">
          <label className="export-label">Scope</label>
          <select
            className="export-select"
            value={scopeChoice}
            onChange={(e) => setScopeChoice(e.target.value as ScopeChoice)}
          >
            <option value="current_frame">Current Frame</option>
            <option value="selected_span">Selected Span</option>
            <option value="current_clip" disabled={clips.length === 0}>
              Current Clip {clips.length === 0 ? '(none)' : ''}
            </option>
            <option value="all_clips" disabled={clips.length === 0}>
              All Clips {clips.length === 0 ? '(none)' : `(${clips.length})`}
            </option>
          </select>
        </div>

        {scopeChoice === 'selected_span' && (
          <div className="export-preview-row export-span-inputs">
            <label>
              Start
              <input
                type="number"
                min={1}
                max={frames.length}
                value={spanStart}
                onChange={(e) => setSpanStart(parseInt(e.target.value, 10) || 1)}
              />
            </label>
            <label>
              End
              <input
                type="number"
                min={1}
                max={frames.length}
                value={spanEnd}
                onChange={(e) => setSpanEnd(parseInt(e.target.value, 10) || 1)}
              />
            </label>
          </div>
        )}

        {scopeChoice === 'current_clip' && clips.length > 0 && (
          <div className="export-preview-row">
            <select
              className="export-select"
              value={selectedClipId ?? ''}
              onChange={(e) => setSelectedClipId(e.target.value)}
            >
              {clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.validity === 'invalid' ? '\u2717 ' : c.validity === 'warning' ? '\u26A0 ' : ''}{c.name} ({c.startFrame + 1}–{c.endFrame + 1})
                </option>
              ))}
            </select>
            {selectedClipInvalid && (
              <span className="export-preview-warning">Selected clip has an invalid range — export blocked</span>
            )}
          </div>
        )}

        <div className="export-preview-row">
          <label className="export-label">Layout</label>
          <select
            className="export-select"
            value={layoutChoice}
            onChange={(e) => setLayoutChoice(e.target.value as LayoutChoice)}
          >
            <option value="horizontal_strip">Horizontal Strip</option>
            <option value="vertical_strip">Vertical Strip</option>
            <option value="grid">Grid (auto)</option>
          </select>
        </div>

        <button
          className="export-preview-btn"
          onClick={handlePreview}
          disabled={previewState === 'loading' || scopeBlocked}
        >
          {previewState === 'loading' ? 'Generating...' : 'Preview'}
        </button>
      </div>

      {/* Preview canvas */}
      <div className="export-preview-canvas-wrap">
        {previewState === 'empty' && (
          <span className="export-preview-empty">Choose scope and layout, then click Preview</span>
        )}
        {previewState === 'loading' && (
          <span className="export-preview-loading">Calculating layout...</span>
        )}
        {previewState === 'error' && (
          <span className="export-preview-error">{errorMsg}</span>
        )}
        {(previewState === 'ready' || previewState === 'stale') && preview && (
          <>
            {previewState === 'stale' && (
              <span className="export-preview-stale">Preview outdated — re-preview before export</span>
            )}
            <canvas ref={canvasRef} className="export-preview-canvas" />
            <div className="export-preview-meta">
              <span>{preview.outputWidth} x {preview.outputHeight}px</span>
              <span>{preview.frameCount} frame{preview.frameCount !== 1 ? 's' : ''}</span>
              <span>{preview.columns}c x {preview.rows}r</span>
              {preview.clipGroups.length > 0 && (
                <span>{preview.clipGroups.length} clip{preview.clipGroups.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {preview.warnings.length > 0 && (
              <div className="export-preview-warnings">
                {preview.warnings.map((w, i) => (
                  <span key={i} className="export-preview-warning">{w}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Export actions — only when preview is fresh */}
      {previewState === 'ready' && preview && (
        <div className="export-actions">
          <label className="export-manifest-toggle">
            <input
              type="checkbox"
              checked={emitManifest}
              onChange={(e) => setEmitManifest(e.target.checked)}
            />
            <span>Include manifest</span>
          </label>
          {emitManifest && (
            <div className="export-preview-row">
              <label className="export-label">Format</label>
              <select
                className="export-select"
                value={manifestFormat}
                onChange={(e) => setManifestFormat(e.target.value as ManifestFormat)}
              >
                <option value="glyphstudio_native">GlyphStudio Native</option>
                <option value="generic_runtime">Generic Runtime</option>
              </select>
            </div>
          )}

          <div className="export-action-buttons">
            {canExportClip && (
              <>
                <button className="export-action-btn" onClick={handleExportSequence} disabled={exporting}>
                  Export Sequence
                </button>
                <button className="export-action-btn" onClick={handleExportSheet} disabled={exporting}>
                  Export Sheet
                </button>
              </>
            )}
            {canExportAllClips && (
              <button className="export-action-btn" onClick={handleExportAllClipsSheet} disabled={exporting}>
                Export All Clips Sheet
              </button>
            )}
            {!canExportClip && !canExportAllClips && (
              <span className="export-action-hint">
                Select a clip scope to enable export
              </span>
            )}
          </div>
          {canExportAgain && (
            <button
              className="export-action-btn export-again-btn"
              onClick={handleExportAgain}
              disabled={exporting}
              title="Re-export to the same path with current settings"
            >
              Export Again
            </button>
          )}
        </div>
      )}

      {/* Last export summary */}
      {lastExportConfig && !exportResult && previewState === 'stale' && (
        <div className="export-last-summary">
          <span className="export-last-label">Last export:</span>
          <span>{lastExportConfig.action.replace(/_/g, ' ')}</span>
          {lastExportConfig.emitManifest && (
            <span>+ {lastExportConfig.manifestFormat === 'generic_runtime' ? 'generic' : 'native'} manifest</span>
          )}
          <span className="export-last-hint">Preview again to re-export</span>
        </div>
      )}

      {/* Export result summary */}
      {exportResult && (
        <div className="export-result-summary">
          <span className="export-result-success">
            Exported {exportResult.frameCount} frame{exportResult.frameCount !== 1 ? 's' : ''}
            {exportResult.clipCount > 0 && ` from ${exportResult.clipCount} clip${exportResult.clipCount !== 1 ? 's' : ''}`}
          </span>
          <span className="export-result-files">
            {exportResult.files.length} file{exportResult.files.length !== 1 ? 's' : ''} written
            {exportResult.manifest && ` + ${lastExportConfig?.manifestFormat === 'generic_runtime' ? 'generic' : 'native'} manifest`}
          </span>
          {exportResult.files[0] && (
            <span className="export-result-path" title={exportResult.files[0].path}>
              {exportResult.files[0].path.replace(/^.*[\\/]([^\\/]+[\\/][^\\/]+)$/, '$1')}
            </span>
          )}
          {exportResult.skippedClips > 0 && (
            <span className="export-result-skipped">
              {exportResult.skippedClips} invalid clip{exportResult.skippedClips !== 1 ? 's' : ''} skipped
            </span>
          )}
          {exportResult.wasSuffixed && (
            <span className="export-result-suffixed">
              Some filenames were suffixed to avoid overwriting
            </span>
          )}
          {exportResult.warnings.length > 0 && (
            <div className="export-preview-warnings">
              {exportResult.warnings.map((w, i) => (
                <span key={i} className="export-preview-warning">{w}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bundle packaging section */}
      {previewState === 'ready' && preview && (
        <div className="export-bundle-section">
          <div className="export-bundle-header">Package Bundle</div>

          {/* Package metadata */}
          <div className="export-pkg-meta">
            <div className="export-preview-row">
              <label className="export-label">Package</label>
              <input
                type="text"
                className="export-input"
                placeholder={projectName || 'package name'}
                value={pkgMeta.packageName}
                onChange={(e) => savePkgMeta({ ...pkgMeta, packageName: e.target.value })}
              />
            </div>
            <div className="export-preview-row">
              <label className="export-label">Version</label>
              <input
                type="text"
                className="export-input export-input-short"
                placeholder="0.1.0"
                value={pkgMeta.version}
                onChange={(e) => savePkgMeta({ ...pkgMeta, version: e.target.value })}
              />
            </div>
            <div className="export-preview-row">
              <label className="export-label">Author</label>
              <input
                type="text"
                className="export-input"
                placeholder="optional"
                value={pkgMeta.author}
                onChange={(e) => savePkgMeta({ ...pkgMeta, author: e.target.value })}
              />
            </div>
            <div className="export-preview-row">
              <label className="export-label">Desc</label>
              <input
                type="text"
                className="export-input"
                placeholder="optional"
                value={pkgMeta.description}
                onChange={(e) => savePkgMeta({ ...pkgMeta, description: e.target.value })}
              />
            </div>
          </div>

          <div className="export-bundle-controls">
            <div className="export-preview-row">
              <label className="export-label">Format</label>
              <select
                className="export-select"
                value={bundleFormat}
                onChange={(e) => setBundleFormat(e.target.value as ExportBundleFormat)}
              >
                <option value="folder">Folder</option>
                <option value="zip">Zip</option>
              </select>
            </div>
            <label className="export-manifest-toggle">
              <input
                type="checkbox"
                checked={bundleIncludePreview}
                onChange={(e) => setBundleIncludePreview(e.target.checked)}
              />
              <span>Include preview thumbnail</span>
            </label>
          </div>
          <div className="export-action-buttons">
            <button
              className="export-action-btn"
              onClick={handleBundlePreview}
              disabled={bundling}
            >
              Preview Bundle
            </button>
            <button
              className="export-action-btn export-bundle-btn"
              onClick={handleExportBundle}
              disabled={bundling}
            >
              Export Bundle
            </button>
            {canPackageAgain && (
              <button
                className="export-action-btn export-again-btn"
                onClick={handlePackageAgain}
                disabled={bundling}
                title={`Re-export bundle to ${lastBundleOutputDir}`}
              >
                Package Again
              </button>
            )}
          </div>

          {/* Stale bundle preview hint */}
          {bundlePreview && bundlePreviewStale && (
            <span className="export-preview-stale">Settings changed — preview again to package</span>
          )}

          {/* Last package summary */}
          {bundleResult && (
            <div className="export-bundle-last-summary">
              <span className="export-last-label">Last package:</span>
              <span>{bundleResult.format}</span>
              <span>{bundleResult.files.length} file{bundleResult.files.length !== 1 ? 's' : ''}</span>
              <span>{formatBytes(bundleResult.totalBytes)}</span>
            </div>
          )}

          {/* Bundle preview file list */}
          {bundlePreview && (
            <div className="export-bundle-preview">
              {pkgMeta.packageName && (
                <span className="export-bundle-preview-pkg">
                  {pkgMeta.packageName} v{pkgMeta.version || '?'}
                  {pkgMeta.author && ` by ${pkgMeta.author}`}
                </span>
              )}
              <span className="export-bundle-preview-label">
                {bundlePreview.files.length} file{bundlePreview.files.length !== 1 ? 's' : ''} will be written:
              </span>
              <div className="export-bundle-file-list">
                {bundlePreview.files.map((f, i) => (
                  <span key={i} className={`export-bundle-file export-bundle-file-${f.fileType}`}>
                    {f.relativePath}
                  </span>
                ))}
              </div>
              {bundlePreview.warnings.length > 0 && (
                <div className="export-preview-warnings">
                  {bundlePreview.warnings.map((w, i) => (
                    <span key={i} className="export-preview-warning">{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bundle result */}
          {bundleResult && (
            <div className="export-result-summary">
              <span className="export-result-success">
                Bundle exported ({bundleResult.format})
                {pkgMeta.packageName && ` — ${pkgMeta.packageName} v${pkgMeta.version}`}
              </span>
              <span className="export-result-files">
                {bundleResult.files.length} file{bundleResult.files.length !== 1 ? 's' : ''}
                {bundleResult.totalBytes > 0 && ` (${formatBytes(bundleResult.totalBytes)})`}
              </span>
              <span className="export-result-path" title={bundleResult.outputPath}>
                {bundleResult.outputPath.replace(/^.*[\\/]([^\\/]+[\\/][^\\/]+)$/, '$1')}
              </span>
              {bundleResult.wasSuffixed && (
                <span className="export-result-suffixed">
                  Bundle name was suffixed to avoid overwriting
                </span>
              )}
              {bundleResult.warnings.length > 0 && (
                <div className="export-preview-warnings">
                  {bundleResult.warnings.map((w, i) => (
                    <span key={i} className="export-preview-warning">{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
