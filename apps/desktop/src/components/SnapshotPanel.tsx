import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSnapshotStore, useCanvasViewStore } from '@glyphstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

export function SnapshotPanel() {
  const snapshots = useSnapshotStore((s) => s.snapshots);
  const createSnapshot = useSnapshotStore((s) => s.createSnapshot);
  const deleteSnapshot = useSnapshotStore((s) => s.deleteSnapshot);
  const renameSnapshot = useSnapshotStore((s) => s.renameSnapshot);
  const clearAll = useSnapshotStore((s) => s.clearAll);

  const compareSnapshotId = useCanvasViewStore((s) => s.compareSnapshotId);
  const setCompareSnapshot = useCanvasViewStore((s) => s.setCompareSnapshot);

  const frame = useCanvasFrameStore((s) => s.frame);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCapture = useCallback(() => {
    if (!frame) return;
    const name = `Snapshot ${snapshots.length + 1}`;
    createSnapshot(name, frame.width, frame.height, frame.data);
  }, [frame, snapshots.length, createSnapshot]);

  const handleRestore = useCallback(
    async (snapId: string) => {
      const snap = snapshots.find((s) => s.id === snapId);
      if (!snap) return;
      // Exit compare mode when restoring
      if (compareSnapshotId) setCompareSnapshot(null);
      try {
        const restored = await invoke<CanvasFrameData>('restore_pixels', {
          pixelData: snap.data,
        });
        setFrame(restored);
        syncLayersFromFrame(restored);
      } catch {
        // If the backend command doesn't exist yet, apply client-side
        if (frame) {
          const updated: CanvasFrameData = {
            ...frame,
            data: [...snap.data],
          };
          setFrame(updated);
        }
      }
    },
    [snapshots, frame, setFrame, compareSnapshotId, setCompareSnapshot],
  );

  const handleToggleCompare = useCallback(
    (snapId: string) => {
      if (compareSnapshotId === snapId) {
        setCompareSnapshot(null);
      } else {
        setCompareSnapshot(snapId);
      }
    },
    [compareSnapshotId, setCompareSnapshot],
  );

  const handleDelete = useCallback(
    (snapId: string) => {
      // Exit compare if deleting the compared snapshot
      if (compareSnapshotId === snapId) setCompareSnapshot(null);
      deleteSnapshot(snapId);
    },
    [compareSnapshotId, setCompareSnapshot, deleteSnapshot],
  );

  const handleClearAll = useCallback(() => {
    if (compareSnapshotId) setCompareSnapshot(null);
    clearAll();
  }, [compareSnapshotId, setCompareSnapshot, clearAll]);

  const handleStartRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  }, []);

  const handleCommitRename = useCallback(() => {
    if (renamingId) {
      renameSnapshot(renamingId, renameValue);
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renameSnapshot]);

  return (
    <div className="snapshot-panel">
      <div className="snapshot-panel-header">
        <span className="snapshot-panel-title">Snapshots</span>
        <div className="snapshot-panel-header-actions">
          {compareSnapshotId && (
            <button
              className="snapshot-compare-exit-btn"
              onClick={() => setCompareSnapshot(null)}
              title="Exit compare mode"
            >
              Exit Compare
            </button>
          )}
          <button
            className="snapshot-capture-btn"
            onClick={handleCapture}
            disabled={!frame}
            title="Capture current canvas state"
          >
            Capture
          </button>
          {snapshots.length > 0 && (
            <button
              className="snapshot-clear-btn"
              onClick={handleClearAll}
              title="Clear all snapshots"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {compareSnapshotId && (
        <div className="snapshot-compare-banner">
          Comparing: {snapshots.find((s) => s.id === compareSnapshotId)?.name ?? 'Unknown'}
        </div>
      )}
      <div className="snapshot-list">
        {snapshots.length === 0 && (
          <div className="snapshot-empty">
            No snapshots yet. Click Capture to save the current canvas state.
          </div>
        )}
        {snapshots.map((snap) => {
          const isComparing = compareSnapshotId === snap.id;
          return (
            <div key={snap.id} className={`snapshot-item ${isComparing ? 'comparing' : ''}`}>
              <div className="snapshot-item-info">
                {renamingId === snap.id ? (
                  <input
                    className="snapshot-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="snapshot-name"
                    onDoubleClick={() => handleStartRename(snap.id, snap.name)}
                    title="Double-click to rename"
                  >
                    {snap.name}
                  </span>
                )}
                <span className="snapshot-meta">
                  {snap.width}{'\u00d7'}{snap.height}
                </span>
              </div>
              <div className="snapshot-item-actions">
                <button
                  className={`snapshot-compare-btn ${isComparing ? 'active' : ''}`}
                  onClick={() => handleToggleCompare(snap.id)}
                  title={isComparing ? 'Exit compare' : 'Compare with current canvas'}
                >
                  {isComparing ? 'Live' : 'Compare'}
                </button>
                <button
                  className="snapshot-restore-btn"
                  onClick={() => handleRestore(snap.id)}
                  title="Restore this snapshot to canvas"
                >
                  Restore
                </button>
                <button
                  className="snapshot-delete-btn"
                  onClick={() => handleDelete(snap.id)}
                  title="Delete snapshot"
                >
                  {'\u00d7'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
