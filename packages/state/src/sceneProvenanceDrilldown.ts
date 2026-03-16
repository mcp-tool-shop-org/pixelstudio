import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneHistoryOperationKind, SceneHistoryOperationMetadata } from './sceneHistory';
import type { SceneProvenanceEntry } from './sceneProvenance';

// ── Diff types ──

/**
 * Operation-aware diff payloads for provenance drilldown.
 *
 * Each variant extracts only the meaningful before/after change for its
 * operation kind. These are NOT generic recursive object diffs — they are
 * focused, typed descriptions of what changed.
 */
export type SceneProvenanceDiff =
  | InstanceAddedDiff
  | InstanceRemovedDiff
  | MoveDiff
  | VisibilityDiff
  | OpacityDiff
  | LayerDiff
  | ClipDiff
  | ParallaxDiff
  | UnlinkDiff
  | RelinkDiff
  | ReapplyDiff
  | SetOverrideDiff
  | RemoveOverrideDiff
  | ClearAllOverridesDiff
  | CameraDiff
  | PlaybackDiff
  | KeyframeAddedDiff
  | KeyframeRemovedDiff
  | KeyframeMovedDiff
  | KeyframeEditedDiff;

export interface InstanceAddedDiff {
  type: 'instance-added';
  instanceId: string;
  name: string;
  position: { x: number; y: number };
}

export interface InstanceRemovedDiff {
  type: 'instance-removed';
  instanceId: string;
  name: string;
  position: { x: number; y: number };
}

export interface MoveDiff {
  type: 'move';
  instanceId: string;
  before: { x: number; y: number };
  after: { x: number; y: number };
}

export interface VisibilityDiff {
  type: 'visibility';
  instanceId: string;
  before: boolean;
  after: boolean;
}

export interface OpacityDiff {
  type: 'opacity';
  instanceId: string;
  before: number;
  after: number;
}

export interface LayerDiff {
  type: 'layer';
  instanceId: string;
  before: number;
  after: number;
}

export interface ClipDiff {
  type: 'clip';
  instanceId: string;
  before: string | undefined;
  after: string | undefined;
}

export interface ParallaxDiff {
  type: 'parallax';
  instanceId: string;
  before: number;
  after: number;
}

export interface UnlinkDiff {
  type: 'unlink';
  instanceId: string;
  buildName?: string;
}

export interface RelinkDiff {
  type: 'relink';
  instanceId: string;
  buildName?: string;
}

export interface ReapplyDiff {
  type: 'reapply';
  instanceId: string;
  slotChanges: Array<{ slot: string; before?: string; after?: string }>;
}

export interface SetOverrideDiff {
  type: 'set-override';
  instanceId: string;
  slotId: string;
  mode: string;
  replacementPartId?: string;
}

export interface RemoveOverrideDiff {
  type: 'remove-override';
  instanceId: string;
  slotId: string;
  previousMode?: string;
  previousPartId?: string;
}

export interface ClearAllOverridesDiff {
  type: 'clear-all-overrides';
  instanceId: string;
  clearedSlots: string[];
  count: number;
}

export interface CameraDiff {
  type: 'camera';
  changedFields?: string[];
  before?: SceneCamera;
  after?: SceneCamera;
}

export interface PlaybackDiff {
  type: 'playback';
  before?: ScenePlaybackConfig;
  after?: ScenePlaybackConfig;
}

export interface KeyframeAddedDiff {
  type: 'keyframe-added';
  tick: number;
  keyframe: SceneCameraKeyframe;
}

export interface KeyframeRemovedDiff {
  type: 'keyframe-removed';
  tick: number;
  keyframe: SceneCameraKeyframe;
}

export interface KeyframeMovedDiff {
  type: 'keyframe-moved';
  previousTick: number;
  newTick: number;
  keyframe: SceneCameraKeyframe;
}

export interface KeyframeEditedDiff {
  type: 'keyframe-edited';
  tick: number;
  changedFields: string[];
  before: SceneCameraKeyframe;
  after: SceneCameraKeyframe;
}

// ── Drilldown source (captured at edit seam) ──

/**
 * Captured before/after slice for a single provenance entry.
 *
 * Stored per-entry at the edit seam. Contains only the target
 * instance(s) needed for drilldown derivation — NOT full scene clones.
 */
