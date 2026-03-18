import { useCallback, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import type { DocumentVariant } from '@glyphstudio/domain';

function VariantTab({
  label,
  isActive,
  isComparing,
  onClick,
  onRename,
  onDuplicate,
  onDelete,
  onCompare,
  testId,
}: {
  label: string;
  isActive: boolean;
  isComparing?: boolean;
  onClick: () => void;
  onRename?: (name: string) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCompare?: () => void;
  testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => {
    if (!onRename) return;
    setDraft(label);
    setEditing(true);
  };

  const commitRename = () => {
    if (draft.trim() && onRename) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div
      className={`variant-tab${isActive ? ' active' : ''}${isComparing ? ' comparing' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      {editing ? (
        <input
          className="variant-tab-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid={`${testId}-input`}
        />
      ) : (
        <span
          className="variant-tab-label"
          onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
        >
          {label}
        </span>
      )}
      {(onDuplicate || onDelete || onCompare) && (
        <div className="variant-tab-actions" onClick={(e) => e.stopPropagation()}>
          {onCompare && (
            <button
              className={`variant-tab-btn compare${isComparing ? ' active' : ''}`}
              title={isComparing ? 'Stop comparing' : 'Compare'}
              onClick={onCompare}
              data-testid={`${testId}-cmp`}
            >
              &#x2194;
            </button>
          )}
          {onDuplicate && (
            <button
              className="variant-tab-btn"
              title="Duplicate"
              onClick={onDuplicate}
              data-testid={`${testId}-dup`}
            >
              &#x29C9;
            </button>
          )}
          {onDelete && (
            <button
              className="variant-tab-btn delete"
              title="Delete"
              onClick={onDelete}
              data-testid={`${testId}-del`}
            >
              &#x2715;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function VariantBar() {
  const doc = useSpriteEditorStore((s) => s.document);
  const createVariant = useSpriteEditorStore((s) => s.createVariant);
  const renameVariant = useSpriteEditorStore((s) => s.renameVariant);
  const duplicateVariant = useSpriteEditorStore((s) => s.duplicateVariant);
  const deleteVariant = useSpriteEditorStore((s) => s.deleteVariant);
  const switchToVariant = useSpriteEditorStore((s) => s.switchToVariant);
  const compareVariantId = useSpriteEditorStore((s) => s.compareVariantId);
  const setCompareVariant = useSpriteEditorStore((s) => s.setCompareVariant);

  const variants = doc?.variants ?? [];
  const activeVariantId = doc?.activeVariantId ?? null;

  const handleCreate = useCallback(() => {
    const name = `Variant ${variants.length + 1}`;
    const id = createVariant(name);
    if (id) switchToVariant(id);
  }, [createVariant, switchToVariant, variants.length]);

  // Don't render when there's no document or no variants and no reason to show the bar
  if (!doc) return null;
  // Show bar when variants exist, or hide completely for zero-overhead
  if (variants.length === 0) {
    return (
      <div className="variant-bar minimal" data-testid="variant-bar">
        <button
          className="variant-bar-create-btn"
          onClick={handleCreate}
          title="Create a variant of the current sequence"
          data-testid="variant-create"
        >
          + Variant
        </button>
      </div>
    );
  }

  return (
    <div className="variant-bar" data-testid="variant-bar">
      <VariantTab
        label="Base"
        isActive={activeVariantId === null}
        isComparing={compareVariantId === 'base'}
        onClick={() => switchToVariant(null)}
        onCompare={activeVariantId !== null ? () => setCompareVariant(compareVariantId === 'base' ? null : 'base') : undefined}
        testId="variant-tab-base"
      />
      {variants.map((v) => (
        <VariantTab
          key={v.id}
          label={v.name}
          isActive={activeVariantId === v.id}
          isComparing={compareVariantId === v.id}
          onClick={() => switchToVariant(v.id)}
          onRename={(name) => renameVariant(v.id, name)}
          onDuplicate={() => duplicateVariant(v.id)}
          onDelete={() => deleteVariant(v.id)}
          onCompare={activeVariantId !== v.id ? () => setCompareVariant(compareVariantId === v.id ? null : v.id) : undefined}
          testId={`variant-tab-${v.id}`}
        />
      ))}
      <button
        className="variant-bar-add-btn"
        onClick={handleCreate}
        title="Create variant from current sequence"
        data-testid="variant-add"
      >
        +
      </button>
    </div>
  );
}
