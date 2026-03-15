import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSandboxStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import type {
  SandboxSessionInfo,
  SandboxSource,
  SandboxMetricsSummary,
  SandboxAnchorPathsResult,
  SandboxTimingApplyResult,
  SandboxDuplicateSpanResult,
  DiagnosticSeverity,
  AnchorPathInfo,
  ContactLabel,
} from '@glyphstudio/domain';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { useSelectionStore, useProjectStore } from '@glyphstudio/state';

interface TimelineResult {
  frames: Array<{ id: string; name: string; index: number; durationMs: number | null }>;
  activeFrameIndex: number;
  activeFrameId: string;
  frame: CanvasFrameData;
}

const SEVERITY_CLASS: Record<DiagnosticSeverity, string> = {
  info: 'sandbox-issue-info',
  warning: 'sandbox-issue-warning',
  strong_warning: 'sandbox-issue-strong',
};

const SEVERITY_LABEL: Record<DiagnosticSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  strong_warning: 'Alert',
};

// Stable colors per anchor index for path visualization
const PATH_COLORS = [
  '#ff6b6b', '#51cf66', '#339af0', '#fcc419',
  '#cc5de8', '#20c997', '#ff922b', '#a9e34b',
];

const CONTACT_MARKER_COLORS: Record<ContactLabel, string> = {
  stable_contact: '#50fa7b',
  likely_sliding: '#f1fa8c',
  possible_contact: '#6272a4',
};