export interface SceneProvenanceDrilldownSource {
  kind: SceneHistoryOperationKind;
  metadata?: SceneHistoryOperationMetadata;
  beforeInstance?: SceneAssetInstance;
  afterInstance?: SceneAssetInstance;
  /** Camera state before a camera-targeted operation. */
  beforeCamera?: SceneCamera;
  /** Camera state after a camera-targeted operation. */
  afterCamera?: SceneCamera;
  /** Keyframe state before a keyframe-targeted operation. */
  beforeKeyframe?: SceneCameraKeyframe;
  /** Keyframe state after a keyframe-targeted operation. */
  afterKeyframe?: SceneCameraKeyframe;
  /** Playback config before a playback-targeted operation. */
  beforePlayback?: ScenePlaybackConfig;
  /** Playback config after a playback-targeted operation. */
  afterPlayback?: ScenePlaybackConfig;
}

/**
 * Capture the focused before/after slices for a provenance drilldown.
 *
 * Given operation kind, metadata, and the full before/after instance
 * arrays, extracts only the target instance(s) needed for later
 * drilldown derivation.
 */
export function captureProvenanceDrilldownSource(
  kind: SceneHistoryOperationKind,
  beforeInstances: SceneAssetInstance[],
  afterInstances: SceneAssetInstance[],
  metadata?: SceneHistoryOperationMetadata,
  currentCamera?: SceneCamera,
  nextCamera?: SceneCamera,
  currentKeyframes?: SceneCameraKeyframe[],
  nextKeyframes?: SceneCameraKeyframe[],
  currentPlaybackConfig?: ScenePlaybackConfig,
  nextPlaybackConfig?: ScenePlaybackConfig,
): SceneProvenanceDrilldownSource {
  const instanceId = metaInstanceId(metadata);

  switch (kind) {
    case 'add-instance':
      return {
        kind,
        metadata,
        afterInstance: instanceId ? findInstance(afterInstances, instanceId) : undefined,
      };

    case 'remove-instance':
      return {
        kind,
        metadata,
        beforeInstance: instanceId ? findInstance(beforeInstances, instanceId) : undefined,
      };

    case 'move-instance':
    case 'set-instance-visibility':
    case 'set-instance-opacity':
    case 'set-instance-layer':
    case 'set-instance-clip':
    case 'set-instance-parallax':
    case 'unlink-character-source':
    case 'relink-character-source':
    case 'reapply-character-source':
    case 'set-character-override':
    case 'remove-character-override':
    case 'clear-all-character-overrides':
      return {
        kind,
        metadata,
        beforeInstance: instanceId ? findInstance(beforeInstances, instanceId) : undefined,
        afterInstance: instanceId ? findInstance(afterInstances, instanceId) : undefined,
      };

    case 'set-scene-camera':
      return {
        kind,
        metadata,
        beforeCamera: currentCamera ? { ...currentCamera } : undefined,
        afterCamera: nextCamera ? { ...nextCamera } : undefined,
      };

    case 'set-scene-playback':
      return {
        kind,
        metadata,
        beforePlayback: currentPlaybackConfig ? { ...currentPlaybackConfig } : undefined,
        afterPlayback: nextPlaybackConfig ? { ...nextPlaybackConfig } : undefined,
      };

    case 'add-camera-keyframe': {
      const tick = metaKeyframeTick(metadata);
      return {
        kind,
        metadata,
        afterKeyframe: tick !== undefined ? findKeyframe(nextKeyframes, tick) : undefined,
      };
    }

    case 'remove-camera-keyframe': {
      const tick = metaKeyframeTick(metadata);
      return {
        kind,
        metadata,
        beforeKeyframe: tick !== undefined ? findKeyframe(currentKeyframes, tick) : undefined,
      };
    }

    case 'move-camera-keyframe': {
      const previousTick = metaKeyframePreviousTick(metadata);
      const tick = metaKeyframeTick(metadata);
      return {
        kind,
        metadata,
        beforeKeyframe: previousTick !== undefined ? findKeyframe(currentKeyframes, previousTick) : undefined,
        afterKeyframe: tick !== undefined ? findKeyframe(nextKeyframes, tick) : undefined,
      };
    }

    case 'edit-camera-keyframe': {
      const tick = metaKeyframeTick(metadata);
      return {
        kind,
        metadata,
        beforeKeyframe: tick !== undefined ? findKeyframe(currentKeyframes, tick) : undefined,
        afterKeyframe: tick !== undefined ? findKeyframe(nextKeyframes, tick) : undefined,
      };
    }

    case 'restore-entry':
      return {
        kind,
        metadata,
        beforeCamera: currentCamera ? { ...currentCamera } : undefined,
        afterCamera: nextCamera ? { ...nextCamera } : undefined,
        beforePlayback: currentPlaybackConfig ? { ...currentPlaybackConfig } : undefined,
        afterPlayback: nextPlaybackConfig ? { ...nextPlaybackConfig } : undefined,
      };
  }
}

