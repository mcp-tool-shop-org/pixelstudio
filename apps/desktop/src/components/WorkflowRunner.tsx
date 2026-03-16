import { useWorkflowStore } from '@glyphstudio/state';
import type { WorkflowDef, WorkflowStepResult } from '@glyphstudio/domain';

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <span className="wf-step-icon completed">✓</span>;
    case 'skipped': return <span className="wf-step-icon skipped">—</span>;
    case 'failed': return <span className="wf-step-icon failed">✗</span>;
    case 'running': return <span className="wf-step-icon running">⋯</span>;
    default: return <span className="wf-step-icon pending">○</span>;
  }
}

function StepRow({ label, description, result, isActive }: {
  label: string;
  description: string;
  result?: WorkflowStepResult;
  isActive: boolean;
}) {
  const status = result?.status ?? (isActive ? 'running' : 'pending');
  return (
    <div className={`wf-step-row wf-step-${status}`} data-testid={`wf-step-${label}`}>
      <StepIcon status={status} />
      <div className="wf-step-body">
        <span className="wf-step-label">{label}</span>
        {result?.summary && <span className="wf-step-summary">{result.summary}</span>}
        {result?.error && <span className="wf-step-error">{result.error}</span>}
        {!result && !isActive && <span className="wf-step-desc">{description}</span>}
        {result?.durationMs !== undefined && result.durationMs > 0 && (
          <span className="wf-step-duration">{result.durationMs}ms</span>
        )}
      </div>
    </div>
  );
}

export function WorkflowRunner({ onClose }: { onClose: () => void }) {
  const workflows = useWorkflowStore((s) => s.workflows);
  const activeRun = useWorkflowStore((s) => s.activeRun);
  const clearRun = useWorkflowStore((s) => s.clearRun);

  if (!activeRun) return null;

  const def = workflows.find((w) => w.id === activeRun.workflowId);
  if (!def) return null;

  const isDone = activeRun.status === 'completed' || activeRun.status === 'failed' || activeRun.status === 'cancelled';

  return (
    <div className="wf-runner" data-testid="workflow-runner">
      <div className="wf-runner-header">
        <h3 className="wf-runner-title">{def.name}</h3>
        <span className={`wf-runner-status wf-status-${activeRun.status}`}>
          {activeRun.status}
        </span>
      </div>
      <p className="wf-runner-desc">{def.description}</p>

      <div className="wf-step-list" data-testid="wf-step-list">
        {def.steps.map((step, i) => {
          const result = activeRun.stepResults.find((r) => r.stepId === step.id);
          const isActive = activeRun.status === 'running' && i === activeRun.currentStepIndex && !result;
          return (
            <StepRow
              key={step.id}
              label={step.label}
              description={step.description}
              result={result}
              isActive={isActive}
            />
          );
        })}
      </div>

      {isDone && (
        <div className="wf-runner-footer">
          <button className="wf-close-btn" onClick={() => { clearRun(); onClose(); }} data-testid="wf-close">
            {activeRun.status === 'completed' ? 'Done' : 'Close'}
          </button>
        </div>
      )}
    </div>
  );
}
