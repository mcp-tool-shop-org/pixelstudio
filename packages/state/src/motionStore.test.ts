import { describe, it, expect, beforeEach } from 'vitest';
import { useMotionStore } from './motionStore';
import type { MotionProposal } from '@glyphstudio/domain';

function makeProposal(id: string): MotionProposal {
  return {
    id,
    label: `Proposal ${id}`,
    description: 'Test proposal',
    previewFrames: [[], []],
    previewWidth: 8,
    previewHeight: 8,
  };
}

describe('motionStore', () => {
  beforeEach(() => {
    useMotionStore.getState().reset();
  });

  // --- Initial state ---

  it('starts in idle state', () => {
    const s = useMotionStore.getState();
    expect(s.status).toBe('idle');
    expect(s.sessionId).toBeNull();
    expect(s.proposals).toEqual([]);
    expect(s.selectedProposalId).toBeNull();
    expect(s.lastError).toBeNull();
    expect(s.panelMode).toBe('locomotion');
  });

  // --- Session lifecycle ---

  it('setSession populates all session fields', () => {
    useMotionStore.getState().setSession({
      sessionId: 'sess-1',
      intent: 'walk_cycle_stub',
      direction: 'right',
      targetMode: 'whole_frame',
      outputFrameCount: 4,
      sourceFrameId: 'frame-1',
      proposals: [makeProposal('p1')],
      selectedProposalId: 'p1',
      status: 'reviewing',
    });

    const s = useMotionStore.getState();
    expect(s.sessionId).toBe('sess-1');
    expect(s.intent).toBe('walk_cycle_stub');
    expect(s.direction).toBe('right');
    expect(s.targetMode).toBe('whole_frame');
    expect(s.outputFrameCount).toBe(4);
    expect(s.sourceFrameId).toBe('frame-1');
    expect(s.proposals).toHaveLength(1);
    expect(s.selectedProposalId).toBe('p1');
    expect(s.status).toBe('reviewing');
    expect(s.lastError).toBeNull(); // cleared on setSession
  });

  it('setSession clears previous error', () => {
    useMotionStore.getState().setError('something failed');
    expect(useMotionStore.getState().status).toBe('error');

    useMotionStore.getState().setSession({
      sessionId: 'sess-2',
      intent: 'idle_bob',
      direction: null,
      targetMode: 'whole_frame',
      outputFrameCount: 2,
      sourceFrameId: 'frame-1',
      proposals: [],
      selectedProposalId: null,
      status: 'configuring',
    });

    expect(useMotionStore.getState().lastError).toBeNull();
    expect(useMotionStore.getState().status).toBe('configuring');
  });

  // --- Field setters ---

  it('setIntent updates intent', () => {
    useMotionStore.getState().setIntent('hop');
    expect(useMotionStore.getState().intent).toBe('hop');
  });

  it('setDirection updates direction', () => {
    useMotionStore.getState().setDirection('left');
    expect(useMotionStore.getState().direction).toBe('left');
    useMotionStore.getState().setDirection(null);
    expect(useMotionStore.getState().direction).toBeNull();
  });

  it('setTargetMode updates target mode', () => {
    useMotionStore.getState().setTargetMode('anchor_binding');
    expect(useMotionStore.getState().targetMode).toBe('anchor_binding');
  });

  it('setOutputFrameCount updates count', () => {
    useMotionStore.getState().setOutputFrameCount(4);
    expect(useMotionStore.getState().outputFrameCount).toBe(4);
  });

  it('setProposals replaces proposals list', () => {
    useMotionStore.getState().setProposals([makeProposal('p1'), makeProposal('p2')]);
    expect(useMotionStore.getState().proposals).toHaveLength(2);
  });

  it('setSelectedProposalId updates selection', () => {
    useMotionStore.getState().setSelectedProposalId('p1');
    expect(useMotionStore.getState().selectedProposalId).toBe('p1');
  });

  it('setStatus updates status', () => {
    useMotionStore.getState().setStatus('generating');
    expect(useMotionStore.getState().status).toBe('generating');
  });

  it('setPanelMode updates panel mode', () => {
    useMotionStore.getState().setPanelMode('secondary');
    expect(useMotionStore.getState().panelMode).toBe('secondary');
  });

  // --- Error handling ---

  it('setError sets status to error and stores message', () => {
    useMotionStore.getState().setError('Region too small');
    const s = useMotionStore.getState();
    expect(s.status).toBe('error');
    expect(s.lastError).toBe('Region too small');
  });

  it('setError with null clears error but keeps error status', () => {
    useMotionStore.getState().setError('fail');
    useMotionStore.getState().setError(null);
    const s = useMotionStore.getState();
    expect(s.lastError).toBeNull();
    expect(s.status).toBe('error'); // status still error
  });

  // --- Reset ---

  it('reset restores initial state', () => {
    useMotionStore.getState().setSession({
      sessionId: 'sess-1',
      intent: 'hop',
      direction: 'left',
      targetMode: 'active_selection',
      outputFrameCount: 4,
      sourceFrameId: 'frame-1',
      proposals: [makeProposal('p1')],
      selectedProposalId: 'p1',
      status: 'reviewing',
    });
    useMotionStore.getState().reset();

    const s = useMotionStore.getState();
    expect(s.sessionId).toBeNull();
    expect(s.intent).toBe('idle_bob');
    expect(s.proposals).toEqual([]);
    expect(s.status).toBe('idle');
    expect(s.lastError).toBeNull();
  });
});
