import { useState, useEffect, useCallback } from 'react';
import { useSceneEditorStore } from '@glyphstudio/state';
import type { SceneProvenanceEntry } from '@glyphstudio/state';
import { SceneProvenanceDrilldownPane } from './SceneProvenanceDrilldownPane';
import { SceneComparisonPane } from './SceneComparisonPane';
import { SceneRestorePreviewPane } from './SceneRestorePreviewPane';

/** View mode for the detail pane. */
type PanelMode =
  | { type: 'drilldown' }
  | { type: 'compare-current'; primarySequence: number }
  | { type: 'compare-entry'; primarySequence: number; secondarySequence: number }
  | { type: 'picking-target'; primarySequence: number }
  | { type: 'restore-preview'; sequence: number };

/** Format an ISO timestamp to a short HH:MM:SS display. */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

/** Extract a short metadata summary for display. */
function metadataSummary(entry: SceneProvenanceEntry): string | null {
  const meta = entry.metadata;
  if (!meta) return null;

  if ('slotId' in meta) {
    return `Instance: ${meta.instanceId} \u00B7 Slot: ${meta.slotId}`;
  }
  if ('instanceId' in meta) {
    return `Instance: ${meta.instanceId}`;
  }
  if ('tick' in meta && typeof meta.tick === 'number') {
    if ('previousTick' in meta && meta.previousTick !== undefined) {
      return `Tick ${meta.previousTick} \u2192 ${meta.tick}`;
    }
    if ('changedFields' in meta && meta.changedFields?.length) {
      return `Tick ${meta.tick} \u00B7 ${meta.changedFields.join(', ')}`;
    }
    return `Tick ${meta.tick}`;
  }
  if ('changedFields' in meta && meta.changedFields?.length) {
    return `Fields: ${meta.changedFields.join(', ')}`;
  }
  return null;
}

