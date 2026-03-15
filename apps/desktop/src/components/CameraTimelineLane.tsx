import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useScenePlaybackStore,
  deriveShotsFromCameraKeyframes,
  deriveCameraTimelineMarkers,
  findCurrentCameraShotAtTick,
} from '@pixelstudio/state';
import type { CameraTimelineMarker } from '@pixelstudio/state';
import type { SceneCameraKeyframe, SceneCameraShot, CameraInterpolationMode } from '@pixelstudio/domain';

/**
 * Camera timeline lane — renders keyframe markers and shot span bars
 * within the scene timeline. Click markers/shots to select and navigate.
 * Lane toolbar provides add/delete/nav without needing the dock panel.
 */
export function CameraTimelineLane() {
  const cameraKeyframes = useScenePlaybackStore((s) => s.cameraKeyframes);
  const totalTicks = useScenePlaybackStore((s) => s.totalTicks);
  const currentTick = useScenePlaybackStore((s) => s.currentTick);
  const selectedKeyframeTick = useScenePlaybackStore((s) => s.selectedKeyframeTick);
  const selectKeyframe = useScenePlaybackStore((s) => s.selectKeyframe);
  const seekToTick = useScenePlaybackStore((s) => s.seekToTick);
  const cameraX = useScenePlaybackStore((s) => s.cameraX);
  const cameraY = useScenePlaybackStore((s) => s.cameraY);
  const cameraZoom = useScenePlaybackStore((s) => s.cameraZoom);

  const [busy, setBusy] = useState(false);

  const markers: CameraTimelineMarker[] = useMemo(
    () => deriveCameraTimelineMarkers(cameraKeyframes),
    [cameraKeyframes],
  );

  const shots: SceneCameraShot[] = useMemo(
    () => deriveShotsFromCameraKeyframes(cameraKeyframes, totalTicks),
    [cameraKeyframes, totalTicks],
  );

  const currentShot = useMemo(
    () => findCurrentCameraShotAtTick(shots, currentTick),
    [shots, currentTick],
  );

  const handleMarkerClick = useCallback((tick: number) => {
    selectKeyframe(tick);
    seekToTick(tick);
  }, [selectKeyframe, seekToTick]);

  const handleShotClick = useCallback((shot: SceneCameraShot) => {
    const kf = cameraKeyframes.find((k) => k.tick === shot.startTick);
    if (kf) {
      selectKeyframe(kf.tick);
    }
    seekToTick(shot.startTick);
  }, [cameraKeyframes, selectKeyframe, seekToTick]);

  // --- Lane actions ---
  const handleAddKey = useCallback(async () => {
    setBusy(true);
    try {
      const kfs = await invoke<SceneCameraKeyframe[]>('add_scene_camera_keyframe', {
        tick: currentTick,
        x: cameraX,
        y: cameraY,
        zoom: cameraZoom,
        interpolation: 'linear' as CameraInterpolationMode,
      });
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
      selectKeyframe(currentTick);
    } catch {
      // ignore — panel will show error if open
    } finally {
      setBusy(false);
    }
  }, [currentTick, cameraX, cameraY, cameraZoom, selectKeyframe]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedKeyframeTick === null) return;
    setBusy(true);
    try {
      const kfs = await invoke<SceneCameraKeyframe[]>('delete_scene_camera_keyframe', {
        tick: selectedKeyframeTick,
      });
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
      selectKeyframe(null);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [selectedKeyframeTick, selectKeyframe]);

  const handlePrevKey = useCallback(() => {
    const sorted = [...cameraKeyframes].sort((a, b) => a.tick - b.tick);
    const before = sorted.filter((k) => k.tick < currentTick);
    if (before.length > 0) {
      const target = before[before.length - 1];
      selectKeyframe(target.tick);
      seekToTick(target.tick);
    }
  }, [cameraKeyframes, currentTick, selectKeyframe, seekToTick]);

  const handleNextKey = useCallback(() => {
    const sorted = [...cameraKeyframes].sort((a, b) => a.tick - b.tick);
    const after = sorted.filter((k) => k.tick > currentTick);
    if (after.length > 0) {
      selectKeyframe(after[0].tick);
      seekToTick(after[0].tick);
    }
  }, [cameraKeyframes, currentTick, selectKeyframe, seekToTick]);

  const handleJumpToSelected = useCallback(() => {
    if (selectedKeyframeTick !== null) {
      seekToTick(selectedKeyframeTick);
    }
  }, [selectedKeyframeTick, seekToTick]);

  const handlePrevShot = useCallback(() => {
    if (shots.length === 0) return;
    const current = findCurrentCameraShotAtTick(shots, currentTick);
    if (!current) {
      // Before first shot — jump to first shot start
      selectKeyframe(shots[0].startTick);
      seekToTick(shots[0].startTick);
      return;
    }
    // If at the start of current shot, go to previous shot
    const idx = shots.indexOf(current);
    if (currentTick === current.startTick && idx > 0) {
      selectKeyframe(shots[idx - 1].startTick);
      seekToTick(shots[idx - 1].startTick);
    } else {
      // Jump to start of current shot
      selectKeyframe(current.startTick);
      seekToTick(current.startTick);
    }
  }, [shots, currentTick, selectKeyframe, seekToTick]);

  const handleNextShot = useCallback(() => {
    if (shots.length === 0) return;
    const current = findCurrentCameraShotAtTick(shots, currentTick);
    if (!current) {
      selectKeyframe(shots[0].startTick);
      seekToTick(shots[0].startTick);
      return;
    }
    const idx = shots.indexOf(current);
    if (idx < shots.length - 1) {
      selectKeyframe(shots[idx + 1].startTick);
      seekToTick(shots[idx + 1].startTick);
    }
  }, [shots, currentTick, selectKeyframe, seekToTick]);

  // --- Keyboard shortcuts (scene mode only — component only renders in scene mode) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress when typing in input fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.repeat) return;

      if (e.key === '[' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlePrevKey();
      } else if (e.key === ']' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleNextKey();
      } else if (e.key === '{' && e.shiftKey) {
        // Shift+[ produces { on US layout
        e.preventDefault();
        handlePrevShot();
      } else if (e.key === '}' && e.shiftKey) {
        // Shift+] produces } on US layout
        e.preventDefault();
        handleNextShot();
      } else if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleAddKey();
      } else if ((e.key === 'j' || e.key === 'J') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleJumpToSelected();
      } else if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevKey, handleNextKey, handlePrevShot, handleNextShot, handleAddKey, handleJumpToSelected, handleDeleteSelected]);

  const hasKeyframes = markers.length > 0;
  const hasPrev = cameraKeyframes.some((k) => k.tick < currentTick);
  const hasNext = cameraKeyframes.some((k) => k.tick > currentTick);

  return (
    <div className="cam-lane">
      <div className="cam-lane-header">
        <div className="cam-lane-header-top">
          <span className="cam-lane-label">{'\uD83C\uDFA5'} Camera</span>
          <div className="cam-lane-actions">
            <button
              className="cam-lane-action-btn"
              title="Add key at playhead (K)"
              onClick={handleAddKey}
              disabled={busy}
            >+</button>
            <button
              className="cam-lane-action-btn"
              title="Delete selected key (Del)"
              onClick={handleDeleteSelected}
              disabled={selectedKeyframeTick === null || busy}
            >{'\u2715'}</button>
            <button
              className="cam-lane-action-btn"
              title="Previous key ([)"
              onClick={handlePrevKey}
              disabled={!hasPrev}
            >{'\u25C0'}</button>
            <button
              className="cam-lane-action-btn"
              title="Next key (])"
              onClick={handleNextKey}
              disabled={!hasNext}
            >{'\u25B6'}</button>
            {selectedKeyframeTick !== null && (
              <button
                className="cam-lane-action-btn"
                title="Jump to selected (J)"
                onClick={handleJumpToSelected}
              >{'\u23CE'}</button>
            )}
          </div>
        </div>
        {currentShot && (
          <span className="cam-lane-current-shot" title={`Current: ${currentShot.name}`}>
            {currentShot.name}
          </span>
        )}
      </div>
      <div className="cam-lane-body">
        {!hasKeyframes ? (
          <div className="cam-lane-empty">No camera keyframes — use + to add</div>
        ) : (
          <div className="cam-lane-track">
            {/* Shot span bars */}
            {shots.map((shot, i) => (
              <CamShotBar
                key={`shot-${shot.startTick}`}
                shot={shot}
                totalTicks={totalTicks}
                isCurrent={currentShot?.startTick === shot.startTick}
                isSelected={selectedKeyframeTick === shot.startTick}
                isLast={i === shots.length - 1}
                onClick={handleShotClick}
              />
            ))}
            {/* Keyframe markers */}
            {markers.map((marker) => (
              <CamMarker
                key={`kf-${marker.tick}`}
                marker={marker}
                totalTicks={totalTicks}
                isAtPlayhead={marker.tick === currentTick}
                isSelected={marker.tick === selectedKeyframeTick}
                onClick={handleMarkerClick}
              />
            ))}
            {/* Playhead */}
            <div
              className="cam-lane-playhead"
              style={{ left: `${totalTicks > 1 ? (currentTick / (totalTicks - 1)) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CamShotBar({
  shot,
  totalTicks,
  isCurrent,
  isSelected,
  isLast,
  onClick,
}: {
  shot: SceneCameraShot;
  totalTicks: number;
  isCurrent: boolean;
  isSelected: boolean;
  isLast: boolean;
  onClick: (shot: SceneCameraShot) => void;
}) {
  const max = Math.max(1, totalTicks - 1);
  const left = (shot.startTick / max) * 100;
  const rawWidth = ((shot.endTick - shot.startTick) / max) * 100;
  const width = Math.min(rawWidth, 100 - left);

  const interpBadge = shot.interpolation === 'hold' ? 'H' : 'L';
  const durationLabel = `${shot.durationTicks}t`;
  const rangeLabel = `${shot.startTick}–${shot.endTick - 1}`;
  const endLabel = isLast ? '\u2192 End' : '';

  const cls = [
    'cam-lane-shot',
    isCurrent ? 'current' : '',
    isSelected ? 'selected' : '',
    shot.interpolation === 'hold' ? 'hold' : 'linear',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${shot.name} (${rangeLabel}, ${durationLabel}, ${shot.interpolation})`}
      onClick={() => onClick(shot)}
    >
      <span className="cam-lane-shot-badge">{interpBadge}</span>
      <span className="cam-lane-shot-label">{shot.name}</span>
      {isLast && endLabel && (
        <span className="cam-lane-shot-end">{endLabel}</span>
      )}
    </div>
  );
}

function CamMarker({
  marker,
  totalTicks,
  isAtPlayhead,
  isSelected,
  onClick,
}: {
  marker: CameraTimelineMarker;
  totalTicks: number;
  isAtPlayhead: boolean;
  isSelected: boolean;
  onClick: (tick: number) => void;
}) {
  const max = Math.max(1, totalTicks - 1);
  const left = (marker.tick / max) * 100;

  const cls = [
    'cam-lane-marker',
    isAtPlayhead ? 'at-playhead' : '',
    isSelected ? 'selected' : '',
    marker.interpolation === 'hold' ? 'hold' : 'linear',
  ].filter(Boolean).join(' ');

  const label = marker.name ?? `Key @ ${marker.tick}`;
  const detail = `${label} | tick ${marker.tick} | (${marker.x.toFixed(0)}, ${marker.y.toFixed(0)}) z${marker.zoom.toFixed(1)} | ${marker.interpolation}`;

  return (
    <div
      className={cls}
      style={{ left: `${left}%` }}
      title={detail}
      onClick={() => onClick(marker.tick)}
    />
  );
}
