import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '@pixelstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

interface RecoverableProject {
  projectId: string;
  name: string;
  recoveryPath: string;
  updatedAt: string;
}

interface ProjectInfo {
  projectId: string;
  name: string;
  filePath: string | null;
  isDirty: boolean;
  frame: CanvasFrameData;
}

interface RecoveryPromptProps {
  items: RecoverableProject[];
  onDone: () => void;
}

export function RecoveryPrompt({ items, onDone }: RecoveryPromptProps) {
  const [loading, setLoading] = useState(false);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const setProject = useProjectStore((s) => s.setProject);

  const [error, setError] = useState<string | null>(null);

  const handleRestore = useCallback(async (item: RecoverableProject) => {
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<ProjectInfo>('restore_recovery', {
        projectId: item.projectId,
      });
      setFrame(info.frame);
      syncLayersFromFrame(info.frame);
      setProject(
        info.projectId,
        info.name,
        info.filePath,
        'rgb',
        info.frame.width,
        info.frame.height,
      );
      // Discard remaining recovery items
      for (const other of items) {
        if (other.projectId !== item.projectId) {
          invoke('discard_recovery', { projectId: other.projectId }).catch(() => {});
        }
      }
      onDone();
    } catch (err) {
      console.error('Recovery restore failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [items, onDone, setFrame, setProject]);

  const handleDiscardAll = async () => {
    for (const item of items) {
      await invoke('discard_recovery', { projectId: item.projectId }).catch(() => {});
    }
    onDone();
  };

  return (
    <div className="recovery-prompt">
      <div className="recovery-dialog">
        <h2>Recover Unsaved Work</h2>
        <p>Found unsaved work from a previous session:</p>
        {error && <p className="recovery-error">Restore failed: {error}</p>}
        <ul className="recovery-list">
          {items.map((item) => (
            <li key={item.projectId} className="recovery-item">
              <div className="recovery-item-info">
                <span className="recovery-item-name">{item.name}</span>
                <span className="recovery-item-date">
                  {new Date(item.updatedAt).toLocaleString()}
                </span>
              </div>
              <button
                className="recovery-restore-btn"
                onClick={() => handleRestore(item)}
                disabled={loading}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
        <div className="recovery-actions">
          <button
            className="recovery-discard-btn"
            onClick={handleDiscardAll}
            disabled={loading}
          >
            Discard All
          </button>
        </div>
      </div>
    </div>
  );
}
