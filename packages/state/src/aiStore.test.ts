import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from './aiStore';

function makeJob(id: string, status: 'queued' | 'running' | 'succeeded' | 'failed' = 'queued') {
  return {
    id,
    type: 'inbetween' as const,
    status,
    progress: null as number | null,
    resultCandidateIds: [] as string[],
    error: null as string | null,
  };
}

describe('aiStore', () => {
  beforeEach(() => {
    useAIStore.setState({
      jobsById: {},
      jobOrder: [],
      selectedCandidateId: null,
      resultsTrayOpen: false,
    });
  });

  // --- Job lifecycle ---

  it('starts empty', () => {
    const s = useAIStore.getState();
    expect(Object.keys(s.jobsById)).toHaveLength(0);
    expect(s.jobOrder).toEqual([]);
  });

  it('addJob stores job and appends to order', () => {
    useAIStore.getState().addJob(makeJob('j1'));
    const s = useAIStore.getState();
    expect(s.jobsById['j1']).toBeDefined();
    expect(s.jobOrder).toEqual(['j1']);
  });

  it('addJob preserves insertion order', () => {
    useAIStore.getState().addJob(makeJob('j1'));
    useAIStore.getState().addJob(makeJob('j2'));
    useAIStore.getState().addJob(makeJob('j3'));
    expect(useAIStore.getState().jobOrder).toEqual(['j1', 'j2', 'j3']);
  });

  it('updateJob patches fields', () => {
    useAIStore.getState().addJob(makeJob('j1'));
    useAIStore.getState().updateJob('j1', {
      status: 'running',
      progress: 0.5,
    });
    const j = useAIStore.getState().jobsById['j1'];
    expect(j.status).toBe('running');
    expect(j.progress).toBe(0.5);
  });

  it('updateJob to succeeded with candidates', () => {
    useAIStore.getState().addJob(makeJob('j1'));
    useAIStore.getState().updateJob('j1', {
      status: 'succeeded',
      progress: 1.0,
      resultCandidateIds: ['c1', 'c2'],
    });
    const j = useAIStore.getState().jobsById['j1'];
    expect(j.status).toBe('succeeded');
    expect(j.resultCandidateIds).toEqual(['c1', 'c2']);
  });

  it('updateJob to failed with error', () => {
    useAIStore.getState().addJob(makeJob('j1'));
    useAIStore.getState().updateJob('j1', {
      status: 'failed',
      error: 'ComfyUI timeout',
    });
    const j = useAIStore.getState().jobsById['j1'];
    expect(j.status).toBe('failed');
    expect(j.error).toBe('ComfyUI timeout');
  });

  it('updateJob does not affect other jobs', () => {
    useAIStore.getState().addJob(makeJob('j1'));
    useAIStore.getState().addJob(makeJob('j2'));
    useAIStore.getState().updateJob('j1', { status: 'running' });
    expect(useAIStore.getState().jobsById['j2'].status).toBe('queued');
  });

  // --- Candidate selection ---

  it('selectCandidate sets and clears', () => {
    useAIStore.getState().selectCandidate('c1');
    expect(useAIStore.getState().selectedCandidateId).toBe('c1');
    useAIStore.getState().selectCandidate(null);
    expect(useAIStore.getState().selectedCandidateId).toBeNull();
  });

  // --- Results tray ---

  it('toggleResultsTray flips state', () => {
    expect(useAIStore.getState().resultsTrayOpen).toBe(false);
    useAIStore.getState().toggleResultsTray();
    expect(useAIStore.getState().resultsTrayOpen).toBe(true);
    useAIStore.getState().toggleResultsTray();
    expect(useAIStore.getState().resultsTrayOpen).toBe(false);
  });
});
