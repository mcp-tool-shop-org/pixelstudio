/** Workflow identifier. */
export type WorkflowId = string;

/** A single step in a workflow definition. */
export interface WorkflowStepDef {
  id: string;
  label: string;
  description: string;
  /** If true, this step can be skipped when its precondition isn't met. */
  skippable?: boolean;
}

/** Status of a single step in an active run. */
export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

/** Result of a completed/failed step. */
export interface WorkflowStepResult {
  stepId: string;
  status: WorkflowStepStatus;
  summary?: string;
  error?: string;
  durationMs?: number;
}

/** Definition of a workflow — what it does and what steps it contains. */
export interface WorkflowDef {
  id: WorkflowId;
  name: string;
  description: string;
  /** Category for grouping in the UI. */
  category: 'create' | 'analyze' | 'export';
  steps: WorkflowStepDef[];
}

/** State of an active workflow run. */
export type WorkflowRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/** An active or completed workflow run. */
export interface WorkflowRun {
  workflowId: WorkflowId;
  status: WorkflowRunStatus;
  currentStepIndex: number;
  stepResults: WorkflowStepResult[];
  startedAt: string;
  completedAt?: string;
}
