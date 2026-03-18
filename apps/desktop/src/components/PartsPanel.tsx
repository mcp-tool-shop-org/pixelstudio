import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import {
  createEmptyPartLibrary,
  addPartToLibrary,
  deletePartFromLibrary,
  renamePartInLibrary,
  duplicatePartInLibrary,
  findPartById,
  generateDefaultPartName,
  createPartFromSelection,
} from '@glyphstudio/state';
import type { Part, PartLibrary } from '@glyphstudio/domain';
import { loadPartLibrary, savePartLibrary } from '../lib/partLibraryStorage';

/** Render a part's pixel data into a small canvas for thumbnail display. */
function PartThumbnail({ part }: { part: Part }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displaySize = 32;
    canvas.width = displaySize;
    canvas.height = displaySize;

    // Clear with transparent
    ctx.clearRect(0, 0, displaySize, displaySize);

    // Draw checker background
    const checkerSize = 4;
    for (let y = 0; y < displaySize; y += checkerSize) {
      for (let x = 0; x < displaySize; x += checkerSize) {
        const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#3a3a3a' : '#2a2a2a';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Render part pixels scaled to fit
    if (part.pixelData.length === part.width * part.height * 4 && typeof ImageData !== 'undefined') {
      const imageData = new ImageData(
        new Uint8ClampedArray(part.pixelData),
        part.width,
        part.height,
      );
      // Draw to temp canvas at native size, then scale
      const tmp = document.createElement('canvas');
      tmp.width = part.width;
      tmp.height = part.height;
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) {
        tmpCtx.putImageData(imageData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const scale = Math.min(displaySize / part.width, displaySize / part.height);
        const w = part.width * scale;
        const h = part.height * scale;
        const x = (displaySize - w) / 2;
        const y = (displaySize - h) / 2;
        ctx.drawImage(tmp, x, y, w, h);
      }
    }
  }, [part.pixelData, part.width, part.height]);

  return (
    <canvas
      ref={canvasRef}
      className="parts-thumbnail"
      data-testid={`parts-thumb-${part.id}`}
    />
  );
}

function PartRow({
  part,
  isActive,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: {
  part: Part;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => {
    setDraft(part.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div
      className={`parts-item${isActive ? ' active' : ''}`}
      onClick={onSelect}
      data-testid={`parts-item-${part.id}`}
    >
      <PartThumbnail part={part} />
      <div className="parts-item-info">
        {editing ? (
          <input
            className="parts-item-name-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid={`parts-name-input-${part.id}`}
          />
        ) : (
          <span
            className="parts-item-name"
            onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
            data-testid={`parts-name-${part.id}`}
          >
            {part.name}
          </span>
        )}
        <span className="parts-item-size">{part.width}x{part.height}</span>
      </div>
      <div className="parts-item-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="parts-action-btn"
          title="Duplicate"
          onClick={onDuplicate}
          data-testid={`parts-dup-${part.id}`}
        >
          &#x29C9;
        </button>
        <button
          className="parts-action-btn delete"
          title="Delete"
          onClick={onDelete}
          data-testid={`parts-del-${part.id}`}
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}

export function PartsPanel() {
  const selectionBuffer = useSpriteEditorStore((s) => s.selectionBuffer);
  const activeStampPartId = useSpriteEditorStore((s) => s.activeStampPartId);
  const setActiveStampPart = useSpriteEditorStore((s) => s.setActiveStampPart);
  const doc = useSpriteEditorStore((s) => s.document);

  const [library, setLibrary] = useState<PartLibrary>(() => loadPartLibrary());

  const persist = useCallback((lib: PartLibrary) => {
    setLibrary(lib);
    savePartLibrary(lib);
  }, []);

  const handleSaveSelection = useCallback(() => {
    if (!selectionBuffer) return;
    const name = generateDefaultPartName(library);
    const part = createPartFromSelection(selectionBuffer, name);
    persist(addPartToLibrary(library, part));
  }, [selectionBuffer, library, persist]);

  const handleSelect = useCallback((partId: string) => {
    if (activeStampPartId === partId) {
      setActiveStampPart(null);
    } else {
      setActiveStampPart(partId);
    }
  }, [activeStampPartId, setActiveStampPart]);

  const handleRename = useCallback((partId: string, name: string) => {
    persist(renamePartInLibrary(library, partId, name));
  }, [library, persist]);

  const handleDuplicate = useCallback((partId: string) => {
    const { library: newLib } = duplicatePartInLibrary(library, partId);
    persist(newLib);
  }, [library, persist]);

  const handleDelete = useCallback((partId: string) => {
    if (activeStampPartId === partId) {
      setActiveStampPart(null);
    }
    persist(deletePartFromLibrary(library, partId));
  }, [library, persist, activeStampPartId, setActiveStampPart]);

  if (!doc) {
    return (
      <div className="parts-panel">
        <div className="parts-empty">No document open</div>
      </div>
    );
  }

  return (
    <div className="parts-panel" data-testid="parts-panel">
      <div className="parts-header">
        <span className="parts-title">Parts</span>
        <button
          className="parts-save-btn"
          onClick={handleSaveSelection}
          disabled={!selectionBuffer}
          title={selectionBuffer ? 'Save selection as a reusable part' : 'Select pixels first'}
          data-testid="parts-save-selection"
        >
          + Save Selection
        </button>
      </div>

      {library.parts.length === 0 ? (
        <div className="parts-empty">
          No parts yet. Select pixels and save as a part.
        </div>
      ) : (
        <div className="parts-list">
          {library.parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              isActive={activeStampPartId === part.id}
              onSelect={() => handleSelect(part.id)}
              onRename={(name) => handleRename(part.id, name)}
              onDuplicate={() => handleDuplicate(part.id)}
              onDelete={() => handleDelete(part.id)}
            />
          ))}
        </div>
      )}

      {activeStampPartId && (
        <div className="parts-stamp-bar" data-testid="parts-stamp-bar">
          <span className="parts-stamp-label">
            Stamp: {findPartById(library, activeStampPartId)?.name ?? 'Unknown'}
          </span>
          <button
            className="parts-stamp-clear-btn"
            onClick={() => setActiveStampPart(null)}
            data-testid="parts-stamp-clear"
          >
            Exit Stamp
          </button>
        </div>
      )}
    </div>
  );
}
