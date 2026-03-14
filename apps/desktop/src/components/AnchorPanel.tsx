import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AnchorKind } from '@pixelstudio/domain';
import { ANCHOR_KIND_LABELS, ANCHOR_KIND_COLORS } from '@pixelstudio/domain';
import { useAnchorStore } from '@pixelstudio/state';
import { useSelectionStore } from '@pixelstudio/state';
import { useTimelineStore } from '@pixelstudio/state';
import { useProjectStore } from '@pixelstudio/state';
import type { PresetAnchor, PresetMotionSettings, PresetSaveResult } from '@pixelstudio/domain';

const ANCHOR_KINDS: AnchorKind[] = [
  'head', 'torso', 'arm_left', 'arm_right', 'leg_left', 'leg_right', 'custom',
];

interface AnchorResult {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
  parentName: string | null;
  falloffWeight: number;
}

type AnchorConflictPolicy = 'skip' | 'replace';

interface PropagateResult {
  copied: number;
  skipped: number;
  replaced: number;
  targetFrameCount: number;
}

function toAnchor(r: AnchorResult) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as AnchorKind,
    x: r.x,
    y: r.y,
    bounds: r.bounds,
    parentName: r.parentName ?? null,
    falloffWeight: r.falloffWeight ?? 1.0,
  };
}

