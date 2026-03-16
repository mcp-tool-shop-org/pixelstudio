import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneProvenanceEntry } from './sceneProvenance';
import type { SceneProvenanceDrilldownSource } from './sceneProvenanceDrilldown';

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
