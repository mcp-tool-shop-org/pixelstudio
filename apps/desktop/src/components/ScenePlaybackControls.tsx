import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { ScenePlaybackState, SceneInfo, SceneExportResult, SceneTimelineSummary } from '@pixelstudio/domain';
import { useScenePlaybackStore } from '@pixelstudio/state';

/**
 * Scene playback transport controls — play/pause, loop, FPS, scrubber, step, tick readout, export.
 * Owns the requestAnimationFrame clock loop for the scene.
 */
export function ScenePlaybackControls() {
  const isPlaying = useScenePlaybackStore((s) => s.isPlaying);
  const fps = useScenePlaybackStore((s) => s.fps);
  const looping = useScenePlaybackStore((s) => s.looping);
  const currentTick = useScenePlaybackStore((s) => s.currentTick);
  const elapsedMs = useScenePlaybackStore((s) => s.elapsedMs);
  const totalTicks = useScenePlaybackStore((s) => s.totalTicks);
  const playbackState = useScenePlaybackStore((s) => s.playbackState);
  const setPlaying = useScenePlaybackStore((s) => s.setPlaying);
  const setFps = useScenePlaybackStore((s) => s.setFps);
  const setLooping = useScenePlaybackStore((s) => s.setLooping);
  const setPlaybackState = useScenePlaybackStore((s) => s.setPlaybackState);
  const setTotalTicks = useScenePlaybackStore((s) => s.setTotalTicks);
  const resetClock = useScenePlaybackStore((s) => s.resetClock);
  const seekToTick = useScenePlaybackStore((s) => s.seekToTick);
  const stepTick = useScenePlaybackStore((s) => s.stepTick);

  const rafRef = useRef<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  // --- Load playback state + timeline summary from backend on mount ---
  const refreshPlaybackState = useCallback(async () => {
    try {
      const ps = await invoke<ScenePlaybackState>('get_scene_playback_state');
      setPlaybackState(ps);
      const summary = await invoke<SceneTimelineSummary>('get_scene_timeline_summary');
      setTotalTicks(summary.totalTicks);
    } catch {
      // No scene open — ignore
    }
  }, [setPlaybackState, setTotalTicks]);

  useEffect(() => {
    refreshPlaybackState();
  }, [refreshPlaybackState]);

  // Periodic refresh of timeline summary to stay in sync with clip changes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const summary = await invoke<SceneTimelineSummary>('get_scene_timeline_summary');
        setTotalTicks(summary.totalTicks);
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [setTotalTicks]);

  // --- requestAnimationFrame clock loop ---
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (time: number) => {
      useScenePlaybackStore.getState().advanceClock(time);
      if (useScenePlaybackStore.getState().isPlaying) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  // --- Handlers ---
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setPlaying(false);
    } else {
      const s = useScenePlaybackStore.getState();
      if (!s.looping && s.totalTicks > 0 && s.currentTick >= s.totalTicks - 1) {
        resetClock();
      }
      setPlaying(true);
    }
  }, [isPlaying, setPlaying, resetClock]);

  const handleStop = useCallback(() => {
    setPlaying(false);
    resetClock();
  }, [setPlaying, resetClock]);

  const handleFpsChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    const clamped = Math.max(1, Math.min(60, val));
    setFps(clamped);
    try {
      await invoke<SceneInfo>('set_scene_playback_fps', { fps: clamped });
    } catch {
      // ignore
    }
  }, [setFps]);

  const handleLoopToggle = useCallback(async () => {
    const newVal = !looping;
    setLooping(newVal);
    try {
      await invoke<SceneInfo>('set_scene_loop', { looping: newVal });
    } catch {
      // ignore
    }
  }, [looping, setLooping]);

  // Scrubber drag
  const handleScrubChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tick = parseInt(e.target.value, 10);
    seekToTick(tick);
  }, [seekToTick]);

  // Step buttons
  const handleStepBack = useCallback(() => {
    if (isPlaying) setPlaying(false);
    stepTick(-1);
  }, [isPlaying, setPlaying, stepTick]);

  const handleStepForward = useCallback(() => {
    if (isPlaying) setPlaying(false);
    stepTick(1);
  }, [isPlaying, setPlaying, stepTick]);

  const handleJumpStart = useCallback(() => {
    seekToTick(0);
  }, [seekToTick]);

  const handleJumpEnd = useCallback(() => {
    seekToTick(totalTicks - 1);
  }, [seekToTick, totalTicks]);

  const handleExportFrame = useCallback(async () => {
    setExportMsg('');
    try {
      const filePath = await save({
        title: 'Export Camera Frame',
        defaultPath: 'scene_frame.png',
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });
      if (!filePath) return;

      setExporting(true);
      const tick = useScenePlaybackStore.getState().currentTick;
      const result = await invoke<SceneExportResult>('export_scene_frame', {
        filePath,
        tick,
      });

      const warnText = result.warnings.length > 0
        ? ` (${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''})`
        : '';
      setExportMsg(`${result.width}x${result.height} @ tick ${tick}${warnText}`);
    } catch (err) {
      setExportMsg(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }, []);

  const hasInstances = playbackState ? playbackState.instances.length > 0 : false;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const totalSec = (totalTicks / Math.max(1, fps)).toFixed(1);
  const maxScrub = Math.max(0, totalTicks - 1);

  return (
    <div className="scene-playback-controls">
      <div className="scene-transport">
        <button
          className="scene-transport-btn"
          title="Stop and reset"
          onClick={handleStop}
          disabled={!hasInstances}
        >
          {'\u23F9'}
        </button>
        <button
          className="scene-transport-btn"
          title="Step back"
          onClick={handleStepBack}
          disabled={!hasInstances}
        >
          {'\u23EE'}
        </button>
        <button
          className={`scene-transport-btn scene-transport-play ${isPlaying ? 'active' : ''}`}
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={handlePlayPause}
          disabled={!hasInstances}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button
          className="scene-transport-btn"
          title="Step forward"
          onClick={handleStepForward}
          disabled={!hasInstances}
        >
          {'\u23ED'}
        </button>
        <button
          className={`scene-transport-btn ${looping ? 'active' : ''}`}
          title="Toggle loop"
          onClick={handleLoopToggle}
        >
          {'\u21BB'}
        </button>
      </div>

      <div className="scene-fps-group">
        <input
          type="number"
          className="scene-fps-input"
          value={fps}
          onChange={handleFpsChange}
          min={1}
          max={60}
          title="Scene FPS"
        />
        <span className="scene-fps-label">fps</span>
      </div>

      {/* Scene scrubber */}
      <div className="scene-scrubber-group">
        <button
          className="scene-scrubber-jump"
          title="Jump to start"
          onClick={handleJumpStart}
          disabled={!hasInstances}
        >
          {'\u23EE'}
        </button>
        <input
          type="range"
          className="scene-scrubber"
          min={0}
          max={maxScrub}
          value={Math.min(currentTick, maxScrub)}
          onChange={handleScrubChange}
          disabled={!hasInstances}
          title={`Tick ${currentTick} / ${totalTicks}`}
        />
        <button
          className="scene-scrubber-jump"
          title="Jump to end"
          onClick={handleJumpEnd}
          disabled={!hasInstances}
        >
          {'\u23ED'}
        </button>
      </div>

      <div className="scene-playback-readout">
        <span className="scene-tick-display">
          {currentTick} / {totalTicks}
        </span>
        <span className="scene-time-display">
          {elapsedSec}s / {totalSec}s
        </span>
        {isPlaying && <span className="scene-playing-indicator">{'\u25CF'}</span>}
      </div>

      <div className="scene-export-group">
        <button
          className="scene-transport-btn scene-export-btn"
          title="Export camera frame at current tick as PNG"
          onClick={handleExportFrame}
          disabled={exporting || !hasInstances}
        >
          {'\u2B07'} Export Frame
        </button>
        {exportMsg && <span className="scene-export-msg">{exportMsg}</span>}
      </div>
    </div>
  );
}
