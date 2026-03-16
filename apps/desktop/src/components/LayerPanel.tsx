import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLayerStore, useProjectStore } from '@glyphstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

export function LayerPanel() {
  const rootLayerIds = useLayerStore((s) => s.rootLayerIds);
  const layerById = useLayerStore((s) => s.layerById);
  const layers = useMemo(
    () => rootLayerIds.map((id) => layerById[id]).filter(Boolean),
    [rootLayerIds, layerById],
  );
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
  const toggleSketch = useLayerStore((s) => s.toggleSketch);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const applyFrame = useCallback(
    (frame: CanvasFrameData) => {
      setFrame(frame);
      syncLayersFromFrame(frame);
    },
    [setFrame],
  );

  /** Mark project dirty on both frontend store and backend. */
  const notifyDirty = useCallback(() => {
    markDirty();
    invoke('mark_dirty').catch(() => {});
  }, [markDirty]);

  const handleSelectLayer = useCallback(
    async (layerId: string) => {
      try {
        const frame = await invoke<CanvasFrameData>('select_layer', { layerId });
        applyFrame(frame);
      } catch (err) {
        console.error('select_layer failed:', err);
      }
    },
    [applyFrame],
  );

  const handleToggleVisibility = useCallback(
    async (layerId: string, currentVisible: boolean) => {
      try {
        const frame = await invoke<CanvasFrameData>('set_layer_visibility', {
          layerId,
          visible: !currentVisible,
        });
        applyFrame(frame);
        notifyDirty();
      } catch (err) {
        console.error('set_layer_visibility failed:', err);
      }
    },
    [applyFrame, notifyDirty],
  );

  const handleToggleLock = useCallback(
    async (layerId: string, currentLocked: boolean) => {
      try {
        const frame = await invoke<CanvasFrameData>('set_layer_lock', {
          layerId,
          locked: !currentLocked,
        });
        applyFrame(frame);
        notifyDirty();
      } catch (err) {
        console.error('set_layer_lock failed:', err);
      }
    },
    [applyFrame, notifyDirty],
  );

  const handleAddLayer = useCallback(async () => {
    try {
      const frame = await invoke<CanvasFrameData>('create_layer', { name: null });
      applyFrame(frame);
      notifyDirty();
    } catch (err) {
      console.error('create_layer failed:', err);
    }
  }, [applyFrame, notifyDirty]);

  const handleAddSketchLayer = useCallback(async () => {
    try {
      const frame = await invoke<CanvasFrameData>('create_layer', { name: 'Sketch' });
      applyFrame(frame);
      // The new layer is now active — mark it as sketch
      const newId = frame.activeLayerId;
      if (newId) {
        toggleSketch(newId);
      }
      notifyDirty();
    } catch (err) {
      console.error('create_layer (sketch) failed:', err);
    }
  }, [applyFrame, notifyDirty, toggleSketch]);

  const handleToggleSketch = useCallback(
    (layerId: string) => {
      toggleSketch(layerId);
      notifyDirty();
    },
    [toggleSketch, notifyDirty],
  );

  const handleDeleteLayer = useCallback(
    async (layerId: string) => {
      try {
        const frame = await invoke<CanvasFrameData>('delete_layer', { layerId });
        applyFrame(frame);
        notifyDirty();
      } catch (err) {
        console.error('delete_layer failed:', err);
      }
    },
    [applyFrame, notifyDirty],
  );

  const handleSetOpacity = useCallback(
    async (layerId: string, opacity: number) => {
      try {
        const frame = await invoke<CanvasFrameData>('set_layer_opacity', {
          layerId,
          opacity,
        });
        applyFrame(frame);
        notifyDirty();
      } catch (err) {
        console.error('set_layer_opacity failed:', err);
      }
    },
    [applyFrame, notifyDirty],
  );

  const handleStartRename = useCallback((layerId: string, currentName: string) => {
    setRenamingId(layerId);
    setRenameValue(currentName);
  }, []);

  const handleCommitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      const frame = await invoke<CanvasFrameData>('rename_layer', {
        layerId: renamingId,
        name: renameValue.trim(),
      });
      applyFrame(frame);
      notifyDirty();
    } catch (err) {
      console.error('rename_layer failed:', err);
    }
    setRenamingId(null);
  }, [renamingId, renameValue, applyFrame, notifyDirty]);

  // Display top-to-bottom (reverse since bottom layer = index 0 in Rust)
  const displayLayers = [...layers].reverse();

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span className="layer-panel-title">Layers</span>
        <div className="layer-panel-header-actions">
          <button
            className="layer-panel-add sketch"
            onClick={handleAddSketchLayer}
            title="Add sketch layer (excluded from export)"
          >
            S+
          </button>
          <button className="layer-panel-add" onClick={handleAddLayer} title="Add layer">
            +
          </button>
        </div>
      </div>
      <div className="layer-panel-list">
        {displayLayers.map((layer) => {
          if (!layer) return null;
          const isActive = layer.id === activeLayerId;
          const isSketch = layer.type === 'sketch';
          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? 'active' : ''} ${isSketch ? 'sketch' : ''}`}
              onClick={() => handleSelectLayer(layer.id)}
            >
              <button
                className={`layer-vis ${layer.visible ? 'on' : 'off'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleVisibility(layer.id, layer.visible);
                }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? '\u25c9' : '\u25cb'}
              </button>
              <button
                className={`layer-lock ${layer.locked ? 'on' : 'off'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLock(layer.id, layer.locked);
                }}
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              >
                {layer.locked ? '\u{1f512}' : '\u{1f513}'}
              </button>
              {renamingId === layer.id ? (
                <input
                  className="layer-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="layer-name"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(layer.id, layer.name);
                  }}
                >
                  {isSketch && <span className="layer-sketch-badge" title="Sketch layer (excluded from export)">S</span>}
                  {layer.name}
                </span>
              )}
              {layers.length > 1 && (
                <button
                  className="layer-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLayer(layer.id);
                  }}
                  title="Delete layer"
                >
                  {'\u00d7'}
                </button>
              )}
              {isActive && (
                <div className="layer-active-controls" onClick={(e) => e.stopPropagation()}>
                  <div className="layer-opacity">
                    <input
                      type="range"
                      className="layer-opacity-slider"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(layer.opacity * 100)}
                      onChange={(e) =>
                        handleSetOpacity(layer.id, Number(e.target.value) / 100)
                      }
                      title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                    />
                    <span className="layer-opacity-value">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                  <button
                    className={`layer-sketch-toggle ${isSketch ? 'on' : ''}`}
                    onClick={() => handleToggleSketch(layer.id)}
                    title={isSketch ? 'Convert to normal layer' : 'Convert to sketch layer'}
                  >
                    {isSketch ? 'Sketch' : 'Normal'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
