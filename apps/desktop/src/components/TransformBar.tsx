/**
 * TransformBar — context-sensitive toolbar for selection transforms.
 *
 * Appears when `isTransforming` is true. Provides flip/rotate buttons
 * and commit/cancel actions. All transforms call existing Tauri
 * commands — no duplicate logic.
 */

import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSelectionStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';
import type { CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { useProjectStore } from '@glyphstudio/state';

interface TransformResult {
  sourceX: number;
  sourceY: number;
  payloadWidth: number;
  payloadHeight: number;
  offsetX: number;
  offsetY: number;
  payloadData: number[];
  frame: CanvasFrameData;
}

export function TransformBar() {
  const isTransforming = useSelectionStore((s) => s.isTransforming);
  const setTransform = useSelectionStore((s) => s.setTransform);
  const clearTransform = useSelectionStore((s) => s.clearTransform);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
  const [error, setError] = useState('');

  const applyTransform = useCallback(async (command: string) => {
    setError('');
    try {
      const result = await invoke<TransformResult>(command);
      setTransform({
        sourceX: result.sourceX,
        sourceY: result.sourceY,
        payloadWidth: result.payloadWidth,
        payloadHeight: result.payloadHeight,
        offsetX: result.offsetX,
        offsetY: result.offsetY,
        payloadData: result.payloadData,
      });
    } catch (err) {
      setError(String(err));
    }
  }, [setTransform]);

  const handleCommit = useCallback(async () => {
    setError('');
    try {
      const f = await invoke<CanvasFrameData>('commit_selection_transform');
      setFrame(f);
      syncLayersFromFrame(f);
      clearTransform();
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) {
      setError(String(err));
    }
  }, [setFrame, clearTransform, markDirty]);

  const handleCancel = useCallback(async () => {
    setError('');
    try {
      const f = await invoke<CanvasFrameData>('cancel_selection_transform');
      setFrame(f);
      syncLayersFromFrame(f);
      clearTransform();
    } catch (err) {
      setError(String(err));
    }
  }, [setFrame, clearTransform]);

  if (!isTransforming) return null;

  return (
    <div className="transform-bar">
      <span className="transform-bar-label">Transform</span>
      <div className="transform-bar-actions">
        <button
          className="transform-bar-btn"
          onClick={() => applyTransform('flip_selection_horizontal')}
          title="Flip horizontal (H)"
        >
          Flip H
        </button>
        <button
          className="transform-bar-btn"
          onClick={() => applyTransform('flip_selection_vertical')}
          title="Flip vertical (V)"
        >
          Flip V
        </button>
        <span className="transform-bar-sep" />
        <button
          className="transform-bar-btn"
          onClick={() => applyTransform('rotate_selection_90_cw')}
          title="Rotate 90\u00b0 CW (R)"
        >
          Rot CW
        </button>
        <button
          className="transform-bar-btn"
          onClick={() => applyTransform('rotate_selection_90_ccw')}
          title="Rotate 90\u00b0 CCW (Shift+R)"
        >
          Rot CCW
        </button>
      </div>
      <div className="transform-bar-commit">
        <button
          className="transform-bar-btn transform-bar-commit-btn"
          onClick={handleCommit}
          title="Commit transform (Enter)"
        >
          Commit
        </button>
        <button
          className="transform-bar-btn transform-bar-cancel-btn"
          onClick={handleCancel}
          title="Cancel transform (Esc)"
        >
          Cancel
        </button>
      </div>
      {error && <span className="transform-bar-error">{error}</span>}
    </div>
  );
}
