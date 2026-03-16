import { useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import type { SpriteColor, SpriteColorGroup } from '@glyphstudio/domain';

function rgbaToHex(rgba: [number, number, number, number]): string {
  return `#${rgba
    .slice(0, 3)
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

function SlotRow({
  color,
  index,
  isSelected,
  onSelect,
}: {
  color: SpriteColor;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const renamePaletteColor = useSpriteEditorStore((s) => s.renamePaletteColor);
  const lockPaletteColor = useSpriteEditorStore((s) => s.lockPaletteColor);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => {
    setDraft(color.name ?? '');
    setEditing(true);
  };

  const commitRename = () => {
    renamePaletteColor(index, draft);
    setEditing(false);
  };

  return (
    <div
      className={`palette-slot-row${isSelected ? ' selected' : ''}${color.locked ? ' locked' : ''}`}
      onClick={onSelect}
      data-testid={`palette-slot-${index}`}
    >
      <span
        className="palette-slot-swatch"
        style={{ backgroundColor: rgbaToHex(color.rgba) }}
      />
      {editing ? (
        <input
          className="palette-slot-name-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          data-testid={`palette-slot-name-input-${index}`}
        />
      ) : (
        <span
          className="palette-slot-name"
          onDoubleClick={startRename}
          data-testid={`palette-slot-name-${index}`}
        >
          {color.name || `Color ${index}`}
        </span>
      )}
      {color.semanticRole && (
        <span className="palette-slot-role">{color.semanticRole}</span>
      )}
      <button
        className={`palette-slot-lock-btn${color.locked ? ' active' : ''}`}
        title={color.locked ? 'Unlock' : 'Lock'}
        onClick={(e) => {
          e.stopPropagation();
          lockPaletteColor(index, !color.locked);
        }}
        data-testid={`palette-slot-lock-${index}`}
      >
        {color.locked ? '\u{1F512}' : '\u{1F513}'}
      </button>
    </div>
  );
}

function SlotDetail({
  color,
  index,
  groups,
}: {
  color: SpriteColor;
  index: number;
  groups: SpriteColorGroup[];
}) {
  const setPaletteColorRole = useSpriteEditorStore((s) => s.setPaletteColorRole);
  const assignColorToGroup = useSpriteEditorStore((s) => s.assignColorToGroup);
  const removePaletteColor = useSpriteEditorStore((s) => s.removePaletteColor);

  return (
    <div className="palette-slot-detail" data-testid="palette-slot-detail">
      <div className="palette-detail-header">
        <span
          className="palette-detail-swatch"
          style={{ backgroundColor: rgbaToHex(color.rgba) }}
        />
        <span className="palette-detail-name">{color.name || `Color ${index}`}</span>
      </div>

      <div className="palette-detail-rgba">
        {color.rgba[0]}, {color.rgba[1]}, {color.rgba[2]}, {color.rgba[3]}
      </div>

      <label className="palette-detail-field">
        Semantic Role
        <input
          type="text"
          value={color.semanticRole ?? ''}
          placeholder="e.g. outline, skin, shadow"
          onChange={(e) =>
            setPaletteColorRole(index, e.target.value || undefined)
          }
          data-testid="palette-detail-role-input"
        />
      </label>

      <label className="palette-detail-field">
        Group
        <select
          value={color.groupId ?? ''}
          onChange={(e) =>
            assignColorToGroup(index, e.target.value || undefined)
          }
          data-testid="palette-detail-group-select"
        >
          <option value="">None</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {!color.locked && (
        <button
          className="palette-detail-remove-btn"
          onClick={() => removePaletteColor(index)}
          data-testid="palette-detail-remove"
        >
          Remove Color
        </button>
      )}
      {color.locked && (
        <span className="palette-detail-locked-hint">This color is locked</span>
      )}
    </div>
  );
}

function GroupSection({
  group,
  colors,
}: {
  group: SpriteColorGroup;
  colors: { color: SpriteColor; index: number }[];
}) {
  const renameColorGroup = useSpriteEditorStore((s) => s.renameColorGroup);
  const deleteColorGroup = useSpriteEditorStore((s) => s.deleteColorGroup);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <div className="palette-group-section" data-testid={`palette-group-${group.id}`}>
      <div className="palette-group-header">
        {editing ? (
          <input
            className="palette-group-name-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              renameColorGroup(group.id, draft);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renameColorGroup(group.id, draft);
                setEditing(false);
              }
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="palette-group-name"
            onDoubleClick={() => {
              setDraft(group.name);
              setEditing(true);
            }}
          >
            {group.name}
          </span>
        )}
        <span className="palette-group-count">{colors.length}</span>
        <button
          className="palette-group-delete-btn"
          title="Delete group"
          onClick={() => deleteColorGroup(group.id)}
          data-testid={`palette-group-delete-${group.id}`}
        >
          ×
        </button>
      </div>
      <div className="palette-group-swatches">
        {colors.map(({ color }) => (
          <span
            key={color.rgba.join(',')}
            className="palette-group-swatch"
            style={{ backgroundColor: rgbaToHex(color.rgba) }}
            title={color.name ?? undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function PalettePropsPanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const addPaletteColor = useSpriteEditorStore((s) => s.addPaletteColor);
  const createColorGroup = useSpriteEditorStore((s) => s.createColorGroup);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!doc) {
    return (
      <div className="palette-props-panel" data-testid="palette-props-panel">
        <span className="palette-props-empty">No document loaded</span>
      </div>
    );
  }

  const { palette } = doc;
  const groups = palette.groups ?? [];
  const selectedColor = selectedSlot !== null ? palette.colors[selectedSlot] : null;

  // Summary stats
  const lockedCount = palette.colors.filter((c) => c.locked).length;
  const roledCount = palette.colors.filter((c) => c.semanticRole).length;
  const groupedCount = palette.colors.filter((c) => c.groupId).length;

  return (
    <div className="palette-props-panel" data-testid="palette-props-panel">
      {/* Summary */}
      <div className="palette-summary" data-testid="palette-summary">
        <span>{palette.colors.length} colors</span>
        <span>{lockedCount} locked</span>
        <span>{roledCount} labeled</span>
        <span>{groups.length} groups</span>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="palette-groups">
          {groups.map((g) => (
            <GroupSection
              key={g.id}
              group={g}
              colors={palette.colors
                .map((c, i) => ({ color: c, index: i }))
                .filter(({ color }) => color.groupId === g.id)}
            />
          ))}
        </div>
      )}

      {/* Ungrouped colors */}
      <div className="palette-slots-header">
        <span>Slots</span>
        <button
          className="palette-add-group-btn"
          onClick={() => createColorGroup('New Group')}
          title="Create color group"
          data-testid="palette-add-group"
        >
          + Group
        </button>
        <button
          className="palette-add-color-btn"
          onClick={() =>
            addPaletteColor({ rgba: [128, 128, 128, 255], name: 'New Color' })
          }
          title="Add color"
          data-testid="palette-add-color"
        >
          + Color
        </button>
      </div>

      <div className="palette-slot-list" data-testid="palette-slot-list">
        {palette.colors.map((color, i) => (
          <SlotRow
            key={i}
            color={color}
            index={i}
            isSelected={selectedSlot === i}
            onSelect={() => setSelectedSlot(i)}
          />
        ))}
      </div>

      {/* Detail pane */}
      {selectedColor && selectedSlot !== null && (
        <SlotDetail color={selectedColor} index={selectedSlot} groups={groups} />
      )}
    </div>
  );
}
