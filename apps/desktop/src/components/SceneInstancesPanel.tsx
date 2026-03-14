import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SceneAssetInstance, ScenePlaybackState, SourceClipInfo } from '@pixelstudio/domain';
import { useScenePlaybackStore, useProjectStore } from '@pixelstudio/state';

export function SceneInstancesPanel() {
  const [instances, setInstances] = useState<SceneAssetInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const setPlaybackState = useScenePlaybackStore((s) => s.setPlaybackState);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<SceneAssetInstance[]>('get_scene_instances');
      setInstances(result);
      // Also refresh playback state for clip resolution
      const ps = await invoke<ScenePlaybackState>('get_scene_playback_state');
      setPlaybackState(ps);
    } catch {
      setInstances([]);
    }
  }, [setPlaybackState]);

  useEffect(() => { refresh(); }, [refresh]);

  // Periodic refresh to stay in sync with scene canvas
  useEffect(() => {
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const notifyDirty = useCallback(() => {
    useProjectStore.getState().markDirty();
    invoke('mark_dirty').catch(() => {});
  }, []);

  const handleVisibility = useCallback(async (instanceId: string, visible: boolean) => {
    try {
      await invoke('set_scene_instance_visibility', { instanceId, visible });
      notifyDirty();
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [refresh, notifyDirty]);

  const handleOpacity = useCallback(async (instanceId: string, opacity: number) => {
    try {
      await invoke('set_scene_instance_opacity', { instanceId, opacity });
      notifyDirty();
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [refresh, notifyDirty]);

  const handleBringForward = useCallback(async (instanceId: string) => {
    const inst = instances.find((i) => i.instanceId === instanceId);
    if (!inst) return;
    const maxZ = Math.max(...instances.map((i) => i.zOrder));
    if (inst.zOrder >= maxZ) return;
    try {
      await invoke('set_scene_instance_layer', { instanceId, zOrder: inst.zOrder + 1 });
      notifyDirty();
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [instances, refresh, notifyDirty]);

  const handleSendBackward = useCallback(async (instanceId: string) => {
    const inst = instances.find((i) => i.instanceId === instanceId);
    if (!inst) return;
    const minZ = Math.min(...instances.map((i) => i.zOrder));
    if (inst.zOrder <= minZ) return;
    try {
      await invoke('set_scene_instance_layer', { instanceId, zOrder: inst.zOrder - 1 });
      notifyDirty();
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [instances, refresh, notifyDirty]);

  const handleRemove = useCallback(async (instanceId: string) => {
    try {
      await invoke('remove_scene_instance', { instanceId });
      if (selectedId === instanceId) setSelectedId(null);
      notifyDirty();
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [selectedId, refresh, notifyDirty]);

  // Sort by z-order descending (top items first in list)
  const sorted = [...instances].sort((a, b) => b.zOrder - a.zOrder);

  if (instances.length === 0) {
    return (
      <div className="scene-instances-panel">
        <div className="scene-instances-header">
          <span className="scene-instances-title">Instances</span>
        </div>
        <div className="scene-instances-empty">
          No instances in scene. Use "Add Asset" on the canvas.
        </div>
      </div>
    );
  }

  return (
    <div className="scene-instances-panel">
      <div className="scene-instances-header">
        <span className="scene-instances-title">Instances</span>
        <span className="scene-instances-count">{instances.length}</span>
      </div>

      {error && <span className="scene-instances-error">{error}</span>}

      <div className="scene-instances-list">
        {sorted.map((inst) => {
          const isSelected = selectedId === inst.instanceId;
          return (
            <div
              key={inst.instanceId}
              className={`scene-instance-row ${isSelected ? 'scene-instance-row-selected' : ''} ${!inst.visible ? 'scene-instance-row-hidden' : ''}`}
              onClick={() => setSelectedId(inst.instanceId)}
            >
              <div className="scene-instance-row-info">
                <span className="scene-instance-row-name">{inst.name}</span>
                <span className="scene-instance-row-pos">({inst.x}, {inst.y}) z{inst.zOrder}</span>
              </div>
              <div className="scene-instance-row-controls">
                <button
                  className="scene-instance-ctrl-btn"
                  title={inst.visible ? 'Hide' : 'Show'}
                  onClick={(e) => { e.stopPropagation(); handleVisibility(inst.instanceId, !inst.visible); }}
                >
                  {inst.visible ? '\u25C9' : '\u25CB'}
                </button>
                <button
                  className="scene-instance-ctrl-btn"
                  title="Bring forward"
                  onClick={(e) => { e.stopPropagation(); handleBringForward(inst.instanceId); }}
                >
                  {'\u25B2'}
                </button>
                <button
                  className="scene-instance-ctrl-btn"
                  title="Send backward"
                  onClick={(e) => { e.stopPropagation(); handleSendBackward(inst.instanceId); }}
                >
                  {'\u25BC'}
                </button>
                <button
                  className="scene-instance-ctrl-btn scene-instance-remove-btn"
                  title="Remove instance"
                  onClick={(e) => { e.stopPropagation(); handleRemove(inst.instanceId); }}
                >
                  {'\u00D7'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected instance detail with clip picker */}
      {selectedId && (() => {
        const inst = instances.find((i) => i.instanceId === selectedId);
        if (!inst) return null;
        return (
          <InstanceDetailPane
            instance={inst}
            onOpacityChange={handleOpacity}
            onParallaxChange={async (instanceId, parallax) => {
              try {
                await invoke('set_scene_instance_parallax', { instanceId, parallax });
                notifyDirty();
                refresh();
              } catch (err) {
                setError(String(err));
              }
            }}
            onClipChange={async (instanceId, clipId) => {
              try {
                await invoke('set_scene_instance_clip', { instanceId, clipId });
                notifyDirty();
                refresh();
              } catch (err) {
                setError(String(err));
              }
            }}
          />
        );
      })()}
    </div>
  );
}

/** Detail pane for the selected instance — includes clip picker. */
function InstanceDetailPane({
  instance,
  onOpacityChange,
  onParallaxChange,
  onClipChange,
}: {
  instance: SceneAssetInstance;
  onOpacityChange: (instanceId: string, opacity: number) => void;
  onParallaxChange: (instanceId: string, parallax: number) => void;
  onClipChange: (instanceId: string, clipId: string | null) => void;
}) {
  const [sourceClips, setSourceClips] = useState<SourceClipInfo[]>([]);
  const [clipsLoaded, setClipsLoaded] = useState(false);

  const ps = useScenePlaybackStore((s) => s.playbackState);
  const clipState = ps?.instances.find((c) => c.instanceId === instance.instanceId);
  const clipStatus = clipState?.status ?? 'no_clip';
  const clipStatusClass = clipStatus === 'resolved' ? 'clip-ok'
    : clipStatus === 'no_clip' ? 'clip-none'
    : 'clip-warn';

  // Load available clips from source asset
  useEffect(() => {
    setClipsLoaded(false);
    invoke<SourceClipInfo[]>('list_source_clips', { sourcePath: instance.sourcePath })
      .then((clips) => {
        setSourceClips(clips);
        setClipsLoaded(true);
      })
      .catch(() => {
        setSourceClips([]);
        setClipsLoaded(true);
      });
  }, [instance.sourcePath]);

  const handleClipSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onClipChange(instance.instanceId, val === '' ? null : val);
  }, [instance.instanceId, onClipChange]);

  const statusLabel = clipStatus === 'resolved' ? ''
    : clipStatus === 'missing_clip' ? ' (missing)'
    : clipStatus === 'missing_source' ? ' (source missing)'
    : clipStatus === 'no_clips_in_source' ? ' (no clips)'
    : '';

  return (
    <div className="scene-instance-detail">
      <div className="scene-instance-detail-row">
        <span className="scene-instance-detail-label">Source</span>
        <span className="scene-instance-detail-path" title={instance.sourcePath}>
          {instance.sourcePath.split(/[\\/]/).pop()}
        </span>
      </div>

      <div className="scene-instance-detail-row">
        <span className="scene-instance-detail-label">Clip</span>
        {clipsLoaded && sourceClips.length > 0 ? (
          <select
            className={`scene-clip-picker ${clipStatusClass}`}
            value={instance.clipId ?? ''}
            onChange={handleClipSelect}
          >
            <option value="">No clip (static)</option>
            {sourceClips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.frameCount}f{c.loopClip ? ', loop' : ''})
              </option>
            ))}
          </select>
        ) : clipsLoaded ? (
          <span className={`scene-instance-clip-value ${clipStatusClass}`}>
            no clips available{statusLabel}
          </span>
        ) : (
          <span className="scene-instance-clip-value clip-none">loading...</span>
        )}
      </div>

      {clipStatus !== 'no_clip' && clipStatus !== 'resolved' && (
        <div className="scene-instance-detail-row">
          <span className="scene-instance-detail-label" />
          <span className="scene-instance-clip-warning">{statusLabel.trim()}</span>
        </div>
      )}

      <div className="scene-instance-detail-row">
        <span className="scene-instance-detail-label">Opacity</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(instance.opacity * 100)}
          onChange={(e) => onOpacityChange(instance.instanceId, parseInt(e.target.value) / 100)}
          className="scene-instance-opacity-slider"
        />
        <span className="scene-instance-opacity-value">{Math.round(instance.opacity * 100)}%</span>
      </div>

      <div className="scene-instance-detail-row">
        <span className="scene-instance-detail-label">Depth</span>
        <input
          type="range"
          min="10"
          max="300"
          value={Math.round((instance.parallax ?? 1.0) * 100)}
          onChange={(e) => onParallaxChange(instance.instanceId, parseInt(e.target.value) / 100)}
          className="scene-instance-parallax-slider"
        />
        <span className="scene-instance-parallax-value">{(instance.parallax ?? 1.0).toFixed(1)}</span>
      </div>
      <div className="scene-instance-detail-row scene-parallax-presets">
        <span className="scene-instance-detail-label" />
        <button
          className={`scene-parallax-preset ${(instance.parallax ?? 1.0) === 0.5 ? 'active' : ''}`}
          onClick={() => onParallaxChange(instance.instanceId, 0.5)}
        >BG</button>
        <button
          className={`scene-parallax-preset ${(instance.parallax ?? 1.0) === 1.0 ? 'active' : ''}`}
          onClick={() => onParallaxChange(instance.instanceId, 1.0)}
        >MG</button>
        <button
          className={`scene-parallax-preset ${(instance.parallax ?? 1.0) === 1.5 ? 'active' : ''}`}
          onClick={() => onParallaxChange(instance.instanceId, 1.5)}
        >FG</button>
        <span className="scene-parallax-hint">
          {(instance.parallax ?? 1.0) < 1.0 ? 'background' : (instance.parallax ?? 1.0) > 1.0 ? 'foreground' : 'normal'}
        </span>
      </div>
    </div>
  );
}
