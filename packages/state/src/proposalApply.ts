/**
 * Proposal Apply — converts accepted proposals into document changes.
 *
 * Law: proposals are applied through the normal store API,
 * creating real shapes or modifying existing ones. The user
 * can undo via normal document history.
 *
 * Two modes:
 * 1. Accept — apply changes directly to the document
 * 2. Duplicate to layer — create proposal shapes in an AI Proposals group
 */

import type {
  VectorMasterDocument,
  VectorShape,
  VectorShapeId,
  VectorGroupId,
} from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import type { Proposal, ProposalAction, ProposedShape } from './proposalModel';

// ── Types ──

/** Result of applying a proposal. */
export interface ApplyResult {
  /** Whether the apply succeeded. */
  ok: boolean;
  /** New shape IDs created (for 'add' and 'merge' actions). */
  createdShapeIds: VectorShapeId[];
  /** Shape IDs that were modified. */
  modifiedShapeIds: VectorShapeId[];
  /** Shape IDs that were removed. */
  removedShapeIds: VectorShapeId[];
  /** Error message if failed. */
  error: string | null;
}

/** Store interface — the minimal store API we need. */
export interface ProposalStoreApi {
  addShape: (shape: Omit<VectorShape, 'id' | 'zOrder'>) => VectorShapeId;
  removeShape: (id: VectorShapeId) => void;
  setShapeGeometry: (id: VectorShapeId, geometry: VectorShape['geometry']) => void;
  setShapeTransform: (id: VectorShapeId, transform: Partial<VectorShape['transform']>) => void;
  setShapeFill: (id: VectorShapeId, fill: VectorShape['fill']) => void;
  setShapeReduction: (id: VectorShapeId, reduction: Partial<VectorShape['reduction']>) => void;
  setShapeName: (id: VectorShapeId, name: string) => void;
  setShapeGroup: (id: VectorShapeId, groupId: VectorGroupId | null) => void;
  addGroup: (name: string) => VectorGroupId;
}

// ── Apply ──

/**
 * Apply a proposal's actions directly to the document.
 *
 * This is the "Accept" action. Changes go through the normal store API,
 * so they're part of the document's edit history.
 */
export function applyProposal(
  proposal: Proposal,
  store: ProposalStoreApi,
  doc: VectorMasterDocument,
): ApplyResult {
  const created: VectorShapeId[] = [];
  const modified: VectorShapeId[] = [];
  const removed: VectorShapeId[] = [];

  try {
    for (const action of proposal.actions) {
      switch (action.type) {
        case 'add': {
          const id = addProposedShape(action.shape, store, null);
          created.push(id);
          break;
        }
        case 'modify': {
          const shape = doc.shapes.find((s) => s.id === action.targetId);
          if (!shape) continue;
          applyChanges(action.targetId, action.changes, store);
          modified.push(action.targetId);
          break;
        }
        case 'drop': {
          const shape = doc.shapes.find((s) => s.id === action.targetId);
          if (!shape) continue;
          store.removeShape(action.targetId);
          removed.push(action.targetId);
          break;
        }
        case 'merge': {
          // Add the merged result shape
          const id = addProposedShape(action.result, store, null);
          created.push(id);
          // Remove source shapes
          for (const sourceId of action.sourceIds) {
            const exists = doc.shapes.find((s) => s.id === sourceId);
            if (exists) {
              store.removeShape(sourceId);
              removed.push(sourceId);
            }
          }
          break;
        }
      }
    }

    return { ok: true, createdShapeIds: created, modifiedShapeIds: modified, removedShapeIds: removed, error: null };
  } catch (err) {
    return {
      ok: false,
      createdShapeIds: created,
      modifiedShapeIds: modified,
      removedShapeIds: removed,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Duplicate proposal shapes into an "AI Proposals" group.
 *
 * This is the "Duplicate to layer" action. Creates new shapes
 * in a dedicated group so the user can compare side-by-side.
 */
export function duplicateProposalToGroup(
  proposal: Proposal,
  store: ProposalStoreApi,
  doc: VectorMasterDocument,
): ApplyResult {
  const created: VectorShapeId[] = [];

  try {
    // Find or create AI Proposals group
    let groupId = doc.groups.find((g) => g.name === 'AI Proposals')?.id ?? null;
    if (!groupId) {
      groupId = store.addGroup('AI Proposals');
    }

    for (const action of proposal.actions) {
      switch (action.type) {
        case 'add': {
          const id = addProposedShape(action.shape, store, groupId);
          store.setShapeName(id, `[AI] ${action.shape.name}`);
          created.push(id);
          break;
        }
        case 'modify': {
          // Create a copy of the original with the proposed changes applied
          const original = doc.shapes.find((s) => s.id === action.targetId);
          if (!original) continue;
          const proposed: ProposedShape = {
            tempId: '',
            name: `[AI] ${original.name}`,
            geometry: action.changes.geometry ?? structuredClone(original.geometry),
            fill: action.changes.fill !== undefined ? action.changes.fill : original.fill,
            stroke: original.stroke,
            transform: action.changes.transform
              ? { ...original.transform, ...action.changes.transform }
              : { ...original.transform },
            reduction: action.changes.reduction
              ? { ...original.reduction, ...action.changes.reduction }
              : { ...original.reduction },
          };
          const id = addProposedShape(proposed, store, groupId);
          created.push(id);
          break;
        }
        case 'merge': {
          const id = addProposedShape(action.result, store, groupId);
          store.setShapeName(id, `[AI] ${action.result.name}`);
          created.push(id);
          break;
        }
        case 'drop':
          // Don't duplicate drops — nothing to show
          break;
      }
    }

    return { ok: true, createdShapeIds: created, modifiedShapeIds: [], removedShapeIds: [], error: null };
  } catch (err) {
    return {
      ok: false,
      createdShapeIds: created,
      modifiedShapeIds: [],
      removedShapeIds: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Helpers ──

function addProposedShape(
  proposed: ProposedShape,
  store: ProposalStoreApi,
  groupId: VectorGroupId | null,
): VectorShapeId {
  const id = store.addShape({
    name: proposed.name,
    groupId,
    geometry: proposed.geometry,
    fill: proposed.fill,
    stroke: proposed.stroke,
    transform: proposed.transform,
    reduction: proposed.reduction,
    visible: true,
    locked: false,
  });
  return id;
}

function applyChanges(
  targetId: VectorShapeId,
  changes: NonNullable<Extract<ProposalAction, { type: 'modify' }>['changes']>,
  store: ProposalStoreApi,
): void {
  if (changes.geometry) store.setShapeGeometry(targetId, changes.geometry);
  if (changes.transform) store.setShapeTransform(targetId, changes.transform);
  if (changes.fill !== undefined) store.setShapeFill(targetId, changes.fill);
  if (changes.reduction) store.setShapeReduction(targetId, changes.reduction);
  if (changes.name) store.setShapeName(targetId, changes.name);
}
