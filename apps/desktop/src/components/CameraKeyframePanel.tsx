import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SceneCameraKeyframe, CameraInterpolationMode, SceneCameraShot } from '@glyphstudio/domain';
import { useScenePlaybackStore, deriveShotsFromCameraKeyframes } from '@glyphstudio/state';

type ViewMode = 'keyframes' | 'shots';

/** Camera keyframe authoring panel — list, add, edit, delete, jump between keys. */
export function CameraKeyframePanel() {
  const [keyframes, setKeyframes] = useState<SceneCameraKeyframe[]>([]);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('keyframes');

  const currentTick = useScenePlaybackStore((s) => s.currentTick);
  const totalTicks = useScenePlaybackStore((s) => s.totalTicks);
  const cameraX = useScenePlaybackStore((s) => s.cameraX);
  const cameraY = useScenePlaybackStore((s) => s.cameraY);
  const cameraZoom = useScenePlaybackStore((s) => s.cameraZoom);
  const seekToTick = useScenePlaybackStore((s) => s.seekToTick);
  const selectedTick = useScenePlaybackStore((s) => s.selectedKeyframeTick);
  const selectKeyframe = useScenePlaybackStore((s) => s.selectKeyframe);

  const shots = useMemo(
    () => deriveShotsFromCameraKeyframes(keyframes, totalTicks),
    [keyframes, totalTicks],
  );

  // Load keyframes from backend
  const refreshKeyframes = useCallback(async () => {
    try {
      const kfs = await invoke<SceneCameraKeyframe[]>('list_scene_camera_keyframes');
      setKeyframes(kfs);
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
    } catch {
      // no scene open
    }
  }, []);

  useEffect(() => {
    refreshKeyframes();
  }, [refreshKeyframes]);

  // Clear selection if the selected keyframe was deleted
  useEffect(() => {
    if (selectedTick !== null && !keyframes.some((k) => k.tick === selectedTick)) {
      selectKeyframe(null);
    }
  }, [keyframes, selectedTick]);

  // Add keyframe at current playhead using current effective camera
  const handleAddAtPlayhead = useCallback(async () => {
    setError('');
    try {
      const kfs = await invoke<SceneCameraKeyframe[]>('add_scene_camera_keyframe', {
        tick: currentTick,
        x: cameraX,
        y: cameraY,
        zoom: cameraZoom,
        interpolation: 'linear' as CameraInterpolationMode,
      });
      setKeyframes(kfs);
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
      selectKeyframe(currentTick);
    } catch (err) {
      setError(String(err));
    }
  }, [currentTick, cameraX, cameraY, cameraZoom]);

  // Delete a keyframe by tick
  const handleDelete = useCallback(async (tick: number) => {
    setError('');
    try {
      const kfs = await invoke<SceneCameraKeyframe[]>('delete_scene_camera_keyframe', { tick });
      setKeyframes(kfs);
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  // Jump playhead to a keyframe tick
  const handleJumpTo = useCallback((tick: number) => {
    seekToTick(tick);
    selectKeyframe(tick);
  }, [seekToTick]);

  // Navigate to previous/next keyframe
  const handlePrevKey = useCallback(() => {
    if (keyframes.length === 0) return;
    const before = keyframes.filter((k) => k.tick < currentTick);
    if (before.length > 0) {
      const target = before[before.length - 1];
      handleJumpTo(target.tick);
    }
  }, [keyframes, currentTick, handleJumpTo]);

  const handleNextKey = useCallback(() => {
    if (keyframes.length === 0) return;
    const after = keyframes.filter((k) => k.tick > currentTick);
    if (after.length > 0) {
      handleJumpTo(after[0].tick);
    }
  }, [keyframes, currentTick, handleJumpTo]);

  // Navigate to previous/next shot
  const handlePrevShot = useCallback(() => {
    if (shots.length === 0) return;
    const before = shots.filter((s) => s.startTick < currentTick);
    if (before.length > 0) {
      handleJumpTo(before[before.length - 1].startTick);
    }
  }, [shots, currentTick, handleJumpTo]);

  const handleNextShot = useCallback(() => {
    if (shots.length === 0) return;
    const after = shots.filter((s) => s.startTick > currentTick);
    if (after.length > 0) {
      handleJumpTo(after[0].startTick);
    }
  }, [shots, currentTick, handleJumpTo]);

  const selectedKf = selectedTick !== null ? keyframes.find((k) => k.tick === selectedTick) : null;
  const isOnKeyframe = keyframes.some((k) => k.tick === currentTick);

  // Save handler for editor — supports name updates
  const handleEditorSave = useCallback(async (updates: {
    x?: number; y?: number; zoom?: number;
    interpolation?: CameraInterpolationMode; name?: string;
  }) => {
    if (!selectedKf) return;
    setError('');
    try {
      const kfs = await invoke<SceneCameraKeyframe[]>('update_scene_camera_keyframe', {
        tick: selectedKf.tick,
        ...updates,
      });
      setKeyframes(kfs);
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
    } catch (err) {
      setError(String(err));
    }
  }, [selectedKf]);

  // Empty state
  if (keyframes.length === 0) {
    return (
      <div className="camkf-panel">
        <div className="camkf-header">Camera Keyframes</div>
        <CameraKeyframeEmptyState onAdd={handleAddAtPlayhead} currentTick={currentTick} />
        {error && <span className="camkf-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="camkf-panel">
      <div className="camkf-header">
        <span>Camera</span>
        <span className="camkf-header-tick">
          tick {currentTick}{isOnKeyframe ? ' \u25C6' : ''}
        </span>
      </div>

      {/* View toggle */}
      <div className="camkf-view-toggle">
        <button
          className={`camkf-view-btn ${viewMode === 'keyframes' ? 'active' : ''}`}
          onClick={() => setViewMode('keyframes')}
        >
          Keyframes
        </button>
        <button
          className={`camkf-view-btn ${viewMode === 'shots' ? 'active' : ''}`}
          onClick={() => setViewMode('shots')}
        >
          Shots
        </button>
      </div>

      <div className="camkf-toolbar">
        <button className="camkf-btn" title="Add key at playhead" onClick={handleAddAtPlayhead}>
          + Key
        </button>
        {viewMode === 'keyframes' ? (
          <>
            <button className="camkf-btn" title="Previous key" onClick={handlePrevKey} disabled={keyframes.length === 0}>
              {'\u23EE'}
            </button>
            <button className="camkf-btn" title="Next key" onClick={handleNextKey} disabled={keyframes.length === 0}>
              {'\u23ED'}
            </button>
          </>
        ) : (
          <>
            <button className="camkf-btn" title="Previous shot" onClick={handlePrevShot} disabled={shots.length === 0}>
              {'\u23EE'}
            </button>
            <button className="camkf-btn" title="Next shot" onClick={handleNextShot} disabled={shots.length === 0}>
              {'\u23ED'}
            </button>
          </>
        )}
      </div>

      {viewMode === 'keyframes' ? (
        <CameraKeyframeList
          keyframes={keyframes}
          selectedTick={selectedTick}
          currentTick={currentTick}
          onSelect={selectKeyframe}
          onJump={handleJumpTo}
          onDelete={handleDelete}
        />
      ) : (
        <CameraShotList
          shots={shots}
          currentTick={currentTick}
          onJump={handleJumpTo}
        />
      )}

      {selectedKf && (
        <CameraKeyframeEditor
          keyframe={selectedKf}
          onSave={handleEditorSave}
          onDelete={() => handleDelete(selectedKf.tick)}
        />
      )}

      <div className="camkf-resolved">
        <span className="camkf-resolved-label">Resolved @ {currentTick}:</span>
        <span className="camkf-resolved-vals">
          ({cameraX.toFixed(1)}, {cameraY.toFixed(1)}) {(cameraZoom * 100).toFixed(0)}%
        </span>
      </div>

      {error && <span className="camkf-error">{error}</span>}
    </div>
  );
}

/** Empty state when no keyframes exist. */
function CameraKeyframeEmptyState({ onAdd, currentTick }: { onAdd: () => void; currentTick: number }) {
  return (
    <div className="camkf-empty">
      <p className="camkf-empty-text">
        Camera follows base position until keyframes are added.
      </p>
      <button className="camkf-btn camkf-btn-primary" onClick={onAdd}>
        + Add Key at Tick {currentTick}
      </button>
    </div>
  );
}

/** Sorted list of camera keyframes. */
function CameraKeyframeList({
  keyframes,
  selectedTick,
  currentTick,
  onSelect,
  onJump,
  onDelete,
}: {
  keyframes: SceneCameraKeyframe[];
  selectedTick: number | null;
  currentTick: number;
  onSelect: (tick: number) => void;
  onJump: (tick: number) => void;
  onDelete: (tick: number) => void;
}) {
  return (
    <div className="camkf-list">
      <div className="camkf-list-header">
        <span className="camkf-col-tick">Tick</span>
        <span className="camkf-col-name">Name</span>
        <span className="camkf-col-xy">X</span>
        <span className="camkf-col-xy">Y</span>
        <span className="camkf-col-zoom">Zoom</span>
        <span className="camkf-col-interp">Interp</span>
        <span className="camkf-col-actions"></span>
      </div>
      {keyframes.map((kf) => (
        <CameraKeyframeRow
          key={kf.tick}
          keyframe={kf}
          isSelected={selectedTick === kf.tick}
          isAtPlayhead={currentTick === kf.tick}
          onSelect={() => onSelect(kf.tick)}
          onJump={() => onJump(kf.tick)}
          onDelete={() => onDelete(kf.tick)}
        />
      ))}
    </div>
  );
}

/** Single keyframe row. */
function CameraKeyframeRow({
  keyframe,
  isSelected,
  isAtPlayhead,
  onSelect,
  onJump,
  onDelete,
}: {
  keyframe: SceneCameraKeyframe;
  isSelected: boolean;
  isAtPlayhead: boolean;
  onSelect: () => void;
  onJump: () => void;
  onDelete: () => void;
}) {
  const rowClass = [
    'camkf-row',
    isSelected ? 'camkf-row-selected' : '',
    isAtPlayhead ? 'camkf-row-playhead' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass} onClick={onSelect}>
      <span className="camkf-col-tick camkf-mono">{keyframe.tick}</span>
      <span className="camkf-col-name camkf-name-cell">{keyframe.name ?? '\u2014'}</span>
      <span className="camkf-col-xy camkf-mono">{keyframe.x.toFixed(1)}</span>
      <span className="camkf-col-xy camkf-mono">{keyframe.y.toFixed(1)}</span>
      <span className="camkf-col-zoom camkf-mono">{(keyframe.zoom * 100).toFixed(0)}%</span>
      <span className="camkf-col-interp">
        <span className={`camkf-interp-badge camkf-interp-${keyframe.interpolation}`}>
          {keyframe.interpolation === 'hold' ? 'H' : 'L'}
        </span>
      </span>
      <span className="camkf-col-actions">
        <button className="camkf-row-btn" title="Jump to tick" onClick={(e) => { e.stopPropagation(); onJump(); }}>
          {'\u25B6'}
        </button>
        <button className="camkf-row-btn camkf-row-btn-del" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          {'\u2715'}
        </button>
      </span>
    </div>
  );
}

/** Shot list — derived segments between keyframes. */
function CameraShotList({
  shots,
  currentTick,
  onJump,
}: {
  shots: SceneCameraShot[];
  currentTick: number;
  onJump: (tick: number) => void;
}) {
  return (
    <div className="camkf-list">
      <div className="camkf-list-header">
        <span className="camkf-col-name">Shot</span>
        <span className="camkf-col-tick">Start</span>
        <span className="camkf-col-tick">End</span>
        <span className="camkf-col-zoom">Dur</span>
        <span className="camkf-col-interp">Interp</span>
        <span className="camkf-col-actions"></span>
      </div>
      {shots.map((shot) => {
        const isActive = currentTick >= shot.startTick && currentTick < shot.endTick;
        const rowClass = ['camkf-row', isActive ? 'camkf-row-playhead' : ''].filter(Boolean).join(' ');
        return (
          <div key={shot.startTick} className={rowClass}>
            <span className="camkf-col-name camkf-name-cell">{shot.name}</span>
            <span className="camkf-col-tick camkf-mono">{shot.startTick}</span>
            <span className="camkf-col-tick camkf-mono">{shot.endTick}</span>
            <span className="camkf-col-zoom camkf-mono">{shot.durationTicks}t</span>
            <span className="camkf-col-interp">
              <span className={`camkf-interp-badge camkf-interp-${shot.interpolation}`}>
                {shot.interpolation === 'hold' ? 'H' : 'L'}
              </span>
            </span>
            <span className="camkf-col-actions">
              <button className="camkf-row-btn" title="Jump to shot start" onClick={() => onJump(shot.startTick)}>
                {'\u25B6'}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Editor for selected keyframe values. */
function CameraKeyframeEditor({
  keyframe,
  onSave,
  onDelete,
}: {
  keyframe: SceneCameraKeyframe;
  onSave: (updates: { x?: number; y?: number; zoom?: number; interpolation?: CameraInterpolationMode; name?: string }) => Promise<void>;
  onDelete: () => void;
}) {
  const [draftX, setDraftX] = useState(String(keyframe.x));
  const [draftY, setDraftY] = useState(String(keyframe.y));
  const [draftZoom, setDraftZoom] = useState(String(keyframe.zoom));
  const [draftInterp, setDraftInterp] = useState<CameraInterpolationMode>(keyframe.interpolation);
  const [draftName, setDraftName] = useState(keyframe.name ?? '');
  const [saving, setSaving] = useState(false);

  // Sync draft when selected keyframe changes
  useEffect(() => {
    setDraftX(String(keyframe.x));
    setDraftY(String(keyframe.y));
    setDraftZoom(String(keyframe.zoom));
    setDraftInterp(keyframe.interpolation);
    setDraftName(keyframe.name ?? '');
  }, [keyframe.tick, keyframe.x, keyframe.y, keyframe.zoom, keyframe.interpolation, keyframe.name]);

  const isDirty =
    parseFloat(draftX) !== keyframe.x ||
    parseFloat(draftY) !== keyframe.y ||
    parseFloat(draftZoom) !== keyframe.zoom ||
    draftInterp !== keyframe.interpolation ||
    draftName !== (keyframe.name ?? '');

  const handleSave = useCallback(async () => {
    const x = parseFloat(draftX);
    const y = parseFloat(draftY);
    const zoom = parseFloat(draftZoom);
    if (isNaN(x) || isNaN(y) || isNaN(zoom)) return;
    const clampedZoom = Math.max(0.1, Math.min(10.0, zoom));
    setSaving(true);
    try {
      await onSave({
        x, y, zoom: clampedZoom,
        interpolation: draftInterp,
        name: draftName.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }, [draftX, draftY, draftZoom, draftInterp, draftName, onSave]);

  const handleRevert = useCallback(() => {
    setDraftX(String(keyframe.x));
    setDraftY(String(keyframe.y));
    setDraftZoom(String(keyframe.zoom));
    setDraftInterp(keyframe.interpolation);
    setDraftName(keyframe.name ?? '');
  }, [keyframe]);

  return (
    <div className="camkf-editor">
      <div className="camkf-editor-title">
        Key @ tick {keyframe.tick}
      </div>
      <div className="camkf-editor-fields">
        <label className="camkf-field camkf-field-wide">
          <span className="camkf-field-label">Name</span>
          <input
            type="text"
            className="camkf-field-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="(unnamed)"
          />
        </label>
        <label className="camkf-field">
          <span className="camkf-field-label">X</span>
          <input
            type="number"
            className="camkf-field-input"
            value={draftX}
            onChange={(e) => setDraftX(e.target.value)}
            step="1"
          />
        </label>
        <label className="camkf-field">
          <span className="camkf-field-label">Y</span>
          <input
            type="number"
            className="camkf-field-input"
            value={draftY}
            onChange={(e) => setDraftY(e.target.value)}
            step="1"
          />
        </label>
        <label className="camkf-field">
          <span className="camkf-field-label">Zoom</span>
          <input
            type="number"
            className="camkf-field-input"
            value={draftZoom}
            onChange={(e) => setDraftZoom(e.target.value)}
            step="0.1"
            min="0.1"
            max="10"
          />
        </label>
        <div className="camkf-field">
          <span className="camkf-field-label">Interp</span>
          <div className="camkf-interp-toggle">
            <button
              className={`camkf-interp-opt ${draftInterp === 'linear' ? 'active' : ''}`}
              onClick={() => setDraftInterp('linear')}
              title="Linear — blends toward next key"
            >
              Linear
            </button>
            <button
              className={`camkf-interp-opt ${draftInterp === 'hold' ? 'active' : ''}`}
              onClick={() => setDraftInterp('hold')}
              title="Hold — keeps this value until next key"
            >
              Hold
            </button>
          </div>
        </div>
      </div>
      <div className="camkf-editor-actions">
        <button
          className="camkf-btn camkf-btn-primary"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          className="camkf-btn"
          onClick={handleRevert}
          disabled={!isDirty}
        >
          Revert
        </button>
        <button
          className="camkf-btn camkf-btn-danger"
          onClick={onDelete}
        >
          Delete Key
        </button>
      </div>
    </div>
  );
}
