/**
 * Sprite history — operation kinds, snapshots, and entry creation.
 *
 * Follows the scene history contract: deep-clone before/after snapshots,
 * skip no-ops, bounded stack with redo invalidation on new edits.
 */

import type { SpriteDocument, SpritePixelBuffer } from '@glyphstudio/domain';
import { clonePixelBuffer } from './spriteRaster.js';

// ── Operation kinds ──

export const SPRITE_HISTORY_OPERATION_KINDS = [
  'draw',
  'fill',
  'erase',
  'draw-line',
  'add-frame',
  'remove-frame',
  'duplicate-frame',
  'move-frame',
  'set-frame-duration',
  'add-layer',
  'remove-layer',
  'toggle-layer-visibility',
  'rename-layer',
  'move-layer',
  'cut-selection',
  'commit-selection',
  'set-palette-color',
  'swap-palette-colors',
  'import-sheet',
  'apply-palette-set',
] as const;

export type SpriteHistoryOperationKind = typeof SPRITE_HISTORY_OPERATION_KINDS[number];

const OPERATION_LABELS: Record<SpriteHistoryOperationKind, string> = {
  'draw': 'Draw',
  'fill': 'Fill',
  'erase': 'Erase',
  'draw-line': 'Draw line',
  'add-frame': 'Add frame',
  'remove-frame': 'Remove frame',
  'duplicate-frame': 'Duplicate frame',
  'move-frame': 'Move frame',
  'set-frame-duration': 'Set frame duration',
  'add-layer': 'Add layer',
  'remove-layer': 'Remove layer',
  'toggle-layer-visibility': 'Toggle layer visibility',
  'rename-layer': 'Rename layer',
  'move-layer': 'Move layer',
  'cut-selection': 'Cut selection',
  'commit-selection': 'Commit selection',
  'set-palette-color': 'Set palette color',
  'swap-palette-colors': 'Swap colors',
  'import-sheet': 'Import sheet',
  'apply-palette-set': 'Apply palette set',
};

export function describeSpriteHistoryOperation(kind: SpriteHistoryOperationKind): string {
  return OPERATION_LABELS[kind] ?? kind;
}

// ── Snapshot ──

/**
 * A deep-cloned snapshot of the sprite editor's authored state.
 *
 * Includes document structure and all pixel buffers.
 * View state (zoom, pan, grid, tool, onion skin, selection UI) is excluded.
 */
export interface SpriteHistorySnapshot {
  document: SpriteDocument;
  pixelBuffers: Record<string, SpritePixelBuffer>;
  activeFrameIndex: number;
  activeLayerId: string | null;
}

/**
 * Deep-clone the authored state into an immutable snapshot.
 */
export function captureSpriteSnapshot(
  document: SpriteDocument,
  pixelBuffers: Record<string, SpritePixelBuffer>,
  activeFrameIndex: number,
  activeLayerId: string | null,
): SpriteHistorySnapshot {
  const clonedBuffers: Record<string, SpritePixelBuffer> = {};
  for (const [id, buf] of Object.entries(pixelBuffers)) {
    clonedBuffers[id] = clonePixelBuffer(buf);
  }
  return {
    document: JSON.parse(JSON.stringify(document)),
    pixelBuffers: clonedBuffers,
    activeFrameIndex,
    activeLayerId,
  };
}

// ── Entry ──

export interface SpriteHistoryEntry {
  kind: SpriteHistoryOperationKind;
  label: string;
  before: SpriteHistorySnapshot;
  after: SpriteHistorySnapshot;
  timestamp: string;
}

/**
 * Create a history entry from before/after snapshots.
 *
 * Returns `null` if the snapshots are identical (no-op guard).
 * Uses JSON serialization for deep equality on document structure,
 * and byte-level comparison for pixel buffers.
 */
export function createSpriteHistoryEntry(
  kind: SpriteHistoryOperationKind,
  before: SpriteHistorySnapshot,
  after: SpriteHistorySnapshot,
): SpriteHistoryEntry | null {
  if (isSpriteSnapshotEqual(before, after)) return null;

  return {
    kind,
    label: describeSpriteHistoryOperation(kind),
    before,
    after,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Deep equality check for sprite snapshots.
 */
function isSpriteSnapshotEqual(a: SpriteHistorySnapshot, b: SpriteHistorySnapshot): boolean {
  // Quick structural check
  if (a.activeFrameIndex !== b.activeFrameIndex) return false;
  if (a.activeLayerId !== b.activeLayerId) return false;
  if (JSON.stringify(a.document) !== JSON.stringify(b.document)) return false;

  // Check pixel buffers
  const aKeys = Object.keys(a.pixelBuffers).sort();
  const bKeys = Object.keys(b.pixelBuffers).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    const aBuf = a.pixelBuffers[aKeys[i]];
    const bBuf = b.pixelBuffers[bKeys[i]];
    if (aBuf.width !== bBuf.width || aBuf.height !== bBuf.height) return false;
    if (aBuf.data.length !== bBuf.data.length) return false;
    for (let j = 0; j < aBuf.data.length; j++) {
      if (aBuf.data[j] !== bBuf.data[j]) return false;
    }
  }

  return true;
}
