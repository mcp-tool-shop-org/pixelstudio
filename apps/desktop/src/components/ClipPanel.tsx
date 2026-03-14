import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ClipInfo, ClipValidity, PivotMode } from '@pixelstudio/domain';
import { useTimelineStore } from '@pixelstudio/state';
import { useProjectStore } from '@pixelstudio/state';

export function ClipPanel() {
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const frames = useTimelineStore((s) => s.frames);
  const activeFrameIndex = useTimelineStore((s) => s.activeFrameIndex);
  const markDirty = useProjectStore((s) => s.markDirty);

  const refreshClips = useCallback(async () => {
    try {
      const result = await invoke<ClipInfo[]>('list_clips');
      setClips(result);
    } catch {
      /* no canvas */
    }
  }, []);

  useEffect(() => {
    refreshClips();
  }, [refreshClips, frames.length]);

  const handleCreate = useCallback(async () => {
    const name = prompt('Clip name:');
    if (!name?.trim()) return;
    const endIdx = Math.max(activeFrameIndex, frames.length - 1);
    try {
      await invoke<ClipInfo>('create_clip', {
        name: name.trim(),
        startFrame: activeFrameIndex,
        endFrame: endIdx,
      });
      markDirty();
      invoke('mark_dirty').catch(() => {});
      refreshClips();
    } catch (err) {
      console.error('create_clip failed:', err);
    }
  }, [activeFrameIndex, frames.length, markDirty, refreshClips]);

  const handleDelete = useCallback(
    async (clipId: string) => {
      try {
        await invoke('delete_clip', { clipId });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        if (selectedClipId === clipId) setSelectedClipId(null);
        refreshClips();
      } catch (err) {
        console.error('delete_clip failed:', err);
      }
    },
    [markDirty, refreshClips, selectedClipId],
  );

  const handleRename = useCallback(
    async (clipId: string, currentName: string) => {
      const newName = prompt('Rename clip:', currentName);
      if (!newName?.trim() || newName.trim() === currentName) return;
      try {
        await invoke<ClipInfo>('update_clip', {
          clipId,
          name: newName.trim(),
          startFrame: null,
          endFrame: null,
          loopClip: null,
          fpsOverride: null,
          tags: null,
        });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        refreshClips();
      } catch (err) {
        console.error('update_clip failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  const handleToggleLoop = useCallback(
    async (clipId: string, currentLoop: boolean) => {
      try {
        await invoke<ClipInfo>('update_clip', {
          clipId,
          name: null,
          startFrame: null,
          endFrame: null,
          loopClip: !currentLoop,
          fpsOverride: null,
          tags: null,
        });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        refreshClips();
      } catch (err) {
        console.error('update_clip failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  const handleUpdateRange = useCallback(
    async (clipId: string, startFrame: number, endFrame: number) => {
      try {
        await invoke<ClipInfo>('update_clip', {
          clipId,
          name: null,
          startFrame,
          endFrame,
          loopClip: null,
          fpsOverride: null,
          tags: null,
        });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        setEditingId(null);
        refreshClips();
      } catch (err) {
        console.error('update_clip failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  const handleSetPivot = useCallback(
    async (clipId: string, mode: PivotMode, customX?: number, customY?: number) => {
      try {
        await invoke<ClipInfo>('set_clip_pivot', {
          clipId,
          mode,
          customX: mode === 'custom' ? (customX ?? null) : null,
          customY: mode === 'custom' ? (customY ?? null) : null,
        });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        refreshClips();
      } catch (err) {
        console.error('set_clip_pivot failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  const handleAddTag = useCallback(
    async (clipId: string, tag: string) => {
      try {
        await invoke<ClipInfo>('add_clip_tag', { clipId, tag });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        refreshClips();
      } catch (err) {
        console.error('add_clip_tag failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  const handleRemoveTag = useCallback(
    async (clipId: string, tag: string) => {
      try {
        await invoke<ClipInfo>('remove_clip_tag', { clipId, tag });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        refreshClips();
      } catch (err) {
        console.error('remove_clip_tag failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  const handleClearPivot = useCallback(
    async (clipId: string) => {
      try {
        await invoke<ClipInfo>('clear_clip_pivot', { clipId });
        markDirty();
        invoke('mark_dirty').catch(() => {});
        refreshClips();
      } catch (err) {
        console.error('clear_clip_pivot failed:', err);
      }
    },
    [markDirty, refreshClips],
  );

  return (
    <div className="clip-panel">
      <div className="clip-panel-header">
        <span className="clip-panel-title">Clips</span>
        <button className="clip-create-btn" title="Create clip from current frame" onClick={handleCreate}>
          + Clip
        </button>
      </div>
      {clips.length === 0 && <span className="clip-empty">No clips defined</span>}
      <div className="clip-list">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className={`clip-item ${selectedClipId === clip.id ? 'selected' : ''} validity-${clip.validity}`}
            onClick={() => setSelectedClipId(clip.id === selectedClipId ? null : clip.id)}
          >
            <div className="clip-item-header">
              <ValidityBadge validity={clip.validity} />
              <span className="clip-name">{clip.name}</span>
              <span className="clip-range">
                {clip.startFrame + 1}–{clip.endFrame + 1} ({clip.frameCount}f)
              </span>
              {clip.loopClip && <span className="clip-loop-badge">{'\u21BB'}</span>}
            </div>
            {selectedClipId === clip.id && (
              <div className="clip-item-actions">
                {editingId === clip.id ? (
                  <ClipRangeEditor
                    clip={clip}
                    maxFrame={frames.length}
                    onSave={(s, e) => handleUpdateRange(clip.id, s, e)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <button className="clip-action-btn" onClick={() => handleRename(clip.id, clip.name)}>
                      Rename
                    </button>
                    <button className="clip-action-btn" onClick={() => setEditingId(clip.id)}>
                      Edit Range
                    </button>
                    <button
                      className={`clip-action-btn ${clip.loopClip ? 'active' : ''}`}
                      onClick={() => handleToggleLoop(clip.id, clip.loopClip)}
                    >
                      Loop
                    </button>
                    <button className="clip-action-btn clip-delete-btn" onClick={() => handleDelete(clip.id)}>
                      Delete
                    </button>
                  </>
                )}
                {clip.warnings.length > 0 && (
                  <div className="clip-warnings">
                    {clip.warnings.map((w, i) => (
                      <span key={i} className="clip-warning">{w}</span>
                    ))}
                  </div>
                )}
                {clip.fpsOverride != null && (
                  <span className="clip-fps-override">{clip.fpsOverride} fps override</span>
                )}
                <ClipPivotEditor
                  clip={clip}
                  onSetPivot={handleSetPivot}
                  onClearPivot={handleClearPivot}
                />
                <ClipTagEditor
                  clip={clip}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidityBadge({ validity }: { validity: ClipValidity }) {
  if (validity === 'valid') return <span className="clip-validity-badge valid" title="Valid">{'\u2713'}</span>;
  if (validity === 'warning') return <span className="clip-validity-badge warning" title="Has warnings">{'\u26A0'}</span>;
  return <span className="clip-validity-badge invalid" title="Invalid range">{'\u2717'}</span>;
}

function ClipPivotEditor({
  clip,
  onSetPivot,
  onClearPivot,
}: {
  clip: ClipInfo;
  onSetPivot: (clipId: string, mode: PivotMode, customX?: number, customY?: number) => void;
  onClearPivot: (clipId: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customX, setCustomX] = useState(clip.pivot?.customPoint?.x ?? 0);
  const [customY, setCustomY] = useState(clip.pivot?.customPoint?.y ?? 0);

  const currentMode = clip.pivot?.mode ?? null;
  const pivotLabel = currentMode === 'center' ? 'Center'
    : currentMode === 'bottom_center' ? 'Bottom'
    : currentMode === 'custom' ? `Custom (${clip.pivot?.customPoint?.x ?? 0}, ${clip.pivot?.customPoint?.y ?? 0})`
    : 'None';

  return (
    <div className="clip-pivot-editor">
      <div className="clip-pivot-header">
        <span className="clip-pivot-label">Pivot: {pivotLabel}</span>
      </div>
      <div className="clip-pivot-buttons">
        <button
          className={`clip-action-btn ${currentMode === 'center' ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSetPivot(clip.id, 'center'); setShowCustom(false); }}
        >
          Center
        </button>
        <button
          className={`clip-action-btn ${currentMode === 'bottom_center' ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSetPivot(clip.id, 'bottom_center'); setShowCustom(false); }}
        >
          Bottom
        </button>
        <button
          className={`clip-action-btn ${currentMode === 'custom' ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowCustom(!showCustom); }}
        >
          Custom
        </button>
        {currentMode && (
          <button
            className="clip-action-btn"
            onClick={(e) => { e.stopPropagation(); onClearPivot(clip.id); setShowCustom(false); }}
          >
            Clear
          </button>
        )}
      </div>
      {showCustom && (
        <div className="clip-pivot-custom" onClick={(e) => e.stopPropagation()}>
          <label>
            X
            <input
              type="number"
              value={customX}
              onChange={(e) => setCustomX(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label>
            Y
            <input
              type="number"
              value={customY}
              onChange={(e) => setCustomY(parseFloat(e.target.value) || 0)}
            />
          </label>
          <button
            className="clip-action-btn"
            onClick={() => { onSetPivot(clip.id, 'custom', customX, customY); setShowCustom(false); }}
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}

const QUICK_TAGS = ['idle', 'walk', 'run', 'jump', 'wind', 'left', 'right', 'up', 'down'];

function ClipTagEditor({
  clip,
  onAddTag,
  onRemoveTag,
}: {
  clip: ClipInfo;
  onAddTag: (clipId: string, tag: string) => void;
  onRemoveTag: (clipId: string, tag: string) => void;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAddTag(clip.id, trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const existingSet = new Set(clip.tags);

  return (
    <div className="clip-tag-editor" onClick={(e) => e.stopPropagation()}>
      <div className="clip-tag-header">
        <span className="clip-tag-label">
          Tags{clip.tags.length > 0 ? ` (${clip.tags.length})` : ''}
        </span>
      </div>
      {clip.tags.length > 0 && (
        <div className="clip-tag-chips">
          {clip.tags.map((tag) => (
            <span key={tag} className="clip-tag-chip">
              {tag}
              <button
                className="clip-tag-remove"
                onClick={() => onRemoveTag(clip.id, tag)}
                title={`Remove "${tag}"`}
              >
                {'\u00D7'}
              </button>
            </span>
          ))}
        </div>
      )}
      {clip.tags.length === 0 && (
        <span className="clip-tag-empty">No tags</span>
      )}
      <div className="clip-tag-input-row">
        <input
          type="text"
          className="clip-tag-input"
          placeholder="Add tag..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={48}
        />
        <button className="clip-action-btn" onClick={handleAdd} disabled={!input.trim()}>
          Add
        </button>
      </div>
      <div className="clip-tag-quick">
        {QUICK_TAGS.filter((t) => !existingSet.has(t)).slice(0, 6).map((tag) => (
          <button
            key={tag}
            className="clip-tag-quick-btn"
            onClick={() => onAddTag(clip.id, tag)}
          >
            +{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClipRangeEditor({
  clip,
  maxFrame,
  onSave,
  onCancel,
}: {
  clip: ClipInfo;
  maxFrame: number;
  onSave: (start: number, end: number) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(clip.startFrame + 1);
  const [end, setEnd] = useState(clip.endFrame + 1);

  return (
    <div className="clip-range-editor">
      <label>
        Start
        <input
          type="number"
          min={1}
          max={maxFrame}
          value={start}
          onChange={(e) => setStart(parseInt(e.target.value, 10) || 1)}
        />
      </label>
      <label>
        End
        <input
          type="number"
          min={1}
          max={maxFrame}
          value={end}
          onChange={(e) => setEnd(parseInt(e.target.value, 10) || 1)}
        />
      </label>
      <button className="clip-action-btn" onClick={() => onSave(start - 1, end - 1)}>
        Save
      </button>
      <button className="clip-action-btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