export function SceneProvenancePanel() {
  const provenance = useSceneEditorStore((s) => s.provenance);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>({ type: 'drilldown' });

  // Clear selection and exit compare when the selected entry no longer exists
  useEffect(() => {
    if (selectedSequence !== null) {
      const exists = provenance.some((e) => e.sequence === selectedSequence);
      if (!exists) {
        setSelectedSequence(null);
        setPanelMode({ type: 'drilldown' });
      }
    }
  }, [provenance, selectedSequence]);

  // Clear compare mode on scene reset (provenance goes empty)
  useEffect(() => {
    if (provenance.length === 0 && panelMode.type !== 'drilldown') {
      setPanelMode({ type: 'drilldown' });
    }
  }, [provenance.length, panelMode.type]);

  const handleCompareToCurrent = useCallback(() => {
    if (selectedSequence !== null) {
      setPanelMode({ type: 'compare-current', primarySequence: selectedSequence });
    }
  }, [selectedSequence]);

  const handleCompareToEntry = useCallback(() => {
    if (selectedSequence !== null) {
      setPanelMode({ type: 'picking-target', primarySequence: selectedSequence });
    }
  }, [selectedSequence]);

  const handleRestorePreview = useCallback(() => {
    if (selectedSequence !== null) {
      setPanelMode({ type: 'restore-preview', sequence: selectedSequence });
    }
  }, [selectedSequence]);

  const handleCloseCompare = useCallback(() => {
    setPanelMode({ type: 'drilldown' });
  }, []);

  const handleRowClick = useCallback((sequence: number) => {
    if (panelMode.type === 'picking-target') {
      // In target-pick mode, clicking a row selects the secondary entry
      if (sequence !== panelMode.primarySequence) {
        setPanelMode({
          type: 'compare-entry',
          primarySequence: panelMode.primarySequence,
          secondarySequence: sequence,
        });
      }
      return;
    }
    setSelectedSequence(sequence);
    // Exit compare mode when selecting a new row normally
    if (panelMode.type !== 'drilldown') {
      setPanelMode({ type: 'drilldown' });
    }
  }, [panelMode]);

  if (provenance.length === 0) {
    return (
      <div className="scene-provenance-panel">
        <div className="scene-provenance-header">
          <span className="scene-provenance-title">Activity</span>
        </div>
        <div className="scene-provenance-empty">
          <div>No scene changes recorded.</div>
          <div>Edits will appear here as you work.</div>
        </div>
      </div>
    );
  }

  // Render newest first — reversed copy, do not mutate store
  const reversed = [...provenance].reverse();

  const isPickingTarget = panelMode.type === 'picking-target';
  const isComparing = panelMode.type === 'compare-current' || panelMode.type === 'compare-entry';
  const isRestorePreview = panelMode.type === 'restore-preview';

  return (
    <div className="scene-provenance-panel">
      <div className="scene-provenance-header">
        <span className="scene-provenance-title">Activity</span>
        <span className="scene-provenance-count">{provenance.length}</span>
      </div>
      {isPickingTarget && (
        <div className="scene-provenance-pick-banner">
          <span>Select another entry to compare</span>
          <button className="scene-provenance-pick-cancel" onClick={handleCloseCompare}>
            Cancel
          </button>
        </div>
      )}
      <div className="scene-provenance-body">
        <div className="scene-provenance-list">
          {reversed.map((entry) => {
            const meta = metadataSummary(entry);
            const isSelected = entry.sequence === selectedSequence;
            const isPrimary = (panelMode.type === 'picking-target' || panelMode.type === 'compare-entry') &&
              'primarySequence' in panelMode && panelMode.primarySequence === entry.sequence;
            const isSecondary = panelMode.type === 'compare-entry' &&
              panelMode.secondarySequence === entry.sequence;
            let rowClass = 'scene-provenance-row';
            if (isSelected && !isPickingTarget) rowClass += ' selected';
            if (isPrimary) rowClass += ' compare-primary';
            if (isSecondary) rowClass += ' compare-secondary';
            return (
              <div
                key={entry.sequence}
                className={rowClass}
                onClick={() => handleRowClick(entry.sequence)}
                data-sequence={entry.sequence}
              >
                <div className="scene-provenance-row-primary">
                  <span className="scene-provenance-label">{entry.label}</span>
                  <span className="scene-provenance-time">{formatTime(entry.timestamp)}</span>
                </div>
                {meta && (
                  <div className="scene-provenance-row-meta" title={meta}>
                    {meta}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="scene-provenance-drilldown">
          {isComparing ? (
            <SceneComparisonPane
              mode={panelMode.type === 'compare-current' ? 'compare-current' : 'compare-entry'}
              primarySequence={'primarySequence' in panelMode ? panelMode.primarySequence : 0}
              secondarySequence={panelMode.type === 'compare-entry' ? panelMode.secondarySequence : undefined}
              onClose={handleCloseCompare}
            />
          ) : isRestorePreview ? (
            <SceneRestorePreviewPane
              sequence={panelMode.sequence}
              onClose={handleCloseCompare}
            />
          ) : selectedSequence !== null ? (
            <>
              <SceneProvenanceDrilldownPane sequence={selectedSequence} />
              {!isPickingTarget && (
                <div className="provenance-compare-actions">
                  <button className="provenance-compare-btn" data-action="compare-current" onClick={handleCompareToCurrent}>
                    Compare to Current
                  </button>
                  <button className="provenance-compare-btn" data-action="compare-entry" onClick={handleCompareToEntry}>
                    Compare to...
                  </button>
                  <button className="provenance-compare-btn" data-action="restore-preview" onClick={handleRestorePreview}>
                    Preview Restore Impact
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="provenance-drilldown-pane">
              <div className="provenance-drilldown-placeholder">
                Select an activity entry to inspect what changed.
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="scene-provenance-footer">
        Scene activity log
      </div>
    </div>
  );
}
