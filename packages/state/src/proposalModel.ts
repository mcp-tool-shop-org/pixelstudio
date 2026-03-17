/**
 * AI Proposal Model — data types for reviewable, non-destructive AI proposals.
 *
 * Law: every AI proposal is reviewable, non-destructive, easy to reject,
 * and inserted into the actual workflow. No invisible mutation goblins.
 */

import type {
  VectorShape,
  VectorShapeId,
  VectorGeometry,
  VectorTransform,
  VectorReductionMeta,
  Rgba,
  SizeProfileId,
} from '@glyphstudio/domain';
import { generateVectorShapeId } from '@glyphstudio/domain';

// ── Proposal types ──

/** Unique proposal ID. */
export type ProposalId = string;

/** Unique proposal set ID (groups related proposals). */
export type ProposalSetId = string;

/** What kind of proposal this is. */
export type ProposalKind =
  | 'silhouette-variant'
  | 'pose-suggestion'
  | 'simplification'
  | 'exaggeration';

/** How the user responded to a proposal. */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'dismissed';

/**
 * A single shape modification proposed by the AI.
 *
 * Can be:
 * - 'add': propose a new shape
 * - 'modify': propose changes to an existing shape
 * - 'drop': propose removing a shape
 * - 'merge': propose merging shapes into one
 */
export type ProposalAction =
  | { type: 'add'; shape: ProposedShape }
  | { type: 'modify'; targetId: VectorShapeId; changes: ProposedChanges }
  | { type: 'drop'; targetId: VectorShapeId; reason: string }
  | { type: 'merge'; sourceIds: VectorShapeId[]; result: ProposedShape; reason: string };

/** A new shape proposed by the AI (not yet in the document). */
export interface ProposedShape {
  /** Temporary ID for the proposal (not a real shape ID yet). */
  tempId: string;
  name: string;
  geometry: VectorGeometry;
  fill: Rgba | null;
  stroke: { color: Rgba; width: number } | null;
  transform: VectorTransform;
  reduction: VectorReductionMeta;
}

/** Partial changes proposed to an existing shape. */
export interface ProposedChanges {
  geometry?: VectorGeometry;
  transform?: Partial<VectorTransform>;
  fill?: Rgba | null;
  reduction?: Partial<VectorReductionMeta>;
  name?: string;
}

/**
 * A single AI proposal — one coherent suggestion.
 *
 * Example: "Widen the hood by 30% to survive at 16×16"
 * Example: "Silhouette variant A — forward-leaning stance"
 */
export interface Proposal {
  id: ProposalId;
  /** Which set this belongs to. */
  setId: ProposalSetId;
  /** What kind of proposal. */
  kind: ProposalKind;
  /** Short headline describing what this proposes. */
  headline: string;
  /** Why this change helps (reduction-aware reasoning). */
  rationale: string;
  /** The concrete actions this proposal would take. */
  actions: ProposalAction[];
  /** Current status. */
  status: ProposalStatus;
  /** Which size profile this targets (null = all). */
  targetProfileId: SizeProfileId | null;
  /** Severity/priority (lower = more important). */
  priority: number;
  /** Created timestamp. */
  createdAt: string;
}

/**
 * A set of related proposals generated together.
 *
 * Example: "3 silhouette variants for knight"
 * Example: "Simplification proposals for 16×16"
 */
export interface ProposalSet {
  id: ProposalSetId;
  /** What generated this set. */
  kind: ProposalKind;
  /** Human-readable label. */
  label: string;
  /** Source document name. */
  documentName: string;
  /** Proposal IDs in this set. */
  proposalIds: ProposalId[];
  /** Created timestamp. */
  createdAt: string;
}

/** Session-level proposal history. */
export interface ProposalSession {
  /** All proposal sets generated in this session, newest first. */
  sets: ProposalSet[];
  /** All proposals indexed by ID. */
  proposalsById: Record<ProposalId, Proposal>;
  /** How many proposals have been accepted total. */
  acceptedCount: number;
  /** How many proposals have been rejected total. */
  rejectedCount: number;
}

