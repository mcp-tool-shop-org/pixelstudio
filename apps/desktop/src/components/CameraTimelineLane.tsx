import { useCallback, useMemo } from 'react';
import {
  useScenePlaybackStore,
  deriveShotsFromCameraKeyframes,
  deriveCameraTimelineMarkers,
  findCurrentCameraShotAtTick,
} from '@pixelstudio/state';
import type { CameraTimelineMarker } from '@pixelstudio/state';
import type { SceneCameraShot } from '@pixelstudio/domain';

/**
 * Camera timeline lane — renders keyframe markers and shot span bars
 * within the scene timeline. Click markers/shots to select and navigate.
 */
export function CameraTimelineLane() {
  const cameraKeyframes = useScenePlaybackStore((s) => s.cameraKeyframes);
  const totalTicks = useScenePlaybackStore((s) => s.totalTicks);
  const currentTick = useScenePlaybackStore((s) => s.currentTick);
  const selectedKeyframeTick = useScenePlaybackStore((s) => s.selectedKeyframeTick);
  const selectKeyframe = useScenePlaybackStore((s) => s.selectKeyframe);
  const seekToTick = useScenePlaybackStore((s) => s.seekToTick);

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
    // Select the starting keyframe for this shot
    const kf = cameraKeyframes.find((k) => k.tick === shot.startTick);
    if (kf) {
      selectKeyframe(kf.tick);
    }
    seekToTick(shot.startTick);
  }, [cameraKeyframes, selectKeyframe, seekToTick]);

  const hasKeyframes = markers.length > 0;

  return (
    <div className="cam-lane">
      <div className="cam-lane-header">
        <span className="cam-lane-label">{'\uD83C\uDFA5'} Camera</span>
        {currentShot && (
          <span className="cam-lane-current-shot" title={`Current: ${currentShot.name}`}>
            {currentShot.name}
          </span>
        )}
      </div>
      <div className="cam-lane-body">
        {!hasKeyframes ? (
          <div className="cam-lane-empty">No camera keyframes</div>
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
