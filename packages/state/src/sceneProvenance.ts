import type {
  SceneHistoryOperationKind,
  SceneHistoryOperationMetadata,
} from './sceneHistory';
import { describeSceneHistoryOperation } from './sceneHistory';

// ── Provenance entry ──

/**
 * A scene provenance entry — an append-only record of a committed scene edit.
 *
 * Provenance is NOT undo history. It records what happened (forward edits),
 * not how to reverse it. Undo/redo navigation does not create provenance entries.
 */
export interface SceneProvenanceEntry {
  /** Monotonically increasing sequence number (1-based). */
  sequence: number;
  /** Operation kind aligned with scene history operation kinds. */
  kind: SceneHistoryOperationKind;
  /** Human-readable label describing the operation. */
  label: string;
  /** ISO 8601 timestamp when the edit was committed. */
  timestamp: string;
  /** Narrow metadata identifying the edit target. */
  metadata?: SceneHistoryOperationMetadata;
}

// ── Pure helpers ──

let _nextSequence = 1;

/**
 * Reset the sequence counter. Call on scene change / new scene.
 * Returns the reset value (1) for testability.
 */
export function resetProvenanceSequence(): number {
  _nextSequence = 1;
  return _nextSequence;
}

/**
 * Get the current next sequence value without incrementing.
 * For testing only.
 */
export function peekProvenanceSequence(): number {
  return _nextSequence;
}

/**
 * Create a provenance entry from an operation kind and optional metadata.
 *
 * The label is derived from the operation kind via `describeSceneHistoryOperation`.
 * The sequence is auto-assigned and monotonically increasing.
 */
export function createSceneProvenanceEntry(
  kind: SceneHistoryOperationKind,
  metadata?: SceneHistoryOperationMetadata,
): SceneProvenanceEntry {
  return {
    sequence: _nextSequence++,
    kind,
    label: describeSceneProvenanceEntry(kind, metadata),
    timestamp: new Date().toISOString(),
    metadata,
  };
}

/**
 * Describe a provenance entry with a human-readable label.
 *
 * Enriches the base operation description with target info from metadata.
 */
export function describeSceneProvenanceEntry(
  kind: SceneHistoryOperationKind,
  metadata?: SceneHistoryOperationMetadata,
): string {
  const base = describeSceneHistoryOperation(kind);
  if (!metadata) return base;

  if ('slotId' in metadata) {
    return `${base} (slot: ${metadata.slotId})`;
  }
  if ('instanceId' in metadata) {
    return `${base} (${metadata.instanceId})`;
  }
  if ('changedFields' in metadata && metadata.changedFields?.length) {
    return `${base} (${metadata.changedFields.join(', ')})`;
  }
  return base;
}