// ── Drilldown ──

/**
 * A provenance drilldown — the focused before/after inspection for a
 * single provenance entry.
 *
 * Derived from stored before/after snapshots, not recomputed from
 * current state. Read-only and explanatory.
 */
export interface SceneProvenanceDrilldown {
  kind: SceneHistoryOperationKind;
  label: string;
  sequence: number;
  timestamp: string;
  metadata?: SceneHistoryOperationMetadata;
  diff: SceneProvenanceDiff;
}

// ── Derivation ──

/** Find an instance by ID in an array. */
function findInstance(
  instances: SceneAssetInstance[],
  id: string,
): SceneAssetInstance | undefined {
  return instances.find((i) => i.instanceId === id);
}

/** Get instance ID from metadata, if present. */
function metaInstanceId(metadata?: SceneHistoryOperationMetadata): string | undefined {
  if (metadata && 'instanceId' in metadata) return metadata.instanceId;
  return undefined;
}

/** Get slot ID from metadata, if present. */
function metaSlotId(metadata?: SceneHistoryOperationMetadata): string | undefined {
  if (metadata && 'slotId' in metadata) return metadata.slotId;
  return undefined;
}

/** Get keyframe tick from metadata, if present. */
function metaKeyframeTick(metadata?: SceneHistoryOperationMetadata): number | undefined {
  if (metadata && 'tick' in metadata) return metadata.tick;
  return undefined;
}

/** Get keyframe previous tick from metadata, if present. */
function metaKeyframePreviousTick(metadata?: SceneHistoryOperationMetadata): number | undefined {
  if (metadata && 'previousTick' in metadata) return metadata.previousTick;
  return undefined;
}

/** Find a keyframe by tick in an array. */
function findKeyframe(
  keyframes: SceneCameraKeyframe[] | undefined,
  tick: number,
): SceneCameraKeyframe | undefined {
  return keyframes?.find((k) => k.tick === tick);
}

/**
 * Derive a focused drilldown diff from before/after scene snapshots and
 * a provenance entry.
 *
 * The diff is operation-aware: each operation kind extracts only the
 * meaningful change from the stored before/after instance arrays.
 *
 * Returns `undefined` if the diff cannot be derived (e.g., target
 * instance not found in snapshots).
 */
