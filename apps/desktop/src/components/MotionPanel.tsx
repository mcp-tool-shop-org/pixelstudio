import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { MotionIntent, MotionDirection, MotionFrameCount, MotionTargetMode, MotionSessionStatus } from '@pixelstudio/domain';
import { useMotionStore } from '@pixelstudio/state';
import { useSelectionStore } from '@pixelstudio/state';
import { useTimelineStore } from '@pixelstudio/state';

const INTENTS: { id: MotionIntent; label: string }[] = [
  { id: 'idle_bob', label: 'Idle Bob' },
  { id: 'walk_cycle_stub', label: 'Walk Cycle' },
  { id: 'run_cycle_stub', label: 'Run Cycle' },
  { id: 'hop', label: 'Hop' },
];

const DIRECTIONS: { id: MotionDirection; label: string }[] = [
  { id: 'left', label: '\u2190' },
  { id: 'right', label: '\u2192' },
  { id: 'up', label: '\u2191' },
  { id: 'down', label: '\u2193' },
];

const FRAME_COUNTS: MotionFrameCount[] = [2, 4];

interface MotionSessionResult {
  sessionId: string;
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
  sourceFrameId: string;
  proposals: Array<{
    id: string;
    label: string;
    description: string;
    previewFrames: number[][];
    previewWidth: number;
    previewHeight: number;
  }>;
  selectedProposalId: string | null;
  status: string;
}

// --- Mini preview tile renderer ---

function PreviewTile({ data, width, height, size }: {
  data: number[];
  width: number;
  height: number;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw checker background
    const checkerSize = Math.max(1, Math.floor(Math.max(width, height) / 8));
    for (let y = 0; y < height; y += checkerSize) {
      for (let x = 0; x < width; x += checkerSize) {
        const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#3a3a3a' : '#2a2a2a';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Draw pixel data
    const imgData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
      imgData.data[i] = data[i];
    }
    ctx.putImageData(imgData, 0, 0);
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="motion-preview-tile"
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
      }}
    />
  );
}

// --- Detail preview with frame stepping ---

