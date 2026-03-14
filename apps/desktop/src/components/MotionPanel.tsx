import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { MotionIntent, MotionDirection, MotionFrameCount, MotionTargetMode, MotionSessionStatus, MotionTemplateId, MotionTemplateInfo, SecondaryMotionTemplateId, SecondaryTemplateInfo, SecondaryReadinessInfo, MotionPanelMode } from '@pixelstudio/domain';
import { useMotionStore } from '@pixelstudio/state';
import { useSelectionStore } from '@pixelstudio/state';
import { useTimelineStore } from '@pixelstudio/state';
import { useAnchorStore } from '@pixelstudio/state';
import { useProjectStore } from '@pixelstudio/state';
import type { PresetAnchor, PresetMotionSettings, PresetSaveResult, MotionPresetKind } from '@pixelstudio/domain';
import { ANCHOR_KIND_LABELS } from '@pixelstudio/domain';
import type { AnchorKind } from '@pixelstudio/domain';

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

const DIRECTION_LABELS: Record<MotionDirection, string> = {
  left: 'Left', right: 'Right', up: 'Up', down: 'Down',
};

const FRAME_COUNTS: MotionFrameCount[] = [2, 4];

const PREVIEW_FPS_OPTIONS = [4, 8, 12] as const;

interface MotionSessionResult {
  sessionId: string;
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
  sourceFrameId: string;
  anchorKind: string | null;
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

interface MotionCommitResult {
  insertedFrameIds: string[];
  activeFrameId: string;
  activeFrameIndex: number;
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

// --- Detail preview with playback controls ---

function DetailPreview({ proposal, intent, direction, targetMode, outputFrameCount, secondaryTemplateName }: {
  proposal: { previewFrames: number[][]; previewWidth: number; previewHeight: number; label: string; description: string };
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
  secondaryTemplateName?: string;
}) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [looping, setLooping] = useState(true);
  const [previewFps, setPreviewFps] = useState<number>(8);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCount = proposal.previewFrames.length;
  const w = proposal.previewWidth;
  const h = proposal.previewHeight;

  // Reset frame index and stop playback when proposal changes
  useEffect(() => {
    setFrameIdx(0);
    setIsPlaying(false);
  }, [proposal]);

  // Render current frame
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

  // Playback timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!isPlaying) return;

    timerRef.current = setInterval(() => {
      setFrameIdx((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (looping) return 0;
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1000 / previewFps);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, previewFps, frameCount, looping]);

  const handlePrev = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx((i) => (i > 0 ? i - 1 : frameCount - 1));
  }, [frameCount]);

