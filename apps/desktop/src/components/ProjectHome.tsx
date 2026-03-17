import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useWorkflowStore } from '@glyphstudio/state';
import type { WorkflowDef, WorkspaceMode } from '@glyphstudio/domain';
import { ALL_WORKFLOWS } from '../workflows/definitions';
import { executeWorkflow, type WorkflowInputs } from '../workflows/executor';
import { WorkflowRunner } from './WorkflowRunner';
import { toast } from '../lib/toast';

interface ProjectHomeProps {
  onEnterWorkspace: (mode?: WorkspaceMode) => void;
}

const SIZE_PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: '16', w: 16, h: 16 },
  { label: '32', w: 32, h: 32 },
  { label: '48', w: 48, h: 48 },
  { label: '64', w: 64, h: 64 },
  { label: '128', w: 128, h: 128 },
  { label: '32×48', w: 32, h: 48 },
];

function CreateForm({ onRun }: { onRun: (wfId: string, inputs: WorkflowInputs) => void }) {
  const [name, setName] = useState('Untitled');
  const [width, setWidth] = useState(64);
  const [height, setHeight] = useState(64);
  const [frameCount, setFrameCount] = useState(4);
  const [frameDuration, setFrameDuration] = useState(100);
  const [mode, setMode] = useState<'static' | 'animation'>('static');

  return (
    <div className="ph-create-form" data-testid="create-form">
      <h3>New Sprite</h3>
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
            title={`${p.w}×${p.h}`}
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

  useEffect(() => {
    registerWorkflows(ALL_WORKFLOWS);
  }, [registerWorkflows]);

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

  const isRunning = activeRun?.status === 'running';

  // Separate creation workflows from tool workflows
  const toolWorkflows = workflows.filter((w) => w.category !== 'create');

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
                Open Project…
              </button>
            </div>
            <CreateForm onRun={handleRunWorkflow} />
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