// ── Factory functions ──

export function generateProposalId(): ProposalId {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateProposalSetId(): ProposalSetId {
  return `pset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySession(): ProposalSession {
  return {
    sets: [],
    proposalsById: {},
    acceptedCount: 0,
    rejectedCount: 0,
  };
}

export function createProposal(
  setId: ProposalSetId,
  kind: ProposalKind,
  headline: string,
  rationale: string,
  actions: ProposalAction[],
  opts: {
    targetProfileId?: SizeProfileId | null;
    priority?: number;
  } = {},
): Proposal {
  return {
    id: generateProposalId(),
    setId,
    kind,
    headline,
    rationale,
    actions,
    status: 'pending',
    targetProfileId: opts.targetProfileId ?? null,
    priority: opts.priority ?? 0,
    createdAt: new Date().toISOString(),
  };
}

export function createProposalSet(
  kind: ProposalKind,
  label: string,
  documentName: string,
): ProposalSet {
  return {
    id: generateProposalSetId(),
    kind,
    label,
    documentName,
    proposalIds: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a ProposedShape from an existing VectorShape
 * (for use as a starting point for variants).
 */
export function proposedShapeFromExisting(shape: VectorShape): ProposedShape {
  return {
    tempId: `tmp_${generateVectorShapeId()}`,
    name: shape.name,
    geometry: structuredClone(shape.geometry),
    fill: shape.fill ? [...shape.fill] as Rgba : null,
    stroke: shape.stroke ? { color: [...shape.stroke.color] as Rgba, width: shape.stroke.width } : null,
    transform: { ...shape.transform },
    reduction: { ...shape.reduction },
  };
}

// ── Session operations ──

/** Add a proposal set with its proposals to the session. */
export function addProposalSetToSession(
  session: ProposalSession,
  set: ProposalSet,
  proposals: Proposal[],
): ProposalSession {
  const newById = { ...session.proposalsById };
  const ids: ProposalId[] = [];
  for (const p of proposals) {
    newById[p.id] = p;
    ids.push(p.id);
  }
  const updatedSet = { ...set, proposalIds: ids };
  return {
    ...session,
    sets: [updatedSet, ...session.sets],
    proposalsById: newById,
  };
}

/** Accept a proposal (marks it accepted). */
export function acceptProposal(session: ProposalSession, id: ProposalId): ProposalSession {
  const p = session.proposalsById[id];
  if (!p || p.status !== 'pending') return session;
  return {
    ...session,
    proposalsById: { ...session.proposalsById, [id]: { ...p, status: 'accepted' } },
    acceptedCount: session.acceptedCount + 1,
  };
}

/** Reject a proposal. */
export function rejectProposal(session: ProposalSession, id: ProposalId): ProposalSession {
  const p = session.proposalsById[id];
  if (!p || p.status !== 'pending') return session;
  return {
    ...session,
    proposalsById: { ...session.proposalsById, [id]: { ...p, status: 'rejected' } },
    rejectedCount: session.rejectedCount + 1,
  };
}

/** Dismiss all pending proposals in a set. */
export function dismissProposalSet(session: ProposalSession, setId: ProposalSetId): ProposalSession {
  const set = session.sets.find((s) => s.id === setId);
  if (!set) return session;
  const newById = { ...session.proposalsById };
  for (const pid of set.proposalIds) {
    const p = newById[pid];
    if (p && p.status === 'pending') {
      newById[pid] = { ...p, status: 'dismissed' };
    }
  }
  return { ...session, proposalsById: newById };
}

/** Get pending proposals from a set. */
export function getPendingProposals(session: ProposalSession, setId: ProposalSetId): Proposal[] {
  const set = session.sets.find((s) => s.id === setId);
  if (!set) return [];
  return set.proposalIds
    .map((id) => session.proposalsById[id])
    .filter((p): p is Proposal => !!p && p.status === 'pending');
}