export function deriveProvenanceDiff(
  kind: SceneHistoryOperationKind,
  beforeInstances: SceneAssetInstance[],
  afterInstances: SceneAssetInstance[],
  metadata?: SceneHistoryOperationMetadata,
  beforeCamera?: SceneCamera,
  afterCamera?: SceneCamera,
  beforeKeyframe?: SceneCameraKeyframe,
  afterKeyframe?: SceneCameraKeyframe,
  beforePlayback?: ScenePlaybackConfig,
  afterPlayback?: ScenePlaybackConfig,
): SceneProvenanceDiff | undefined {
  const instanceId = metaInstanceId(metadata);

  switch (kind) {
    case 'add-instance': {
      if (!instanceId) return undefined;
      const added = findInstance(afterInstances, instanceId);
      if (!added) return undefined;
      return {
        type: 'instance-added',
        instanceId,
        name: added.name,
        position: { x: added.x, y: added.y },
      };
    }

    case 'remove-instance': {
      if (!instanceId) return undefined;
      const removed = findInstance(beforeInstances, instanceId);
      if (!removed) return undefined;
      return {
        type: 'instance-removed',
        instanceId,
        name: removed.name,
        position: { x: removed.x, y: removed.y },
      };
    }

    case 'move-instance': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      return {
        type: 'move',
        instanceId,
        before: { x: before.x, y: before.y },
        after: { x: after.x, y: after.y },
      };
    }

    case 'set-instance-visibility': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      return {
        type: 'visibility',
        instanceId,
        before: before.visible,
        after: after.visible,
      };
    }

    case 'set-instance-opacity': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      return {
        type: 'opacity',
        instanceId,
        before: before.opacity,
        after: after.opacity,
      };
    }

    case 'set-instance-layer': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      return {
        type: 'layer',
        instanceId,
        before: before.zOrder,
        after: after.zOrder,
      };
    }

    case 'set-instance-clip': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      return {
        type: 'clip',
        instanceId,
        before: before.clipId,
        after: after.clipId,
      };
    }

    case 'set-instance-parallax': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      return {
        type: 'parallax',
        instanceId,
        before: before.parallax,
        after: after.parallax,
      };
    }

    case 'unlink-character-source': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      return {
        type: 'unlink',
        instanceId,
        buildName: before?.sourceCharacterBuildName,
      };
    }

    case 'relink-character-source': {
      if (!instanceId) return undefined;
      const after = findInstance(afterInstances, instanceId);
      return {
        type: 'relink',
        instanceId,
        buildName: after?.sourceCharacterBuildName,
      };
    }

    case 'reapply-character-source': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const after = findInstance(afterInstances, instanceId);
      if (!before || !after) return undefined;
      const beforeSlots = before.characterSlotSnapshot?.slots ?? {};
      const afterSlots = after.characterSlotSnapshot?.slots ?? {};
      const allSlotIds = new Set([...Object.keys(beforeSlots), ...Object.keys(afterSlots)]);
      const slotChanges: Array<{ slot: string; before?: string; after?: string }> = [];
      for (const slot of allSlotIds) {
        const bVal = beforeSlots[slot];
        const aVal = afterSlots[slot];
        if (bVal !== aVal) {
          slotChanges.push({ slot, before: bVal, after: aVal });
        }
      }
      return {
        type: 'reapply',
        instanceId,
        slotChanges,
      };
    }

    case 'set-character-override': {
      if (!instanceId) return undefined;
      const slotId = metaSlotId(metadata);
      if (!slotId) return undefined;
      const after = findInstance(afterInstances, instanceId);
      const override = after?.characterOverrides?.[slotId];
      return {
        type: 'set-override',
        instanceId,
        slotId,
        mode: override?.mode ?? 'replace',
        replacementPartId: override?.replacementPartId,
      };
    }

    case 'remove-character-override': {
      if (!instanceId) return undefined;
      const slotId = metaSlotId(metadata);
      if (!slotId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const prevOverride = before?.characterOverrides?.[slotId];
      return {
        type: 'remove-override',
        instanceId,
        slotId,
        previousMode: prevOverride?.mode,
        previousPartId: prevOverride?.replacementPartId,
      };
    }

    case 'clear-all-character-overrides': {
      if (!instanceId) return undefined;
      const before = findInstance(beforeInstances, instanceId);
      const clearedSlots = Object.keys(before?.characterOverrides ?? {});
      return {
        type: 'clear-all-overrides',
        instanceId,
        clearedSlots,
        count: clearedSlots.length,
      };
    }

    case 'set-scene-camera': {
      const changedFields = metadata && 'changedFields' in metadata
        ? metadata.changedFields
        : undefined;
      return {
        type: 'camera',
        changedFields,
        before: beforeCamera,
        after: afterCamera,
      };
    }

    case 'set-scene-playback': {
      return { type: 'playback', before: beforePlayback, after: afterPlayback };
    }

    case 'add-camera-keyframe': {
      if (!afterKeyframe) return undefined;
      return {
        type: 'keyframe-added',
        tick: afterKeyframe.tick,
        keyframe: afterKeyframe,
      };
    }

    case 'remove-camera-keyframe': {
      if (!beforeKeyframe) return undefined;
      return {
        type: 'keyframe-removed',
        tick: beforeKeyframe.tick,
        keyframe: beforeKeyframe,
      };
    }

    case 'move-camera-keyframe': {
      if (!beforeKeyframe || !afterKeyframe) return undefined;
      return {
        type: 'keyframe-moved',
        previousTick: beforeKeyframe.tick,
        newTick: afterKeyframe.tick,
        keyframe: afterKeyframe,
      };
    }

    case 'edit-camera-keyframe': {
      if (!beforeKeyframe || !afterKeyframe) return undefined;
      const changedFields = metadata && 'changedFields' in metadata
        ? metadata.changedFields ?? []
        : [];
      return {
        type: 'keyframe-edited',
        tick: afterKeyframe.tick,
        changedFields,
        before: beforeKeyframe,
        after: afterKeyframe,
      };
    }
  }
}

/**
 * Derive a full drilldown from a provenance entry and before/after snapshots.
 *
 * Returns `undefined` if the diff cannot be derived.
 */
export function deriveProvenanceDrilldown(
  entry: SceneProvenanceEntry,
  beforeInstances: SceneAssetInstance[],
  afterInstances: SceneAssetInstance[],
  beforeCamera?: SceneCamera,
  afterCamera?: SceneCamera,
  beforeKeyframe?: SceneCameraKeyframe,
  afterKeyframe?: SceneCameraKeyframe,
  beforePlayback?: ScenePlaybackConfig,
  afterPlayback?: ScenePlaybackConfig,
): SceneProvenanceDrilldown | undefined {
  const diff = deriveProvenanceDiff(
    entry.kind,
    beforeInstances,
    afterInstances,
    entry.metadata,
    beforeCamera,
    afterCamera,
    beforeKeyframe,
    afterKeyframe,
    beforePlayback,
    afterPlayback,
  );
  if (!diff) return undefined;
  return {
    kind: entry.kind,
    label: entry.label,
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    metadata: entry.metadata,
    diff,
  };
}

