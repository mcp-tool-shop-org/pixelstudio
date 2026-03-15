import { useState, useEffect } from 'react';
import { useSceneEditorStore } from '@glyphstudio/state';
import type { SceneProvenanceEntry } from '@glyphstudio/state';
import { SceneProvenanceDrilldownPane } from './SceneProvenanceDrilldownPane';

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
  if ('changedFields' in meta && meta.changedFields?.length) {
    return `Fields: ${meta.changedFields.join(', ')}`;
  }
  return null;
}

export function SceneProvenancePanel() {
  const provenance = useSceneEditorStore((s) => s.provenance);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);

  // Clear selection when the selected entry no longer exists (e.g. after reset)
  useEffect(() => {
    if (selectedSequence !== null) {
      const exists = provenance.some((e) => e.sequence === selectedSequence);
      if (!exists) {
        setSelectedSequence(null);
      }
    }
  }, [provenance, selectedSequence]);

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

  return (
    <div className="scene-provenance-panel">
      <div className="scene-provenance-header">
        <span className="scene-provenance-title">Activity</span>
        <span className="scene-provenance-count">{provenance.length}</span>
      </div>
      <div className="scene-provenance-body">
        <div className="scene-provenance-list">
          {reversed.map((entry) => {
            const meta = metadataSummary(entry);
            const isSelected = entry.sequence === selectedSequence;
            return (
              <div
                key={entry.sequence}
                className={`scene-provenance-row${isSelected ? ' selected' : ''}`}
                onClick={() => setSelectedSequence(entry.sequence)}
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
          {selectedSequence !== null ? (
            <SceneProvenanceDrilldownPane sequence={selectedSequence} />
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
