import { useState, useMemo, useCallback } from 'react';
import {
  useVectorMasterStore,
  useSizeProfileStore,
  captureCopilotContext,
  captureCopilotRaster,
  analyzeTopChanges,
  analyzeCollapse,
  analyzeProfileStrength,
  analyzeExaggeration,
  askVisionWhatDoesThisReadAs,
  checkOllamaAvailability,
  pixelBufferToBase64Png,
  DEFAULT_OLLAMA_CONFIG,
} from '@glyphstudio/state';
import type {
  CopilotContext,
  TopChangesResponse,
  CollapseResponse,
  ProfileComparisonResponse,
  ExaggerationResponse,
  VisionResponse,
  OllamaVisionConfig,
} from '@glyphstudio/state';

// ── Types ──

type CopilotAction =
  | 'top-changes'
  | 'collapse'
  | 'profile-strength'
  | 'exaggeration'
  | 'vision';

interface CopilotNote {
  action: CopilotAction;
  timestamp: string;
  content: string;
}

// ── Component ──

export function VectorCopilotPanel() {
  const doc = useVectorMasterStore((s) => s.document);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);

  const [activeAction, setActiveAction] = useState<CopilotAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [topChanges, setTopChanges] = useState<TopChangesResponse | null>(null);
  const [collapse, setCollapse] = useState<CollapseResponse | null>(null);
  const [profileStrength, setProfileStrength] = useState<ProfileComparisonResponse | null>(null);
  const [exaggeration, setExaggeration] = useState<ExaggerationResponse | null>(null);
  const [vision, setVision] = useState<VisionResponse | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState<CopilotNote[]>([]);
  const [ollamaConfig] = useState<OllamaVisionConfig>({ ...DEFAULT_OLLAMA_CONFIG });

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  const captureContext = useCallback((): CopilotContext | null => {
    if (!doc) return null;
    return captureCopilotContext(doc, activeProfiles);
  }, [doc, activeProfiles]);

  const saveNote = useCallback((action: CopilotAction, content: string) => {
    setNotes((prev) => [...prev, {
      action,
      timestamp: new Date().toLocaleTimeString(),
      content,
    }]);
  }, []);

  // ── Action handlers ──

  const handleTopChanges = useCallback(() => {
    const ctx = captureContext();
    if (!ctx) return;
    setActiveAction('top-changes');
    const result = analyzeTopChanges(ctx);
    setTopChanges(result);
    if (result.critiques.length > 0) {
      saveNote('top-changes', result.critiques.map((c) => `[${c.severity}] ${c.headline}`).join('\n'));
    }
  }, [captureContext, saveNote]);

  const handleCollapse = useCallback(() => {
    const ctx = captureContext();
    if (!ctx) return;
    setActiveAction('collapse');
    const result = analyzeCollapse(ctx);
    setCollapse(result);
    saveNote('collapse', result.summary);
  }, [captureContext, saveNote]);

  const handleProfileStrength = useCallback(() => {
    const ctx = captureContext();
    if (!ctx) return;
    setActiveAction('profile-strength');
    const result = analyzeProfileStrength(ctx);
    setProfileStrength(result);
    saveNote('profile-strength', result.summary);
  }, [captureContext, saveNote]);

  const handleExaggeration = useCallback(() => {
    const ctx = captureContext();
    if (!ctx) return;
    setActiveAction('exaggeration');
    const result = analyzeExaggeration(ctx);
    setExaggeration(result);
    saveNote('exaggeration', result.summary);
  }, [captureContext, saveNote]);

  const handleVision = useCallback(async () => {
    if (!doc) return;
    setActiveAction('vision');
    setLoading(true);
    setVision(null);

    // Check availability first
    const avail = await checkOllamaAvailability(ollamaConfig);
    if (!avail.available) {
      setOllamaStatus(avail.error ?? `Model "${ollamaConfig.model}" not found. Available: ${avail.models.join(', ') || 'none'}`);
      setLoading(false);
      return;
    }
    setOllamaStatus(null);

    // Rasterize at a readable size for vision (64×64 upscaled context)
    const buf = captureCopilotRaster(doc, 64, 64);
    const result = await askVisionWhatDoesThisReadAs(buf, ollamaConfig);
    setVision(result);
    setLoading(false);

    if (result.ok) {
      saveNote('vision', result.description);
    }
  }, [doc, ollamaConfig, saveNote]);

  // ── Render ──

  if (!doc) {
    return (
      <div className="dock-panel-placeholder">
        <span className="placeholder-label">No vector document</span>
      </div>
    );
  }

  return (
    <div className="vector-copilot-panel">
      <div className="copilot-actions">
        <button
          className={`copilot-action-btn ${activeAction === 'top-changes' ? 'active' : ''}`}
          onClick={handleTopChanges}
          title="What 3 changes matter most?"
        >
          Top 3 Changes
        </button>
        <button
          className={`copilot-action-btn ${activeAction === 'collapse' ? 'active' : ''}`}
          onClick={handleCollapse}
          title="What will die at current target sizes?"
        >
          Collapse Check
        </button>
        <button
          className={`copilot-action-btn ${activeAction === 'profile-strength' ? 'active' : ''}`}
          onClick={handleProfileStrength}
          title="Which size profile reads strongest?"
        >
          Size Ranking
        </button>
        <button
          className={`copilot-action-btn ${activeAction === 'exaggeration' ? 'active' : ''}`}
          onClick={handleExaggeration}
          title="What should be exaggerated before reduction?"
        >
          Exaggeration
        </button>
        <button
          className={`copilot-action-btn vision-btn ${activeAction === 'vision' ? 'active' : ''}`}
          onClick={handleVision}
          disabled={loading}
          title="What does this read as? (requires Ollama)"
        >
          {loading ? 'Asking AI...' : 'What Is This?'}
        </button>
      </div>

      {activeProfiles.length === 0 && (
        <div className="copilot-warning">
          No active size profiles. Enable profiles in the Reduction tab for analysis.
        </div>
      )}

      <div className="copilot-result">
        {activeAction === 'top-changes' && topChanges && (
          <TopChangesResult data={topChanges} />
        )}
        {activeAction === 'collapse' && collapse && (
          <CollapseResult data={collapse} />
        )}
        {activeAction === 'profile-strength' && profileStrength && (
          <ProfileStrengthResult data={profileStrength} />
        )}
        {activeAction === 'exaggeration' && exaggeration && (
          <ExaggerationResult data={exaggeration} />
        )}
        {activeAction === 'vision' && (
          <VisionResult data={vision} loading={loading} ollamaStatus={ollamaStatus} />
        )}
      </div>

      {notes.length > 0 && (
        <div className="copilot-notes">
          <div className="copilot-notes-header">
            <span>Session Notes ({notes.length})</span>
            <button
              className="copilot-clear-btn"
              onClick={() => setNotes([])}
              title="Clear notes"
            >
              Clear
            </button>
          </div>
          <div className="copilot-notes-list">
            {notes.map((note, i) => (
              <div key={i} className="copilot-note">
                <span className="copilot-note-time">{note.timestamp}</span>
                <span className="copilot-note-content">{note.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function TopChangesResult({ data }: { data: TopChangesResponse }) {
  if (data.critiques.length === 0) {
    return <div className="copilot-all-clear">No critical issues found. Design looks solid.</div>;
  }
  return (
    <div className="copilot-critiques">
      {data.critiques.map((c, i) => (
        <div key={i} className={`copilot-critique severity-${c.severity}`}>
          <div className="critique-header">
            <span className={`severity-badge ${c.severity}`}>{c.severity}</span>
            <span className="critique-headline">{c.headline}</span>
          </div>
          <div className="critique-reason">{c.reason}</div>
          <div className="critique-suggestion">{c.suggestion}</div>
          {c.affectedShapes.length > 0 && (
            <div className="critique-shapes">Shapes: {c.affectedShapes.join(', ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function CollapseResult({ data }: { data: CollapseResponse }) {
  return (
    <div className="copilot-collapse">
      <div className="copilot-summary">{data.summary}</div>
      {data.alwaysDead.length > 0 && (
        <div className="collapse-group">
          <span className="collapse-label dead">Always collapse:</span>
          <span>{data.alwaysDead.join(', ')}</span>
        </div>
      )}
      {data.atRisk.length > 0 && (
        <div className="collapse-group">
          <span className="collapse-label risk">At risk:</span>
          <span>{data.atRisk.join(', ')}</span>
        </div>
      )}
      {data.criticalLosses.length > 0 && (
        <div className="collapse-group">
          <span className="collapse-label critical">Critical losses:</span>
          <span>{data.criticalLosses.join(', ')}</span>
        </div>
      )}
      {data.alwaysDead.length === 0 && data.atRisk.length === 0 && (
        <div className="copilot-all-clear">All shapes survive at every active target size.</div>
      )}
    </div>
  );
}

function ProfileStrengthResult({ data }: { data: ProfileComparisonResponse }) {
  return (
    <div className="copilot-profiles">
      <div className="copilot-summary">{data.summary}</div>
      {data.ranked.map((p) => (
        <div key={p.profileId} className="profile-rank-row">
          <span className="profile-rank-score">{p.score}</span>
          <span className="profile-rank-name">{p.name}</span>
          <span className="profile-rank-size">{p.size}</span>
          <span className="profile-rank-reason">{p.reason}</span>
        </div>
      ))}
    </div>
  );
}

function ExaggerationResult({ data }: { data: ExaggerationResponse }) {
  return (
    <div className="copilot-exaggeration">
      <div className="copilot-summary">{data.summary}</div>
      {data.recommendations.map((r, i) => (
        <div key={i} className="exaggeration-row">
          <span className="exaggeration-shape">{r.shapeName}</span>
          <span className="exaggeration-action">{r.action}</span>
          <span className="exaggeration-reason">{r.reason}</span>
        </div>
      ))}
    </div>
  );
}

function VisionResult({
  data,
  loading,
  ollamaStatus,
}: {
  data: VisionResponse | null;
  loading: boolean;
  ollamaStatus: string | null;
}) {
  if (loading) {
    return <div className="copilot-loading">Sending to Ollama vision model...</div>;
  }
  if (ollamaStatus) {
    return (
      <div className="copilot-ollama-error">
        <div className="copilot-error-title">Ollama unavailable</div>
        <div className="copilot-error-detail">{ollamaStatus}</div>
        <div className="copilot-error-hint">
          Run: <code>ollama pull llava</code> then <code>ollama serve</code>
        </div>
      </div>
    );
  }
  if (!data) return null;
  if (!data.ok) {
    return (
      <div className="copilot-ollama-error">
        <div className="copilot-error-title">Vision failed</div>
        <div className="copilot-error-detail">{data.error}</div>
      </div>
    );
  }
  return (
    <div className="copilot-vision-result">
      <div className="vision-description">{data.description}</div>
      <div className="vision-meta">
        {data.model} &middot; {(data.responseTimeMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}