function DetailPreview({ proposal }: {
  proposal: { previewFrames: number[][]; previewWidth: number; previewHeight: number; label: string };
}) {
  const [frameIdx, setFrameIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCount = proposal.previewFrames.length;
  const w = proposal.previewWidth;
  const h = proposal.previewHeight;

  // Reset frame index when proposal changes
  useEffect(() => { setFrameIdx(0); }, [proposal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = proposal.previewFrames[frameIdx];
    if (!data) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Checker background
    const checkerSize = Math.max(1, Math.floor(Math.max(w, h) / 8));
    for (let y = 0; y < h; y += checkerSize) {
      for (let x = 0; x < w; x += checkerSize) {
        const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#3a3a3a' : '#2a2a2a';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < data.length; i++) {
      imgData.data[i] = data[i];
    }
    ctx.putImageData(imgData, 0, 0);
  }, [proposal, frameIdx, w, h]);

  const handlePrev = useCallback(() => {
    setFrameIdx((i) => (i > 0 ? i - 1 : frameCount - 1));
  }, [frameCount]);

  const handleNext = useCallback(() => {
    setFrameIdx((i) => (i < frameCount - 1 ? i + 1 : 0));
  }, [frameCount]);

  // Scale to fit ~96px tall, keeping aspect ratio, pixelated
  const scale = Math.max(1, Math.floor(96 / Math.max(w, h)));
  const displayW = w * scale;
  const displayH = h * scale;

  return (
    <div className="motion-detail-preview">
      <canvas
        ref={canvasRef}
        className="motion-detail-canvas"
        style={{ width: displayW, height: displayH, imageRendering: 'pixelated' }}
      />
      <div className="motion-detail-controls">
        <button className="motion-step-btn" onClick={handlePrev} title="Previous frame">{'\u25C0'}</button>
        <span className="motion-detail-frame-label">{frameIdx + 1} / {frameCount}</span>
        <button className="motion-step-btn" onClick={handleNext} title="Next frame">{'\u25B6'}</button>
      </div>
    </div>
  );
}

// --- Main panel ---

export function MotionPanel() {
  const sessionId = useMotionStore((s) => s.sessionId);
  const intent = useMotionStore((s) => s.intent);
  const direction = useMotionStore((s) => s.direction);
  const outputFrameCount = useMotionStore((s) => s.outputFrameCount);
  const proposals = useMotionStore((s) => s.proposals);
  const selectedProposalId = useMotionStore((s) => s.selectedProposalId);
  const status = useMotionStore((s) => s.status);
  const lastError = useMotionStore((s) => s.lastError);
  const setIntent = useMotionStore((s) => s.setIntent);
  const setDirection = useMotionStore((s) => s.setDirection);
  const setOutputFrameCount = useMotionStore((s) => s.setOutputFrameCount);
  const setSession = useMotionStore((s) => s.setSession);
  const setStatus = useMotionStore((s) => s.setStatus);
  const setError = useMotionStore((s) => s.setError);
  const reset = useMotionStore((s) => s.reset);
  const setSelectedProposalId = useMotionStore((s) => s.setSelectedProposalId);

  const hasSelection = useSelectionStore((s) => s.hasSelection);
  const isTransforming = useSelectionStore((s) => s.isTransforming);
  const playing = useTimelineStore((s) => s.playing);
  const setPlaying = useTimelineStore((s) => s.setPlaying);
  const activeFrameId = useTimelineStore((s) => s.activeFrameId);
  const sourceFrameId = useMotionStore((s) => s.sourceFrameId);

  const isActive = sessionId !== null;
  const canStart = !isTransforming && !playing;
  const isGenerating = status === 'generating';

  const resolvedTargetMode: MotionTargetMode = hasSelection ? 'active_selection' : 'whole_frame';

  // --- Invalidation: cancel session if active frame changed ---
  useEffect(() => {
    if (isActive && sourceFrameId && activeFrameId !== sourceFrameId) {
      invoke('cancel_motion_session').catch(() => {});
      reset();
    }
  }, [isActive, activeFrameId, sourceFrameId, reset]);

  const applyResult = useCallback((result: MotionSessionResult) => {
    setSession({
      sessionId: result.sessionId,
      intent: result.intent,
      direction: result.direction,
      targetMode: result.targetMode,
      outputFrameCount: result.outputFrameCount,
      sourceFrameId: result.sourceFrameId,
      proposals: result.proposals,
      selectedProposalId: result.selectedProposalId,
      status: result.status as MotionSessionStatus,
    });
  }, [setSession]);

  const handleBeginSession = useCallback(async () => {
    if (playing) setPlaying(false);
    try {
      const result = await invoke<MotionSessionResult>('begin_motion_session', {
        intent,
        direction,
        targetMode: resolvedTargetMode,
        outputFrameCount,
      });
      applyResult(result);
    } catch (err) {
      setError(String(err));
    }
  }, [intent, direction, resolvedTargetMode, outputFrameCount, playing, setPlaying, applyResult, setError]);

  const handleGenerate = useCallback(async () => {
    setStatus('generating');
    try {
      const result = await invoke<MotionSessionResult>('generate_motion_proposals');
      applyResult(result);
    } catch (err) {
      setError(String(err));
    }
  }, [applyResult, setStatus, setError]);

  const handleRegenerate = useCallback(async () => {
    setStatus('generating');
    setSelectedProposalId(null);
    try {
      const result = await invoke<MotionSessionResult>('generate_motion_proposals');
      applyResult(result);
    } catch (err) {
      setError(String(err));
    }
  }, [applyResult, setStatus, setError, setSelectedProposalId]);

  const handleSelectProposal = useCallback(async (proposalId: string) => {
    try {
      await invoke<MotionSessionResult>('accept_motion_proposal', { proposalId });
      setSelectedProposalId(proposalId);
    } catch (err) {
      setError(String(err));
    }
  }, [setSelectedProposalId, setError]);

  const handleReject = useCallback(async () => {
    try {
      await invoke<MotionSessionResult>('reject_motion_proposal');
      setSelectedProposalId(null);
    } catch (err) {
      setError(String(err));
    }
  }, [setSelectedProposalId, setError]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke('cancel_motion_session');
      reset();
    } catch (err) {
      setError(String(err));
    }
  }, [reset, setError]);

  const selectedProposal = proposals.find((p) => p.id === selectedProposalId);

  // --- Idle / config state ---
  if (!isActive) {
    return (
      <div className="motion-panel">
        <div className="motion-config">
          <div className="motion-field">
            <label className="motion-label">Intent</label>
            <div className="motion-btn-group">
              {INTENTS.map((i) => (
                <button
                  key={i.id}
                  className={`motion-option ${intent === i.id ? 'active' : ''}`}
                  onClick={() => setIntent(i.id)}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <div className="motion-field">
            <label className="motion-label">Direction</label>
            <div className="motion-btn-group">
              <button
                className={`motion-option ${direction === null ? 'active' : ''}`}
                onClick={() => setDirection(null)}
              >
                None
              </button>
              {DIRECTIONS.map((d) => (
                <button
                  key={d.id}
                  className={`motion-option ${direction === d.id ? 'active' : ''}`}
                  onClick={() => setDirection(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="motion-field">
            <label className="motion-label">Frames</label>
            <div className="motion-btn-group">
              {FRAME_COUNTS.map((c) => (
                <button
                  key={c}
                  className={`motion-option ${outputFrameCount === c ? 'active' : ''}`}
                  onClick={() => setOutputFrameCount(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="motion-field">
            <label className="motion-label">Target</label>
            <span className="motion-target-label">
              {hasSelection ? 'Selection' : 'Whole Frame'}
            </span>
          </div>

          <button
            className="motion-start-btn"
            onClick={handleBeginSession}
            disabled={!canStart}
            title={!canStart ? 'Cannot start: transform or playback active' : 'Begin motion session'}
          >
            Start Motion Session
          </button>

          {lastError && <div className="motion-error">{lastError}</div>}
        </div>
      </div>
    );
  }

  // --- Active session ---
  return (
    <div className="motion-panel">
      <div className="motion-session">
        <div className="motion-session-header">
          <span className="motion-session-label">
            Motion: {INTENTS.find((i) => i.id === intent)?.label ?? intent}
          </span>
          <span className="motion-status">{status}</span>
          <span className="motion-preview-badge">Preview Only</span>
          <button className="motion-cancel-btn" onClick={handleCancel}>Cancel</button>
        </div>

        {status === 'configuring' && (
          <button className="motion-generate-btn" onClick={handleGenerate} disabled={isGenerating}>
            Generate Proposals
          </button>
        )}

        {isGenerating && (
          <div className="motion-loading">Generating proposals...</div>
        )}

        {status === 'reviewing' && proposals.length === 0 && (
          <div className="motion-empty">No proposals generated for this configuration.</div>
        )}

        {proposals.length > 0 && !isGenerating && (
          <div className="motion-proposals">
            {proposals.map((p) => (
              <button
                key={p.id}
                className={`motion-proposal-card ${selectedProposalId === p.id ? 'selected' : ''}`}
                onClick={() => handleSelectProposal(p.id)}
                title={p.description}
                disabled={status === 'error'}
              >
                <span className="proposal-label">{p.label}</span>
                <div className="proposal-strip">
                  {p.previewFrames.map((frame, idx) => (
                    <PreviewTile
                      key={idx}
                      data={frame}
                      width={p.previewWidth}
                      height={p.previewHeight}
                      size={32}
                    />
                  ))}
                </div>
                <span className="proposal-desc">{p.description}</span>
              </button>
            ))}
          </div>
        )}

        {selectedProposal && (
          <div className="motion-selected-area">
            <DetailPreview proposal={selectedProposal} />
            <div className="motion-proposal-actions">
              <button className="motion-reject-btn" onClick={handleReject}>Deselect</button>
              <button className="motion-regen-btn" onClick={handleRegenerate} title="Re-generate all proposals">
                Regenerate
              </button>
              <span className="motion-accept-note">Timeline commit coming in next slice</span>
            </div>
          </div>
        )}

        {!selectedProposal && proposals.length > 0 && !isGenerating && (
          <div className="motion-proposal-actions">
            <button className="motion-regen-btn" onClick={handleRegenerate} title="Re-generate all proposals">
              Regenerate
            </button>
          </div>
        )}

        {lastError && <div className="motion-error">{lastError}</div>}
      </div>
    </div>
  );
}
