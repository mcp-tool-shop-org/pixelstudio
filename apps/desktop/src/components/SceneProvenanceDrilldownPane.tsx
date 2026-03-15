import {
  useSceneEditorStore,
  deriveProvenanceDiff,
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

/** Format a 0–1 opacity as a readable percentage. */
function fmtOpacity(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ── Shared field row ──

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="provenance-drilldown-field">
      <span className="provenance-drilldown-field-label">{label}</span>
      <span className="provenance-drilldown-field-value">{value}</span>
    </div>
  );
}

function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="provenance-drilldown-before-after">
      <span className="provenance-drilldown-ba-label">{label}</span>
      <div className="provenance-drilldown-ba-row">
        <span className="provenance-drilldown-ba-tag">Before</span>
        <span className="provenance-drilldown-field-value">{before}</span>
      </div>
      <div className="provenance-drilldown-ba-row">
        <span className="provenance-drilldown-ba-tag">After</span>
        <span className="provenance-drilldown-field-value">{after}</span>
      </div>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return <div className="provenance-drilldown-note">{text}</div>;
}

// ── Instance lifecycle ──

function InstanceLifecycleDiffView({ diff }: { diff: SceneProvenanceDiff }) {
  if (diff.type === 'instance-added') {
    return (
      <div className="provenance-drilldown-detail" data-family="lifecycle">
        <Field label="Instance" value={diff.instanceId} />
        <Field label="Name" value={diff.name} />
        <Field label="Position" value={`(${diff.position.x}, ${diff.position.y})`} />
      </div>
    );
  }
  if (diff.type === 'instance-removed') {
    return (
      <div className="provenance-drilldown-detail" data-family="lifecycle">
        <Field label="Instance" value={diff.instanceId} />
        <Field label="Name" value={diff.name} />
        <Field label="Was at" value={`(${diff.position.x}, ${diff.position.y})`} />
      </div>
    );
  }
  return null;
}

// ── Move ──

function InstanceMoveDiffView({ diff }: { diff: SceneProvenanceDiff }) {
  if (diff.type !== 'move') return null;
  return (
    <div className="provenance-drilldown-detail" data-family="move">
      <Field label="Instance" value={diff.instanceId} />
      <BeforeAfter
        label="Position"
        before={`(${diff.before.x}, ${diff.before.y})`}
        after={`(${diff.after.x}, ${diff.after.y})`}
      />
    </div>
  );
}

// ── Property changes ──

function InstancePropertyDiffView({ diff }: { diff: SceneProvenanceDiff }) {
  switch (diff.type) {
    case 'visibility':
      return (
        <div className="provenance-drilldown-detail" data-family="property">
          <Field label="Instance" value={diff.instanceId} />
          <BeforeAfter
            label="Visibility"
            before={diff.before ? 'Visible' : 'Hidden'}
            after={diff.after ? 'Visible' : 'Hidden'}
          />
        </div>
      );
    case 'opacity':
      return (
        <div className="provenance-drilldown-detail" data-family="property">
          <Field label="Instance" value={diff.instanceId} />
          <BeforeAfter
            label="Opacity"
            before={fmtOpacity(diff.before)}
            after={fmtOpacity(diff.after)}
          />
        </div>
      );
    case 'layer':
      return (
        <div className="provenance-drilldown-detail" data-family="property">
          <Field label="Instance" value={diff.instanceId} />
          <BeforeAfter label="Layer" before={String(diff.before)} after={String(diff.after)} />
        </div>
      );
    case 'clip':
      return (
        <div className="provenance-drilldown-detail" data-family="property">
          <Field label="Instance" value={diff.instanceId} />
          <BeforeAfter label="Clip" before={diff.before ?? 'none'} after={diff.after ?? 'none'} />
        </div>
      );
    case 'parallax':
      return (
        <div className="provenance-drilldown-detail" data-family="property">
          <Field label="Instance" value={diff.instanceId} />
          <BeforeAfter label="Parallax" before={diff.before.toFixed(1)} after={diff.after.toFixed(1)} />
        </div>
      );
    default:
      return null;
  }
}

// ── Character source relationship ──

