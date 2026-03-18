import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useWorkflowStore, useSpriteEditorStore } from '@glyphstudio/state';
import { parsePack, addPartToLibrary, deriveImportName } from '@glyphstudio/state';
import type { SavedTemplate, SavedPack } from '@glyphstudio/state';
import type { Part } from '@glyphstudio/domain';
import { generatePartId } from '@glyphstudio/domain';
import type { WorkflowDef, WorkspaceMode } from '@glyphstudio/domain';
import { ALL_WORKFLOWS } from '../workflows/definitions';
import { executeWorkflow, type WorkflowInputs } from '../workflows/executor';
import { WorkflowRunner } from './WorkflowRunner';
import { toast } from '../lib/toast';
import { loadTemplateLibrary } from '../lib/templateLibraryStorage';
import { loadPackLibrary } from '../lib/packLibraryStorage';
import { loadPartLibrary, savePartLibrary } from '../lib/partLibraryStorage';

interface ProjectHomeProps {
  onEnterWorkspace: (mode?: WorkspaceMode) => void;
}

type StartMode = 'blank' | 'template' | 'pack';

const SIZE_PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: '16', w: 16, h: 16 },
  { label: '32', w: 32, h: 32 },
  { label: '48', w: 48, h: 48 },
  { label: '64', w: 64, h: 64 },
  { label: '128', w: 128, h: 128 },
  { label: '32\u00D748', w: 32, h: 48 },
];

const PINNED_STARTS_KEY = 'glyphstudio_pinned_starts';

