import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLayerStore, useProjectStore } from '@pixelstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

export function LayerPanel() {
  const layers = useLayerStore((s) => s.rootLayerIds.map((id) => s.layerById[id]).filter(Boolean));
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
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
        <button className="layer-panel-add" onClick={handleAddLayer} title="Add layer">
          +
        </button>
      </div>
      <div className="layer-panel-list">
        {displayLayers.map((layer) => {
          if (!layer) return null;
          const isActive = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? 'active' : ''}`}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
