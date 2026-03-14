import { useMemo } from 'react';
import {
  useScenePlaybackStore,
  deriveShotsFromCameraKeyframes,
  deriveCameraTimelineMarkers,
} from '@pixelstudio/state';
import type { CameraTimelineMarker } from '@pixelstudio/state';
import type { SceneCameraShot } from '@pixelstudio/domain';

/**
 * Camera timeline lane — renders keyframe markers and shot span bars
 * within the scene timeline. Read-only in this commit; interactions
 * come in Commit 3.
 */
export function CameraTimelineLane() {
  const cameraKeyframes = useScenePlaybackStore((s) => s.cameraKeyframes);
  const totalTicks = useScenePlaybackStore((s) => s.totalTicks);
  const currentTick = useScenePlaybackStore((s) => s.currentTick);

  const markers: CameraTimelineMarker[] = useMemo(
    () => deriveCameraTimelineMarkers(cameraKeyframes),
    [cameraKeyframes],
  );

  const shots: SceneCameraShot[] = useMemo(
    () => deriveShotsFromCameraKeyframes(cameraKeyframes, totalTicks),
    [cameraKeyframes, totalTicks],
  );

  const hasKeyframes = markers.length > 0;

  return (
    <div className="cam-lane">
      <div className="cam-lane-header">
        <span className="cam-lane-label">{'\uD83C\uDFA5'} Camera</span>
      </div>
      <div className="cam-lane-body">
        {!hasKeyframes ? (
          <div className="cam-lane-empty">No camera keyframes</div>
        ) : (
          <div className="cam-lane-track" style={{ position: 'relative' }}>
            {/* Shot span bars */}
            {shots.map((shot) => (
              <CamShotBar
                key={`shot-${shot.startTick}`}
                shot={shot}
                totalTicks={totalTicks}
                isCurrent={currentTick >= shot.startTick && currentTick < shot.endTick}
              />
            ))}
            {/* Keyframe markers */}
            {markers.map((marker) => (
              <CamMarker
                key={`kf-${marker.tick}`}
                marker={marker}
                totalTicks={totalTicks}
                isAtPlayhead={marker.tick === currentTick}
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
}: {
  shot: SceneCameraShot;
  totalTicks: number;
  isCurrent: boolean;
}) {
  const max = Math.max(1, totalTicks - 1);
  const left = (shot.startTick / max) * 100;
  const width = ((shot.endTick - shot.startTick) / max) * 100;

  return (
    <div
      className={`cam-lane-shot${isCurrent ? ' current' : ''}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${shot.name} (${shot.startTick}–${shot.endTick - 1})`}
    >
      <span className="cam-lane-shot-label">{shot.name}</span>
    </div>
  );
}

function CamMarker({
  marker,
  totalTicks,
  isAtPlayhead,
}: {
  marker: CameraTimelineMarker;
  totalTicks: number;
  isAtPlayhead: boolean;
}) {
  const max = Math.max(1, totalTicks - 1);
  const left = (marker.tick / max) * 100;

  return (
    <div
      className={`cam-lane-marker${isAtPlayhead ? ' at-playhead' : ''}`}
      style={{ left: `${left}%` }}
      title={marker.name ?? `Key @ ${marker.tick}`}
    />
  );
}