export function AnchorPanel() {
  const anchors = useAnchorStore((s) => s.anchors);
  const selectedAnchorId = useAnchorStore((s) => s.selectedAnchorId);
  const overlayVisible = useAnchorStore((s) => s.overlayVisible);
  const setAnchors = useAnchorStore((s) => s.setAnchors);
  const addAnchor = useAnchorStore((s) => s.addAnchor);
  const removeAnchor = useAnchorStore((s) => s.removeAnchor);
  const selectAnchor = useAnchorStore((s) => s.selectAnchor);
  const toggleOverlay = useAnchorStore((s) => s.toggleOverlay);
  const hasSelection = useSelectionStore((s) => s.hasSelection);
  const activeFrameId = useTimelineStore((s) => s.activeFrameId);

  const [newKind, setNewKind] = useState<AnchorKind>('custom');
  const [error, setError] = useState<string | null>(null);
  const [propagateMsg, setPropagateMsg] = useState<string | null>(null);
  const [conflictPolicy, setConflictPolicy] = useState<AnchorConflictPolicy>('skip');
  const frames = useTimelineStore((s) => s.frames);

  // Refresh anchors when frame changes
  useEffect(() => {
    invoke<AnchorResult[]>('list_anchors')
      .then((results) => {
        setAnchors(results.map(toAnchor));
        setError(null);
      })
      .catch(() => {
        setAnchors([]);
      });
  }, [activeFrameId, setAnchors]);

  const handleCreate = useCallback(async () => {
    setError(null);
    try {
      // Place at center of canvas by default — user can drag/update
      const result = await invoke<AnchorResult>('create_anchor', {
        kind: newKind,
        x: 16,
        y: 16,
      });
      addAnchor(toAnchor(result));
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [newKind, addAnchor, notifyDirty]);

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    try {
      await invoke('delete_anchor', { anchorId: id });
      removeAnchor(id);
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [removeAnchor, notifyDirty]);

  const handleRename = useCallback(async (id: string, name: string) => {
    setError(null);
    try {
      await invoke<AnchorResult>('update_anchor', { anchorId: id, name });
      useAnchorStore.getState().updateAnchor(id, { name });
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [notifyDirty]);

  const handleBindSelection = useCallback(async (id: string) => {
    setError(null);
    try {
      const result = await invoke<AnchorResult>('bind_anchor_to_selection', { anchorId: id });
      useAnchorStore.getState().updateAnchor(id, { bounds: result.bounds });
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [notifyDirty]);

  const handleClearBinding = useCallback(async (id: string) => {
    setError(null);
    try {
      await invoke<AnchorResult>('clear_anchor_binding', { anchorId: id });
      useAnchorStore.getState().updateAnchor(id, { bounds: null });
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [notifyDirty]);

  // Keyboard nudge for selected anchor (arrow keys) and delete (Delete/Backspace)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedAnchorId) return;
      const sel = anchors.find((a) => a.id === selectedAnchorId);
      if (!sel) return;

      // Don't intercept if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') { dy = -1; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { dy = 1; e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { dx = -1; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { dx = 1; e.preventDefault(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete(selectedAnchorId);
        return;
      } else {
        return;
      }

      const newX = Math.max(0, sel.x + dx);
      const newY = Math.max(0, sel.y + dy);
      invoke<AnchorResult>('move_anchor', { anchorId: selectedAnchorId, x: newX, y: newY })
        .then((result) => {
          useAnchorStore.getState().updateAnchor(selectedAnchorId, { x: result.x, y: result.y });
          notifyDirty();
        })
        .catch((err) => setError(String(err)));
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedAnchorId, anchors, handleDelete, notifyDirty]);

  const handleCopyToAll = useCallback(async () => {
    setError(null);
    setPropagateMsg(null);
    try {
      const result = await invoke<PropagateResult>('copy_anchors_to_all_frames', {
        conflictPolicy,
      });
      const parts: string[] = [];
      if (result.copied > 0) parts.push(`${result.copied} copied`);
      if (result.replaced > 0) parts.push(`${result.replaced} replaced`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      setPropagateMsg(`${parts.join(', ')} across ${result.targetFrameCount} frame${result.targetFrameCount !== 1 ? 's' : ''}`);
      setTimeout(() => setPropagateMsg(null), 4000);
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [conflictPolicy, notifyDirty]);

  const handlePropagateSelected = useCallback(async () => {
    if (!selectedAnchorId) return;
    setError(null);
    setPropagateMsg(null);
    try {
      const result = await invoke<PropagateResult>('propagate_anchor_updates', {
        anchorId: selectedAnchorId,
      });
      setPropagateMsg(result.replaced > 0
        ? `Updated ${result.replaced} matching anchor${result.replaced !== 1 ? 's' : ''} across frames`
        : 'No matching anchors found on other frames');
      setTimeout(() => setPropagateMsg(null), 4000);
      if (result.replaced > 0) notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [selectedAnchorId, notifyDirty]);

  const handleSetParent = useCallback(async (id: string, parentName: string | null) => {
    setError(null);
    try {
      if (parentName) {
        const result = await invoke<AnchorResult>('set_anchor_parent', { anchorId: id, parentName });
        useAnchorStore.getState().updateAnchor(id, { parentName: result.parentName });
      } else {
        const result = await invoke<AnchorResult>('clear_anchor_parent', { anchorId: id });
        useAnchorStore.getState().updateAnchor(id, { parentName: result.parentName });
      }
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [notifyDirty]);

  const handleSetFalloff = useCallback(async (id: string, falloffWeight: number) => {
    setError(null);
    try {
      const result = await invoke<AnchorResult>('set_anchor_falloff', { anchorId: id, falloffWeight });
      useAnchorStore.getState().updateAnchor(id, { falloffWeight: result.falloffWeight });
      notifyDirty();
    } catch (err) {
      setError(String(err));
    }
  }, [notifyDirty]);

  const canvasSize = useProjectStore((s) => s.canvasSize);
  const markDirty = useProjectStore((s) => s.markDirty);

  /** Mark project dirty on both frontend store and backend. */
  const notifyDirty = useCallback(() => {
    markDirty();
    invoke('mark_dirty').catch(() => {});
  }, [markDirty]);

  const [savePresetMsg, setSavePresetMsg] = useState<string | null>(null);

  const handleSaveAsPreset = useCallback(async () => {
    const presetName = prompt('Preset name:');
    if (!presetName?.trim()) return;

    const w = canvasSize.width || 1;
    const h = canvasSize.height || 1;
    const presetAnchors: PresetAnchor[] = anchors.map((a) => ({
      name: a.name,
      kind: a.kind,
      parentName: a.parentName ?? null,
      falloffWeight: a.falloffWeight ?? 1.0,
      hintX: Math.min(1, Math.max(0, a.x / w)),
      hintY: Math.min(1, Math.max(0, a.y / h)),
    }));

    const motionSettings: PresetMotionSettings = {};

    try {
      const result = await invoke<PresetSaveResult>('save_motion_preset', {
        name: presetName.trim(),
        kind: 'locomotion',
        description: null,
        anchors: presetAnchors,
        motionSettings,
        targetNotes: null,
      });
      setSavePresetMsg(`Saved preset "${result.name}"`);
      setTimeout(() => setSavePresetMsg(null), 3000);
    } catch (err) {
      setSavePresetMsg(`Error: ${err}`);
      setTimeout(() => setSavePresetMsg(null), 5000);
    }
  }, [anchors, canvasSize]);

  const selectedAnchor = anchors.find((a) => a.id === selectedAnchorId);

  // Compute parent options for selected anchor (exclude self)
  const parentOptions = selectedAnchor
    ? anchors.filter((a) => a.name !== selectedAnchor.name)
    : [];

  return (
    <div className="anchor-panel">
      <div className="anchor-panel-header">
        <span className="anchor-panel-title">Anchors</span>
        <button
          className={`anchor-overlay-toggle ${overlayVisible ? 'active' : ''}`}
          onClick={toggleOverlay}
          title={overlayVisible ? 'Hide anchor overlay' : 'Show anchor overlay'}
        >
          {overlayVisible ? '\u25C9' : '\u25CB'}
        </button>
      </div>

      <div className="anchor-create-row">
        <select
          className="anchor-kind-select"
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as AnchorKind)}
        >
          {ANCHOR_KINDS.map((k) => (
            <option key={k} value={k}>{ANCHOR_KIND_LABELS[k]}</option>
          ))}
        </select>
        <button className="anchor-add-btn" onClick={handleCreate} title="Add anchor">+</button>
      </div>

      {anchors.length === 0 && (
        <div className="anchor-empty">No anchors on this frame</div>
      )}

      <div className="anchor-list">
        {anchors.map((a) => (
          <div
            key={a.id}
            className={`anchor-item ${selectedAnchorId === a.id ? 'selected' : ''}`}
            onClick={() => selectAnchor(selectedAnchorId === a.id ? null : a.id)}
          >
            <span
              className="anchor-kind-dot"
              style={{ background: ANCHOR_KIND_COLORS[a.kind] }}
              title={ANCHOR_KIND_LABELS[a.kind]}
            />
            <input
              className="anchor-name-input"
              value={a.name}
              onChange={(e) => handleRename(a.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="anchor-coords">({a.x}, {a.y})</span>
            {a.bounds && <span className="anchor-has-bounds" title="Has bound region">{'\u25A3'}</span>}
            {a.parentName ? (
              <span className="anchor-parent-badge" title={`Child of ${a.parentName}`}>{'\u2192'}{a.parentName}</span>
            ) : (
              anchors.some((o) => o.parentName === a.name) && (
                <span className="anchor-root-badge" title="Root anchor">root</span>
              )
            )}
            <button
              className="anchor-delete-btn"
              onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
              title="Delete anchor"
            >
              {'\u00D7'}
            </button>
          </div>
        ))}
      </div>

      {selectedAnchor && (
        <div className="anchor-binding-area">
          <span className="anchor-binding-label">
            Region: {selectedAnchor.bounds
              ? `${selectedAnchor.bounds.width}\u00D7${selectedAnchor.bounds.height} at (${selectedAnchor.bounds.x}, ${selectedAnchor.bounds.y})`
              : 'None'}
          </span>
          <div className="anchor-binding-actions">
            <button
              className="anchor-bind-btn"
              onClick={() => handleBindSelection(selectedAnchor.id)}
              disabled={!hasSelection}
              title={hasSelection ? 'Bind current selection to this anchor' : 'Make a selection first'}
            >
              Bind Selection
            </button>
            {selectedAnchor.bounds && (
              <button
                className="anchor-clear-btn"
                onClick={() => handleClearBinding(selectedAnchor.id)}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {selectedAnchor && (
        <div className="anchor-hierarchy-area">
          <div className="anchor-hierarchy-row">
            <label className="anchor-hierarchy-label">Parent:</label>
            <select
              className="anchor-parent-select"
              value={selectedAnchor.parentName ?? ''}
              onChange={(e) => handleSetParent(selectedAnchor.id, e.target.value || null)}
            >
              <option value="">None (root)</option>
              {parentOptions.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="anchor-hierarchy-row">
            <label className="anchor-hierarchy-label">Falloff:</label>
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.1}
              value={selectedAnchor.falloffWeight ?? 1.0}
              onChange={(e) => handleSetFalloff(selectedAnchor.id, Number(e.target.value))}
              className="anchor-falloff-slider"
            />
            <span className="anchor-falloff-value">{(selectedAnchor.falloffWeight ?? 1.0).toFixed(1)}</span>
          </div>
        </div>
      )}

      {anchors.length > 0 && frames.length > 1 && (
        <div className="anchor-propagate-area">
          <div className="anchor-propagate-header">
            <span className="anchor-propagate-label">Propagate</span>
            <select
              className="anchor-conflict-select"
              value={conflictPolicy}
              onChange={(e) => setConflictPolicy(e.target.value as AnchorConflictPolicy)}
              title="What to do when target frame already has an anchor with the same name"
            >
              <option value="skip">Skip existing</option>
              <option value="replace">Replace existing</option>
            </select>
          </div>
          <div className="anchor-propagate-actions">
            <button className="anchor-propagate-btn" onClick={handleCopyToAll} title="Copy all anchors to every other frame">
              Copy to all frames
            </button>
            {selectedAnchor && (
              <button className="anchor-propagate-btn" onClick={handlePropagateSelected} title="Push this anchor's position/kind/bounds to matching anchors on other frames">
                Sync "{selectedAnchor.name}"
              </button>
            )}
          </div>
        </div>
      )}

      {anchors.length > 0 && (
        <button
          className="anchor-save-preset-btn"
          onClick={handleSaveAsPreset}
          title="Save current anchor layout as a reusable preset"
        >
          Save Anchors as Preset
        </button>
      )}

      {savePresetMsg && <div className="anchor-success">{savePresetMsg}</div>}
      {propagateMsg && <div className="anchor-success">{propagateMsg}</div>}
      {error && <div className="anchor-error">{error}</div>}
    </div>
  );
}