// ── Human-readable diff description ──

/**
 * Describe a provenance diff in plain operator language.
 *
 * Returns a short, focused sentence describing the change.
 * This is not a raw JSON dump — it explains what happened.
 */
export function describeProvenanceDiff(diff: SceneProvenanceDiff): string {
  switch (diff.type) {
    case 'instance-added':
      return `Added "${diff.name}" at (${diff.position.x}, ${diff.position.y})`;

    case 'instance-removed':
      return `Removed "${diff.name}" from (${diff.position.x}, ${diff.position.y})`;

    case 'move':
      return `Moved from (${diff.before.x}, ${diff.before.y}) to (${diff.after.x}, ${diff.after.y})`;

    case 'visibility':
      return diff.after ? 'Made visible' : 'Made hidden';

    case 'opacity':
      return `Opacity: ${formatPercent(diff.before)} → ${formatPercent(diff.after)}`;

    case 'layer':
      return `Layer: ${diff.before} → ${diff.after}`;

    case 'clip':
      return `Clip: ${diff.before ?? 'none'} → ${diff.after ?? 'none'}`;

    case 'parallax':
      return `Parallax: ${diff.before.toFixed(1)} → ${diff.after.toFixed(1)}`;

    case 'unlink':
      return diff.buildName
        ? `Unlinked from "${diff.buildName}"`
        : 'Unlinked from source';

    case 'relink':
      return diff.buildName
        ? `Relinked to "${diff.buildName}"`
        : 'Relinked to source';

    case 'reapply': {
      if (diff.slotChanges.length === 0) return 'Reapplied from source (no slot changes)';
      const changes = diff.slotChanges.map(
        (c) => `${c.slot}: ${c.before ?? 'empty'} → ${c.after ?? 'empty'}`,
      );
      return `Reapplied from source: ${changes.join(', ')}`;
    }

    case 'set-override':
      return diff.mode === 'remove'
        ? `Override ${diff.slotId}: removed part`
        : `Override ${diff.slotId}: ${diff.replacementPartId ?? 'replaced'}`;

    case 'remove-override':
      return `Cleared override on ${diff.slotId}`;

    case 'clear-all-overrides':
      return diff.count > 0
        ? `Cleared ${diff.count} override${diff.count !== 1 ? 's' : ''} (${diff.clearedSlots.join(', ')})`
        : 'Cleared all overrides';

    case 'camera': {
      if (!diff.changedFields?.length) return 'Camera changed';
      if (diff.before && diff.after) {
        const parts = diff.changedFields.map((f) => {
          const b = diff.before![f as keyof SceneCamera];
          const a = diff.after![f as keyof SceneCamera];
          if (typeof b === 'number' && typeof a === 'number') {
            return `${f}: ${b.toFixed(1)} → ${a.toFixed(1)}`;
          }
          return f;
        });
        return `Camera: ${parts.join(', ')}`;
      }
      return `Camera: ${diff.changedFields.join(', ')}`;
    }

    case 'playback': {
      if (!diff.before || !diff.after) return 'Playback settings changed';
      const parts: string[] = [];
      if (diff.before.fps !== diff.after.fps) {
        parts.push(`FPS: ${diff.before.fps} → ${diff.after.fps}`);
      }
      if (diff.before.looping !== diff.after.looping) {
        parts.push(`Looping: ${diff.before.looping ? 'Yes' : 'No'} → ${diff.after.looping ? 'Yes' : 'No'}`);
      }
      return parts.length > 0
        ? `Playback: ${parts.join(', ')}`
        : 'Playback settings changed';
    }

    case 'keyframe-added':
      return `Added keyframe at tick ${diff.tick}`;

    case 'keyframe-removed':
      return `Removed keyframe at tick ${diff.tick}`;

    case 'keyframe-moved':
      return `Moved keyframe from tick ${diff.previousTick} to tick ${diff.newTick}`;

    case 'keyframe-edited': {
      if (diff.changedFields.length === 0) return `Edited keyframe at tick ${diff.tick}`;
      return `Edited keyframe at tick ${diff.tick}: ${diff.changedFields.join(', ')}`;
    }
  }
}

/** Format a 0–1 opacity as a percentage string. */
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
