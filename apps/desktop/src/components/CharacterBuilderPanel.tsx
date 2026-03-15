import { useCallback, useState } from 'react';
import {
  CHARACTER_SLOT_IDS,
  CHARACTER_SLOT_LABELS,
  REQUIRED_SLOTS,
} from '@glyphstudio/domain';
import type { CharacterSlotId } from '@glyphstudio/domain';
import {
  useCharacterStore,
  getEquippedPartForSlot,
  getMissingRequiredSlots,
  getCharacterErrors,
  getCharacterWarnings,
  isCharacterValid,
} from '@glyphstudio/state';

export function CharacterBuilderPanel() {
  const build = useCharacterStore((s) => s.activeCharacterBuild);
  const selectedSlot = useCharacterStore((s) => s.selectedSlot);
  const validationIssues = useCharacterStore((s) => s.validationIssues);
  const createBuild = useCharacterStore((s) => s.createCharacterBuild);
  const clearBuild = useCharacterStore((s) => s.clearCharacterBuild);
  const setName = useCharacterStore((s) => s.setCharacterName);
  const selectSlot = useCharacterStore((s) => s.selectSlot);
  const unequipSlot = useCharacterStore((s) => s.unequipCharacterSlot);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const state = useCharacterStore.getState();
  const errors = getCharacterErrors(state);
  const warnings = getCharacterWarnings(state);
  const valid = isCharacterValid(state);
  const missingSlots = getMissingRequiredSlots(state);

  const handleStartRename = useCallback(() => {
    if (!build) return;
    setRenameValue(build.name);
    setIsRenaming(true);
  }, [build]);

  const handleCommitRename = useCallback(() => {
    if (renameValue.trim()) {
      setName(renameValue.trim());
    }
    setIsRenaming(false);
  }, [renameValue, setName]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCommitRename();
      if (e.key === 'Escape') setIsRenaming(false);
    },
    [handleCommitRename],
  );

  // ── Empty state ──
  if (!build) {
    return (
      <div className="char-builder" data-testid="char-builder-panel">
        <div className="char-builder-empty">
          <p className="char-builder-empty-msg">No character build active.</p>
          <p className="char-builder-empty-hint">
            Required slots: Head, Torso, Arms, Legs
          </p>
          <button
            className="btn-primary char-builder-create-btn"
            onClick={() => createBuild()}
          >
            Create Character Build
          </button>
        </div>
      </div>
    );
  }

  const selectedPart = selectedSlot ? getEquippedPartForSlot(state, selectedSlot) : undefined;
  const isSelectedRequired = selectedSlot
    ? (REQUIRED_SLOTS as readonly string[]).includes(selectedSlot)
    : false;
  const selectedSlotIssues = selectedSlot
    ? validationIssues.filter((i) => i.slot === selectedSlot)
    : [];

  return (
    <div className="char-builder" data-testid="char-builder-panel">
      {/* ── Header ── */}
      <div className="char-builder-header">
        <div className="char-builder-identity">
          {isRenaming ? (
            <input
              className="char-builder-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleCommitRename}
              onKeyDown={handleRenameKeyDown}
              autoFocus
              data-testid="char-rename-input"
            />
          ) : (
            <span
              className="char-builder-name"
              onDoubleClick={handleStartRename}
              title="Double-click to rename"
              data-testid="char-build-name"
            >
              {build.name}
            </span>
          )}
        </div>
        <div className="char-builder-header-actions">
          <button
            className="char-builder-action-btn"
            title="New build"
            onClick={() => createBuild()}
            data-testid="char-new-btn"
          >
            +
          </button>
          <button
            className="char-builder-action-btn"
            title="Clear build"
            onClick={clearBuild}
            data-testid="char-clear-btn"
          >
            {'\u2715'}
          </button>
        </div>
      </div>

      {/* ── Validation summary ── */}
      <div className="char-builder-validation" data-testid="char-validation-summary">
        {valid ? (
          <span className="char-validation-ok">{'\u2713'} Valid build</span>
        ) : (
          <span className="char-validation-errors">
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="char-validation-warnings">
            {' '}{'\u26A0'} {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Slot list ── */}
      <div className="char-builder-slots" data-testid="char-slot-list">
        {CHARACTER_SLOT_IDS.map((slotId) => {
          const part = getEquippedPartForSlot(state, slotId);
          const isRequired = (REQUIRED_SLOTS as readonly string[]).includes(slotId);
          const isMissing = isRequired && !part;
          const isSelected = selectedSlot === slotId;
          const hasIssue = validationIssues.some((i) => i.slot === slotId);

          const cls = [
            'char-slot-row',
            isSelected ? 'selected' : '',
            isMissing ? 'missing' : '',
            hasIssue ? 'has-issue' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={slotId}
              className={cls}
              onClick={() => selectSlot(slotId)}
              data-testid={`char-slot-${slotId}`}
              data-slot={slotId}
            >
              <span className="char-slot-label">
                {CHARACTER_SLOT_LABELS[slotId]}
                {isRequired && <span className="char-slot-required" title="Required"> *</span>}
              </span>
              <span className="char-slot-status">
                {part ? (
                  <span className="char-slot-equipped" title={part.sourceId}>
                    {part.sourceId}
                  </span>
                ) : (
                  <span className="char-slot-empty">—</span>
                )}
              </span>
              {isMissing && <span className="char-slot-badge missing-badge" title="Required slot is empty">{'\u26A0'}</span>}
              {hasIssue && !isMissing && <span className="char-slot-badge issue-badge" title="Has validation issue">{'\u25CF'}</span>}
            </div>
          );
        })}
      </div>

      {/* ── Selected slot detail ── */}
      {selectedSlot && (
        <div className="char-builder-detail" data-testid="char-slot-detail">
          <div className="char-detail-header">
            <span className="char-detail-slot-name">
              {CHARACTER_SLOT_LABELS[selectedSlot]}
            </span>
            <span className="char-detail-required-tag">
              {isSelectedRequired ? 'Required' : 'Optional'}
            </span>
          </div>

          {selectedPart ? (
            <div className="char-detail-equipped">
              <div className="char-detail-part-info">
                <span className="char-detail-part-label">Equipped:</span>
                <span className="char-detail-part-id" data-testid="char-detail-part-id">
                  {selectedPart.sourceId}
                </span>
              </div>
              {selectedPart.tags && selectedPart.tags.length > 0 && (
                <div className="char-detail-tags">
                  {selectedPart.tags.map((t) => (
                    <span key={t} className="char-detail-tag">{t}</span>
                  ))}
                </div>
              )}
              <div className="char-detail-actions">
                <button
                  className="char-builder-action-btn"
                  title="Remove from slot"
                  onClick={() => unequipSlot(selectedSlot)}
                  data-testid="char-remove-part-btn"
                >
                  Remove
                </button>
                <button
                  className="char-builder-action-btn char-replace-btn"
                  title="Replace with another part"
                  disabled
                  data-testid="char-replace-part-btn"
                >
                  Replace Part
                </button>
              </div>
            </div>
          ) : (
            <div className="char-detail-empty">
              <p className="char-detail-empty-msg">No part equipped in this slot.</p>
              <button
                className="char-builder-action-btn char-apply-btn"
                title="Choose a part for this slot"
                disabled
                data-testid="char-apply-part-btn"
              >
                Choose Part
              </button>
            </div>
          )}

          {selectedSlotIssues.length > 0 && (
            <div className="char-detail-issues" data-testid="char-slot-issues">
              {selectedSlotIssues.map((issue, i) => (
                <div
                  key={i}
                  className={`char-detail-issue ${issue.severity}`}
                >
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Validation issue list ── */}
      {validationIssues.length > 0 && (
        <div className="char-builder-issues" data-testid="char-issue-list">
          <div className="char-issues-header">Issues</div>
          {errors.map((issue, i) => (
            <div key={`e-${i}`} className="char-issue-row error">
              {issue.message}
            </div>
          ))}
          {warnings.map((issue, i) => (
            <div key={`w-${i}`} className="char-issue-row warning">
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
