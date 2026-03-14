import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceMode } from '@pixelstudio/domain';
import { useTimelineStore } from '@pixelstudio/state';
import { useProjectStore } from '@pixelstudio/state';
import { useSelectionStore } from '@pixelstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

interface TimelineResult {
  frames: Array<{ id: string; name: string; index: number }>;
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
  const setFrames = useTimelineStore((s) => s.setFrames);
  const fps = useTimelineStore((s) => s.fps);

  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

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

  const handleCreateFrame = useCallback(async () => {
    try {
      const result = await invoke<TimelineResult>('create_frame', { name: null });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('create_frame failed:', err); }
  }, [applyResult, markDirty]);

  const handleDuplicateFrame = useCallback(async () => {
    try {
      const result = await invoke<TimelineResult>('duplicate_frame');
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('duplicate_frame failed:', err); }
  }, [applyResult, markDirty]);

  const handleDeleteFrame = useCallback(async () => {
    if (!activeFrameId || frames.length <= 1) return;
    try {
      const result = await invoke<TimelineResult>('delete_frame', { frameId: activeFrameId });
      applyResult(result);
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) { console.error('delete_frame failed:', err); }
  }, [activeFrameId, frames.length, applyResult, markDirty]);

  const handleSelectFrame = useCallback(async (frameId: string) => {
    if (frameId === activeFrameId) return;
    try {
      const result = await invoke<TimelineResult>('select_frame', { frameId });
      applyResult(result);
    } catch (err) { console.error('select_frame failed:', err); }
  }, [activeFrameId, applyResult]);

  const handlePrevFrame = useCallback(async () => {
    const idx = frames.findIndex((f) => f.id === activeFrameId);
    if (idx > 0) handleSelectFrame(frames[idx - 1].id);
  }, [frames, activeFrameId, handleSelectFrame]);

  const handleNextFrame = useCallback(async () => {
    const idx = frames.findIndex((f) => f.id === activeFrameId);
    if (idx < frames.length - 1) handleSelectFrame(frames[idx + 1].id);
  }, [frames, activeFrameId, handleSelectFrame]);

  if (!showTimeline) {
    return (
      <footer className="bottom-dock">
        <div className="bottom-dock-info">
          <span className="dock-mode-label">{activeMode}</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bottom-dock">
      <div className="timeline-panel">
        <div className="timeline-controls">
          <button className="timeline-btn" title="Previous frame (,)" onClick={handlePrevFrame}>{'\u23EE'}</button>
          <button className="timeline-btn" title="Next frame (.)" onClick={handleNextFrame}>{'\u23ED'}</button>
          <span className="timeline-fps">{fps} fps</span>
        </div>
        <div className="timeline-frames">
          {frames.map((f) => (
            <button
              key={f.id}
              className={`timeline-frame ${f.id === activeFrameId ? 'active' : ''}`}
              title={f.name}
              onClick={() => handleSelectFrame(f.id)}
            >
              <span className="frame-number">{f.index + 1}</span>
            </button>
          ))}
          <button className="timeline-add-frame" title="New frame" onClick={handleCreateFrame}>+</button>
          <button className="timeline-add-frame" title="Duplicate frame" onClick={handleDuplicateFrame}>{'\u2398'}</button>
          {frames.length > 1 && (
            <button className="timeline-add-frame" title="Delete frame" onClick={handleDeleteFrame}>{'\u2715'}</button>
          )}
        </div>
        <div className="timeline-info">
          <span>{frames.length} frame{frames.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </footer>
  );
}
