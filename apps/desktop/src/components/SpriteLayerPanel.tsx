import { useState, useRef, useEffect } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';

export function SpriteLayerPanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const activeFrameIndex = useSpriteEditorStore((s) => s.activeFrameIndex);
  const activeLayerId = useSpriteEditorStore((s) => s.activeLayerId);
  const addLayer = useSpriteEditorStore((s) => s.addLayer);
  const removeLayer = useSpriteEditorStore((s) => s.removeLayer);
  const setActiveLayer = useSpriteEditorStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = useSpriteEditorStore((s) => s.toggleLayerVisibility);
  const renameLayer = useSpriteEditorStore((s) => s.renameLayer);
  const moveLayer = useSpriteEditorStore((s) => s.moveLayer);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  if (!doc) return null;

  const frame = doc.frames[activeFrameIndex];
  if (!frame) return null;

  // Display layers top-to-bottom (highest index = top of stack = first in list)
  const layersTopDown = [...frame.layers].reverse();

  const handleRenameStart = (layerId: string, currentName: string) => {
    setRenamingId(layerId);
    setRenameValue(currentName);
  };

  const handleRenameCommit = () => {
    if (renamingId && renameValue.trim()) {
      renameLayer(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameCommit();
    } else if (e.key === 'Escape') {
      setRenamingId(null);
    }
  };

  return (
    <div className="sprite-layer-panel" data-testid="sprite-layer-panel">
      <div className="sprite-layer-panel-header">
        <span className="sprite-layer-panel-title">Layers</span>
        <button
          className="sprite-layer-add-btn"
          onClick={addLayer}
          title="Add new layer"
          data-testid="add-layer-btn"
        >
          +
        </button>
      </div>
      <div className="sprite-layer-list" data-testid="sprite-layer-list">
        {layersTopDown.map((layer) => {
          const isActive = layer.id === activeLayerId;
          const originalIndex = frame.layers.findIndex((l) => l.id === layer.id);

          return (
            <div
              key={layer.id}
              className={`sprite-layer-item${isActive ? ' active' : ''}`}
              data-testid={`layer-item-${layer.id}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <button
                className={`sprite-layer-visibility${layer.visible ? ' visible' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                data-testid={`layer-visibility-${layer.id}`}
              >
                {layer.visible ? '👁' : '—'}
              </button>

              {renamingId === layer.id ? (
                <input
                  ref={renameInputRef}
                  className="sprite-layer-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameCommit}
                  onKeyDown={handleRenameKeyDown}
                  data-testid={`layer-rename-input-${layer.id}`}
                />
              ) : (
                <span
                  className="sprite-layer-name"
                  onDoubleClick={() => handleRenameStart(layer.id, layer.name)}
                  data-testid={`layer-name-${layer.id}`}
                >
                  {layer.name}
                </span>
              )}

              <div className="sprite-layer-actions">
                <button
                  className="sprite-layer-move-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(originalIndex, originalIndex + 1);
                  }}
                  disabled={originalIndex >= frame.layers.length - 1}
                  title="Move layer up"
                  data-testid={`layer-move-up-${layer.id}`}
                >
                  ▲
                </button>
                <button
                  className="sprite-layer-move-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(originalIndex, originalIndex - 1);
                  }}
                  disabled={originalIndex <= 0}
                  title="Move layer down"
                  data-testid={`layer-move-down-${layer.id}`}
                >
                  ▼
                </button>
                {frame.layers.length > 1 && (
                  <button
                    className="sprite-layer-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    title="Remove layer"
                    data-testid={`layer-remove-${layer.id}`}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
