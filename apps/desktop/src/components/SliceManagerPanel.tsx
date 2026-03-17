import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSliceStore, useCanvasViewStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import type { CanvasFrameData } from '../lib/canvasFrameStore';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { useProjectStore } from '@glyphstudio/state';

export function SliceManagerPanel() {
  const sliceRegions = useSliceStore((s) => s.sliceRegions);
  const selectedSliceId = useSliceStore((s) => s.selectedSliceId);
  const setSelectedSliceId = useSliceStore((s) => s.setSelectedSliceId);
  const setHoveredSliceId = useSliceStore((s) => s.setHoveredSliceId);
  const setSliceRegions = useSliceStore((s) => s.setSliceRegions);
  const selectionBounds = useSelectionStore((s) => s.selectionBounds);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
  const setPan = useCanvasViewStore((s) => s.setPan);

  /** Pan canvas so the given slice region is centered in the viewport. */
  const focusSlice = useCallback((region: typeof sliceRegions[number]) => {
    const { frame } = useCanvasFrameStore.getState();
    const { zoom } = useCanvasViewStore.getState();
    if (!frame) return;
    const sliceCenterX = region.x + region.width / 2;
    const sliceCenterY = region.y + region.height / 2;
    // pan = zoom * (frameCenter - sliceCenter)
    const newPanX = zoom * (frame.width / 2 - sliceCenterX);
    const newPanY = zoom * (frame.height / 2 - sliceCenterY);
    setPan(newPanX, newPanY);
  }, [setPan]);

  const reload = useCallback(() => {
    invoke<typeof sliceRegions>('list_slice_regions')
      .then(setSliceRegions)
      .catch(() => {});
  }, [setSliceRegions]);

  const handleCreateFromSelection = useCallback(async () => {
    if (!selectionBounds) return;
    const { x, y, width, height } = selectionBounds;
    const count = sliceRegions.length + 1;
    try {
      const f = await invoke<CanvasFrameData>('create_slice_region', {
        name: `slice_${count}`,
        x, y, width, height,
      });
      setFrame(f);
      syncLayersFromFrame(f);
      markDirty();
      invoke('mark_dirty').catch(() => {});
      reload();
    } catch {
      // silently ignore
    }
  }, [selectionBounds, sliceRegions.length, setFrame, markDirty, reload]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const f = await invoke<CanvasFrameData>('delete_slice_region', { id });
      setFrame(f);
      syncLayersFromFrame(f);
      markDirty();
      invoke('mark_dirty').catch(() => {});
      if (selectedSliceId === id) setSelectedSliceId(null);
      reload();
    } catch {
      // silently ignore
    }
  }, [selectedSliceId, setSelectedSliceId, setFrame, markDirty, reload]);

  const handleClearAll = useCallback(async () => {
    try {
      const f = await invoke<CanvasFrameData>('clear_slice_regions');
      setFrame(f);
      syncLayersFromFrame(f);
      markDirty();
      invoke('mark_dirty').catch(() => {});
      setSelectedSliceId(null);
      setSliceRegions([]);
    } catch {
      // silently ignore
    }
  }, [setFrame, markDirty, setSelectedSliceId, setSliceRegions]);

  return (
    <div className="slice-manager-panel">
      <div className="slice-manager-toolbar">
        <button
          className="slice-toolbar-btn"
          onClick={handleCreateFromSelection}
          disabled={!selectionBounds}
          title={selectionBounds ? 'Create slice from current selection' : 'Make a selection first'}
          data-testid="slice-create-from-sel-btn"
        >
          + From Sel
        </button>
        {sliceRegions.length > 0 && (
          <button
            className="slice-toolbar-btn slice-toolbar-btn--danger"
            onClick={handleClearAll}
            title="Delete all slices"
            data-testid="slice-clear-all-btn"
          >
            Clear All
          </button>
        )}
      </div>

      {sliceRegions.length === 0 ? (
        <div className="slice-empty-state" data-testid="slice-empty-state">
          <span>No slices yet.</span>
          <span className="slice-empty-hint">Use the Slice tool or select a region and click + From Sel.</span>
        </div>
      ) : (
        <ul className="slice-list" data-testid="slice-list">
          {sliceRegions.map((s) => (
            <li
              key={s.id}
              className={`slice-list-item${selectedSliceId === s.id ? ' active' : ''}`}
              onClick={() => {
                const nextId = selectedSliceId === s.id ? null : s.id;
                setSelectedSliceId(nextId);
                if (nextId) focusSlice(s);
              }}
              onMouseEnter={() => setHoveredSliceId(s.id)}
              onMouseLeave={() => setHoveredSliceId(null)}
              data-testid={`slice-item-${s.id}`}
            >
              <span className="slice-item-name" title={s.name}>{s.name}</span>
              <span className="slice-item-dims">{s.width}×{s.height}</span>
              <span className="slice-item-pos">({s.x},{s.y})</span>
              <button
                className="slice-item-delete"
                onClick={(e) => handleDelete(s.id, e)}
                title={`Delete ${s.name}`}
                data-testid={`slice-delete-${s.id}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
