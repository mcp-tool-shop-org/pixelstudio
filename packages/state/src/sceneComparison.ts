import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneProvenanceEntry } from './sceneProvenance';
import type { SceneProvenanceDrilldownSource } from './sceneProvenanceDrilldown';
import type { FieldConfig } from './structuredValueSummary';
import {
  extractChangedFields,
  CAMERA_FIELD_CONFIGS,
  KEYFRAME_FIELD_CONFIGS,
  PLAYBACK_FIELD_CONFIGS,
  fmtNumber,
  fmtPercent,
  fmtBool,
  fmtString,
} from './structuredValueSummary';

// ── Comparison modes ──

/**
 * How two scene states are related for comparison.
 *
 * - `current-vs-entry`: compare live scene state against a historical provenance entry
 * - `entry-vs-entry`: compare two provenance entries against each other
 */
export type SceneComparisonMode = 'current-vs-entry' | 'entry-vs-entry';

// ── Comparison source ──

/**
 * A snapshot of scene state at a single point in time.
 *
 * For provenance entries, the "after" state of the drilldown source is the
 * snapshot — it represents what the scene looked like after that edit.
 *
 * For current state, this is the live scene state from the editor store.
 */
export interface SceneComparisonSnapshot {
  instances: SceneAssetInstance[];
  camera?: SceneCamera;
  keyframes?: SceneCameraKeyframe[];
  playbackConfig?: ScenePlaybackConfig;
}

/**
 * A comparison anchor — identifies one side of a comparison.
 *
 * Either the current live scene state or a specific provenance entry.
 */
export type SceneComparisonAnchor =
  | { type: 'current'; snapshot: SceneComparisonSnapshot }
  | { type: 'entry'; entry: SceneProvenanceEntry; source: SceneProvenanceDrilldownSource; snapshot: SceneComparisonSnapshot };

// ── Comparison request ──

/**
 * A fully resolved comparison request.
 *
 * Both anchors carry their resolved snapshots. The comparison engine
 * diffs `left` against `right` — left is the older/base state, right
 * is the newer/target state.
 */
export interface SceneComparisonRequest {
  mode: SceneComparisonMode;
  left: SceneComparisonAnchor;
  right: SceneComparisonAnchor;
}

// ── Comparison result sections ──

/**
 * A single instance that exists in both sides with field-level diffs.
 */
