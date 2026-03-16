import { useMemo } from 'react';
import {
  useSceneEditorStore,
  createCurrentAnchor,
  createEntryAnchor,
  createComparisonRequest,
  deriveSceneComparison,
  describeComparison,
} from '@glyphstudio/state';
import type {
  SceneComparisonResult,
  InstanceComparisonSection,
  InstanceComparisonEntry,
  CameraComparisonSection,
  KeyframeComparisonSection,
  KeyframeComparisonEntry,
  PlaybackComparisonSection,
  SceneComparisonSnapshot,
} from '@glyphstudio/state';

// ── Shared rendering helpers ──

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

function SectionLabel({ text }: { text: string }) {
  return <div className="comparison-section-label">{text}</div>;
}

// ── Instance section ──

function InstanceEntryView({ entry }: { entry: InstanceComparisonEntry }) {
  return (
    <div className="comparison-instance-entry" data-status={entry.status}>
      <div className="comparison-instance-header">
        <span className="comparison-instance-name">{entry.name}</span>
        <span className="comparison-instance-status">{entry.status}</span>
      </div>
      {entry.fieldDiffs.map((d) => (
        <BeforeAfter key={d.field} label={d.label} before={d.before} after={d.after} />
      ))}
    </div>
  );
}

function InstanceSectionView({ section }: { section: InstanceComparisonSection }) {
  if (section.status === 'unchanged') return null;
  return (
    <div className="comparison-section" data-domain="instances">
      <SectionLabel text="Instances" />
      <div className="comparison-section-summary">
        {section.added > 0 && <span>{section.added} added</span>}
        {section.removed > 0 && <span>{section.removed} removed</span>}
        {section.changed > 0 && <span>{section.changed} changed</span>}
      </div>
      {section.entries.map((e) => (
        <InstanceEntryView key={e.instanceId} entry={e} />
      ))}
    </div>
  );
}

// ── Camera section ──

function CameraSectionView({ section }: { section: CameraComparisonSection }) {
  if (section.status === 'unchanged' || section.status === 'unavailable') return null;
  return (
    <div className="comparison-section" data-domain="camera">
      <SectionLabel text="Camera" />
      {section.before && section.after ? (
        <>
          {section.changedFields.includes('x') && (
            <BeforeAfter label="Pan X" before={String(section.before.x)} after={String(section.after.x)} />
          )}
          {section.changedFields.includes('y') && (
            <BeforeAfter label="Pan Y" before={String(section.before.y)} after={String(section.after.y)} />
          )}
          {section.changedFields.includes('zoom') && (
            <BeforeAfter label="Zoom" before={String(section.before.zoom)} after={String(section.after.zoom)} />
          )}
        </>
      ) : (
        <div className="comparison-note">Camera data available on one side only.</div>
      )}
    </div>
  );
}

// ── Keyframe section ──

function KeyframeEntryView({ entry }: { entry: KeyframeComparisonEntry }) {
  return (
    <div className="comparison-keyframe-entry" data-status={entry.status}>
      <span className="comparison-keyframe-tick">Tick {entry.tick}</span>
      <span className="comparison-keyframe-status">{entry.status}</span>
      {entry.status === 'changed' && entry.changedFields.length > 0 && (
        <span className="comparison-keyframe-fields">{entry.changedFields.join(', ')}</span>
      )}
    </div>
  );
}

function KeyframeSectionView({ section }: { section: KeyframeComparisonSection }) {
  if (section.status === 'unchanged' || section.status === 'unavailable') return null;
  return (
    <div className="comparison-section" data-domain="keyframes">
      <SectionLabel text="Keyframes" />
      {section.entries.map((e) => (
        <KeyframeEntryView key={e.tick} entry={e} />
      ))}
    </div>
  );
}

// ── Playback section ──

