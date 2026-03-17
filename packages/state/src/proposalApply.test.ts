import { describe, it, expect, beforeEach } from 'vitest';
import type { VectorMasterDocument, VectorShape } from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import { useVectorMasterStore } from './vectorMasterStore';
import { applyProposal, duplicateProposalToGroup } from './proposalApply';
import { createProposal } from './proposalModel';
import type { ProposalStoreApi } from './proposalApply';

// ── Helpers ──

function getStore(): ProposalStoreApi {
  const s = useVectorMasterStore.getState();
  return {
    addShape: s.addShape,
    removeShape: s.removeShape,
    setShapeGeometry: s.setShapeGeometry,
    setShapeTransform: s.setShapeTransform,
    setShapeFill: s.setShapeFill,
    setShapeReduction: s.setShapeReduction,
    setShapeName: s.setShapeName,
    setShapeGroup: s.setShapeGroup,
    addGroup: s.addGroup,
  };
}

function getDoc(): VectorMasterDocument {
  return useVectorMasterStore.getState().document!;
}

describe('applyProposal', () => {
  beforeEach(() => {
    useVectorMasterStore.setState({
      document: null,
      selectedShapeIds: [],
      selectedGroupId: null,
    });
    useVectorMasterStore.getState().createDocument('Test');
    useVectorMasterStore.getState().addShape({
      name: 'body',
      groupId: null,
      geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 300 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
  });

  it('applies modify action to existing shape', () => {
    const doc = getDoc();
    const bodyId = doc.shapes[0].id;
    const proposal = createProposal('set-1', 'simplification', 'Widen body', 'reason', [
      {
        type: 'modify',
        targetId: bodyId,
        changes: { geometry: { kind: 'rect', x: 80, y: 100, w: 240, h: 300 } },
      },
    ]);
    const result = applyProposal(proposal, getStore(), doc);
    expect(result.ok).toBe(true);
    expect(result.modifiedShapeIds).toContain(bodyId);

    const updated = getDoc().shapes.find((s) => s.id === bodyId);
    expect(updated?.geometry).toEqual({ kind: 'rect', x: 80, y: 100, w: 240, h: 300 });
  });

  it('applies add action creating new shape', () => {
    const doc = getDoc();
    const proposal = createProposal('set-1', 'silhouette-variant', 'Add hat', 'reason', [
      {
        type: 'add',
        shape: {
          tempId: 'tmp-1',
          name: 'hat',
          geometry: { kind: 'ellipse', cx: 200, cy: 50, rx: 60, ry: 30 },
          fill: [200, 100, 50, 255],
          stroke: null,
          transform: { ...DEFAULT_VECTOR_TRANSFORM },
          reduction: { ...DEFAULT_REDUCTION_META },
        },
      },
    ]);
    const result = applyProposal(proposal, getStore(), doc);
    expect(result.ok).toBe(true);
    expect(result.createdShapeIds).toHaveLength(1);

    const newDoc = getDoc();
    const hat = newDoc.shapes.find((s) => s.name === 'hat');
    expect(hat).toBeTruthy();
    expect(hat?.geometry.kind).toBe('ellipse');
  });

  it('applies drop action removing shape', () => {
    const doc = getDoc();
    const bodyId = doc.shapes[0].id;
    const proposal = createProposal('set-1', 'simplification', 'Drop body', 'reason', [
      { type: 'drop', targetId: bodyId, reason: 'Too small' },
    ]);
    const result = applyProposal(proposal, getStore(), doc);
    expect(result.ok).toBe(true);
    expect(result.removedShapeIds).toContain(bodyId);
    expect(getDoc().shapes.find((s) => s.id === bodyId)).toBeUndefined();
  });

  it('applies merge action creating new and removing sources', () => {
    // Add a second shape
    useVectorMasterStore.getState().addShape({
      name: 'arm',
      groupId: null,
      geometry: { kind: 'rect', x: 310, y: 200, w: 30, h: 100 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    const doc = getDoc();
    const bodyId = doc.shapes[0].id;
    const armId = doc.shapes[1].id;

    const proposal = createProposal('set-1', 'simplification', 'Merge body+arm', 'reason', [
      {
        type: 'merge',
        sourceIds: [bodyId, armId],
        result: {
          tempId: 'tmp-merge',
          name: 'body+arm',
          geometry: { kind: 'rect', x: 100, y: 100, w: 240, h: 300 },
          fill: [100, 100, 100, 255],
          stroke: null,
          transform: { ...DEFAULT_VECTOR_TRANSFORM },
          reduction: { ...DEFAULT_REDUCTION_META },
        },
        reason: 'Nearby small shapes',
      },
    ]);
    const result = applyProposal(proposal, getStore(), doc);
    expect(result.ok).toBe(true);
    expect(result.createdShapeIds).toHaveLength(1);
    expect(result.removedShapeIds).toHaveLength(2);

    const newDoc = getDoc();
    expect(newDoc.shapes.find((s) => s.id === bodyId)).toBeUndefined();
    expect(newDoc.shapes.find((s) => s.id === armId)).toBeUndefined();
    expect(newDoc.shapes.find((s) => s.name === 'body+arm')).toBeTruthy();
  });
});

describe('duplicateProposalToGroup', () => {
  beforeEach(() => {
    useVectorMasterStore.setState({
      document: null,
      selectedShapeIds: [],
      selectedGroupId: null,
    });
    useVectorMasterStore.getState().createDocument('Test');
    useVectorMasterStore.getState().addShape({
      name: 'body',
      groupId: null,
      geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 300 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
  });

  it('creates AI Proposals group and duplicates modified shapes', () => {
    const doc = getDoc();
    const bodyId = doc.shapes[0].id;
    const proposal = createProposal('set-1', 'simplification', 'Widen body', 'reason', [
      {
        type: 'modify',
        targetId: bodyId,
        changes: { geometry: { kind: 'rect', x: 80, y: 100, w: 240, h: 300 } },
      },
    ]);
    const result = duplicateProposalToGroup(proposal, getStore(), doc);
    expect(result.ok).toBe(true);
    expect(result.createdShapeIds).toHaveLength(1);

    const newDoc = getDoc();
    // Original body should be unchanged
    const original = newDoc.shapes.find((s) => s.id === bodyId);
    expect(original?.geometry).toEqual({ kind: 'rect', x: 100, y: 100, w: 200, h: 300 });
    // AI Proposals group should exist
    const aiGroup = newDoc.groups.find((g) => g.name === 'AI Proposals');
    expect(aiGroup).toBeTruthy();
    // Duplicated shape should be in AI Proposals group
    const duplicated = newDoc.shapes.find((s) => s.name === '[AI] body');
    expect(duplicated).toBeTruthy();
    expect(duplicated?.groupId).toBe(aiGroup?.id);
    expect(duplicated?.geometry).toEqual({ kind: 'rect', x: 80, y: 100, w: 240, h: 300 });
  });

  it('reuses existing AI Proposals group', () => {
    const groupId = useVectorMasterStore.getState().addGroup('AI Proposals');
    const doc = getDoc();
    const bodyId = doc.shapes[0].id;
    const proposal = createProposal('set-1', 'pose-suggestion', 'Shift', 'reason', [
      {
        type: 'modify',
        targetId: bodyId,
        changes: { transform: { x: 10 } },
      },
    ]);
    duplicateProposalToGroup(proposal, getStore(), doc);
    const newDoc = getDoc();
    const groups = newDoc.groups.filter((g) => g.name === 'AI Proposals');
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(groupId);
  });

  it('does not duplicate drop actions', () => {
    const doc = getDoc();
    const bodyId = doc.shapes[0].id;
    const proposal = createProposal('set-1', 'simplification', 'Drop body', 'reason', [
      { type: 'drop', targetId: bodyId, reason: 'Too small' },
    ]);
    const result = duplicateProposalToGroup(proposal, getStore(), doc);
    expect(result.ok).toBe(true);
    expect(result.createdShapeIds).toHaveLength(0);
    // Original body should still exist
    expect(getDoc().shapes.find((s) => s.id === bodyId)).toBeTruthy();
  });
});