function CharacterSourceDiffView({ diff }: { diff: SceneProvenanceDiff }) {
  if (diff.type === 'unlink') {
    return (
      <div className="provenance-drilldown-detail" data-family="source">
        <Field label="Instance" value={diff.instanceId} />
        {diff.buildName && <Field label="Build" value={diff.buildName} />}
        <BeforeAfter label="Link mode" before="Linked" after="Unlinked" />
        <Note text="Snapshot and overrides preserved. Source relationship detached." />
      </div>
    );
  }
  if (diff.type === 'relink') {
    return (
      <div className="provenance-drilldown-detail" data-family="source">
        <Field label="Instance" value={diff.instanceId} />
        {diff.buildName && <Field label="Build" value={diff.buildName} />}
        <BeforeAfter label="Link mode" before="Unlinked" after="Linked" />
        <Note text="Source relationship restored. Snapshot not rewritten by relink." />
      </div>
    );
  }
  if (diff.type === 'reapply') {
    return (
      <div className="provenance-drilldown-detail" data-family="source">
        <Field label="Instance" value={diff.instanceId} />
        {diff.slotChanges.length === 0 ? (
          <Note text="Reapplied from source. No slot changes detected." />
        ) : (
          <>
            <div className="provenance-drilldown-section-label">Slot changes</div>
            <div className="provenance-drilldown-slots">
              {diff.slotChanges.map((c) => (
                <BeforeAfter
                  key={c.slot}
                  label={c.slot}
                  before={c.before ?? 'empty'}
                  after={c.after ?? 'empty'}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  return null;
}

// ── Character override ──

function CharacterOverrideDiffView({ diff }: { diff: SceneProvenanceDiff }) {
  if (diff.type === 'set-override') {
    const modeLabel = diff.mode === 'remove' ? 'Remove part' : 'Replace part';
    return (
      <div className="provenance-drilldown-detail" data-family="override">
        <Field label="Instance" value={diff.instanceId} />
        <Field label="Slot" value={diff.slotId} />
        <Field label="Mode" value={modeLabel} />
        {diff.replacementPartId && <Field label="Replacement" value={diff.replacementPartId} />}
      </div>
    );
  }
  if (diff.type === 'remove-override') {
    return (
      <div className="provenance-drilldown-detail" data-family="override">
        <Field label="Instance" value={diff.instanceId} />
        <Field label="Slot" value={diff.slotId} />
        {diff.previousMode && <Field label="Was" value={diff.previousMode === 'remove' ? 'Remove part' : 'Replace part'} />}
        {diff.previousPartId && <Field label="Was part" value={diff.previousPartId} />}
        <Note text="Override cleared. Slot reverted to source snapshot." />
      </div>
    );
  }
  if (diff.type === 'clear-all-overrides') {
    return (
      <div className="provenance-drilldown-detail" data-family="override">
        <Field label="Instance" value={diff.instanceId} />
        <BeforeAfter label="Overrides" before={String(diff.count)} after="0" />
        {diff.clearedSlots.length > 0 && (
          <Field label="Cleared slots" value={diff.clearedSlots.join(', ')} />
        )}
        <Note text="All overrides removed. Instance reverted to source snapshot." />
      </div>
    );
  }
  return null;
}

// ── Camera / playback ──

function CameraPlaybackDiffView({ diff }: { diff: SceneProvenanceDiff }) {
  if (diff.type === 'camera') {
    return (
      <div className="provenance-drilldown-detail" data-family="camera">
        {diff.changedFields?.length ? (
          <Field label="Changed" value={diff.changedFields.join(', ')} />
        ) : (
          <Note text="Camera settings changed." />
        )}
      </div>
    );
  }
  if (diff.type === 'playback') {
    return (
      <div className="provenance-drilldown-detail" data-family="camera">
        <Note text="Playback settings changed." />
      </div>
    );
  }
  return null;
}

// ── Main dispatcher ──

function DiffSummary({ diff }: { diff: SceneProvenanceDiff }) {
  switch (diff.type) {
    case 'instance-added':
    case 'instance-removed':
      return <InstanceLifecycleDiffView diff={diff} />;
    case 'move':
      return <InstanceMoveDiffView diff={diff} />;
    case 'visibility':
    case 'opacity':
    case 'layer':
    case 'clip':
    case 'parallax':
      return <InstancePropertyDiffView diff={diff} />;
    case 'unlink':
    case 'relink':
    case 'reapply':
      return <CharacterSourceDiffView diff={diff} />;
    case 'set-override':
    case 'remove-override':
    case 'clear-all-overrides':
      return <CharacterOverrideDiffView diff={diff} />;
    case 'camera':
    case 'playback':
      return <CameraPlaybackDiffView diff={diff} />;
  }
}

// ── Props ──

interface Props {
  sequence: number;
}

// ── Pane ──

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
