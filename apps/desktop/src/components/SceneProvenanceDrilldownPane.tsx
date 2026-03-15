import {
  useSceneEditorStore,
  deriveProvenanceDiff,
  describeProvenanceDiff,
} from '@glyphstudio/state';
import type {
  SceneProvenanceEntry,
  SceneProvenanceDrilldownSource,
  SceneProvenanceDiff,
} from '@glyphstudio/state';

/** Format an ISO timestamp to a short HH:MM:SS display. */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

interface Props {
  sequence: number;
}

/** Render a structured summary for a diff. */
function DiffSummary({ diff }: { diff: SceneProvenanceDiff }) {
  const description = describeProvenanceDiff(diff);

  switch (diff.type) {
    case 'instance-added':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Name</span>
            <span className="provenance-drilldown-field-value">{diff.name}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Position</span>
            <span className="provenance-drilldown-field-value">({diff.position.x}, {diff.position.y})</span>
          </div>
        </div>
      );

    case 'instance-removed':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Name</span>
            <span className="provenance-drilldown-field-value">{diff.name}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Was at</span>
            <span className="provenance-drilldown-field-value">({diff.position.x}, {diff.position.y})</span>
          </div>
        </div>
      );

    case 'move':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Before</span>
            <span className="provenance-drilldown-field-value">({diff.before.x}, {diff.before.y})</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">After</span>
            <span className="provenance-drilldown-field-value">({diff.after.x}, {diff.after.y})</span>
          </div>
        </div>
      );

    case 'visibility':
    case 'opacity':
    case 'layer':
    case 'parallax':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );

    case 'clip':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );

    case 'unlink':
    case 'relink':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );

    case 'reapply':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
          {diff.slotChanges.length > 0 && (
            <div className="provenance-drilldown-slots">
              {diff.slotChanges.map((c) => (
                <div key={c.slot} className="provenance-drilldown-field">
                  <span className="provenance-drilldown-field-label">{c.slot}</span>
                  <span className="provenance-drilldown-field-value">{c.before ?? 'empty'} → {c.after ?? 'empty'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'set-override':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Slot</span>
            <span className="provenance-drilldown-field-value">{diff.slotId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );

    case 'remove-override':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Slot</span>
            <span className="provenance-drilldown-field-value">{diff.slotId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );

    case 'clear-all-overrides':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-field">
            <span className="provenance-drilldown-field-label">Instance</span>
            <span className="provenance-drilldown-field-value">{diff.instanceId}</span>
          </div>
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );

    case 'camera':
    case 'playback':
      return (
        <div className="provenance-drilldown-detail">
          <div className="provenance-drilldown-description">{description}</div>
        </div>
      );
  }
}

export function SceneProvenanceDrilldownPane({ sequence }: Props) {
  const provenance = useSceneEditorStore((s) => s.provenance);
  const drilldownBySequence = useSceneEditorStore((s) => s.drilldownBySequence);

  const entry: SceneProvenanceEntry | undefined = provenance.find((e) => e.sequence === sequence);
  if (!entry) {
    return (
      <div className="provenance-drilldown-pane">
        <div className="provenance-drilldown-fallback">
          Details for this activity entry are not available.
        </div>
      </div>
    );
  }

  const source: SceneProvenanceDrilldownSource | undefined = drilldownBySequence[sequence];
  if (!source) {
    return (
      <div className="provenance-drilldown-pane">
        <div className="provenance-drilldown-fallback">
          Details for this activity entry are not available.
        </div>
      </div>
    );
  }

  const diff = deriveProvenanceDiff(
    source.kind,
    source.beforeInstance ? [source.beforeInstance] : [],
    source.afterInstance ? [source.afterInstance] : [],
    source.metadata,
  );

  if (!diff) {
    return (
      <div className="provenance-drilldown-pane">
        <div className="provenance-drilldown-fallback">
          Details for this activity entry are not available.
        </div>
      </div>
    );
  }

  return (
    <div className="provenance-drilldown-pane">
      <div className="provenance-drilldown-header">
        <span className="provenance-drilldown-label">{entry.label}</span>
        <span className="provenance-drilldown-time">{formatTime(entry.timestamp)}</span>
      </div>
      <DiffSummary diff={diff} />
    </div>
  );
}