function loadPinnedStarts(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STARTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePinnedStarts(ids: string[]): void {
  try { localStorage.setItem(PINNED_STARTS_KEY, JSON.stringify(ids)); } catch {}
}

function CreateForm({ onRun }: { onRun: (wfId: string, inputs: WorkflowInputs) => void }) {
  const [name, setName] = useState('Untitled');
  const [width, setWidth] = useState(64);
  const [height, setHeight] = useState(64);
  const [frameCount, setFrameCount] = useState(4);
  const [frameDuration, setFrameDuration] = useState(100);
  const [mode, setMode] = useState<'static' | 'animation'>('static');

  return (
    <div className="ph-create-form" data-testid="create-form">
      <label className="ph-field">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} data-testid="create-name" />
      </label>
      <div className="ph-field-row">
        <label className="ph-field">
          Width
          <input type="number" value={width} min={1} max={1024} onChange={(e) => setWidth(Number(e.target.value))} data-testid="create-width" />
        </label>
        <label className="ph-field">
          Height
          <input type="number" value={height} min={1} max={1024} onChange={(e) => setHeight(Number(e.target.value))} data-testid="create-height" />
        </label>
      </div>
      <div className="ph-size-presets" data-testid="size-presets">
        {SIZE_PRESETS.map((p) => (
          <button
            key={p.label}
            className={`ph-preset-btn${width === p.w && height === p.h ? ' active' : ''}`}
            onClick={() => { setWidth(p.w); setHeight(p.h); }}
            data-testid={`preset-${p.label}`}
            title={`${p.w}\u00D7${p.h}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="ph-mode-toggle" data-testid="create-mode-toggle">
        <button className={mode === 'static' ? 'active' : ''} onClick={() => setMode('static')}>Static</button>
        <button className={mode === 'animation' ? 'active' : ''} onClick={() => setMode('animation')}>Animation</button>
      </div>
      {mode === 'animation' && (
        <div className="ph-field-row">
          <label className="ph-field">
            Frames
            <input type="number" value={frameCount} min={2} max={64} onChange={(e) => setFrameCount(Number(e.target.value))} data-testid="create-frames" />
          </label>
          <label className="ph-field">
            Duration (ms)
            <input type="number" value={frameDuration} min={16} max={2000} onChange={(e) => setFrameDuration(Number(e.target.value))} data-testid="create-duration" />
          </label>
        </div>
      )}
      <button
        className="btn-primary ph-create-btn"
        onClick={() => {
          const wfId = mode === 'static' ? 'new-static-sprite' : 'new-animation-sprite';
          onRun(wfId, { name, width, height, frameCount, frameDurationMs: frameDuration });
        }}
        data-testid="create-run"
      >
        Create
      </button>
    </div>
  );
}

function StartCard({
  id,
  name,
  meta,
  description,
  isPinned,
  onStart,
  onTogglePin,
  testId,
}: {
  id: string;
  name: string;
  meta: string;
  description?: string;
  isPinned: boolean;
  onStart: () => void;
  onTogglePin: () => void;
  testId: string;
}) {
  return (
    <div className="ph-start-card" data-testid={testId}>
      <button className="ph-start-card-main" onClick={onStart}>
        <span className="ph-start-card-name">{name}</span>
        <span className="ph-start-card-meta">{meta}</span>
        {description && <span className="ph-start-card-desc">{description}</span>}
      </button>
      <button
        className={`ph-start-pin${isPinned ? ' pinned' : ''}`}
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        title={isPinned ? 'Unpin' : 'Pin to top'}
        data-testid={`${testId}-pin`}
      >
        {isPinned ? '\u2759' : '\u25CB'}
      </button>
    </div>
  );
}

function WorkflowCard({ def, onRun, disabled }: { def: WorkflowDef; onRun: () => void; disabled: boolean }) {
  return (
    <button className="ph-workflow-card" onClick={onRun} disabled={disabled} data-testid={`wf-card-${def.id}`}>
      <span className="ph-wf-name">{def.name}</span>
      <span className="ph-wf-desc">{def.description}</span>
      <span className="ph-wf-category">{def.category}</span>
    </button>
  );
}

export function ProjectHome({ onEnterWorkspace }: ProjectHomeProps) {
  const registerWorkflows = useWorkflowStore((s) => s.registerWorkflows);
  const activeRun = useWorkflowStore((s) => s.activeRun);
  const workflows = useWorkflowStore((s) => s.workflows);

  const [startMode, setStartMode] = useState<StartMode>('blank');
  const [templates] = useState(() => loadTemplateLibrary().templates);
  const [packs] = useState(() => loadPackLibrary().packs);
  const [pinnedIds, setPinnedIds] = useState(() => loadPinnedStarts());

  const hasTemplates = templates.length > 0;
  const hasPacks = packs.length > 0;

  useEffect(() => {
    registerWorkflows(ALL_WORKFLOWS);
  }, [registerWorkflows]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      savePinnedStarts(next);
      return next;
    });
  }, []);

  const handleOpen = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'GlyphStudio Project', extensions: ['pxs'] }],
        multiple: false,
      });
      if (!filePath || typeof filePath !== 'string') return;
      await invoke('open_project', { filePath });
      onEnterWorkspace('edit');
    } catch (err) {
      console.error('open_project failed:', err);
      toast.error('Failed to open project');
    }
  };

  const handleRunWorkflow = (wfId: string, inputs: WorkflowInputs = {}) => {
    const def = workflows.find((w) => w.id === wfId);
    if (!def) return;
    const fullInputs: WorkflowInputs = {
      ...inputs,
      setMode: (m: string) => onEnterWorkspace(m as WorkspaceMode),
    };
    executeWorkflow(def, fullInputs);
  };

  const handleTemplateStart = useCallback((json: string) => {
    const err = useSpriteEditorStore.getState().newDocumentFromTemplate(json);
    if (err) {
      toast.error(`Template error: ${err}`);
    } else {
      onEnterWorkspace('edit');
    }
  }, [onEnterWorkspace]);

  const handlePackStart = useCallback((pack: SavedPack) => {
    // Create blank document with default size, then apply pack assets
    useSpriteEditorStore.getState().newDocument('Untitled', 64, 64);

    // Parse and apply pack contents
    const doc = useSpriteEditorStore.getState().document;
    if (!doc) return;

    const result = parsePack(pack.interchangeJson, [], []);
    if ('error' in result) {
      toast.error(`Pack error: ${result.error}`);
      return;
    }

    // Import palette sets
    for (const ps of result.paletteSets) {
      const newId = useSpriteEditorStore.getState().createPaletteSet(ps.name);
      if (newId) {
        const currentDoc = useSpriteEditorStore.getState().document!;
        const updatedSets = currentDoc.paletteSets!.map((s) =>
          s.id === newId ? { ...s, colors: ps.colors.map((c) => ({ rgba: c.rgba, name: c.name })) } : s,
        );
        useSpriteEditorStore.setState({ document: { ...currentDoc, paletteSets: updatedSets } });
      }
    }

    // Import parts
    let partLib = loadPartLibrary();
    for (const p of result.parts) {
      const now = new Date().toISOString();
      const part: Part = {
        id: generatePartId(),
        name: p.name,
        width: p.width,
        height: p.height,
        pixelData: [...p.pixelData],
        tags: p.tags ? [...p.tags] : undefined,
        createdAt: now,
        updatedAt: now,
      };
      partLib = addPartToLibrary(partLib, part);
    }
    savePartLibrary(partLib);

    useSpriteEditorStore.setState({ dirty: false });
    onEnterWorkspace('edit');
  }, [onEnterWorkspace]);

  const isRunning = activeRun?.status === 'running';
  const toolWorkflows = workflows.filter((w) => w.category !== 'create');
  const pinnedSet = new Set(pinnedIds);

  // Sort pinned to top
  const sortedTemplates = [...templates].sort((a, b) => {
    const ap = pinnedSet.has(a.id) ? 0 : 1;
    const bp = pinnedSet.has(b.id) ? 0 : 1;
    return ap - bp;
  });

  const sortedPacks = [...packs].sort((a, b) => {
    const ap = pinnedSet.has(a.id) ? 0 : 1;
    const bp = pinnedSet.has(b.id) ? 0 : 1;
    return ap - bp;
  });

  return (
    <div className="project-home" data-testid="project-home">
      {activeRun ? (
        <div className="ph-runner-container">
          <WorkflowRunner onClose={() => {}} />
        </div>
      ) : (
        <>
          <div className="project-home-left">
            <h1 className="project-home-title">GlyphStudio</h1>
            <p className="project-home-tagline">
              Build sprites with deterministic tools first. AI stays in the passenger seat.
            </p>
            <div className="ph-open-row">
              <button className="btn-secondary ph-open-btn" onClick={handleOpen} data-testid="open-project-btn">
                Open Project...
              </button>
            </div>

            {/* Start mode tabs */}
            <div className="ph-start-tabs" data-testid="start-tabs">
              <button
                className={`ph-start-tab${startMode === 'blank' ? ' active' : ''}`}
                onClick={() => setStartMode('blank')}
                data-testid="start-tab-blank"
              >
                Blank
              </button>
              {hasTemplates && (
                <button
                  className={`ph-start-tab${startMode === 'template' ? ' active' : ''}`}
                  onClick={() => setStartMode('template')}
                  data-testid="start-tab-template"
                >
                  Templates ({templates.length})
                </button>
              )}
              {hasPacks && (
                <button
                  className={`ph-start-tab${startMode === 'pack' ? ' active' : ''}`}
                  onClick={() => setStartMode('pack')}
                  data-testid="start-tab-pack"
                >
                  Packs ({packs.length})
                </button>
              )}
            </div>

            {/* Start content */}
            {startMode === 'blank' && (
              <CreateForm onRun={handleRunWorkflow} />
            )}

            {startMode === 'template' && (
              <div className="ph-start-list" data-testid="template-list">
                {sortedTemplates.map((tmpl) => (
                  <StartCard
                    key={tmpl.id}
                    id={tmpl.id}
                    name={tmpl.name}
                    meta={`${tmpl.canvasWidth}\u00D7${tmpl.canvasHeight}`}
                    description={tmpl.description}
                    isPinned={pinnedSet.has(tmpl.id)}
                    onStart={() => handleTemplateStart(tmpl.interchangeJson)}
                    onTogglePin={() => togglePin(tmpl.id)}
                    testId={`template-${tmpl.id}`}
                  />
                ))}
              </div>
            )}

            {startMode === 'pack' && (
              <div className="ph-start-list" data-testid="pack-list">
                {sortedPacks.map((pack) => (
                  <StartCard
                    key={pack.id}
                    id={pack.id}
                    name={pack.name}
                    meta={`${pack.paletteSetCount} palette${pack.paletteSetCount !== 1 ? 's' : ''}, ${pack.partCount} part${pack.partCount !== 1 ? 's' : ''}`}
                    description={pack.description}
                    isPinned={pinnedSet.has(pack.id)}
                    onStart={() => handlePackStart(pack)}
                    onTogglePin={() => togglePin(pack.id)}
                    testId={`pack-${pack.id}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="project-home-right">
            <h3>Workflows</h3>
            <div className="ph-workflow-list" data-testid="workflow-list">
              {toolWorkflows.map((def) => (
                <WorkflowCard
                  key={def.id}
                  def={def}
                  onRun={() => handleRunWorkflow(def.id)}
                  disabled={isRunning}
                />
              ))}
            </div>
            {toolWorkflows.length === 0 && (
              <p className="text-muted">No workflows available</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
