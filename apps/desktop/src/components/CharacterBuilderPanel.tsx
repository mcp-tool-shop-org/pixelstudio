import { useCallback, useState } from 'react';
import {
  CHARACTER_SLOT_IDS,
  CHARACTER_SLOT_LABELS,
  REQUIRED_SLOTS,
} from '@glyphstudio/domain';
import type { CharacterPartPreset, CharacterSlotId } from '@glyphstudio/domain';
import {
  useCharacterStore,
  getEquippedPartForSlot,
  getMissingRequiredSlots,
  getCharacterErrors,
  getCharacterWarnings,
  isCharacterValid,
  getCompatiblePresetsForSlot,
  classifyAllPresetsForSlot,
  checkPlaceability,
  placeCharacterBuild,
} from '@glyphstudio/state';
import type { SceneAssetInstance } from '@glyphstudio/domain';

interface CharacterBuilderPanelProps {
  /** Available part presets for the picker. */
  partCatalog?: CharacterPartPreset[];
  /** Callback when library changes (for storage persistence). */
  onLibraryChange?: (library: import('@glyphstudio/domain').CharacterBuildLibrary) => void;
  /** Callback when a character build is placed into the scene. */
  onPlaceInScene?: (instance: SceneAssetInstance) => void;
}

/** Derive a slot's health status for badge display. */
function deriveSlotStatus(
  slotId: CharacterSlotId,
  hasPartEquipped: boolean,
  isRequired: boolean,
  hasError: boolean,
  hasWarning: boolean,
): 'missing' | 'error' | 'warning' | 'ready' | 'empty' {
  if (!hasPartEquipped && isRequired) return 'missing';
  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  if (hasPartEquipped) return 'ready';
  return 'empty';
}

/** Count how many slots have equipped parts. */
function countEquippedSlots(slots: Partial<Record<string, unknown>>): number {
  return Object.keys(slots).length;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  missing: { label: 'Missing', cls: 'char-status-missing' },
  error: { label: 'Error', cls: 'char-status-error' },
  warning: { label: 'Warning', cls: 'char-status-warning' },
  ready: { label: 'Ready', cls: 'char-status-ready' },
  empty: { label: '', cls: '' },
};

const TOTAL_SLOTS = CHARACTER_SLOT_IDS.length;