export interface InstanceFieldDiff {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface InstanceComparisonEntry {
  instanceId: string;
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  fieldDiffs: InstanceFieldDiff[];
}

/**
 * Camera comparison — before/after with field-level changes.
 */
export interface CameraComparisonSection {
  type: 'camera';
  status: 'changed' | 'unchanged' | 'unavailable';
  before?: SceneCamera;
  after?: SceneCamera;
  changedFields: string[];
}

/**
 * Keyframe comparison — added/removed/changed keyframes.
 */
export interface KeyframeComparisonEntry {
  tick: number;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  before?: SceneCameraKeyframe;
  after?: SceneCameraKeyframe;
  changedFields: string[];
}

export interface KeyframeComparisonSection {
  type: 'keyframes';
  status: 'changed' | 'unchanged' | 'unavailable';
  entries: KeyframeComparisonEntry[];
}

/**
 * Playback comparison — before/after with field-level changes.
 */
export interface PlaybackComparisonSection {
  type: 'playback';
  status: 'changed' | 'unchanged' | 'unavailable';
  before?: ScenePlaybackConfig;
  after?: ScenePlaybackConfig;
  changedFields: string[];
}

/**
 * Instance section — added/removed/changed instances.
 */
export interface InstanceComparisonSection {
  type: 'instances';
  status: 'changed' | 'unchanged';
  entries: InstanceComparisonEntry[];
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

// ── Comparison result ──

/**
 * The full comparison result across all scene domains.
 *
 * Each section may be `unavailable` when the data needed to compare
 * is missing from one or both anchors (e.g., no camera in a drilldown source).
 */
export interface SceneComparisonResult {
  mode: SceneComparisonMode;
  instances: InstanceComparisonSection;
  camera: CameraComparisonSection;
  keyframes: KeyframeComparisonSection;
  playback: PlaybackComparisonSection;
  /** True when at least one section has changes. */
  hasChanges: boolean;
  /** Summary label for the comparison (e.g., "#3 vs Current"). */
  label: string;
}

// ── Fallback / unsupported ──

/**
 * Reasons a comparison section might be unavailable.
 */
export type ComparisonUnavailableReason =
  | 'no-snapshot-data'
  | 'entry-predates-capture'
  | 'scope-not-applicable';

// ── Helpers ──

/**
 * Build a comparison anchor from the current live scene state.
 */
export function createCurrentAnchor(snapshot: SceneComparisonSnapshot): SceneComparisonAnchor {
  return { type: 'current', snapshot };
}

/**
 * Build a comparison anchor from a provenance entry and its drilldown source.
 *
 * For entry-based anchors, we reconstruct the "after" snapshot from the
 * drilldown source. Instance data comes from afterInstance (single-instance
 * captures), camera from afterCamera, etc.
 *
 * For full-scene comparison, the caller must provide the full instance array
 * from the history snapshot — drilldown sources only capture the target instance.
 * When `fullInstances` is provided, it is used directly. Otherwise, only the
 * drilldown source's afterInstance is available (limited comparison).
 */
export function createEntryAnchor(
  entry: SceneProvenanceEntry,
  source: SceneProvenanceDrilldownSource,
  fullInstances?: SceneAssetInstance[],
): SceneComparisonAnchor {
  const snapshot: SceneComparisonSnapshot = {
    instances: fullInstances ?? (source.afterInstance ? [source.afterInstance] : []),
    camera: source.afterCamera,
    playbackConfig: source.afterPlayback,
  };
  return { type: 'entry', entry, source, snapshot };
}

/**
 * Create a comparison request from two anchors.
 *
 * Infers the mode from anchor types.
 */
export function createComparisonRequest(
  left: SceneComparisonAnchor,
  right: SceneComparisonAnchor,
): SceneComparisonRequest {
  const mode: SceneComparisonMode =
    left.type === 'entry' && right.type === 'entry'
      ? 'entry-vs-entry'
      : 'current-vs-entry';
  return { mode, left, right };
}

/**
 * Validate that a comparison request is well-formed.
 *
 * Returns an error message if invalid, undefined if valid.
 */
export function validateComparisonRequest(
  request: SceneComparisonRequest,
): string | undefined {
  // Both anchors must have snapshot data
  if (!request.left.snapshot || !request.right.snapshot) {
    return 'Both comparison anchors must have snapshot data.';
  }
  // entry-vs-entry: both must be entries
  if (request.mode === 'entry-vs-entry') {
    if (request.left.type !== 'entry' || request.right.type !== 'entry') {
      return 'entry-vs-entry mode requires both anchors to be provenance entries.';
    }
  }
  // current-vs-entry: at least one must be current
  if (request.mode === 'current-vs-entry') {
    if (request.left.type !== 'current' && request.right.type !== 'current') {
      return 'current-vs-entry mode requires at least one anchor to be current state.';
    }
  }
  return undefined;
}

/**
 * Generate a human-readable label for a comparison.
 */
export function describeComparison(request: SceneComparisonRequest): string {
  const leftLabel = request.left.type === 'current'
    ? 'Current'
    : `#${request.left.entry.sequence}`;
  const rightLabel = request.right.type === 'current'
    ? 'Current'
    : `#${request.right.entry.sequence}`;
  return `${leftLabel} vs ${rightLabel}`;
}

/**
 * Determine which comparison scopes are applicable for a given pair of anchors.
 *
 * Returns the set of section types that can produce meaningful results.
 */
export function resolveComparisonScopes(
  request: SceneComparisonRequest,
): Set<'instances' | 'camera' | 'keyframes' | 'playback'> {
  const scopes = new Set<'instances' | 'camera' | 'keyframes' | 'playback'>();

  // Instances are always comparable when both sides have instance data
  if (request.left.snapshot.instances.length > 0 || request.right.snapshot.instances.length > 0) {
    scopes.add('instances');
  }

  // Camera is comparable when at least one side has camera data
  if (request.left.snapshot.camera !== undefined || request.right.snapshot.camera !== undefined) {
    scopes.add('camera');
  }

  // Keyframes are comparable when at least one side has keyframe data
  if (request.left.snapshot.keyframes !== undefined || request.right.snapshot.keyframes !== undefined) {
    scopes.add('keyframes');
  }

  // Playback is comparable when at least one side has playback data
  if (request.left.snapshot.playbackConfig !== undefined || request.right.snapshot.playbackConfig !== undefined) {
    scopes.add('playback');
  }

  return scopes;
}

// ── Restore preview ──

/**
 * The result of a restore-preview analysis.
 *
 * Shows what would change if a historical entry's "after" state were
 * restored into the current scene. Wraps the standard comparison result
 * with a restore-specific label.
 */
export interface RestorePreviewResult {
  /** The underlying comparison (entry after → current). */
  comparison: SceneComparisonResult;
  /** True when restoring would cause no authored changes. */
  noImpact: boolean;
  /** Human-readable restore label, e.g., "Restore #3 → impact preview". */
  label: string;
}

/**
 * Derive a restore-preview analysis for a given provenance entry.
 *
 * Compares the entry's "after" snapshot (what the scene looked like after
 * that edit) against the current live scene state. The diff shows what
 * would change if the user restored to that historical state.
 *
 * Pure function — no store access. The caller must provide both the
 * entry anchor and the current snapshot.
 */
export function deriveRestorePreview(
  entryAnchor: SceneComparisonAnchor,
  currentSnapshot: SceneComparisonSnapshot,
): RestorePreviewResult {
  const currentAnchor = createCurrentAnchor(currentSnapshot);
  const request = createComparisonRequest(entryAnchor, currentAnchor);
  const comparison = deriveSceneComparison(request);
  const entryLabel = entryAnchor.type === 'entry'
    ? `#${entryAnchor.entry.sequence}`
    : 'selected entry';
  return {
    comparison,
    noImpact: !comparison.hasChanges,
    label: `Restore ${entryLabel} \u2192 impact preview`,
  };
}

// ── Instance field configs for comparison ──

const INSTANCE_FIELD_CONFIGS: FieldConfig[] = [
  { key: 'x', label: 'X', format: fmtNumber },
  { key: 'y', label: 'Y', format: fmtNumber },
  { key: 'zOrder', label: 'Layer', format: fmtNumber },
  { key: 'visible', label: 'Visible', format: fmtBool },
  { key: 'opacity', label: 'Opacity', format: fmtPercent },
  { key: 'parallax', label: 'Parallax', format: fmtNumber },
  { key: 'clipId', label: 'Clip', format: (v) => String(v ?? 'none') },
  { key: 'characterLinkMode', label: 'Link Mode', format: (v) => String(v ?? 'linked') },
];

// ── Derivation engine ──

/**
 * Derive a full scene comparison from a resolved request.
 *
 * Pure function — no store access, no UI logic. Compares each authored
 * domain independently and returns a stable, structured result.
 */
export function deriveSceneComparison(request: SceneComparisonRequest): SceneComparisonResult {
  const scopes = resolveComparisonScopes(request);
  const label = describeComparison(request);

  const instances = deriveInstanceComparison(
    request.left.snapshot.instances,
    request.right.snapshot.instances,
  );

  const camera = scopes.has('camera')
    ? deriveCameraComparison(request.left.snapshot.camera, request.right.snapshot.camera)
    : { type: 'camera' as const, status: 'unavailable' as const, changedFields: [] };

  const keyframes = scopes.has('keyframes')
    ? deriveKeyframeComparison(request.left.snapshot.keyframes, request.right.snapshot.keyframes)
    : { type: 'keyframes' as const, status: 'unavailable' as const, entries: [] };

  const playback = scopes.has('playback')
    ? derivePlaybackComparison(request.left.snapshot.playbackConfig, request.right.snapshot.playbackConfig)
    : { type: 'playback' as const, status: 'unavailable' as const, changedFields: [] };

  const hasChanges =
    instances.status === 'changed' ||
    camera.status === 'changed' ||
    keyframes.status === 'changed' ||
    playback.status === 'changed';

  return {
    mode: request.mode,
    instances,
    camera,
    keyframes,
    playback,
    hasChanges,
    label,
  };
}

// ── Instance comparison ──

/**
 * Compare two instance arrays by instanceId.
 *
 * Stable ordering: sorted by instanceId for deterministic output.
 */
function deriveInstanceComparison(
  leftInstances: SceneAssetInstance[],
  rightInstances: SceneAssetInstance[],
): InstanceComparisonSection {
  const leftById = new Map(leftInstances.map((i) => [i.instanceId, i]));
  const rightById = new Map(rightInstances.map((i) => [i.instanceId, i]));

  // Collect all instance IDs, sorted for stable order
  const allIds = [...new Set([...leftById.keys(), ...rightById.keys()])].sort();

  const entries: InstanceComparisonEntry[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const id of allIds) {
    const left = leftById.get(id);
    const right = rightById.get(id);

    if (!left && right) {
      // Added
      entries.push({
        instanceId: id,
        name: right.name,
        status: 'added',
        fieldDiffs: [],
      });
      added++;
    } else if (left && !right) {
      // Removed
      entries.push({
        instanceId: id,
        name: left.name,
        status: 'removed',
        fieldDiffs: [],
      });
      removed++;
    } else if (left && right) {
      // Both sides exist — compare fields
      const fieldDiffs = deriveInstanceFieldDiffs(left, right);
      const overrideDiffs = deriveOverrideDiffs(left, right);
      const allDiffs = [...fieldDiffs, ...overrideDiffs];

      if (allDiffs.length > 0) {
        entries.push({
          instanceId: id,
          name: right.name,
          status: 'changed',
          fieldDiffs: allDiffs,
        });
        changed++;
      } else {
        unchanged++;
      }
    }
  }

  return {
    type: 'instances',
    status: added > 0 || removed > 0 || changed > 0 ? 'changed' : 'unchanged',
    entries,
    added,
    removed,
    changed,
    unchanged,
  };
}

/**
 * Derive field-level diffs between two instances of the same ID.
 *
 * Uses INSTANCE_FIELD_CONFIGS for stable ordering.
 */
function deriveInstanceFieldDiffs(
  left: SceneAssetInstance,
  right: SceneAssetInstance,
): InstanceFieldDiff[] {
  return extractChangedFields(
    left as unknown as Record<string, unknown>,
    right as unknown as Record<string, unknown>,
    INSTANCE_FIELD_CONFIGS,
  );
}

/**
 * Derive character override diffs between two instances.
 *
 * Reports individual slot override changes rather than collapsing
 * into a generic "overrides changed" blob.
 */
function deriveOverrideDiffs(
  left: SceneAssetInstance,
  right: SceneAssetInstance,
): InstanceFieldDiff[] {
  const leftOverrides = left.characterOverrides ?? {};
  const rightOverrides = right.characterOverrides ?? {};
  const allSlots = [...new Set([...Object.keys(leftOverrides), ...Object.keys(rightOverrides)])].sort();

  const diffs: InstanceFieldDiff[] = [];
  for (const slot of allSlots) {
    const lOverride = leftOverrides[slot];
    const rOverride = rightOverrides[slot];
    const lStr = lOverride ? `${lOverride.mode}${lOverride.replacementPartId ? `:${lOverride.replacementPartId}` : ''}` : 'none';
    const rStr = rOverride ? `${rOverride.mode}${rOverride.replacementPartId ? `:${rOverride.replacementPartId}` : ''}` : 'none';
    if (lStr !== rStr) {
      diffs.push({
        field: `override:${slot}`,
        label: `Override (${slot})`,
        before: lStr,
        after: rStr,
      });
    }
  }
  return diffs;
}

// ── Camera comparison ──

/**
 * Compare two camera states using CAMERA_FIELD_CONFIGS for stable ordering.
 */
function deriveCameraComparison(
  left?: SceneCamera,
  right?: SceneCamera,
): CameraComparisonSection {
  if (left === undefined && right === undefined) {
    return { type: 'camera', status: 'unavailable', changedFields: [] };
  }
  if (left === undefined || right === undefined) {
    // One side has camera, the other doesn't — this is a meaningful change
    return {
      type: 'camera',
      status: 'changed',
      before: left,
      after: right,
      changedFields: left
        ? CAMERA_FIELD_CONFIGS.map((c) => c.key)
        : CAMERA_FIELD_CONFIGS.map((c) => c.key),
    };
  }

  const changes = extractChangedFields(
    left as unknown as Record<string, unknown>,
    right as unknown as Record<string, unknown>,
    CAMERA_FIELD_CONFIGS,
  );

  return {
    type: 'camera',
    status: changes.length > 0 ? 'changed' : 'unchanged',
    before: left,
    after: right,
    changedFields: changes.map((c) => c.field),
  };
}

// ── Keyframe comparison ──

/**
 * Compare two keyframe arrays by tick identity (not array position).
 *
 * Detects: added, removed, changed (value/interpolation at same tick).
 * Stable ordering: sorted by tick.
 */
function deriveKeyframeComparison(
  left?: SceneCameraKeyframe[],
  right?: SceneCameraKeyframe[],
): KeyframeComparisonSection {
  if (left === undefined && right === undefined) {
    return { type: 'keyframes', status: 'unavailable', entries: [] };
  }

  const leftArr = left ?? [];
  const rightArr = right ?? [];
  const leftByTick = new Map(leftArr.map((k) => [k.tick, k]));
  const rightByTick = new Map(rightArr.map((k) => [k.tick, k]));

  const allTicks = [...new Set([...leftByTick.keys(), ...rightByTick.keys()])].sort((a, b) => a - b);

  const entries: KeyframeComparisonEntry[] = [];
  let hasChange = false;

  for (const tick of allTicks) {
    const lkf = leftByTick.get(tick);
    const rkf = rightByTick.get(tick);

    if (!lkf && rkf) {
      entries.push({ tick, status: 'added', after: rkf, changedFields: [] });
      hasChange = true;
    } else if (lkf && !rkf) {
      entries.push({ tick, status: 'removed', before: lkf, changedFields: [] });
      hasChange = true;
    } else if (lkf && rkf) {
      const changes = extractChangedFields(
        lkf as unknown as Record<string, unknown>,
        rkf as unknown as Record<string, unknown>,
        KEYFRAME_FIELD_CONFIGS,
      );
      if (changes.length > 0) {
        entries.push({
          tick,
          status: 'changed',
          before: lkf,
          after: rkf,
          changedFields: changes.map((c) => c.field),
        });
        hasChange = true;
      }
      // Unchanged keyframes are omitted from entries
    }
  }

  return {
    type: 'keyframes',
    status: hasChange ? 'changed' : 'unchanged',
    entries,
  };
}

// ── Playback comparison ──

/**
 * Compare two playback configs using PLAYBACK_FIELD_CONFIGS for stable ordering.
 */
function derivePlaybackComparison(
  left?: ScenePlaybackConfig,
  right?: ScenePlaybackConfig,
): PlaybackComparisonSection {
  if (left === undefined && right === undefined) {
    return { type: 'playback', status: 'unavailable', changedFields: [] };
  }
  if (left === undefined || right === undefined) {
    return {
      type: 'playback',
      status: 'changed',
      before: left,
      after: right,
      changedFields: PLAYBACK_FIELD_CONFIGS.map((c) => c.key),
    };
  }

  const changes = extractChangedFields(
    left as unknown as Record<string, unknown>,
    right as unknown as Record<string, unknown>,
    PLAYBACK_FIELD_CONFIGS,
  );

  return {
    type: 'playback',
    status: changes.length > 0 ? 'changed' : 'unchanged',
    before: left,
    after: right,
    changedFields: changes.map((c) => c.field),
  };
}