function PlaybackSectionView({ section }: { section: PlaybackComparisonSection }) {
  if (section.status === 'unchanged' || section.status === 'unavailable') return null;
  return (
    <div className="comparison-section" data-domain="playback">
      <SectionLabel text="Playback" />
      {section.before && section.after ? (
        <>
          {section.changedFields.includes('fps') && (
            <BeforeAfter label="FPS" before={String(section.before.fps)} after={String(section.after.fps)} />
          )}
          {section.changedFields.includes('looping') && (
            <BeforeAfter
              label="Looping"
              before={section.before.looping ? 'Yes' : 'No'}
              after={section.after.looping ? 'Yes' : 'No'}
            />
          )}
        </>
      ) : (
        <div className="comparison-note">Playback data available on one side only.</div>
      )}
    </div>
  );
}

// ── Unavailable sections ──

function UnavailableSections({ result }: { result: SceneComparisonResult }) {
  const unavailable: string[] = [];
  if (result.camera.status === 'unavailable') unavailable.push('Camera');
  if (result.keyframes.status === 'unavailable') unavailable.push('Keyframes');
  if (result.playback.status === 'unavailable') unavailable.push('Playback');
  if (unavailable.length === 0) return null;
  return (
    <div className="comparison-unavailable">
      {unavailable.join(', ')}: no data available for comparison.
    </div>
  );
}

// ── Props ──

export interface SceneComparisonPaneProps {
  mode: 'compare-current' | 'compare-entry';
  primarySequence: number;
  secondarySequence?: number;
  onClose: () => void;
}

// ── Pane ──

export function SceneComparisonPane({
  mode,
  primarySequence,
  secondarySequence,
  onClose,
}: SceneComparisonPaneProps) {
  const provenance = useSceneEditorStore((s) => s.provenance);
  const drilldownBySequence = useSceneEditorStore((s) => s.drilldownBySequence);
  const instances = useSceneEditorStore((s) => s.instances);
  const camera = useSceneEditorStore((s) => s.camera);
  const keyframes = useSceneEditorStore((s) => s.keyframes);
  const playbackConfig = useSceneEditorStore((s) => s.playbackConfig);

  const result = useMemo((): SceneComparisonResult | null => {
    const primaryEntry = provenance.find((e) => e.sequence === primarySequence);
    if (!primaryEntry) return null;
    const primarySource = drilldownBySequence[primarySequence];
    if (!primarySource) return null;

    if (mode === 'compare-current') {
      const currentSnapshot: SceneComparisonSnapshot = {
        instances,
        camera,
        keyframes,
        playbackConfig,
      };
      const left = createEntryAnchor(primaryEntry, primarySource);
      const right = createCurrentAnchor(currentSnapshot);
      return deriveSceneComparison(createComparisonRequest(left, right));
    }

    // compare-entry
    if (secondarySequence === undefined) return null;
    const secondaryEntry = provenance.find((e) => e.sequence === secondarySequence);
    if (!secondaryEntry) return null;
    const secondarySource = drilldownBySequence[secondarySequence];
    if (!secondarySource) return null;

    const left = createEntryAnchor(primaryEntry, primarySource);
    const right = createEntryAnchor(secondaryEntry, secondarySource);
    return deriveSceneComparison(createComparisonRequest(left, right));
  }, [mode, primarySequence, secondarySequence, provenance, drilldownBySequence, instances, camera, keyframes, playbackConfig]);

  if (!result) {
    return (
      <div className="comparison-pane">
        <div className="comparison-header">
          <span className="comparison-title">Compare</span>
          <button className="comparison-close" onClick={onClose}>Close</button>
        </div>
        <div className="comparison-fallback">
          Comparison data is not available for the selected entries.
        </div>
      </div>
    );
  }

  return (
    <div className="comparison-pane">
      <div className="comparison-header">
        <span className="comparison-title">{result.label}</span>
        <button className="comparison-close" onClick={onClose}>Close</button>
      </div>
      {!result.hasChanges ? (
        <div className="comparison-no-changes">
          No authored differences between these states.
        </div>
      ) : (
        <div className="comparison-body">
          <InstanceSectionView section={result.instances} />
          <CameraSectionView section={result.camera} />
          <KeyframeSectionView section={result.keyframes} />
          <PlaybackSectionView section={result.playback} />
          <UnavailableSections result={result} />
        </div>
      )}
    </div>
  );
}