  const handleNext = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx((i) => (i < frameCount - 1 ? i + 1 : 0));
  }, [frameCount]);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => {
      if (!p) {
        // If at end and not looping, restart from beginning
        setFrameIdx((idx) => (idx >= frameCount - 1 ? 0 : idx));
      }
      return !p;
    });
  }, [frameCount]);

  // Keyboard controls (when container is focused)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === ',') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' || e.key === '.') {
        e.preventDefault();
        handleNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    el.addEventListener('keydown', handleKey);
    return () => el.removeEventListener('keydown', handleKey);
  }, [handlePrev, handleNext, togglePlay]);

  // Scale to fit ~96px tall, keeping aspect ratio, pixelated
  const scale = Math.max(1, Math.floor(96 / Math.max(w, h)));
  const displayW = w * scale;
  const displayH = h * scale;

  const intentLabel = secondaryTemplateName ?? (INTENTS.find((i) => i.id === intent)?.label ?? intent);
  const dirLabel = direction ? DIRECTION_LABELS[direction] : null;
  const targetLabel = targetMode === 'active_selection' ? 'Selection'
    : targetMode === 'anchor_binding' ? 'Anchor'
    : 'Whole Frame';

  return (
    <div className="motion-detail-preview" ref={containerRef} tabIndex={0}>
      <div className="motion-detail-meta">
        <span className="motion-detail-title">{proposal.label}</span>
        <span className="motion-detail-summary">
          {intentLabel}{dirLabel ? ` \u00B7 ${dirLabel}` : ''} \u00B7 {outputFrameCount}f \u00B7 {targetLabel}
        </span>
        <span className="motion-detail-desc">{proposal.description}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="motion-detail-canvas"
        style={{ width: displayW, height: displayH, imageRendering: 'pixelated' }}
      />
      <div className="motion-playback-controls">
        <button className="motion-step-btn" onClick={handlePrev} title="Previous frame (Left / ,)">{'\u25C0'}</button>
        <button className="motion-play-btn" onClick={togglePlay} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button className="motion-step-btn" onClick={handleNext} title="Next frame (Right / .)">{'\u25B6'}</button>
        <span className="motion-detail-frame-label">{frameIdx + 1}/{frameCount}</span>
        <button
          className={`motion-loop-btn ${looping ? 'active' : ''}`}
          onClick={() => setLooping((l) => !l)}
          title={looping ? 'Loop: on' : 'Loop: off'}
        >
          {'\u21BB'}
        </button>
        <select
          className="motion-fps-select"
          value={previewFps}
          onChange={(e) => setPreviewFps(Number(e.target.value))}
          title="Preview FPS"
        >
          {PREVIEW_FPS_OPTIONS.map((fps) => (
            <option key={fps} value={fps}>{fps} fps</option>
          ))}
        </select>
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
  const targetMode = useMotionStore((s) => s.targetMode);
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

  // Panel mode: locomotion vs secondary
  const panelMode = useMotionStore((s) => s.panelMode);
  const setPanelMode = useMotionStore((s) => s.setPanelMode);

  // Template mode (locomotion sub-mode)
  const [useTemplate, setUseTemplate] = useState(false);
  const [templates, setTemplates] = useState<MotionTemplateInfo[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<MotionTemplateId>('idle_breathing');

  // Secondary motion state
  const [secondaryTemplates, setSecondaryTemplates] = useState<SecondaryTemplateInfo[]>([]);
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<SecondaryMotionTemplateId>('wind_soft');
  const [secondaryStrength, setSecondaryStrength] = useState(1.0);
  const [secondaryFrameCount, setSecondaryFrameCount] = useState<number>(4);
  const [secondaryPhaseOffset, setSecondaryPhaseOffset] = useState(0.0);
  const [readiness, setReadiness] = useState<SecondaryReadinessInfo | null>(null);

  // Load templates once
  useEffect(() => {
    invoke<MotionTemplateInfo[]>('list_motion_templates')
      .then(setTemplates)
      .catch(() => {});
    invoke<SecondaryTemplateInfo[]>('list_secondary_motion_templates')
      .then(setSecondaryTemplates)
      .catch(() => {});
  }, []);

  // Anchor context
  const selectedAnchorId = useAnchorStore((s) => s.selectedAnchorId);
  const anchors = useAnchorStore((s) => s.anchors);

  // Fetch readiness when secondary template or frame changes
  useEffect(() => {
    if (panelMode !== 'secondary') return;
    invoke<SecondaryReadinessInfo>('check_secondary_readiness', {
      templateId: selectedSecondaryId,
    })
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, [panelMode, selectedSecondaryId, activeFrameId, anchors.length]);

  const selectedAnchor = anchors.find((a) => a.id === selectedAnchorId);
  const anchorHasBounds = selectedAnchor?.bounds != null;

  const isActive = sessionId !== null;
  const canStart = !isTransforming && !playing;
  const isGenerating = status === 'generating';

  // Target priority: selection > anchor binding > whole frame
  const resolvedTargetMode: MotionTargetMode = hasSelection
    ? 'active_selection'
    : (selectedAnchorId && anchorHasBounds) ? 'anchor_binding' : 'whole_frame';

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
        anchorId: (!hasSelection && selectedAnchorId) ? selectedAnchorId : null,
      });
      applyResult(result);
    } catch (err) {
      setError(String(err));
    }
  }, [intent, direction, resolvedTargetMode, outputFrameCount, hasSelection, selectedAnchorId, playing, setPlaying, applyResult, setError]);

  const handleBeginTemplateSession = useCallback(async () => {
    if (playing) setPlaying(false);
    try {
      const result = await invoke<MotionSessionResult>('apply_motion_template', {
        templateId: selectedTemplateId,
        direction,
        outputFrameCount,
      });
      applyResult(result);
    } catch (err) {
      setError(String(err));
    }
  }, [selectedTemplateId, direction, outputFrameCount, playing, setPlaying, applyResult, setError]);

  const handleBeginSecondarySession = useCallback(async () => {
    if (playing) setPlaying(false);
    try {
      const result = await invoke<MotionSessionResult>('apply_secondary_motion_template', {
        templateId: selectedSecondaryId,
        direction,
        strength: secondaryStrength,
        frameCount: secondaryFrameCount,
        phaseOffset: secondaryPhaseOffset,
      });
      applyResult(result);
    } catch (err) {
      setError(String(err));
    }
  }, [selectedSecondaryId, direction, secondaryStrength, secondaryFrameCount, secondaryPhaseOffset, playing, setPlaying, applyResult, setError]);

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
    // Pause main timeline playback when selecting a proposal for preview
    if (playing) setPlaying(false);
    try {
      await invoke<MotionSessionResult>('accept_motion_proposal', { proposalId });
      setSelectedProposalId(proposalId);
    } catch (err) {
      setError(String(err));
    }
  }, [setSelectedProposalId, setError, playing, setPlaying]);

  const handleReject = useCallback(async () => {
    try {
      await invoke<MotionSessionResult>('reject_motion_proposal');
      setSelectedProposalId(null);
    } catch (err) {
      setError(String(err));
    }
  }, [setSelectedProposalId, setError]);

  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [savePresetMsg, setSavePresetMsg] = useState<string | null>(null);

  const canvasSize = useProjectStore((s) => s.canvasSize);

  const handleSavePreset = useCallback(async () => {
    const presetName = prompt('Preset name:');
    if (!presetName?.trim()) return;

    const kind: MotionPresetKind = panelMode === 'secondary' ? 'secondary_motion' : 'locomotion';

    // Build anchor list from current store, normalizing positions
    const w = canvasSize.width || 1;
    const h = canvasSize.height || 1;
    const presetAnchors: PresetAnchor[] = anchors.map((a) => ({
      name: a.name,
      kind: a.kind,
      parentName: a.parentName ?? null,
      falloffWeight: a.falloffWeight ?? 1.0,
      hintX: Math.min(1, Math.max(0, a.x / w)),
      hintY: Math.min(1, Math.max(0, a.y / h)),
    }));

    // Build motion settings from current panel state
    const motionSettings: PresetMotionSettings = panelMode === 'secondary'
      ? {
          templateId: selectedSecondaryId,
          direction: direction ?? undefined,
          strength: secondaryStrength,
          frameCount: secondaryFrameCount,
          phaseOffset: secondaryPhaseOffset,
        }
      : useTemplate
        ? {
            templateId: selectedTemplateId,
            direction: direction ?? undefined,
            frameCount: outputFrameCount,
          }
        : {
            intent: intent,
            direction: direction ?? undefined,
            frameCount: outputFrameCount,
          };

    try {
      const result = await invoke<PresetSaveResult>('save_motion_preset', {
        name: presetName.trim(),
        kind,
        description: null,
        anchors: presetAnchors,
        motionSettings,
        targetNotes: null,
      });
      setSavePresetMsg(`Saved preset "${result.name}"`);
      setTimeout(() => setSavePresetMsg(null), 3000);
    } catch (err) {
      setSavePresetMsg(`Error: ${err}`);
      setTimeout(() => setSavePresetMsg(null), 5000);
    }
  }, [panelMode, anchors, canvasSize, direction, intent, outputFrameCount, useTemplate, selectedTemplateId, selectedSecondaryId, secondaryStrength, secondaryFrameCount, secondaryPhaseOffset]);

  const handleCommit = useCallback(async () => {
    setStatus('committing');
    setCommitMessage(null);
    try {
      const result = await invoke<MotionCommitResult>('commit_motion_proposal');
      // Refresh timeline state after frames were inserted
      const timelineResult = await invoke<{ frames: any[]; activeFrameId: string; activeFrameIndex: number }>('get_timeline');
      useTimelineStore.getState().setFrames(timelineResult.frames, timelineResult.activeFrameId, timelineResult.activeFrameIndex);
      const count = result.insertedFrameIds.length;
      const modeLabel = panelMode === 'secondary'
        ? `Inserted ${count} secondary-motion frame${count !== 1 ? 's' : ''}`
        : `Inserted ${count} frame${count !== 1 ? 's' : ''} into timeline`;
      setCommitMessage(modeLabel);
      reset();
      // Clear success message after a few seconds
      setTimeout(() => setCommitMessage(null), 4000);
    } catch (err) {
      setError(String(err));
    }
  }, [setStatus, reset, setError]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke('cancel_motion_session');
      reset();
    } catch (err) {
      setError(String(err));
    }
  }, [reset, setError]);

  const selectedProposal = proposals.find((p) => p.id === selectedProposalId);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateMissing = selectedTemplate
    ? selectedTemplate.anchorRequirements
        .filter((r) => r.required)
        .filter((r) => !anchors.some((a) => a.kind === r.kind))
    : [];

  const selectedSecondaryTemplate = secondaryTemplates.find((t) => t.id === selectedSecondaryId);

  // --- Idle / config state ---
  if (!isActive) {
    return (
      <div className="motion-panel">
        <div className="motion-config">
          {/* Top-level mode split: Locomotion vs Secondary */}
          <div className="motion-mode-toggle">
            <button
              className={`motion-mode-btn ${panelMode === 'locomotion' ? 'active' : ''}`}
              onClick={() => setPanelMode('locomotion')}
            >
              Locomotion
            </button>
            <button
              className={`motion-mode-btn ${panelMode === 'secondary' ? 'active' : ''}`}
              onClick={() => setPanelMode('secondary')}
            >
              Secondary
            </button>
          </div>

          {panelMode === 'secondary' ? (
            <>
              {/* --- Secondary Motion Config --- */}
              <div className="motion-field">
                <label className="motion-label">Template</label>
                <select
                  className="motion-template-select"
                  value={selectedSecondaryId}
                  onChange={(e) => setSelectedSecondaryId(e.target.value as SecondaryMotionTemplateId)}
                >
                  {secondaryTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedSecondaryTemplate && (
                <div className="motion-template-info">
                  <span className="motion-template-desc">{selectedSecondaryTemplate.description}</span>
                  <span className="motion-template-hint">{selectedSecondaryTemplate.hint}</span>
                </div>
              )}

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
                <label className="motion-label">Strength</label>
                <div className="motion-strength-row">
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    value={secondaryStrength}
                    onChange={(e) => setSecondaryStrength(Number(e.target.value))}
                    className="motion-strength-slider"
                  />
                  <span className="motion-strength-value">{secondaryStrength.toFixed(1)}</span>
                </div>
              </div>

              <div className="motion-field">
                <label className="motion-label">Frames</label>
                <div className="motion-btn-group">
                  {[2, 4, 6].map((c) => (
                    <button
                      key={c}
                      className={`motion-option ${secondaryFrameCount === c ? 'active' : ''}`}
                      onClick={() => setSecondaryFrameCount(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="motion-field">
                <label className="motion-label">Phase offset</label>
                <div className="motion-strength-row">
                  <input
                    type="range"
                    min={0}
                    max={6.28}
                    step={0.1}
                    value={secondaryPhaseOffset}
                    onChange={(e) => setSecondaryPhaseOffset(Number(e.target.value))}
                    className="motion-strength-slider"
                  />
                  <span className="motion-strength-value">{secondaryPhaseOffset.toFixed(1)}</span>
                </div>
              </div>

              {/* Target summary + readiness */}
              {readiness && (
                <div className="secondary-readiness">
                  <div className={`secondary-readiness-tier tier-${readiness.tier}`}>
                    {readiness.tier === 'ready' ? 'Ready' : readiness.tier === 'limited' ? 'Works, but limited' : 'Missing anchors'}
                  </div>
                  <div className="secondary-target-summary">
                    {readiness.rootAnchors.length > 0 && (
                      <span className="secondary-target-line">
                        Root: {readiness.rootAnchors.join(', ')}
                      </span>
                    )}
                    {readiness.childAnchors.length > 0 && (
                      <span className="secondary-target-line">
                        Children: {readiness.childAnchors.join(', ')}
                      </span>
                    )}
                    {readiness.notes.map((note, i) => (
                      <span key={i} className="secondary-readiness-note">{note}</span>
                    ))}
                  </div>
                  {readiness.fixHints.length > 0 && (
                    <div className="secondary-fix-hints">
                      {readiness.fixHints.map((hint, i) => (
                        <span key={i} className="secondary-fix-hint">{hint}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                className="motion-start-btn"
                onClick={handleBeginSecondarySession}
                disabled={!canStart || readiness?.tier === 'blocked'}
                title={
                  readiness?.tier === 'blocked'
                    ? 'No valid target — add anchors first'
                    : !canStart
                    ? 'Cannot start: transform or playback active'
                    : 'Generate secondary motion proposals'
                }
              >
                Generate Secondary Motion
              </button>
              {readiness?.tier === 'blocked' && (
                <div className="motion-blocked-reason">No valid target — add anchors in the Anchors panel first</div>
              )}
              {!canStart && readiness?.tier !== 'blocked' && (
                <div className="motion-blocked-reason">
                  {isTransforming ? 'Finish or cancel the active transform first' : 'Stop timeline playback first'}
                </div>
              )}
            </>
          ) : (
            <>
              {/* --- Locomotion Config --- */}
              <div className="motion-mode-toggle motion-sub-toggle">
                <button
                  className={`motion-mode-btn ${!useTemplate ? 'active' : ''}`}
                  onClick={() => setUseTemplate(false)}
                >
                  Manual
                </button>
                <button
                  className={`motion-mode-btn ${useTemplate ? 'active' : ''}`}
                  onClick={() => setUseTemplate(true)}
                >
                  Template
                </button>
              </div>

              {useTemplate ? (
                <>
                  <div className="motion-field">
                    <label className="motion-label">Template</label>
                    <select
                      className="motion-template-select"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value as MotionTemplateId)}
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div className="motion-template-info">
                      <span className="motion-template-desc">{selectedTemplate.description}</span>
                      <div className="motion-template-reqs">
                        {selectedTemplate.anchorRequirements.map((r) => {
                          const present = anchors.some((a) => a.kind === r.kind);
                          return (
                            <span key={r.kind} className={`motion-template-req ${present ? 'met' : r.required ? 'missing' : 'optional'}`}>
                              {ANCHOR_KIND_LABELS[r.kind as AnchorKind] ?? r.kind}: {r.role}
                              {r.required && !present && ' (missing)'}
                            </span>
                          );
                        })}
                      </div>
                      {templateMissing.length > 0 && (
                        <div className="motion-template-warning">
                          Missing required: {templateMissing.map((r) => ANCHOR_KIND_LABELS[r.kind as AnchorKind] ?? r.kind).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
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
              )}

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

              {!useTemplate && (
                <div className="motion-field">
                  <label className="motion-label">Target</label>
                  <span className="motion-target-label">
                    {hasSelection
                      ? 'Selection (takes precedence)'
                      : (selectedAnchor && anchorHasBounds)
                        ? `Anchor: ${selectedAnchor.name} (${ANCHOR_KIND_LABELS[selectedAnchor.kind as AnchorKind] ?? selectedAnchor.kind})`
                        : 'Whole Frame'}
                  </span>
                </div>
              )}

              {useTemplate && (
                <div className="motion-readiness">
                  <span className="motion-readiness-label">
                    Anchors: {anchors.length} on frame
                    {anchors.filter((a) => a.bounds).length > 0 && ` (${anchors.filter((a) => a.bounds).length} bound)`}
                  </span>
                  {selectedTemplate && templateMissing.length === 0 && anchors.length > 0 && (
                    <span className="motion-readiness-ok">Ready for {selectedTemplate.name}</span>
                  )}
                </div>
              )}

              <button
                className="motion-start-btn"
                onClick={useTemplate ? handleBeginTemplateSession : handleBeginSession}
                disabled={!canStart}
                title={!canStart ? 'Cannot start: transform or playback active' : useTemplate ? 'Apply template' : 'Begin motion session'}
              >
                {useTemplate ? 'Apply Template' : 'Start Motion Session'}
              </button>
            </>
          )}

          {anchors.length > 0 && (
            <button
              className="motion-save-preset-btn"
              onClick={handleSavePreset}
              title="Save current anchors and motion settings as a reusable preset"
            >
              Save as Preset
            </button>
          )}

          {savePresetMsg && <div className="motion-success">{savePresetMsg}</div>}
          {commitMessage && <div className="motion-success">{commitMessage}</div>}
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
        {targetMode === 'anchor_binding' && (
          <div className="motion-target-badge">Anchor-targeted</div>
        )}

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
                disabled={status === 'error' || status === 'committing'}
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
            <DetailPreview
              proposal={selectedProposal}
              intent={intent}
              direction={direction}
              targetMode={targetMode}
              outputFrameCount={outputFrameCount}
              secondaryTemplateName={panelMode === 'secondary' ? selectedSecondaryTemplate?.name : undefined}
            />
            <div className="motion-proposal-actions">
              <button className="motion-reject-btn" onClick={handleReject}>Deselect</button>
              <button className="motion-regen-btn" onClick={handleRegenerate} title="Re-generate all proposals">
                Regenerate
              </button>
              <button
                className="motion-commit-btn"
                onClick={handleCommit}
                disabled={status === 'committing'}
                title="Insert generated frames into timeline"
              >
                {status === 'committing' ? 'Committing...' : 'Commit to Timeline'}
              </button>
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
