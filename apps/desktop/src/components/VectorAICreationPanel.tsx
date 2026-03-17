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
  wouldShapeCollapse,
  generateShapesFromDescription,
  critiqueRenderedSprite,
  refineShapesFromCritique,
  shapesToProposalSet,
  checkOllamaAvailability,
  DEFAULT_GENERATE_CONFIG,
} from '@glyphstudio/state';
import type {
  ProposalSession,
  ProposalKind,
  Proposal,
  ProposalSet,
  ProposalStoreApi,
  ProposalAction,
  LLMShapeDef,
  OllamaGenerateConfig,
} from '@glyphstudio/state';
import type { VectorMasterDocument } from '@glyphstudio/domain';

// ── Types ──

type GenerateMode = 'ai-generate' | 'silhouette' | 'pose' | 'simplification';

// ── Component ──

export function VectorAICreationPanel() {
  const doc = useVectorMasterStore((s) => s.document);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);

  const [session, setSession] = useState<ProposalSession>(createEmptySession);
  const [generateMode, setGenerateMode] = useState<GenerateMode>('ai-generate');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [simplifyProfileId, setSimplifyProfileId] = useState<string>('');

  // AI Generate state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLog, setAiLog] = useState<string[]>([]);

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

  // ── AI Generate ──

  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiLog([]);

    const artW = doc?.artboardWidth ?? 500;
    const artH = doc?.artboardHeight ?? 500;
    const sizes = activeProfiles.length > 0
      ? activeProfiles.map(p => p.targetWidth).sort((a, b) => a - b)
      : [16, 32, 48];

    try {
      // Check Ollama availability
      setAiLog(prev => [...prev, `Checking Ollama (${DEFAULT_GENERATE_CONFIG.textModel})...`]);
      const avail = await checkOllamaAvailability({
        baseUrl: DEFAULT_GENERATE_CONFIG.baseUrl,
        model: DEFAULT_GENERATE_CONFIG.textModel,
        timeoutMs: 5000,
      });

      if (!avail.available) {
        setAiError(`Ollama not available. Run: ollama pull ${DEFAULT_GENERATE_CONFIG.textModel} && ollama serve`);
        setAiLoading(false);
        return;
      }

      // Step 1: Generate shapes
      setAiLog(prev => [...prev, `Generating shapes for "${aiPrompt}"...`]);
      const genResult = await generateShapesFromDescription(
        aiPrompt, artW, artH, sizes, doc ?? undefined,
      );

      if (!genResult.ok) {
        setAiError(genResult.error ?? 'Generation failed');
        setAiLoading(false);
        return;
      }

      setAiLog(prev => [...prev, `Got ${genResult.shapes.length} shapes (${genResult.responseTimeMs}ms)`]);

      if (genResult.shapes.length === 0) {
        setAiError('LLM returned no valid shapes');
        setAiLoading(false);
        return;
      }

      // Convert to proposals
      const { set, proposals } = shapesToProposalSet(genResult.shapes, genResult.reasoning, aiPrompt);

      setAiLog(prev => [...prev, `${genResult.reasoning}`]);
      setSession(prev => addProposalSetToSession(prev, set, proposals));
      setSelectedSetId(set.id);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, doc, activeProfiles]);

  // ── Algorithmic Generate ──

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
      default:
        return;
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
          className={`ai-mode-btn ${generateMode === 'ai-generate' ? 'active' : ''}`}
          onClick={() => setGenerateMode('ai-generate')}
        >
          AI Generate
        </button>
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

      {/* AI Generate mode */}
      {generateMode === 'ai-generate' && (
        <div className="ai-generate-section">
          <textarea
            className="ai-prompt-input"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe what to draw, e.g. 'hooded monk with staff' or 'fire-breathing dragon with spread wings'"
            rows={3}
            disabled={aiLoading}
          />
          <button
            className="ai-generate-btn ollama"
            onClick={handleAiGenerate}
            disabled={aiLoading || !aiPrompt.trim()}
          >
            {aiLoading ? 'Generating...' : 'Generate with Ollama'}
          </button>
          {aiError && <div className="ai-error">{aiError}</div>}
          {aiLog.length > 0 && (
            <div className="ai-log">
              {aiLog.map((line, i) => <div key={i} className="ai-log-line">{line}</div>)}
            </div>
          )}
        </div>
      )}

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

      {/* Generate button for algorithmic modes */}
      {generateMode !== 'ai-generate' && (
        <button
          className="ai-generate-btn"
          onClick={handleGenerate}
          disabled={activeProfiles.length === 0}
        >
          Generate {generateMode === 'silhouette' ? 'Variants' : generateMode === 'pose' ? 'Suggestions' : 'Proposals'}
        </button>
      )}

      {generateMode !== 'ai-generate' && activeProfiles.length === 0 && (
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
              doc={doc}
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
  doc,
  onAccept,
  onDuplicate,
  onReject,
}: {
  proposal: Proposal;
  doc: VectorMasterDocument;
  onAccept: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isPending = proposal.status === 'pending';
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className={`ai-proposal-card status-${proposal.status}`}>
      <div className="ai-proposal-header">
        <div className="ai-proposal-headline">{proposal.headline}</div>
        {isPending && (
          <button
            className="ai-preview-toggle"
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle before/after preview"
          >
            {showPreview ? 'Hide' : 'Preview'}
          </button>
        )}
      </div>
      <div className="ai-proposal-rationale">{proposal.rationale}</div>
      <div className="ai-proposal-actions-summary">
        {proposal.actions.map((a, i) => (
          <span key={i} className={`ai-action-badge ${a.type}`}>
            {a.type}
          </span>
        ))}
      </div>

      {/* Before/After Preview */}
      {showPreview && isPending && (
        <div className="ai-proposal-preview">
          {proposal.actions.map((action, i) => (
            <ActionPreview key={i} action={action} doc={doc} />
          ))}
        </div>
      )}

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

function ActionPreview({ action, doc }: { action: ProposalAction; doc: VectorMasterDocument }) {
  switch (action.type) {
    case 'modify': {
      const shape = doc.shapes.find((s) => s.id === action.targetId);
      if (!shape) return <div className="preview-row">Target shape not found</div>;
      const changes = action.changes;
      return (
        <div className="preview-row">
          <span className="preview-label">Modify "{shape.name}"</span>
          <div className="preview-diff">
            {changes.geometry && (
              <div className="preview-change">
                <span className="preview-before">geo: {geoSummary(shape.geometry)}</span>
                <span className="preview-arrow">{'\u2192'}</span>
                <span className="preview-after">{geoSummary(changes.geometry)}</span>
              </div>
            )}
            {changes.transform && (
              <div className="preview-change">
                <span className="preview-before">pos: ({Math.round(shape.transform.x)}, {Math.round(shape.transform.y)})</span>
                <span className="preview-arrow">{'\u2192'}</span>
                <span className="preview-after">({Math.round(changes.transform.x ?? shape.transform.x)}, {Math.round(changes.transform.y ?? shape.transform.y)})</span>
              </div>
            )}
            {changes.fill && (
              <div className="preview-change">
                <span className="preview-before">fill: [{shape.fill?.join(',')}]</span>
                <span className="preview-arrow">{'\u2192'}</span>
                <span className="preview-after">[{changes.fill.join(',')}]</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    case 'add':
      return (
        <div className="preview-row">
          <span className="preview-label">Add "{action.shape.name}"</span>
          <span className="preview-detail">{geoSummary(action.shape.geometry)}</span>
        </div>
      );
    case 'drop': {
      const shape = doc.shapes.find((s) => s.id === action.targetId);
      return (
        <div className="preview-row">
          <span className="preview-label">Drop "{shape?.name ?? '?'}"</span>
          <span className="preview-detail">{action.reason}</span>
        </div>
      );
    }
    case 'merge':
      return (
        <div className="preview-row">
          <span className="preview-label">Merge {action.sourceIds.length} shapes {'\u2192'} "{action.result.name}"</span>
          <span className="preview-detail">{action.reason}</span>
        </div>
      );
  }
}

function geoSummary(geo: any): string {
  switch (geo.kind) {
    case 'rect':
      return `rect ${Math.round(geo.w)}x${Math.round(geo.h)} @ (${Math.round(geo.x)},${Math.round(geo.y)})`;
    case 'ellipse':
      return `ellipse ${Math.round(geo.rx * 2)}x${Math.round(geo.ry * 2)} @ (${Math.round(geo.cx)},${Math.round(geo.cy)})`;
    case 'polygon':
      return `polygon ${geo.points.length}pts`;
    case 'path':
      return `path ${geo.points.length}pts${geo.closed ? ' closed' : ''}`;
    case 'line':
      return `line (${Math.round(geo.x1)},${Math.round(geo.y1)})-(${Math.round(geo.x2)},${Math.round(geo.y2)})`;
    default:
      return geo.kind;
  }
}

function kindLabel(kind: ProposalKind): string {
  switch (kind) {
    case 'silhouette-variant': return 'SIL';
    case 'pose-suggestion': return 'POSE';
    case 'simplification': return 'SIMP';
    case 'exaggeration': return 'EXAG';
  }
}