export function CharacterBuilderPanel({ partCatalog = [], onLibraryChange, onPlaceInScene }: CharacterBuilderPanelProps) {
  const build = useCharacterStore((s) => s.activeCharacterBuild);
  const selectedSlot = useCharacterStore((s) => s.selectedSlot);
  const validationIssues = useCharacterStore((s) => s.validationIssues);
  const isDirty = useCharacterStore((s) => s.isDirty);
  const activeSavedBuildId = useCharacterStore((s) => s.activeSavedBuildId);
  const createBuild = useCharacterStore((s) => s.createCharacterBuild);
  const clearBuild = useCharacterStore((s) => s.clearCharacterBuild);
  const setName = useCharacterStore((s) => s.setCharacterName);
  const selectSlot = useCharacterStore((s) => s.selectSlot);
  const unequipSlot = useCharacterStore((s) => s.unequipCharacterSlot);
  const equipPart = useCharacterStore((s) => s.equipCharacterPart);
  const library = useCharacterStore((s) => s.buildLibrary);
  const selectedLibraryBuildId = useCharacterStore((s) => s.selectedLibraryBuildId);
  const selectLibraryBuild = useCharacterStore((s) => s.selectLibraryBuild);
  const saveActiveBuild = useCharacterStore((s) => s.saveActiveBuildToLibrary);
  const saveAsNew = useCharacterStore((s) => s.saveAsNewToLibrary);
  const loadLibraryBuild = useCharacterStore((s) => s.loadLibraryBuildIntoActive);
  const duplicateLibraryBuild = useCharacterStore((s) => s.duplicateLibraryBuild);
  const deleteLibraryBuild = useCharacterStore((s) => s.deleteLibraryBuild);
  const revertToSaved = useCharacterStore((s) => s.revertToSaved);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showingPicker, setShowingPicker] = useState(false);
  const [showIncompatible, setShowIncompatible] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingLoadId, setConfirmingLoadId] = useState<string | null>(null);

  const state = useCharacterStore.getState();
  const errors = getCharacterErrors(state);
  const warnings = getCharacterWarnings(state);
  const valid = isCharacterValid(state);
  const missingSlots = getMissingRequiredSlots(state);

  // Save is disabled when clean+already saved, or no build
  const saveDisabled = !build || (!isDirty && activeSavedBuildId !== null);
  const canRevert = isDirty && activeSavedBuildId !== null;

  // Placeability
  const placeability = checkPlaceability(build, validationIssues);

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

  const handleApplyPreset = useCallback(
    (preset: CharacterPartPreset) => {
      equipPart(preset);
      setShowingPicker(false);
    },
    [equipPart],
  );

  const handleClear = useCallback(() => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearBuild();
    setConfirmingClear(false);
  }, [confirmingClear, clearBuild]);

  const handleSaveToLibrary = useCallback(() => {
    const updated = saveActiveBuild();
    if (updated && onLibraryChange) onLibraryChange(updated);
  }, [saveActiveBuild, onLibraryChange]);

  const handleSaveAsNew = useCallback(() => {
    const updated = saveAsNew();
    if (updated && onLibraryChange) onLibraryChange(updated);
  }, [saveAsNew, onLibraryChange]);

  const handleLoadFromLibrary = useCallback((buildId: string) => {
    if (isDirty && confirmingLoadId !== buildId) {
      setConfirmingLoadId(buildId);
      return;
    }
    loadLibraryBuild(buildId);
    setConfirmingDeleteId(null);
    setConfirmingLoadId(null);
  }, [isDirty, confirmingLoadId, loadLibraryBuild]);

  const handleCancelLoad = useCallback(() => {
    setConfirmingLoadId(null);
  }, []);

  const handleDuplicate = useCallback((buildId: string) => {
    const updated = duplicateLibraryBuild(buildId);
    if (updated && onLibraryChange) onLibraryChange(updated);
  }, [duplicateLibraryBuild, onLibraryChange]);

  const handleDelete = useCallback((buildId: string) => {
    if (confirmingDeleteId !== buildId) {
      setConfirmingDeleteId(buildId);
      return;
    }
    const updated = deleteLibraryBuild(buildId);
    if (updated && onLibraryChange) onLibraryChange(updated);
    setConfirmingDeleteId(null);
  }, [confirmingDeleteId, deleteLibraryBuild, onLibraryChange]);

  const handleRevert = useCallback(() => {
    revertToSaved();
  }, [revertToSaved]);

  const handlePlaceInScene = useCallback(() => {
    if (!build || !placeability.placeable) return;
    const instance = placeCharacterBuild(build);
    if (onPlaceInScene) onPlaceInScene(instance);
  }, [build, placeability.placeable, onPlaceInScene]);

  // ── Library section (shared between empty and active states) ──
  const librarySection = (
    <div className="char-library" data-testid="char-library">
      <div className="char-library-header">
        <span className="char-library-title">Saved Builds</span>
        <span className="char-library-count" data-testid="char-library-count">
          {library.builds.length}
        </span>
      </div>
      {library.builds.length === 0 ? (
        <div className="char-library-empty" data-testid="char-library-empty">
          {build ? (
            <>
              <p className="char-library-empty-msg">No saved builds yet.</p>
              <button
                className="char-builder-action-btn char-library-save-cta"
                onClick={handleSaveToLibrary}
                data-testid="char-library-save-cta"
              >
                Save Current Build
              </button>
            </>
          ) : (
            <p className="char-library-empty-msg">
              Saved builds will appear here after you create and save a character.
            </p>
          )}
        </div>
      ) : (
        <div className="char-library-list" data-testid="char-library-list">
          {library.builds.map((saved) => {
            const isSelected = selectedLibraryBuildId === saved.id;
            const isActive = activeSavedBuildId === saved.id;
            const equipped = countEquippedSlots(saved.slots);
            const isConfirmingDelete = confirmingDeleteId === saved.id;
            return (
              <div
                key={saved.id}
                className={`char-library-row${isSelected ? ' selected' : ''}${isActive ? ' active' : ''}`}
                onClick={() => selectLibraryBuild(saved.id)}
                data-testid={`char-library-row-${saved.id}`}
                data-selected={isSelected ? 'true' : 'false'}
                data-active={isActive ? 'true' : 'false'}
              >
                <div className="char-library-row-info">
                  <span className="char-library-row-name" data-testid={`char-library-name-${saved.id}`}>
                    {saved.name}
                  </span>
                  <span className="char-library-row-meta" data-testid={`char-library-meta-${saved.id}`}>
                    {equipped}/{TOTAL_SLOTS} slots{isActive ? ' · Active' : ''}
                  </span>
                  <span className="char-library-row-date" data-testid={`char-library-date-${saved.id}`}>
                    {new Date(saved.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="char-library-row-actions">
                  {confirmingLoadId === saved.id ? (
                    <>
                      <span className="char-library-load-warn" data-testid={`char-library-load-warn-${saved.id}`}>
                        Discard changes?
                      </span>
                      <button
                        className="char-builder-action-btn char-library-load-btn char-btn-confirm"
                        title="Discard unsaved changes and load"
                        onClick={(e) => { e.stopPropagation(); handleLoadFromLibrary(saved.id); }}
                        data-testid={`char-library-load-confirm-${saved.id}`}
                      >
                        Yes
                      </button>
                      <button
                        className="char-builder-action-btn char-library-load-btn"
                        title="Cancel"
                        onClick={(e) => { e.stopPropagation(); handleCancelLoad(); }}
                        data-testid={`char-library-load-cancel-${saved.id}`}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      className="char-builder-action-btn char-library-load-btn"
                      title="Load into editor"
                      onClick={(e) => { e.stopPropagation(); handleLoadFromLibrary(saved.id); }}
                      data-testid={`char-library-load-${saved.id}`}
                    >
                      Load
                    </button>
                  )}
                  <button
                    className="char-builder-action-btn char-library-dup-btn"
                    title="Duplicate"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(saved.id); }}
                    data-testid={`char-library-dup-${saved.id}`}
                  >
                    Dup
                  </button>
                  <button
                    className={`char-builder-action-btn char-library-del-btn${isConfirmingDelete ? ' char-btn-confirm' : ''}`}
                    title={isConfirmingDelete ? 'Click again to confirm' : 'Delete'}
                    onClick={(e) => { e.stopPropagation(); handleDelete(saved.id); }}
                    onBlur={() => setConfirmingDeleteId(null)}
                    data-testid={`char-library-del-${saved.id}`}
                  >
                    {isConfirmingDelete ? 'Confirm?' : 'Del'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
        {librarySection}
      </div>
    );
  }

  const selectedPart = selectedSlot ? getEquippedPartForSlot(state, selectedSlot) : undefined;
  const isSelectedRequired = selectedSlot
    ? (REQUIRED_SLOTS as readonly string[]).includes(selectedSlot)
    : false;
  const selectedSlotErrors = selectedSlot
    ? validationIssues.filter((i) => i.slot === selectedSlot && i.severity === 'error')
    : [];
  const selectedSlotWarnings = selectedSlot
    ? validationIssues.filter((i) => i.slot === selectedSlot && i.severity === 'warning')
    : [];
  const selectedSlotIssues = [...selectedSlotErrors, ...selectedSlotWarnings];
  // Related-slot issues: issues from other slots that reference this selected slot
  const relatedSlotIssues = selectedSlot
    ? validationIssues.filter((i) => i.relatedSlot === selectedSlot && i.slot !== selectedSlot)
    : [];

  // Compute candidates when picker is open
  const candidates = showingPicker && selectedSlot && build
    ? (showIncompatible
        ? classifyAllPresetsForSlot(partCatalog, selectedSlot, build)
        : getCompatiblePresetsForSlot(partCatalog, selectedSlot, build))
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
          {isDirty && (
            <span className="char-dirty-indicator" data-testid="char-dirty-indicator">
              Unsaved changes
            </span>
          )}
          <span className="char-build-status" data-testid="char-build-status">
            {activeSavedBuildId ? (isDirty ? 'Modified' : 'Saved') : 'New build'}
          </span>
        </div>
        <div className="char-builder-header-actions">
          <button
            className="char-builder-action-btn char-save-btn"
            title={saveDisabled ? 'No changes to save' : 'Save to library'}
            onClick={handleSaveToLibrary}
            disabled={saveDisabled}
            data-testid="char-save-btn"
          >
            Save
          </button>
          <button
            className="char-builder-action-btn char-save-as-btn"
            title="Save as new build"
            onClick={handleSaveAsNew}
            data-testid="char-save-as-btn"
          >
            Save As New
          </button>
          {canRevert && (
            <button
              className="char-builder-action-btn char-revert-btn"
              title="Revert to last saved version"
              onClick={handleRevert}
              data-testid="char-revert-btn"
            >
              Revert
            </button>
          )}
          <button
            className="char-builder-action-btn char-place-btn"
            title={placeability.placeable ? 'Place in scene' : placeability.reason ?? 'Cannot place'}
            onClick={handlePlaceInScene}
            disabled={!placeability.placeable}
            data-testid="char-place-btn"
          >
            Place in Scene
          </button>
          {!placeability.placeable && placeability.reason && build && (
            <span className="char-place-reason" data-testid="char-place-reason">
              {placeability.reason}
            </span>
          )}
          <button
            className="char-builder-action-btn"
            title="New build"
            onClick={() => {
              createBuild();
              setConfirmingClear(false);
            }}
            data-testid="char-new-btn"
          >
            +
          </button>
          <button
            className={`char-builder-action-btn${confirmingClear ? ' char-btn-confirm' : ''}`}
            title={confirmingClear ? 'Click again to confirm' : 'Clear build'}
            onClick={handleClear}
            onBlur={() => setConfirmingClear(false)}
            data-testid="char-clear-btn"
          >
            {confirmingClear ? 'Confirm?' : '\u2715'}
          </button>
        </div>
      </div>

      {/* ── Validation summary ── */}
      <div
        className={`char-builder-validation${valid ? ' char-validation-valid' : ''}`}
        data-testid="char-validation-summary"
      >
        {valid ? (
          <div className="char-validation-ok-block" data-testid="char-valid-state">
            <span className="char-validation-ok">{'\u2713'} Valid build</span>
            <span className="char-validation-ok-sub">All required slots filled</span>
          </div>
        ) : (
          <div className="char-validation-error-block">
            <span className="char-validation-errors">
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {warnings.length > 0 && (
          <span className="char-validation-warnings">
            {'\u26A0'} {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Slot list ── */}
      <div className="char-builder-slots" data-testid="char-slot-list">
        {CHARACTER_SLOT_IDS.map((slotId) => {
          const part = getEquippedPartForSlot(state, slotId);
          const isRequired = (REQUIRED_SLOTS as readonly string[]).includes(slotId);
          const slotErrors = validationIssues.filter((i) => i.slot === slotId && i.severity === 'error');
          const slotWarnings = validationIssues.filter((i) => i.slot === slotId && i.severity === 'warning');
          const isMissing = isRequired && !part;
          const isSelected = selectedSlot === slotId;
          const status = deriveSlotStatus(slotId, !!part, isRequired, slotErrors.length > 0, slotWarnings.length > 0);
          const badge = STATUS_BADGE[status];

          const cls = [
            'char-slot-row',
            isSelected ? 'selected' : '',
            `slot-${status}`,
          ].filter(Boolean).join(' ');

          return (
            <div
              key={slotId}
              className={cls}
              onClick={() => {
                selectSlot(slotId);
                setShowingPicker(false);
                setConfirmingClear(false);
              }}
              data-testid={`char-slot-${slotId}`}
              data-slot={slotId}
              data-status={status}
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
                  <span className="char-slot-empty">{'\u2014'}</span>
                )}
              </span>
              {badge.label && (
                <span
                  className={`char-slot-badge ${badge.cls}`}
                  data-testid={`char-badge-${slotId}`}
                >
                  {badge.label}
                </span>
              )}
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
            <span className={`char-detail-required-tag ${isSelectedRequired ? 'tag-required' : 'tag-optional'}`}>
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
                  title="Remove part from this slot"
                  onClick={() => unequipSlot(selectedSlot)}
                  data-testid="char-remove-part-btn"
                >
                  Remove
                </button>
                <button
                  className="char-builder-action-btn char-replace-btn"
                  title="Replace with a different part"
                  onClick={() => setShowingPicker(true)}
                  data-testid="char-replace-part-btn"
                >
                  Replace Part
                </button>
              </div>
            </div>
          ) : (
            <div className="char-detail-empty">
              {isSelectedRequired ? (
                <p className="char-detail-empty-msg char-detail-required-hint" data-testid="char-required-hint">
                  This slot is required. Choose a part to complete your build.
                </p>
              ) : (
                <p className="char-detail-empty-msg">No part equipped in this slot.</p>
              )}
              <button
                className="char-builder-action-btn char-apply-btn"
                title="Choose a part for this slot"
                onClick={() => setShowingPicker(true)}
                data-testid="char-apply-part-btn"
              >
                Choose Part
              </button>
            </div>
          )}

          {/* ── Preset picker ── */}
          {showingPicker && (
            <div className="char-preset-picker" data-testid="char-preset-picker">
              <div className="char-preset-picker-header">
                <span className="char-preset-picker-title">
                  Choose part for {CHARACTER_SLOT_LABELS[selectedSlot]}
                </span>
                <button
                  className="char-builder-action-btn char-preset-picker-close"
                  onClick={() => setShowingPicker(false)}
                  data-testid="char-picker-close-btn"
                >
                  {'\u2715'}
                </button>
              </div>
              {selectedPart && (
                <div className="char-preset-current" data-testid="char-picker-current">
                  Current: <span className="char-preset-current-id">{selectedPart.sourceId}</span>
                </div>
              )}
              {partCatalog.length > 0 && (
                <label className="char-preset-toggle" data-testid="char-picker-incompat-toggle">
                  <input
                    type="checkbox"
                    checked={showIncompatible}
                    onChange={(e) => setShowIncompatible(e.target.checked)}
                  />
                  <span>Show incompatible</span>
                </label>
              )}
              {candidates.length === 0 ? (
                <div className="char-preset-picker-empty" data-testid="char-picker-empty">
                  {partCatalog.length === 0
                    ? 'No parts in catalog.'
                    : `No compatible parts available for ${CHARACTER_SLOT_LABELS[selectedSlot]}.`}
                </div>
              ) : (
                <div className="char-preset-picker-list" data-testid="char-picker-list">
                  {candidates.map((candidate) => {
                    const isCurrent = selectedPart?.sourceId === candidate.preset.sourceId;
                    return (
                      <div
                        key={candidate.preset.sourceId}
                        className={`char-preset-candidate ${candidate.tier}${isCurrent ? ' current' : ''}`}
                        data-testid={`char-candidate-${candidate.preset.sourceId}`}
                        data-tier={candidate.tier}
                      >
                        <div className="char-candidate-info">
                          <span className="char-candidate-name">
                            {candidate.preset.name}
                            {isCurrent && <span className="char-candidate-current-tag"> (current)</span>}
                          </span>
                          {candidate.preset.description && (
                            <span className="char-candidate-desc">{candidate.preset.description}</span>
                          )}
                          <span className={`char-candidate-tier-badge tier-${candidate.tier}`} data-testid={`char-tier-badge-${candidate.preset.sourceId}`}>
                            {candidate.tier === 'compatible' ? 'Compatible' : candidate.tier === 'warning' ? 'Warning' : 'Incompatible'}
                          </span>
                          {candidate.tier === 'warning' && (
                            <div className="char-candidate-warnings" data-testid="char-candidate-warnings">
                              {candidate.reasons.map((reason, i) => (
                                <span key={i} className="char-candidate-warning-reason">
                                  {'\u26A0'} {reason}
                                </span>
                              ))}
                            </div>
                          )}
                          {candidate.tier === 'incompatible' && (
                            <div className="char-candidate-warnings">
                              {candidate.reasons.map((reason, i) => (
                                <span key={i} className="char-candidate-warning-reason char-candidate-incompat-reason">
                                  {'\u2715'} {reason}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          className="char-builder-action-btn char-candidate-apply-btn"
                          onClick={() => handleApplyPreset(candidate.preset)}
                          disabled={candidate.tier === 'incompatible'}
                          data-testid={`char-apply-${candidate.preset.sourceId}`}
                        >
                          {isCurrent ? 'Re-equip' : selectedPart ? 'Replace' : 'Equip'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Slot-specific issues ── */}
          {selectedSlotIssues.length > 0 && (
            <div className="char-detail-issues" data-testid="char-slot-issues">
              <div className="char-detail-issues-header">Slot issues</div>
              {selectedSlotErrors.map((issue, i) => (
                <div key={`e-${i}`} className="char-detail-issue error">
                  {issue.message}
                  {issue.relatedSlot && (
                    <span className="char-issue-related-slot"> ({CHARACTER_SLOT_LABELS[issue.relatedSlot]})</span>
                  )}
                </div>
              ))}
              {selectedSlotWarnings.map((issue, i) => (
                <div key={`w-${i}`} className="char-detail-issue warning">
                  {issue.message}
                  {issue.relatedSlot && (
                    <span className="char-issue-related-slot"> ({CHARACTER_SLOT_LABELS[issue.relatedSlot]})</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {relatedSlotIssues.length > 0 && (
            <div className="char-detail-related-issues" data-testid="char-related-issues">
              <div className="char-detail-issues-header">Related issues</div>
              {relatedSlotIssues.map((issue, i) => (
                <div key={`r-${i}`} className="char-detail-issue warning">
                  {issue.message}
                  {issue.slot && (
                    <span className="char-issue-related-slot"> (from {CHARACTER_SLOT_LABELS[issue.slot]})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Validation issue list (grouped) ── */}
      {validationIssues.length > 0 && (
        <div className="char-builder-issues" data-testid="char-issue-list">
          {errors.length > 0 && (
            <div className="char-issues-group" data-testid="char-issue-errors">
              <div className="char-issues-header">Errors ({errors.length})</div>
              {errors.map((issue, i) => (
                <div key={`e-${i}`} className="char-issue-row error">
                  {issue.slot && (
                    <span className="char-issue-slot-badge">{CHARACTER_SLOT_LABELS[issue.slot]}</span>
                  )}
                  <span className="char-issue-message">{issue.message}</span>
                </div>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="char-issues-group" data-testid="char-issue-warnings">
              <div className="char-issues-header">Warnings ({warnings.length})</div>
              {warnings.map((issue, i) => (
                <div key={`w-${i}`} className="char-issue-row warning">
                  {issue.slot && (
                    <span className="char-issue-slot-badge">{CHARACTER_SLOT_LABELS[issue.slot]}</span>
                  )}
                  <span className="char-issue-message">{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Build Library ── */}
      {librarySection}
    </div>
  );
}
