import { useCallback, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import type { PaletteSet } from '@glyphstudio/domain';

function rgbaToHex(rgba: [number, number, number, number]): string {
  return `#${rgba
    .slice(0, 3)
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

type ApplyScope = 'frame' | 'all';

function PaletteSetRow({
  ps,
  isActive,
  isPreviewing,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: {
  ps: PaletteSet;
  isActive: boolean;
  isPreviewing: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => {
    setDraft(ps.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  const swatches = ps.colors.slice(0, 8);

  return (
    <div
      className={`palette-set-row${isActive ? ' active' : ''}${isPreviewing ? ' previewing' : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        // Simple context: duplicate or delete on right-click
      }}
      data-testid={`palette-set-${ps.id}`}
    >
      <div className="palette-set-swatches">
        {swatches.map((c, i) => (
          <span
            key={i}
            className="palette-set-swatch"
            style={{ backgroundColor: rgbaToHex(c.rgba) }}
          />
        ))}
        {ps.colors.length > 8 && (
          <span className="palette-set-swatch-more">+{ps.colors.length - 8}</span>
        )}
      </div>
      <div className="palette-set-info">
        {editing ? (
          <input
            className="palette-set-name-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid={`palette-set-name-input-${ps.id}`}
          />
        ) : (
          <span
            className="palette-set-name"
            onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
            data-testid={`palette-set-name-${ps.id}`}
          >
            {ps.name}
          </span>
        )}
        {isActive && <span className="palette-set-badge active-badge">Active</span>}
        {isPreviewing && <span className="palette-set-badge preview-badge">Preview</span>}
      </div>
      <div className="palette-set-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="palette-set-action-btn"
          title="Duplicate"
          onClick={onDuplicate}
          data-testid={`palette-set-dup-${ps.id}`}
        >
          ⧉
        </button>
        <button
          className="palette-set-action-btn delete"
          title="Delete"
          onClick={onDelete}
          data-testid={`palette-set-del-${ps.id}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function PaletteSetsPanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const previewPaletteSetId = useSpriteEditorStore((s) => s.previewPaletteSetId);
  const createPaletteSet = useSpriteEditorStore((s) => s.createPaletteSet);
  const renamePaletteSet = useSpriteEditorStore((s) => s.renamePaletteSet);
  const duplicatePaletteSet = useSpriteEditorStore((s) => s.duplicatePaletteSet);
  const deletePaletteSet = useSpriteEditorStore((s) => s.deletePaletteSet);
  const setActivePaletteSet = useSpriteEditorStore((s) => s.setActivePaletteSet);
  const previewPaletteSet = useSpriteEditorStore((s) => s.previewPaletteSet);
  const applyPaletteSetToFrame = useSpriteEditorStore((s) => s.applyPaletteSetToFrame);
  const applyPaletteSetToAll = useSpriteEditorStore((s) => s.applyPaletteSetToAll);
  const cancelPalettePreview = useSpriteEditorStore((s) => s.cancelPalettePreview);

  const [scope, setScope] = useState<ApplyScope>('frame');

  const paletteSets = doc?.paletteSets ?? [];
  const activePaletteSetId = doc?.activePaletteSetId ?? null;

  const handleSaveCurrent = useCallback(() => {
    const name = `Variant ${paletteSets.length + 1}`;
    createPaletteSet(name);
  }, [createPaletteSet, paletteSets.length]);

  const handleSelect = useCallback((id: string) => {
    if (previewPaletteSetId === id) {
      cancelPalettePreview();
    } else {
      previewPaletteSet(id);
    }
  }, [previewPaletteSetId, previewPaletteSet, cancelPalettePreview]);

  const handleCommit = useCallback(() => {
    if (!previewPaletteSetId) return;
    if (scope === 'frame') {
      applyPaletteSetToFrame(previewPaletteSetId);
    } else {
      applyPaletteSetToAll(previewPaletteSetId);
    }
  }, [previewPaletteSetId, scope, applyPaletteSetToFrame, applyPaletteSetToAll]);

  if (!doc) {
    return (
      <div className="palette-sets-panel">
        <div className="palette-sets-empty">No document open</div>
      </div>
    );
  }

  return (
    <div className="palette-sets-panel" data-testid="palette-sets-panel">
      <div className="palette-sets-header">
        <span className="palette-sets-title">Palette Sets</span>
        <button
          className="palette-sets-save-btn"
          onClick={handleSaveCurrent}
          title="Save current palette as a new set"
          data-testid="palette-sets-save"
        >
          + Save Current
        </button>
      </div>

      {paletteSets.length === 0 ? (
        <div className="palette-sets-empty">
          No palette sets yet. Save your current palette to create one.
        </div>
      ) : (
        <div className="palette-sets-list">
          {paletteSets.map((ps) => (
            <PaletteSetRow
              key={ps.id}
              ps={ps}
              isActive={activePaletteSetId === ps.id}
              isPreviewing={previewPaletteSetId === ps.id}
              onSelect={() => handleSelect(ps.id)}
              onRename={(name) => renamePaletteSet(ps.id, name)}
              onDuplicate={() => duplicatePaletteSet(ps.id)}
              onDelete={() => deletePaletteSet(ps.id)}
            />
          ))}
        </div>
      )}

      {previewPaletteSetId && (
        <div className="palette-sets-commit-bar" data-testid="palette-sets-commit-bar">
          <div className="palette-sets-scope">
            <label className="palette-sets-scope-label">
              <input
                type="radio"
                name="palette-scope"
                value="frame"
                checked={scope === 'frame'}
                onChange={() => setScope('frame')}
              />
              Active Frame
            </label>
            <label className="palette-sets-scope-label">
              <input
                type="radio"
                name="palette-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              All Frames
            </label>
          </div>
          <div className="palette-sets-commit-actions">
            <button
              className="palette-sets-commit-btn"
              onClick={handleCommit}
              data-testid="palette-sets-commit"
            >
              Apply
            </button>
            <button
              className="palette-sets-cancel-btn"
              onClick={cancelPalettePreview}
              data-testid="palette-sets-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
