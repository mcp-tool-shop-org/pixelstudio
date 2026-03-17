import { useState, useMemo, useCallback } from 'react';
import {
  useVectorMasterStore,
  useSizeProfileStore,
  generateSilhouetteVariants,
  generatePoseSuggestions,
  generateSimplificationProposals,
  createEmptySession,
  addProposalSetToSession,
  acceptProposal as acceptProposalFn,
  rejectProposal as rejectProposalFn,
  dismissProposalSet as dismissProposalSetFn,
  getPendingProposals,
  applyProposal,
  duplicateProposalToGroup,
} from '@glyphstudio/state';
import type {
  ProposalSession,
  ProposalKind,
  Proposal,
  ProposalSet,
  ProposalStoreApi,
} from '@glyphstudio/state';

// ── Types ──

type GenerateMode = 'silhouette' | 'pose' | 'simplification';

// ── Component ──

export function VectorAICreationPanel() {
  const doc = useVectorMasterStore((s) => s.document);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);

  const [session, setSession] = useState<ProposalSession>(createEmptySession);
  const [generateMode, setGenerateMode] = useState<GenerateMode>('silhouette');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [simplifyProfileId, setSimplifyProfileId] = useState<string>('');

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  // Build store API from zustand actions
  const storeApi: ProposalStoreApi = useMemo(() => ({
    addShape: useVectorMasterStore.getState().addShape,
    removeShape: useVectorMasterStore.getState().removeShape,
    setShapeGeometry: useVectorMasterStore.getState().setShapeGeometry,
    setShapeTransform: useVectorMasterStore.getState().setShapeTransform,
    setShapeFill: useVectorMasterStore.getState().setShapeFill,
    setShapeReduction: useVectorMasterStore.getState().setShapeReduction,
    setShapeName: useVectorMasterStore.getState().setShapeName,
    setShapeGroup: useVectorMasterStore.getState().setShapeGroup,
    addGroup: useVectorMasterStore.getState().addGroup,
  }), []);

  // ── Generate ──

  const handleGenerate = useCallback(() => {
    if (!doc) return;
    let result: { set: ProposalSet; proposals: Proposal[] };

    switch (generateMode) {
      case 'silhouette':
        result = generateSilhouetteVariants(doc, activeProfiles);
        break;
      case 'pose':
        result = generatePoseSuggestions(doc, activeProfiles);
        break;
      case 'simplification': {
        const targetProfile = activeProfiles.find((p) => p.id === simplifyProfileId) ?? activeProfiles[0];
        if (!targetProfile) return;
        result = generateSimplificationProposals(doc, activeProfiles, targetProfile);
        break;
      }
    }

    if (result.proposals.length === 0) return;

    setSession((prev) => addProposalSetToSession(prev, result.set, result.proposals));
    setSelectedSetId(result.set.id);
  }, [doc, generateMode, activeProfiles, simplifyProfileId]);

  // ── Accept / Reject / Dismiss ──

  const handleAccept = useCallback((proposalId: string) => {
    if (!doc) return;
    const proposal = session.proposalsById[proposalId];
    if (!proposal) return;
    const result = applyProposal(proposal, storeApi, doc);
    if (result.ok) {
      setSession((prev) => acceptProposalFn(prev, proposalId));
    }
  }, [doc, session, storeApi]);

  const handleDuplicate = useCallback((proposalId: string) => {
    if (!doc) return;
    const proposal = session.proposalsById[proposalId];
    if (!proposal) return;
    const result = duplicateProposalToGroup(proposal, storeApi, doc);
    if (result.ok) {
      setSession((prev) => acceptProposalFn(prev, proposalId));
    }
  }, [doc, session, storeApi]);

  const handleReject = useCallback((proposalId: string) => {
    setSession((prev) => rejectProposalFn(prev, proposalId));
  }, []);

  const handleDismissSet = useCallback((setId: string) => {
    setSession((prev) => dismissProposalSetFn(prev, setId));
  }, []);

  // ── Render ──

  if (!doc) {
    return (
      <div className="dock-panel-placeholder">
        <span className="placeholder-label">No vector document</span>
      </div>
    );
  }

  const selectedSet = session.sets.find((s) => s.id === selectedSetId);
  const pendingProposals = selectedSet ? getPendingProposals(session, selectedSet.id) : [];
  const allProposalsForSet = selectedSet
    ? selectedSet.proposalIds.map((id) => session.proposalsById[id]).filter(Boolean)
    : [];

  return (
    <div className="vector-ai-creation-panel">
      {/* Mode selector */}
      <div className="ai-mode-selector">
        <button
          className={`ai-mode-btn ${generateMode === 'silhouette' ? 'active' : ''}`}
          onClick={() => setGenerateMode('silhouette')}
        >
          Silhouettes
        </button>
        <button
          className={`ai-mode-btn ${generateMode === 'pose' ? 'active' : ''}`}
          onClick={() => setGenerateMode('pose')}
        >
          Pose
        </button>
        <button
          className={`ai-mode-btn ${generateMode === 'simplification' ? 'active' : ''}`}
          onClick={() => setGenerateMode('simplification')}
        >
          Simplify
        </button>
      </div>

      {/* Simplification target profile */}
      {generateMode === 'simplification' && (
        <div className="ai-profile-select">
          <label className="prop-mini-label">Target</label>
          <select
            className="prop-select"
            value={simplifyProfileId}
            onChange={(e) => setSimplifyProfileId(e.target.value)}
          >
            {activeProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Generate button */}
      <button
        className="ai-generate-btn"
        onClick={handleGenerate}
        disabled={activeProfiles.length === 0}
      >
        Generate {generateMode === 'silhouette' ? 'Variants' : generateMode === 'pose' ? 'Suggestions' : 'Proposals'}
      </button>

      {activeProfiles.length === 0 && (
        <div className="copilot-warning">
          Enable size profiles in the Reduction tab first.
        </div>
      )}

      {/* Session stats */}
      {session.sets.length > 0 && (
        <div className="ai-session-stats">
          <span>{session.sets.length} generation(s)</span>
          <span className="ai-stat-accepted">{session.acceptedCount} accepted</span>
          <span className="ai-stat-rejected">{session.rejectedCount} rejected</span>
        </div>
      )}

      {/* Set history */}
      {session.sets.length > 0 && (
        <div className="ai-set-list">
          {session.sets.map((s) => (
            <button
              key={s.id}
              className={`ai-set-btn ${selectedSetId === s.id ? 'active' : ''}`}
              onClick={() => setSelectedSetId(s.id)}
            >
              <span className="ai-set-kind">{kindLabel(s.kind)}</span>
              <span className="ai-set-label">{s.label}</span>
              <span className="ai-set-count">{s.proposalIds.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Proposals for selected set */}
      {selectedSet && (
        <div className="ai-proposals">
          <div className="ai-proposals-header">
            <span>{selectedSet.label}</span>
            {pendingProposals.length > 0 && (
              <button
                className="copilot-clear-btn"
                onClick={() => handleDismissSet(selectedSet.id)}
              >
                Dismiss All
              </button>
            )}
          </div>
          {allProposalsForSet.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onAccept={handleAccept}
              onDuplicate={handleDuplicate}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function ProposalCard({
  proposal,
  onAccept,
  onDuplicate,
  onReject,
}: {
  proposal: Proposal;
  onAccept: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isPending = proposal.status === 'pending';

  return (
    <div className={`ai-proposal-card status-${proposal.status}`}>
      <div className="ai-proposal-headline">{proposal.headline}</div>
      <div className="ai-proposal-rationale">{proposal.rationale}</div>
      <div className="ai-proposal-actions-summary">
        {proposal.actions.map((a, i) => (
          <span key={i} className={`ai-action-badge ${a.type}`}>
            {a.type}
          </span>
        ))}
      </div>
      {isPending && (
        <div className="ai-proposal-buttons">
          <button
            className="ai-accept-btn"
            onClick={() => onAccept(proposal.id)}
            title="Apply changes directly to document"
          >
            Accept
          </button>
          <button
            className="ai-duplicate-btn"
            onClick={() => onDuplicate(proposal.id)}
            title="Create proposal shapes in AI Proposals group"
          >
            Duplicate
          </button>
          <button
            className="ai-reject-btn"
            onClick={() => onReject(proposal.id)}
            title="Dismiss this proposal"
          >
            Reject
          </button>
        </div>
      )}
      {!isPending && (
        <div className={`ai-proposal-status ${proposal.status}`}>
          {proposal.status}
        </div>
      )}
    </div>
  );
}

function kindLabel(kind: ProposalKind): string {
  switch (kind) {
    case 'silhouette-variant': return 'SIL';
    case 'pose-suggestion': return 'POSE';
    case 'simplification': return 'SIMP';
    case 'exaggeration': return 'EXAG';
  }
}