export function SandboxPanel() {
  const session = useSandboxStore((s) => s.session);
  const playback = useSandboxStore((s) => s.playback);
  const currentFrame = useSandboxStore((s) => s.currentFrame);
  const playing = useSandboxStore((s) => s.playing);
  const lastError = useSandboxStore((s) => s.lastError);
  const setSession = useSandboxStore((s) => s.setSession);
  const setFps = useSandboxStore((s) => s.setFps);
  const setLooping = useSandboxStore((s) => s.setLooping);
  const setCurrentFrame = useSandboxStore((s) => s.setCurrentFrame);
  const setPlaying = useSandboxStore((s) => s.setPlaying);
  const setError = useSandboxStore((s) => s.setError);
  const reset = useSandboxStore((s) => s.reset);

  // Analysis state
  const metrics = useSandboxStore((s) => s.metrics);
  const analysisLoading = useSandboxStore((s) => s.analysisLoading);
  const analysisError = useSandboxStore((s) => s.analysisError);
  const analyzedSessionId = useSandboxStore((s) => s.analyzedSessionId);
  const setMetrics = useSandboxStore((s) => s.setMetrics);
  const setAnalysisLoading = useSandboxStore((s) => s.setAnalysisLoading);
  const setAnalysisError = useSandboxStore((s) => s.setAnalysisError);

  // Path visualization state
  const anchorPaths = useSandboxStore((s) => s.anchorPaths);
  const selectedAnchorNames = useSandboxStore((s) => s.selectedAnchorNames);
  const pathsLoading = useSandboxStore((s) => s.pathsLoading);
  const pathsError = useSandboxStore((s) => s.pathsError);
  const pathsSessionId = useSandboxStore((s) => s.pathsSessionId);
  const showContactHints = useSandboxStore((s) => s.showContactHints);
  const setAnchorPaths = useSandboxStore((s) => s.setAnchorPaths);
  const toggleAnchorName = useSandboxStore((s) => s.toggleAnchorName);
  const setPathsLoading = useSandboxStore((s) => s.setPathsLoading);
  const setPathsError = useSandboxStore((s) => s.setPathsError);
  const setShowContactHints = useSandboxStore((s) => s.setShowContactHints);

  // Action state
  const applying = useSandboxStore((s) => s.applying);
  const duplicating = useSandboxStore((s) => s.duplicating);
  const actionSuccess = useSandboxStore((s) => s.actionSuccess);
  const actionError = useSandboxStore((s) => s.actionError);
  const setApplying = useSandboxStore((s) => s.setApplying);
  const setDuplicating = useSandboxStore((s) => s.setDuplicating);
  const setActionSuccess = useSandboxStore((s) => s.setActionSuccess);
  const setActionError = useSandboxStore((s) => s.setActionError);
  const clearActionFeedback = useSandboxStore((s) => s.clearActionFeedback);

  const activeFrameIndex = useTimelineStore((s) => s.activeFrameIndex);
  const frames = useTimelineStore((s) => s.frames);
  const setFrames = useTimelineStore((s) => s.setFrames);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const markDirty = useProjectStore((s) => s.markDirty);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);

  // --- Playback timer ---
  useEffect(() => {
    if (!playing || !session) return;
    const interval = 1000 / playback.fps;
    timerRef.current = window.setInterval(() => {
      useSandboxStore.setState((s) => {
        const next = s.currentFrame + 1;
        if (next >= (s.session?.frameCount ?? 0)) {
          if (s.playback.looping) return { currentFrame: 0 };
          return { playing: false };
        }
        return { currentFrame: next };
      });
    }, interval);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [playing, session, playback.fps, playback.looping]);

  // --- Render current frame to canvas ---
  useEffect(() => {
    if (!session || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const frameData = session.previewFrames[currentFrame];
    if (!frameData) return;
    const w = session.previewWidth;
    const h = session.previewHeight;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < frameData.length; i++) {
      imgData.data[i] = frameData[i];
    }
    ctx.putImageData(imgData, 0, 0);
  }, [session, currentFrame]);

  // --- Render path overlay ---
  useEffect(() => {
    if (!session || !overlayRef.current) return;
    const ctx = overlayRef.current.getContext('2d');
    if (!ctx) return;
    const w = session.previewWidth;
    const h = session.previewHeight;
    overlayRef.current.width = w;
    overlayRef.current.height = h;
    ctx.clearRect(0, 0, w, h);

    if (selectedAnchorNames.length === 0 || anchorPaths.length === 0) return;

    // The absolute frame index for the current sandbox frame
    const absFrame = session.startFrameIndex + currentFrame;

    const selectedPaths = anchorPaths.filter((p) => selectedAnchorNames.includes(p.anchorName));

    selectedPaths.forEach((path, pathIdx) => {
      const color = PATH_COLORS[pathIdx % PATH_COLORS.length];
      const presentSamples = path.samples.filter((s) => s.present);

      // Draw path line through present samples
      if (presentSamples.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.moveTo(presentSamples[0].x + 0.5, presentSamples[0].y + 0.5);
        for (let i = 1; i < presentSamples.length; i++) {
          ctx.lineTo(presentSamples[i].x + 0.5, presentSamples[i].y + 0.5);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Draw per-frame dots
      presentSamples.forEach((s) => {
        const isCurrent = s.frameIndex === absFrame;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = isCurrent ? 1.0 : 0.4;
        const r = isCurrent ? 2 : 1;
        ctx.arc(s.x + 0.5, s.y + 0.5, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Current frame: draw highlight ring
        if (isCurrent) {
          ctx.beginPath();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.arc(s.x + 0.5, s.y + 0.5, 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Draw contact hints
      if (showContactHints && path.contactHints.length > 0) {
        path.contactHints.forEach((hint) => {
          const sample = path.samples.find((s) => s.frameIndex === hint.frameIndex && s.present);
          if (!sample) return;
          const markerColor = CONTACT_MARKER_COLORS[hint.label as ContactLabel] ?? '#6272a4';
          ctx.beginPath();
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1;
          ctx.globalAlpha = hint.confidence;
          // Small diamond marker below the point
          const mx = sample.x + 0.5;
          const my = sample.y + 3.5;
          ctx.moveTo(mx, my - 1.5);
          ctx.lineTo(mx + 1.5, my);
          ctx.lineTo(mx, my + 1.5);
          ctx.lineTo(mx - 1.5, my);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        });
      }
    });
  }, [session, currentFrame, anchorPaths, selectedAnchorNames, showContactHints]);

  // --- Open sandbox from timeline span ---
  const handleOpenFromTimeline = useCallback(async () => {
    if (frames.length === 0) return;
    const start = 0;
    const end = frames.length - 1;
    try {
      const result = await invoke<SandboxSessionInfo>('begin_sandbox_session', {
        startFrameIndex: start,
        endFrameIndex: end,
        source: 'timeline_span' as SandboxSource,
      });
      setSession(result);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [frames, setSession, setError]);

  // --- Close sandbox ---
  const handleClose = useCallback(async () => {
    try {
      await invoke('close_sandbox_session');
    } catch {
      // ignore
    }
    reset();
  }, [reset]);

  // --- Frame stepping ---
  const handlePrev = useCallback(() => {
    if (!session) return;
    setCurrentFrame(currentFrame > 0 ? currentFrame - 1 : session.frameCount - 1);
  }, [session, currentFrame, setCurrentFrame]);

  const handleNext = useCallback(() => {
    if (!session) return;
    setCurrentFrame(currentFrame < session.frameCount - 1 ? currentFrame + 1 : 0);
  }, [session, currentFrame, setCurrentFrame]);

  const handleTogglePlay = useCallback(() => {
    setPlaying(!playing);
  }, [playing, setPlaying]);

  // --- Analyze ---
  const handleAnalyze = useCallback(async () => {
    if (!session) return;
    setAnalysisLoading(true);
    try {
      const result = await invoke<SandboxMetricsSummary>('analyze_sandbox_motion');
      setMetrics(result);
    } catch (e: any) {
      setAnalysisError(e?.message ?? String(e));
    }
  }, [session, setAnalysisLoading, setMetrics, setAnalysisError]);

  // --- Fetch anchor paths ---
  const handleFetchPaths = useCallback(async () => {
    if (!session) return;
    setPathsLoading(true);
    try {
      const result = await invoke<SandboxAnchorPathsResult>('get_sandbox_anchor_paths');
      setAnchorPaths(result.paths, result.sessionId);
    } catch (e: any) {
      setPathsError(e?.message ?? String(e));
    }
  }, [session, setPathsLoading, setAnchorPaths, setPathsError]);

  // --- Helper: refresh timeline after apply actions ---
  const refreshTimeline = useCallback(async (selectFrameId?: string) => {
    try {
      if (selectFrameId) {
        const result = await invoke<TimelineResult>('select_frame', { frameId: selectFrameId });
        setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
        setFrame(result.frame);
        syncLayersFromFrame(result.frame);
        clearSelection();
      } else {
        const result = await invoke<TimelineResult>('get_timeline');
        setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
      }
    } catch {
      // timeline refresh is best-effort
    }
  }, [setFrames, setFrame, clearSelection]);

  // --- Apply timing ---
  const handleApplyTiming = useCallback(async (durationMs: number | null) => {
    if (!session) return;
    clearActionFeedback();
    setApplying(true);
    try {
      const result = await invoke<SandboxTimingApplyResult>('apply_sandbox_timing', {
        durationMs,
      });
      setApplying(false);
      const label = durationMs != null ? `${durationMs}ms` : 'default';
      setActionSuccess(`Timing applied (${label}) to ${result.framesAffected} frames.`);
      markDirty();
      invoke('mark_dirty').catch(() => {});
      await refreshTimeline();
    } catch (e: any) {
      setActionError(e?.message ?? String(e));
    }
  }, [session, clearActionFeedback, setApplying, setActionSuccess, setActionError, refreshTimeline, markDirty]);

  // --- Duplicate span ---
  const handleDuplicate = useCallback(async () => {
    if (!session) return;
    clearActionFeedback();
    setDuplicating(true);
    try {
      const result = await invoke<SandboxDuplicateSpanResult>('duplicate_sandbox_span');
      setDuplicating(false);
      setActionSuccess(`Duplicated ${result.newFrameIds.length} frames at position ${result.insertPosition}.`);
      markDirty();
      invoke('mark_dirty').catch(() => {});
      await refreshTimeline(result.firstNewFrameId);
    } catch (e: any) {
      setActionError(e?.message ?? String(e));
    }
  }, [session, clearActionFeedback, setDuplicating, setActionSuccess, setActionError, refreshTimeline, markDirty]);

  // FPS preset → duration_ms
  const fpsPresets = [4, 8, 12, 16] as const;

  const isStale = session && analyzedSessionId && analyzedSessionId !== session.sessionId;
  const pathsStale = session && pathsSessionId && pathsSessionId !== session.sessionId;

  // --- No session: show entry point ---
  if (!session) {
    return (
      <div className="sandbox-panel sandbox-empty">
        <h3 className="sandbox-header">Sandbox</h3>
        <p className="sandbox-hint">Isolated preview — no project changes.</p>
        <button
          className="sandbox-open-btn"
          onClick={handleOpenFromTimeline}
          disabled={frames.length === 0}
        >
          Open All Frames in Sandbox
        </button>
        {lastError && <p className="sandbox-error">{lastError}</p>}
      </div>
    );
  }

  // Compute canvas display size
  const displayW = Math.min(session.previewWidth * 4, 256);
  const displayH = Math.min(session.previewHeight * 4, 256);

  // --- Active session ---
  return (
    <div className="sandbox-panel sandbox-active">
      <div className="sandbox-header-row">
        <h3 className="sandbox-header">Sandbox</h3>
        <span className="sandbox-source-badge">{session.source}</span>
        <button className="sandbox-close-btn" onClick={handleClose}>Close</button>
      </div>

      <div className="sandbox-preview">
        <div className="sandbox-canvas-stack" style={{ width: displayW, height: displayH }}>
          <canvas
            ref={canvasRef}
            className="sandbox-canvas"
            style={{ imageRendering: 'pixelated', width: displayW, height: displayH }}
          />
          <canvas
            ref={overlayRef}
            className="sandbox-overlay"
            style={{ imageRendering: 'pixelated', width: displayW, height: displayH }}
          />
        </div>
      </div>

      <div className="sandbox-controls">
        <button className="sandbox-ctrl-btn" onClick={handlePrev} title="Previous frame">&larr;</button>
        <button className="sandbox-ctrl-btn" onClick={handleTogglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? '\u23F8' : '\u25B6'}
        </button>
        <button className="sandbox-ctrl-btn" onClick={handleNext} title="Next frame">&rarr;</button>
        <span className="sandbox-frame-label">
          {currentFrame + 1}/{session.frameCount}
        </span>
      </div>

      <div className="sandbox-settings">
        <label className="sandbox-setting">
          FPS:
          <input
            type="number"
            min={1}
            max={60}
            value={playback.fps}
            onChange={(e) => setFps(Math.max(1, Math.min(60, Number(e.target.value))))}
            className="sandbox-fps-input"
          />
        </label>
        <label className="sandbox-setting">
          <input
            type="checkbox"
            checked={playback.looping}
            onChange={(e) => setLooping(e.target.checked)}
          />
          Loop
        </label>
      </div>

      {/* --- Anchor Paths section --- */}
      <div className="sandbox-diagnostics">
        <div className="sandbox-diag-header">
          <span className="sandbox-diag-title">Anchor Paths</span>
          <button
            className="sandbox-analyze-btn"
            onClick={handleFetchPaths}
            disabled={pathsLoading}
          >
            {pathsLoading ? 'Loading...' : anchorPaths.length > 0 ? 'Refresh' : 'Load Paths'}
          </button>
        </div>

        {pathsError && <p className="sandbox-error">{pathsError}</p>}

        {anchorPaths.length === 0 && !pathsLoading && !pathsError && (
          <p className="sandbox-diag-empty">Load paths to visualize anchor motion.</p>
        )}

        {pathsStale && anchorPaths.length > 0 && (
          <p className="sandbox-diag-stale">Session changed — paths may be stale.</p>
        )}

        {anchorPaths.length > 0 && (
          <div className="sandbox-anchor-list">
            {anchorPaths.map((path, i) => {
              const color = PATH_COLORS[i % PATH_COLORS.length];
              const selected = selectedAnchorNames.includes(path.anchorName);
              const presentCount = path.samples.filter((s) => s.present).length;
              const totalCount = path.samples.length;
              return (
                <button
                  key={path.anchorName}
                  className={`sandbox-anchor-btn ${selected ? 'selected' : ''}`}
                  onClick={() => toggleAnchorName(path.anchorName)}
                  title={`${path.anchorKind} — ${presentCount}/${totalCount} frames, dist: ${path.totalDistance.toFixed(1)}px`}
                >
                  <span className="sandbox-anchor-swatch" style={{ background: color }} />
                  <span className="sandbox-anchor-name">{path.anchorName}</span>
                  {presentCount < totalCount && (
                    <span className="sandbox-anchor-gaps">{totalCount - presentCount} gaps</span>
                  )}
                </button>
              );
            })}
            <label className="sandbox-setting sandbox-contact-toggle">
              <input
                type="checkbox"
                checked={showContactHints}
                onChange={(e) => setShowContactHints(e.target.checked)}
              />
              Contact hints
            </label>
          </div>
        )}
      </div>

      {/* --- Diagnostics section --- */}
      <div className="sandbox-diagnostics">
        <div className="sandbox-diag-header">
          <span className="sandbox-diag-title">Diagnostics</span>
          <button
            className="sandbox-analyze-btn"
            onClick={handleAnalyze}
            disabled={analysisLoading}
          >
            {analysisLoading ? 'Analyzing...' : metrics ? 'Reanalyze' : 'Analyze'}
          </button>
        </div>

        {analysisError && <p className="sandbox-error">{analysisError}</p>}

        {!metrics && !analysisLoading && !analysisError && (
          <p className="sandbox-diag-empty">Press Analyze to inspect motion quality.</p>
        )}

        {metrics && (
          <div className="sandbox-metrics">
            {isStale && (
              <p className="sandbox-diag-stale">Session changed — results may be stale.</p>
            )}

            <div className="sandbox-metrics-grid">
              <div className="sandbox-metric">
                <span className="sandbox-metric-label">Frames</span>
                <span className="sandbox-metric-value">{metrics.frameCount}</span>
              </div>
              <div className="sandbox-metric">
                <span className="sandbox-metric-label">Size</span>
                <span className="sandbox-metric-value">{metrics.previewWidth}&times;{metrics.previewHeight}</span>
              </div>
              <div className="sandbox-metric">
                <span className="sandbox-metric-label">Loop delta</span>
                <span className="sandbox-metric-value">{metrics.loopDiagnostics.firstLastDelta.toFixed(1)}</span>
              </div>
              <div className="sandbox-metric">
                <span className="sandbox-metric-label">Drift</span>
                <span className="sandbox-metric-value">{metrics.driftDiagnostics.driftMagnitude.toFixed(1)}px</span>
              </div>
              <div className="sandbox-metric">
                <span className="sandbox-metric-label">Max jump</span>
                <span className="sandbox-metric-value">{metrics.timingDiagnostics.largestAdjacentDelta.toFixed(1)}</span>
              </div>
              <div className="sandbox-metric">
                <span className="sandbox-metric-label">Still pairs</span>
                <span className="sandbox-metric-value">{metrics.timingDiagnostics.identicalAdjacentCount}</span>
              </div>
            </div>

            <div className="sandbox-diag-hints">
              <p className="sandbox-diag-hint">{metrics.loopDiagnostics.hint}</p>
              <p className="sandbox-diag-hint">{metrics.driftDiagnostics.hint}</p>
              <p className="sandbox-diag-hint">{metrics.timingDiagnostics.hint}</p>
            </div>

            {session.source === 'motion_proposal' && (
              <div className="sandbox-secondary-notes">
                {metrics.driftDiagnostics.driftMagnitude > 4.0 && (
                  <p className="sandbox-secondary-note warning">Base drift detected — root anchors may be shifting too much. Try lowering strength or adjusting hierarchy.</p>
                )}
                {metrics.timingDiagnostics.identicalAdjacentCount > metrics.frameCount / 2 && (
                  <p className="sandbox-secondary-note warning">Over-synchronized — many frames look identical. Try increasing strength or adding hierarchy depth.</p>
                )}
                {metrics.timingDiagnostics.largestAdjacentDelta > metrics.timingDiagnostics.avgAdjacentDelta * 4 && metrics.timingDiagnostics.avgAdjacentDelta > 0.1 && (
                  <p className="sandbox-secondary-note warning">Abrupt jump detected — sway or swing may have a harsh transition. Try adjusting phase offset.</p>
                )}
                {metrics.loopDiagnostics.firstLastDelta > 3.0 && (
                  <p className="sandbox-secondary-note warning">Loop pop — first and last frames differ significantly. Sway/swing templates should loop naturally; try regenerating.</p>
                )}
              </div>
            )}

            {metrics.issues.length > 0 && (
              <div className="sandbox-issues">
                {metrics.issues.map((issue, i) => (
                  <div key={i} className={`sandbox-issue ${SEVERITY_CLASS[issue.severity as DiagnosticSeverity] ?? 'sandbox-issue-info'}`}>
                    <span className="sandbox-issue-badge">
                      {SEVERITY_LABEL[issue.severity as DiagnosticSeverity] ?? issue.severity}
                    </span>
                    <span className="sandbox-issue-label">{issue.label}</span>
                    <p className="sandbox-issue-explanation">{issue.explanation}</p>
                  </div>
                ))}
              </div>
            )}

            {metrics.issues.length === 0 && (
              <p className="sandbox-diag-ok">No issues detected — motion looks clean.</p>
            )}
          </div>
        )}
      </div>

      {/* --- Actions section --- */}
      <div className="sandbox-diagnostics">
        <div className="sandbox-diag-header">
          <span className="sandbox-diag-title">Actions</span>
        </div>

        <div className="sandbox-actions">
          <div className="sandbox-action-group">
            <span className="sandbox-action-label">Apply timing:</span>
            <div className="sandbox-fps-presets">
              {fpsPresets.map((fps) => (
                <button
                  key={fps}
                  className="sandbox-preset-btn"
                  onClick={() => handleApplyTiming(Math.round(1000 / fps))}
                  disabled={applying || duplicating}
                  title={`Set all frames to ${Math.round(1000 / fps)}ms (${fps} FPS)`}
                >
                  {fps} FPS
                </button>
              ))}
              <button
                className="sandbox-preset-btn"
                onClick={() => handleApplyTiming(null)}
                disabled={applying || duplicating}
                title="Reset frames to default timing"
              >
                Default
              </button>
            </div>
          </div>

          <div className="sandbox-action-group">
            <button
              className="sandbox-action-btn"
              onClick={handleDuplicate}
              disabled={applying || duplicating}
              title="Duplicate this span and insert after the original"
            >
              {duplicating ? 'Duplicating...' : 'Duplicate Span'}
            </button>
          </div>
        </div>

        {applying && <p className="sandbox-action-loading">Applying timing...</p>}
        {actionSuccess && <p className="sandbox-action-success">{actionSuccess}</p>}
        {actionError && <p className="sandbox-error">{actionError}</p>}
      </div>

      {lastError && <p className="sandbox-error">{lastError}</p>}
    </div>
  );
}
