import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { WorkspaceMode } from '@glyphstudio/domain';
import { useTimelineStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useScenePlaybackStore } from '@glyphstudio/state';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { MotionPanel } from './MotionPanel';
import { AnchorPanel } from './AnchorPanel';
import { SandboxPanel } from './SandboxPanel';
import { PresetPanel } from './PresetPanel';
import { ClipPanel } from './ClipPanel';
import { ExportPreviewPanel } from './ExportPreviewPanel';
import { ScenePlaybackControls } from './ScenePlaybackControls';
import { CameraTimelineLane } from './CameraTimelineLane';

interface TimelineResult {
  frames: Array<{ id: string; name: string; index: number; durationMs: number | null }>;
  activeFrameIndex: number;
  activeFrameId: string;
  frame: CanvasFrameData;
}

interface BottomDockProps {
  activeMode: WorkspaceMode;
}

export function BottomDock({ activeMode }: BottomDockProps) {
  const showTimeline = activeMode === 'edit' || activeMode === 'animate' || activeMode === 'locomotion';

  const frames = useTimelineStore((s) => s.frames);
  const activeFrameId = useTimelineStore((s) => s.activeFrameId);
  const activeFrameIndex = useTimelineStore((s) => s.activeFrameIndex);
  const setFrames = useTimelineStore((s) => s.setFrames);
  const fps = useTimelineStore((s) => s.fps);
  const playing = useTimelineStore((s) => s.playing);
  const loopEnabled = useTimelineStore((s) => s.loop);
  const setPlaying = useTimelineStore((s) => s.setPlaying);
  const setFps = useTimelineStore((s) => s.setFps);
  const toggleLoop = useTimelineStore((s) => s.toggleLoop);
  const onionSkinEnabled = useTimelineStore((s) => s.onionSkinEnabled);
  const onionSkinShowPrev = useTimelineStore((s) => s.onionSkinShowPrev);
  const onionSkinShowNext = useTimelineStore((s) => s.onionSkinShowNext);
  const toggleOnionSkin = useTimelineStore((s) => s.toggleOnionSkin);
  const setOnionSkinShowPrev = useTimelineStore((s) => s.setOnionSkinShowPrev);
  const setOnionSkinShowNext = useTimelineStore((s) => s.setOnionSkinShowNext);

  const showSilhouette = useCanvasViewStore((s) => s.showSilhouette);
  const toggleSilhouette = useCanvasViewStore((s) => s.toggleOverlay);

  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
  const projectName = useProjectStore((s) => s.name);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  // Playback loop refs
  const playbackRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const switchingRef = useRef(false);

  // Load initial timeline state
  useEffect(() => {
    if (!showTimeline) return;
    invoke<TimelineResult>('get_timeline')
      .then((result) => {
        setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
      })
      .catch(() => {});
  }, [showTimeline, setFrames]);

  const applyResult = useCallback((result: TimelineResult) => {
    setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
    setFrame(result.frame);
    syncLayersFromFrame(result.frame);
    clearSelection();
  }, [setFrames, setFrame, clearSelection]);

  // --- Playback loop (requestAnimationFrame, elapsed-time based) ---
  useEffect(() => {
    if (!playing || frames.length <= 1) {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
        playbackRef.current = null;
      }
      if (playing && frames.length <= 1) setPlaying(false);
      return;
    }

    lastTickRef.current = 0;

    const tick = (time: number) => {
      if (!lastTickRef.current) {
        lastTickRef.current = time;
        playbackRef.current = requestAnimationFrame(tick);
        return;
      }

      const frameDuration = 1000 / useTimelineStore.getState().fps;
      const elapsed = time - lastTickRef.current;

      if (elapsed >= frameDuration && !switchingRef.current) {
        lastTickRef.current = time - (elapsed % frameDuration);

        const state = useTimelineStore.getState();
        const nextIdx = state.activeFrameIndex + 1;

        if (nextIdx >= state.frames.length) {
          if (state.loop) {
            switchingRef.current = true;
            invoke<TimelineResult>('select_frame', { frameId: state.frames[0].id })
              .then((result) => {
                state.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
                useCanvasFrameStore.getState().setFrame(result.frame);
                syncLayersFromFrame(result.frame);
              })
              .catch(() => {})
              .finally(() => { switchingRef.current = false; });
          } else {
            setPlaying(false);
            return;
          }
        } else {
          switchingRef.current = true;
          invoke<TimelineResult>('select_frame', { frameId: state.frames[nextIdx].id })
            .then((result) => {
              state.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
              useCanvasFrameStore.getState().setFrame(result.frame);
              syncLayersFromFrame(result.frame);
            })
            .catch(() => {})
            .finally(() => { switchingRef.current = false; });
        }
      }

      playbackRef.current = requestAnimationFrame(tick);
    };

    playbackRef.current = requestAnimationFrame(tick);
    return () => {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
        playbackRef.current = null;
      }
    };
  }, [playing, frames.length, setPlaying]);

  // --- Ensure playback paused before structural operations ---
  const pauseFirst = useCallback(() => {
    if (useTimelineStore.getState().playing) setPlaying(false);
  }, [setPlaying]);

  // --- Play/pause with editor coexistence ---
  const handlePlayPause = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (useSelectionStore.getState().isTransforming) return;
    clearSelection();
    invoke('clear_selection').catch(() => {});
    if (frames.length <= 1) return;
    setPlaying(true);
  }, [playing, frames.length, setPlaying, clearSelection]);

  const handleCreateFrame = useCallback(async () => {
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('create_frame', { name: null });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('create_frame failed:', err); }
  }, [applyResult, markDirty, pauseFirst]);

  const handleDuplicateFrame = useCallback(async () => {
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('duplicate_frame');
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('duplicate_frame failed:', err); }
  }, [applyResult, markDirty, pauseFirst]);

  const handleDeleteFrame = useCallback(async () => {
    pauseFirst();
    if (!activeFrameId || frames.length <= 1) return;
    try {
      const result = await invoke<TimelineResult>('delete_frame', { frameId: activeFrameId });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('delete_frame failed:', err); }
  }, [activeFrameId, frames.length, applyResult, markDirty, pauseFirst]);

  const handleSelectFrame = useCallback(async (frameId: string) => {
    if (frameId === activeFrameId) return;
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('select_frame', { frameId });
      applyResult(result);
    } catch (err) { console.error('select_frame failed:', err); }
  }, [activeFrameId, applyResult, pauseFirst]);

  const handlePrevFrame = useCallback(async () => {
    const idx = frames.findIndex((f) => f.id === activeFrameId);
    if (idx > 0) {
      handleSelectFrame(frames[idx - 1].id);
    } else if (idx === 0 && loopEnabled && frames.length > 1) {
      handleSelectFrame(frames[frames.length - 1].id);
    }
  }, [frames, activeFrameId, loopEnabled, handleSelectFrame]);

  const handleNextFrame = useCallback(async () => {
    const idx = frames.findIndex((f) => f.id === activeFrameId);
    if (idx < frames.length - 1) {
      handleSelectFrame(frames[idx + 1].id);
    } else if (idx === frames.length - 1 && loopEnabled && frames.length > 1) {
      handleSelectFrame(frames[0].id);
    }
  }, [frames, activeFrameId, loopEnabled, handleSelectFrame]);

  // --- Frame reorder ---
  const handleMoveFrameLeft = useCallback(async () => {
    if (activeFrameIndex <= 0 || !activeFrameId) return;
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('reorder_frame', { frameId: activeFrameId, newIndex: activeFrameIndex - 1 });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('reorder_frame failed:', err); }
  }, [activeFrameId, activeFrameIndex, applyResult, markDirty, pauseFirst]);

  const handleMoveFrameRight = useCallback(async () => {
    if (activeFrameIndex >= frames.length - 1 || !activeFrameId) return;
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('reorder_frame', { frameId: activeFrameId, newIndex: activeFrameIndex + 1 });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('reorder_frame failed:', err); }
  }, [activeFrameId, activeFrameIndex, frames.length, applyResult, markDirty, pauseFirst]);

  // --- Insert frame before/after ---
  const handleInsertBefore = useCallback(async () => {
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('insert_frame_at', { position: activeFrameIndex, name: null });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('insert_frame_at failed:', err); }
  }, [activeFrameIndex, applyResult, markDirty, pauseFirst]);

  const handleInsertAfter = useCallback(async () => {
    pauseFirst();
    try {
      const result = await invoke<TimelineResult>('insert_frame_at', { position: activeFrameIndex + 1, name: null });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('insert_frame_at failed:', err); }
  }, [activeFrameIndex, applyResult, markDirty, pauseFirst]);

  // --- Export ---
  const handleExportSequence = useCallback(async () => {
    pauseFirst();
    try {
      const dirPath = await save({
        title: 'Export PNG Sequence — Choose folder name',
        defaultPath: `${projectName || 'frames'}_sequence`,
      });
      if (!dirPath) return;
      const baseName = projectName || 'frame';
      await invoke<string[]>('export_frame_sequence', { dirPath, baseName });
    } catch (err) { console.error('export_frame_sequence failed:', err); }
  }, [projectName, pauseFirst]);

  const handleExportSpriteStrip = useCallback(async () => {
    pauseFirst();
    try {
      const filePath = await save({
        title: 'Export Sprite Strip',
        defaultPath: `${projectName || 'sprite'}_strip.png`,
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });
      if (!filePath) return;
      await invoke<string>('export_sprite_strip', { filePath, horizontal: true });
    } catch (err) { console.error('export_sprite_strip failed:', err); }
  }, [projectName, pauseFirst]);

  const handleFpsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setFps(val);
  }, [setFps]);

  // Pause sprite timeline playback when entering scene mode
  useEffect(() => {
    if (activeMode === 'scene') {
      if (useTimelineStore.getState().playing) {
        setPlaying(false);
      }
    }
  }, [activeMode, setPlaying]);

  // Pause scene playback when leaving scene mode
  useEffect(() => {
    if (activeMode !== 'scene') {
      if (useScenePlaybackStore.getState().isPlaying) {
        useScenePlaybackStore.getState().setPlaying(false);
      }
    }
  }, [activeMode]);

  if (activeMode === 'vector') {
    return (
      <footer className="bottom-dock">
        <div className="bottom-dock-info">
          <span className="dock-mode-label">Vector Master</span>
          <span className="dock-hint">Draw shapes on the artboard. Use the Shapes panel to manage layers and reduction metadata.</span>
        </div>
      </footer>
    );
  }

  if (activeMode === 'scene') {
    return (
      <footer className="bottom-dock">
        <ScenePlaybackControls />
        <CameraTimelineLane />
      </footer>
    );
  }

  if (!showTimeline) {
    if (activeMode === 'export') {
      return (
        <footer className="bottom-dock">
          <ExportPreviewPanel />
        </footer>
      );
    }
    return (
      <footer className="bottom-dock">
        <div className="bottom-dock-info">
          <span className="dock-mode-label">{activeMode}</span>
        </div>
      </footer>
    );
  }

  const canPlay = frames.length > 1;

  const showMotion = activeMode === 'locomotion';

  return (
    <footer className="bottom-dock">
      {showMotion && <MotionPanel />}
      {showMotion && <AnchorPanel />}
      {showMotion && <SandboxPanel />}
      {showMotion && <PresetPanel />}
      {showTimeline && frames.length > 1 && <ClipPanel />}
      {showTimeline && <ExportPreviewPanel />}
      <div className="timeline-panel">
        <div className="timeline-controls">
          <button className="timeline-btn" title="Previous frame (,)" onClick={handlePrevFrame} disabled={playing}>{'\u23EE'}</button>
          <button
            className={`timeline-btn transport-play ${playing ? 'active' : ''}`}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            onClick={handlePlayPause}
            disabled={!canPlay}
          >
            {playing ? '\u23F8' : '\u25B6'}
          </button>
          <button className="timeline-btn" title="Next frame (.)" onClick={handleNextFrame} disabled={playing}>{'\u23ED'}</button>
          <button
            className={`timeline-btn ${loopEnabled ? 'active' : ''}`}
            title="Toggle loop"
            onClick={toggleLoop}
          >
            {'\u21BB'}
          </button>
          <span className="timeline-fps-group">
            <input
              type="number"
              className="timeline-fps-input"
              value={fps}
              onChange={handleFpsChange}
              min={1}
              max={60}
              title="Frames per second"
            />
            <span className="timeline-fps-label">fps</span>
          </span>
        </div>
        <div className="timeline-frames">
          {frames.map((f) => (
            <button
              key={f.id}
              className={`timeline-frame ${f.id === activeFrameId ? 'active' : ''}`}
              title={f.name + (f.durationMs ? ` (${f.durationMs}ms)` : '')}
              onClick={() => handleSelectFrame(f.id)}
            >
              <span className="frame-number">{f.index + 1}</span>
            </button>
          ))}
          {!playing && (
            <>
              <button className="timeline-add-frame" title="New frame" onClick={handleCreateFrame}>+</button>
              <button className="timeline-add-frame" title="Duplicate frame" onClick={handleDuplicateFrame}>{'\u2398'}</button>
              {frames.length > 1 && (
                <button className="timeline-add-frame" title="Delete frame" onClick={handleDeleteFrame}>{'\u2715'}</button>
              )}
            </>
          )}
        </div>
        <div className="timeline-actions">
          {!playing && frames.length > 1 && (
            <>
              <button className="timeline-btn" title="Move frame left" onClick={handleMoveFrameLeft} disabled={activeFrameIndex <= 0}>{'\u2190'}</button>
              <button className="timeline-btn" title="Move frame right" onClick={handleMoveFrameRight} disabled={activeFrameIndex >= frames.length - 1}>{'\u2192'}</button>
              <span className="timeline-sep">|</span>
              <button className="timeline-btn" title="Insert blank before" onClick={handleInsertBefore}>+B</button>
              <button className="timeline-btn" title="Insert blank after" onClick={handleInsertAfter}>+A</button>
            </>
          )}
          {!playing && frames.length > 1 && (
            <>
              <span className="timeline-sep">|</span>
              <button className="timeline-btn" title="Export PNG sequence" onClick={handleExportSequence}>Seq</button>
              <button className="timeline-btn" title="Export sprite strip" onClick={handleExportSpriteStrip}>Strip</button>
            </>
          )}
        </div>
        <div className="timeline-onion">
          <button
            className={`timeline-btn ${onionSkinEnabled ? 'active' : ''}`}
            title="Toggle onion skin (O)"
            onClick={toggleOnionSkin}
          >
            OS
          </button>
          {onionSkinEnabled && (
            <>
              <label className="onion-check" title="Show previous frame">
                <input type="checkbox" checked={onionSkinShowPrev} onChange={(e) => setOnionSkinShowPrev(e.target.checked)} />
                prev
              </label>
              <label className="onion-check" title="Show next frame">
                <input type="checkbox" checked={onionSkinShowNext} onChange={(e) => setOnionSkinShowNext(e.target.checked)} />
                next
              </label>
            </>
          )}
        </div>
        <div className="timeline-view-toggles">
          <button
            className={`timeline-btn ${showSilhouette ? 'active' : ''}`}
            title="Toggle silhouette view — flatten to single-color outline"
            onClick={() => toggleSilhouette('showSilhouette')}
          >
            Sil
          </button>
        </div>
        <div className="timeline-info">
          <span className="timeline-frame-counter">{activeFrameIndex + 1}/{frames.length}</span>
          {frames.length > 1 && (
            <span className="timeline-frame-name" title={frames[activeFrameIndex]?.name}>
              {frames[activeFrameIndex]?.name}
            </span>
          )}
          {playing && <span className="playback-indicator">playing</span>}
        </div>
      </div>
    </footer>
  );
}
