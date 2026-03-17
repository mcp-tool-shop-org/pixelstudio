import { describe, it, expect } from 'vitest';
import {
  createEmptySession,
  createProposal,
  createProposalSet,
  proposedShapeFromExisting,
  addProposalSetToSession,
  acceptProposal,
  rejectProposal,
  dismissProposalSet,
  getPendingProposals,
} from './proposalModel';
import type { Proposal, ProposalSet } from './proposalModel';
import { createRectShape } from '@glyphstudio/domain';

describe('ProposalModel', () => {
  it('creates empty session', () => {
    const session = createEmptySession();
    expect(session.sets).toHaveLength(0);
    expect(session.acceptedCount).toBe(0);
    expect(session.rejectedCount).toBe(0);
  });

  it('creates proposal with required fields', () => {
    const p = createProposal('set-1', 'silhouette-variant', 'Test', 'Because reasons', []);
    expect(p.id).toMatch(/^prop_/);
    expect(p.setId).toBe('set-1');
    expect(p.kind).toBe('silhouette-variant');
    expect(p.status).toBe('pending');
    expect(p.headline).toBe('Test');
    expect(p.createdAt).toBeTruthy();
  });

  it('creates proposal set', () => {
    const s = createProposalSet('pose-suggestion', 'Test Set', 'My Doc');
    expect(s.id).toMatch(/^pset_/);
    expect(s.kind).toBe('pose-suggestion');
    expect(s.proposalIds).toHaveLength(0);
  });

  it('adds proposal set to session', () => {
    let session = createEmptySession();
    const set = createProposalSet('silhouette-variant', 'Variants', 'Doc');
    const proposals = [
      createProposal(set.id, 'silhouette-variant', 'A', 'reason', []),
      createProposal(set.id, 'silhouette-variant', 'B', 'reason', []),
    ];
    session = addProposalSetToSession(session, set, proposals);
    expect(session.sets).toHaveLength(1);
    expect(session.sets[0].proposalIds).toHaveLength(2);
    expect(Object.keys(session.proposalsById)).toHaveLength(2);
  });

  it('accepts proposal and increments counter', () => {
    let session = createEmptySession();
    const set = createProposalSet('simplification', 'Test', 'Doc');
    const p = createProposal(set.id, 'simplification', 'Drop X', 'reason', []);
    session = addProposalSetToSession(session, set, [p]);
    session = acceptProposal(session, p.id);
    expect(session.proposalsById[p.id].status).toBe('accepted');
    expect(session.acceptedCount).toBe(1);
  });

  it('rejects proposal and increments counter', () => {
    let session = createEmptySession();
    const set = createProposalSet('pose-suggestion', 'Test', 'Doc');
    const p = createProposal(set.id, 'pose-suggestion', 'Break sym', 'reason', []);
    session = addProposalSetToSession(session, set, [p]);
    session = rejectProposal(session, p.id);
    expect(session.proposalsById[p.id].status).toBe('rejected');
    expect(session.rejectedCount).toBe(1);
  });

  it('does not accept already accepted proposal', () => {
    let session = createEmptySession();
    const set = createProposalSet('simplification', 'Test', 'Doc');
    const p = createProposal(set.id, 'simplification', 'X', 'r', []);
    session = addProposalSetToSession(session, set, [p]);
    session = acceptProposal(session, p.id);
    session = acceptProposal(session, p.id); // no-op
    expect(session.acceptedCount).toBe(1);
  });

  it('dismisses all pending proposals in a set', () => {
    let session = createEmptySession();
    const set = createProposalSet('silhouette-variant', 'V', 'Doc');
    const p1 = createProposal(set.id, 'silhouette-variant', 'A', 'r', []);
    const p2 = createProposal(set.id, 'silhouette-variant', 'B', 'r', []);
    session = addProposalSetToSession(session, set, [p1, p2]);
    session = acceptProposal(session, p1.id); // accept one
    session = dismissProposalSet(session, set.id); // dismiss remaining
    expect(session.proposalsById[p1.id].status).toBe('accepted'); // unchanged
    expect(session.proposalsById[p2.id].status).toBe('dismissed');
  });

  it('gets pending proposals from a set', () => {
    let session = createEmptySession();
    const set = createProposalSet('simplification', 'S', 'Doc');
    const p1 = createProposal(set.id, 'simplification', 'A', 'r', []);
    const p2 = createProposal(set.id, 'simplification', 'B', 'r', []);
    session = addProposalSetToSession(session, set, [p1, p2]);
    session = rejectProposal(session, p1.id);
    const pending = getPendingProposals(session, set.id);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(p2.id);
  });

  it('creates ProposedShape from existing VectorShape', () => {
    const shape = createRectShape('hood', 100, 100, 50, 80, [200, 50, 50, 255]);
    const proposed = proposedShapeFromExisting(shape);
    expect(proposed.tempId).toMatch(/^tmp_/);
    expect(proposed.name).toBe('hood');
    expect(proposed.geometry).toEqual(shape.geometry);
    expect(proposed.fill).toEqual([200, 50, 50, 255]);
    // Verify it's a deep copy
    if (proposed.fill) proposed.fill[0] = 0;
    expect(shape.fill![0]).toBe(200);
  });

  it('newest set appears first in session', () => {
    let session = createEmptySession();
    const set1 = createProposalSet('silhouette-variant', 'First', 'Doc');
    session = addProposalSetToSession(session, set1, []);
    const set2 = createProposalSet('pose-suggestion', 'Second', 'Doc');
    session = addProposalSetToSession(session, set2, []);
    expect(session.sets[0].label).toBe('Second');
    expect(session.sets[1].label).toBe('First');
  });
});
