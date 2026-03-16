import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from './workflowStore';
import type { WorkflowDef, WorkflowStepResult } from '@glyphstudio/domain';

const TEST_WORKFLOW: WorkflowDef = {
  id: 'test-wf',
  name: 'Test Workflow',
  description: 'A test workflow',
  category: 'analyze',
  steps: [
    { id: 's1', label: 'Step 1', description: 'First step' },
    { id: 's2', label: 'Step 2', description: 'Second step' },
    { id: 's3', label: 'Step 3', description: 'Third step' },
  ],
};

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ workflows: [], activeRun: null });
  });

  it('starts with empty state', () => {
    const state = useWorkflowStore.getState();
    expect(state.workflows).toEqual([]);
    expect(state.activeRun).toBeNull();
  });

  it('registerWorkflows sets workflow list', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    expect(useWorkflowStore.getState().workflows).toHaveLength(1);
    expect(useWorkflowStore.getState().workflows[0].id).toBe('test-wf');
  });

  it('startRun creates an active run', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');
    const run = useWorkflowStore.getState().activeRun;
    expect(run).not.toBeNull();
    expect(run!.workflowId).toBe('test-wf');
    expect(run!.status).toBe('running');
    expect(run!.currentStepIndex).toBe(0);
    expect(run!.stepResults).toHaveLength(0);
  });

  it('startRun ignores unknown workflow id', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('nonexistent');
    expect(useWorkflowStore.getState().activeRun).toBeNull();
  });

  it('advanceStep records result and moves to next step', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');

    const result: WorkflowStepResult = { stepId: 's1', status: 'completed', summary: 'Done' };
    useWorkflowStore.getState().advanceStep(result);

    const run = useWorkflowStore.getState().activeRun!;
    expect(run.stepResults).toHaveLength(1);
    expect(run.currentStepIndex).toBe(1);
    expect(run.status).toBe('running');
  });

  it('advanceStep on last step completes the run', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');

    useWorkflowStore.getState().advanceStep({ stepId: 's1', status: 'completed' });
    useWorkflowStore.getState().advanceStep({ stepId: 's2', status: 'completed' });
    useWorkflowStore.getState().advanceStep({ stepId: 's3', status: 'completed' });

    const run = useWorkflowStore.getState().activeRun!;
    expect(run.status).toBe('completed');
    expect(run.completedAt).toBeTruthy();
    expect(run.stepResults).toHaveLength(3);
  });

  it('failRun sets status to failed with error', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');
    useWorkflowStore.getState().failRun('Something went wrong');

    const run = useWorkflowStore.getState().activeRun!;
    expect(run.status).toBe('failed');
    expect(run.completedAt).toBeTruthy();
    expect(run.stepResults.some((r) => r.status === 'failed')).toBe(true);
  });

  it('cancelRun sets status to cancelled', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');
    useWorkflowStore.getState().cancelRun();

    const run = useWorkflowStore.getState().activeRun!;
    expect(run.status).toBe('cancelled');
    expect(run.completedAt).toBeTruthy();
  });

  it('clearRun removes the active run', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');
    useWorkflowStore.getState().clearRun();
    expect(useWorkflowStore.getState().activeRun).toBeNull();
  });

  it('advanceStep with skipped status still advances', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');
    useWorkflowStore.getState().advanceStep({ stepId: 's1', status: 'skipped', summary: 'Not needed' });

    const run = useWorkflowStore.getState().activeRun!;
    expect(run.currentStepIndex).toBe(1);
    expect(run.stepResults[0].status).toBe('skipped');
  });

  it('completeRun forces completion', () => {
    useWorkflowStore.getState().registerWorkflows([TEST_WORKFLOW]);
    useWorkflowStore.getState().startRun('test-wf');
    useWorkflowStore.getState().completeRun();

    const run = useWorkflowStore.getState().activeRun!;
    expect(run.status).toBe('completed');
  });
});
